// ============================================================
// POST /api/compras/ordenes/[id]/enviar
//
// Le manda la orden de compra al proveedor por correo y la pasa a
// ENVIADA. Este es el "pedido con un solo botón".
//
// Si el envío falla, la orden NO cambia de estado y el error queda
// guardado: es peor creer que el proveedor recibió el pedido y que no
// llegue, que ver un error y reintentar.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { enviarCorreo } from "@/lib/correo";
import { formatCOP } from "@/lib/utils";
import type { ItemOrden } from "../../route";

type P = { params: Promise<{ id: string }> };

/** Datos de Costamallas para el encabezado del correo. */
async function datosEmpresa() {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: ["empresa_nombre", "empresa_nit", "empresa_telefono", "empresa_email", "empresa_direccion"] } },
    select: { clave: true, valor: true },
  });
  const m = Object.fromEntries(filas.map(f => [f.clave, f.valor]));
  return {
    nombre: m.empresa_nombre || "Costamallas",
    nit: m.empresa_nit || "",
    telefono: m.empresa_telefono || "",
    email: m.empresa_email || "",
    direccion: m.empresa_direccion || "",
  };
}

function plantilla(o: {
  numero: string; proveedor: string; contacto: string | null; items: ItemOrden[];
  total: number; notas: string | null; fechaEsperada: Date | null;
  empresa: Awaited<ReturnType<typeof datosEmpresa>>;
}) {
  const filas = o.items
    .map(
      i => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${i.sku}${i.referenciaProveedor ? `<br><small style="color:#888">Ref: ${i.referenciaProveedor}</small>` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${i.descripcion}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.cantidad}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.precioUnitario ? formatCOP(i.precioUnitario) : "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${i.subtotal ? formatCOP(i.subtotal) : "—"}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="max-width:680px;margin:0 auto;background:#fff">
    <div style="background:#f9df1e;padding:20px 24px">
      <h1 style="margin:0;font-size:19px;color:#0f172a">Orden de compra ${o.numero}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#0f172a">${o.empresa.nombre}${o.empresa.nit ? ` · NIT ${o.empresa.nit}` : ""}</p>
    </div>
    <div style="padding:24px">
      <p style="font-size:14px;color:#334155;margin:0 0 16px">
        ${o.contacto ? `Hola ${o.contacto},` : "Buen día,"}<br>
        Les enviamos la siguiente orden de compra${o.fechaEsperada ? ` con fecha de entrega esperada el <strong>${o.fechaEsperada.toLocaleDateString("es-CO")}</strong>` : ""}.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">SKU</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0">Producto</th>
            <th style="padding:8px;text-align:right;border-bottom:2px solid #e2e8f0">Cant.</th>
            <th style="padding:8px;text-align:right;border-bottom:2px solid #e2e8f0">Unitario</th>
            <th style="padding:8px;text-align:right;border-bottom:2px solid #e2e8f0">Subtotal</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:10px 8px;text-align:right;font-weight:700">Total</td>
            <td style="padding:10px 8px;text-align:right;font-weight:700">${o.total ? formatCOP(o.total) : "A convenir"}</td>
          </tr>
        </tfoot>
      </table>
      ${o.notas ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569"><strong>Observaciones:</strong><br>${o.notas.replace(/\n/g, "<br>")}</div>` : ""}
      <p style="font-size:13px;color:#64748b;margin-top:22px">
        Por favor confirmen recepción y fecha de entrega respondiendo a este correo.
      </p>
    </div>
    <div style="padding:16px 24px;background:#0f172a;color:#94a3b8;font-size:11px">
      ${o.empresa.nombre}${o.empresa.direccion ? ` · ${o.empresa.direccion}` : ""}${o.empresa.telefono ? ` · Tel. ${o.empresa.telefono}` : ""}
    </div>
  </div></body></html>`;
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { proveedor: true },
  });
  if (!orden) return NextResponse.json({ success: false, error: "La orden no existe" }, { status: 404 });

  if (orden.estado === "CANCELADA") {
    return NextResponse.json({ success: false, error: "La orden está cancelada" }, { status: 400 });
  }

  const destino = orden.proveedor.email?.trim();
  if (!destino) {
    return NextResponse.json(
      {
        success: false,
        error: `"${orden.proveedor.nombre}" no tiene correo registrado. Agrégalo en su ficha para poder enviarle pedidos.`,
      },
      { status: 400 },
    );
  }

  const items = (orden.items as unknown as ItemOrden[]) ?? [];
  const empresa = await datosEmpresa();
  const copia = orden.proveedor.emailAlterno?.trim() ? [orden.proveedor.emailAlterno.trim()] : undefined;

  try {
    await enviarCorreo({
      para: destino,
      copia,
      responderA: empresa.email || undefined,
      asunto: `Orden de compra ${orden.numero} — ${empresa.nombre}`,
      html: plantilla({
        numero: orden.numero,
        proveedor: orden.proveedor.nombre,
        contacto: orden.proveedor.contacto,
        items,
        total: Number(orden.total),
        notas: orden.notas,
        fechaEsperada: orden.fechaEsperada,
        empresa,
      }),
      texto:
        `Orden de compra ${orden.numero} — ${empresa.nombre}\n\n` +
        items.map(i => `· ${i.cantidad} x ${i.sku} — ${i.descripcion}`).join("\n") +
        `\n\nTotal: ${Number(orden.total) ? formatCOP(Number(orden.total)) : "A convenir"}` +
        (orden.notas ? `\n\nObservaciones: ${orden.notas}` : ""),
    });
  } catch (e) {
    const mensaje = (e as Error).message;
    // El estado NO cambia: la orden sigue como estaba y se puede reintentar.
    await prisma.ordenCompra.update({ where: { id }, data: { errorEnvio: mensaje } });
    await prisma.log
      .create({
        data: {
          usuarioId: user.sub,
          accion: "COMPRA_ORDEN_ENVIO_FALLIDO",
          detalle: `${orden.numero} → ${destino}`,
          resultado: mensaje.slice(0, 300),
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ success: false, error: mensaje }, { status: 500 });
  }

  const actualizada = await prisma.ordenCompra.update({
    where: { id },
    data: {
      estado: orden.estado === "BORRADOR" ? "ENVIADA" : orden.estado,
      enviadaEn: new Date(),
      enviadaAEmail: destino,
      errorEnvio: null,
    },
  });

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: "COMPRA_ORDEN_ENVIADA",
        detalle: `${orden.numero} → ${destino}`,
        resultado: "OK",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    success: true,
    data: { ...actualizada, total: Number(actualizada.total) },
    mensaje: `Orden enviada a ${destino}${copia ? ` (con copia a ${copia[0]})` : ""}`,
  });
}
