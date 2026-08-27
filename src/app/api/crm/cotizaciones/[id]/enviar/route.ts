// ============================================================
// POST /api/crm/cotizaciones/[id]/enviar
//
// Le manda la cotización al cliente por correo, con el enlace a la
// versión web (desde donde puede descargarla en PDF) y un resumen.
//
// Se manda el ENLACE y no un PDF adjunto a propósito: el enlace deja
// saber si el cliente la abrió, que es lo que dispara el seguimiento.
// Un adjunto llega y no se sabe si alguien lo miró.
//
// Al enviar, la cotización pasa a ENVIADA: mientras es borrador el
// enlace público no muestra nada.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { urlPortal } from "@/lib/url-portal";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { enviarCorreo } from "@/lib/correo";
import { getMarca } from "@/lib/marca";
import { formatCOP } from "@/lib/utils";

type P = { params: Promise<{ id: string }> };

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const cot = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true, empresa: true, email: true } },
      vendedor: { select: { nombre: true, email: true, telefono: true } },
      items: { orderBy: { orden: "asc" } },
    },
  });
  if (!cot) return NextResponse.json({ success: false, error: "La cotización no existe" }, { status: 404 });

  // Una oferta fuera de la política comercial no sale sin visto bueno.
  // Se para aquí y no al aprobar: mandarla ya es prometerle el precio al
  // cliente, y desdecirse después cuesta más que la venta.
  if (cot.aprobacionEstado === "PENDIENTE") {
    return NextResponse.json(
      {
        success: false,
        error: `Esta oferta necesita el visto bueno de un administrador antes de enviarse. ${cot.aprobacionMotivo ?? ""}`.trim(),
      },
      { status: 400 },
    );
  }
  if (cot.aprobacionEstado === "RECHAZADA") {
    return NextResponse.json(
      { success: false, error: "Un administrador rechazó estas condiciones. Ajusta el descuento o el anticipo antes de enviarla." },
      { status: 400 },
    );
  }

  const destino = cot.cliente.email?.trim();
  if (!destino) {
    return NextResponse.json(
      { success: false, error: `${cot.cliente.nombre} no tiene correo registrado en el CRM.` },
      { status: 400 },
    );
  }

  // Una cotización vieja puede no tener token todavía.
  const publicId = cot.publicId ?? randomBytes(16).toString("base64url");

  const marca = await getMarca();
  // El enlace tiene que apuntar al PORTAL. Con NEXT_PUBLIC_APP_URL
  // apuntaba a la tienda: el cliente abría el correo y veía un 404
  // de WordPress. No se habia notado porque el correo nunca ha
  // llegado a salir — falta el SMTP.
  const base = urlPortal(req);
  const enlace = `${base}/cotizacion/${publicId}`;

  const vence = new Date(cot.createdAt.getTime() + cot.validezDias * 86400000)
    .toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  const filas = cot.items
    .map(i => `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #eee;font-size:13px;color:#2b2d29">
        ${i.descripcion}${i.tipo === "INSTALACION" ? ' <span style="background:#11110f;color:#ffdd00;font-size:9px;font-weight:700;padding:2px 6px;text-transform:uppercase">Servicio</span>' : ""}
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #eee;text-align:right;font-size:13px;color:#6b6f6a;white-space:nowrap">
        ${Number(i.cantidad).toLocaleString("es-CO")} ${i.unidad ?? ""}
      </td>
      <td style="padding:9px 0 9px 14px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:700;color:#11110f;white-space:nowrap">
        ${formatCOP(Number(i.subtotal))}
      </td>
    </tr>`)
    .join("");

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#e9ecef;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff">
    <div style="background:${NEGRO};padding:26px 28px">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${AMARILLO}">${marca.companyName}</p>
      <h1 style="margin:8px 0 0;font-size:26px;line-height:1;color:#fff;text-transform:uppercase;font-weight:900">Su cotización<br>${cot.numero}</h1>
    </div>
    <div style="height:4px;background:${AMARILLO}"></div>

    <div style="padding:26px 28px">
      <p style="margin:0 0 16px;font-size:14px;color:#2b2d29;line-height:1.6">
        ${cot.cliente.empresa ? `Buen día, ${cot.cliente.empresa}` : `Buen día, ${cot.cliente.nombre}`}:<br>
        Adjuntamos la oferta que preparamos para usted. Puede verla completa y descargarla en PDF desde el botón de abajo.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:18px 0">
        <tbody>${filas}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;background:${NEGRO}">
        <tr>
          <td style="padding:14px 16px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fff">Total</td>
          <td style="padding:14px 16px;text-align:right;font-size:22px;font-weight:900;color:${AMARILLO}">${formatCOP(Number(cot.total))}</td>
        </tr>
      </table>

      <p style="margin:20px 0;text-align:center">
        <a href="${enlace}" style="display:inline-block;background:${AMARILLO};color:${NEGRO};text-decoration:none;padding:14px 30px;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.03em">
          Ver la cotización
        </a>
      </p>

      <p style="margin:0;font-size:13px;color:#6b6f6a;line-height:1.6">
        Esta oferta es válida hasta el <strong>${vence}</strong>.
        Cualquier ajuste que necesite para avanzar, respóndanos este correo.
      </p>

      <div style="margin-top:22px;padding-left:14px;border-left:4px solid ${AMARILLO}">
        <p style="margin:0;font-size:13px;font-weight:800;color:#11110f">${cot.vendedor?.nombre ?? marca.companyName}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b6f6a">
          ${[cot.vendedor?.telefono || marca.phone, cot.vendedor?.email || marca.email].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>

    <div style="padding:16px 28px;background:${NEGRO};color:rgba(255,255,255,.45);font-size:11px">
      ${marca.companyName}${marca.nit ? ` · NIT ${marca.nit}` : ""}${marca.address ? ` · ${marca.address}` : ""}
    </div>
  </div></body></html>`;

  try {
    await enviarCorreo({
      para: destino,
      responderA: cot.vendedor?.email || marca.email || undefined,
      asunto: `Cotización ${cot.numero} — ${marca.companyName}`,
      html,
      texto:
        `Cotización ${cot.numero} — ${marca.companyName}\n\n` +
        cot.items.map(i => `· ${Number(i.cantidad).toLocaleString("es-CO")} ${i.unidad ?? ""} — ${i.descripcion}`).join("\n") +
        `\n\nTotal: ${formatCOP(Number(cot.total))}\nVálida hasta el ${vence}\n\nVerla: ${enlace}`,
    });
  } catch (e) {
    const mensaje = (e as Error).message;
    // El estado NO cambia: se puede reintentar sabiendo por qué falló.
    await prisma.cotizacion.update({ where: { id }, data: { errorEnvio: mensaje, publicId } });
    return NextResponse.json({ success: false, error: mensaje }, { status: 500 });
  }

  await prisma.cotizacion.update({
    where: { id },
    data: {
      publicId,
      estado: cot.estado === "BORRADOR" ? "ENVIADA" : cot.estado,
      enviadaEn: new Date(),
      enviadaAEmail: destino,
      errorEnvio: null,
    },
  });

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: "COTIZACION_ENVIADA",
        detalle: `${cot.numero} → ${destino}`,
        resultado: "OK",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ success: true, mensaje: `Cotización enviada a ${destino}`, enlace });
}
