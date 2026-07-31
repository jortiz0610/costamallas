// ============================================================
// POST /api/facturacion/facturas/[id]/recordatorio
//
// Le manda al cliente un recordatorio de pago con el saldo pendiente.
// El tono cambia según cuánto lleve vencida: no es lo mismo avisar de
// algo que vence pasado mañana que cobrar algo de hace tres meses.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { enviarCorreo } from "@/lib/correo";
import { formatCOP } from "@/lib/utils";

type P = { params: Promise<{ id: string }> };
const DIA = 86_400_000;

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const factura = await prisma.factura.findUnique({
    where: { id },
    include: { cliente: { select: { nombre: true, empresa: true, email: true } } },
  });
  if (!factura) return NextResponse.json({ success: false, error: "La factura no existe" }, { status: 404 });

  const saldo = Number(factura.saldoPendiente);
  if (saldo <= 0) {
    return NextResponse.json({ success: false, error: "Esta factura ya está pagada" }, { status: 400 });
  }
  if (factura.estado === "ANULADA" || factura.estado === "BORRADOR") {
    return NextResponse.json(
      { success: false, error: `No se envían recordatorios de una factura en estado ${factura.estado}.` },
      { status: 400 },
    );
  }

  const destino = factura.cliente.email?.trim();
  if (!destino) {
    return NextResponse.json(
      { success: false, error: `${factura.cliente.nombre} no tiene correo registrado en el CRM.` },
      { status: 400 },
    );
  }

  const dias = factura.fechaVence
    ? Math.floor((Date.now() - factura.fechaVence.getTime()) / DIA)
    : 0;
  const vencida = dias > 0;

  const cfg = await prisma.configuracion.findMany({
    where: { clave: { in: ["empresa_nombre", "empresa_telefono", "empresa_email", "empresa_nit"] } },
    select: { clave: true, valor: true },
  });
  const e = Object.fromEntries(cfg.map(c => [c.clave, c.valor]));
  const empresa = e.empresa_nombre || "Costamallas";

  const encabezado = vencida
    ? dias > 60
      ? "Factura vencida — requerimos su gestión"
      : "Recordatorio: factura vencida"
    : "Recordatorio de pago próximo";

  const parrafo = vencida
    ? `La factura <strong>${factura.numero}</strong> presenta un saldo pendiente y lleva <strong>${dias} día${dias > 1 ? "s" : ""}</strong> vencida.`
    : `Le recordamos que la factura <strong>${factura.numero}</strong> tiene un saldo pendiente${factura.fechaVence ? ` con vencimiento el <strong>${factura.fechaVence.toLocaleDateString("es-CO")}</strong>` : ""}.`;

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:${vencida ? "#dc2626" : "#f9df1e"};padding:20px 24px">
      <h1 style="margin:0;font-size:18px;color:${vencida ? "#fff" : "#0f172a"}">${encabezado}</h1>
    </div>
    <div style="padding:24px;font-size:14px;color:#334155;line-height:1.6">
      <p style="margin:0 0 14px">Buen día${factura.cliente.empresa ? `, ${factura.cliente.empresa}` : `, ${factura.cliente.nombre}`}:</p>
      <p style="margin:0 0 18px">${parrafo}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b">Factura</td><td style="padding:8px 0;text-align:right;font-weight:600">${factura.numero}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;text-align:right">${formatCOP(Number(factura.total))}</td></tr>
        <tr style="border-top:2px solid #e2e8f0">
          <td style="padding:10px 0;font-weight:700">Saldo pendiente</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;font-size:17px;color:${vencida ? "#dc2626" : "#0f172a"}">${formatCOP(saldo)}</td>
        </tr>
      </table>
      <p style="margin:20px 0 0;color:#64748b;font-size:13px">
        Si ya realizó el pago, por favor ignore este mensaje o envíenos el soporte respondiendo a este correo.
      </p>
    </div>
    <div style="padding:16px 24px;background:#0f172a;color:#94a3b8;font-size:11px">
      ${empresa}${e.empresa_nit ? ` · NIT ${e.empresa_nit}` : ""}${e.empresa_telefono ? ` · Tel. ${e.empresa_telefono}` : ""}
    </div>
  </div></body></html>`;

  try {
    await enviarCorreo({
      para: destino,
      responderA: e.empresa_email || undefined,
      asunto: `${vencida ? "Factura vencida" : "Recordatorio"} ${factura.numero} — ${empresa}`,
      html,
      texto:
        `${encabezado}\n\nFactura ${factura.numero}\nSaldo pendiente: ${formatCOP(saldo)}` +
        (vencida ? `\nDías vencida: ${dias}` : "") +
        `\n\nSi ya realizó el pago, ignore este mensaje.\n${empresa}`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: "FACTURA_RECORDATORIO",
        detalle: `${factura.numero} → ${destino}`,
        resultado: vencida ? `vencida ${dias}d` : "próxima a vencer",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    success: true,
    mensaje: `Recordatorio enviado a ${destino}`,
  });
}
