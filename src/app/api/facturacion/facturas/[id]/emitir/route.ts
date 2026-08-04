import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { emitirElectronica, getFacturacionConfig } from "@/lib/facturacion";
import { getPlazosPago, calcularFechaVence } from "@/lib/plazos-pago";

type P = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
  if (factura.estado === "ANULADA") return NextResponse.json({ success: false, error: "La factura está anulada" }, { status: 400 });

  const cfg = await getFacturacionConfig();
  const r = await emitirElectronica(id);

  // Asignar consecutivo DIAN si aplica (modo electrónico)
  let consecutivo = factura.consecutivo ?? undefined;
  if (!consecutivo && cfg.proveedor !== "manual") {
    consecutivo = cfg.consecutivoActual;
    await prisma.configuracion.upsert({
      where: { clave: "fact_consecutivo" },
      create: { clave: "fact_consecutivo", valor: String(consecutivo + 1) },
      update: { valor: String(consecutivo + 1) },
    });
  }

  // Al emitir empieza a correr el plazo de verdad. Si la factura no
  // traía vencimiento, se calcula ahora desde la fecha de emisión; si
  // alguien puso una a mano, no se le toca.
  const emision = new Date();
  let fechaVence = factura.fechaVence;
  if (r.ok && !fechaVence) {
    fechaVence = calcularFechaVence(factura.formaPago, emision, await getPlazosPago());
  }

  await prisma.factura.update({
    where: { id },
    data: {
      estado: r.ok ? "EMITIDA" : factura.estado,
      ...(r.ok && fechaVence ? { fechaVence } : {}),
      estadoDian: r.estadoDian,
      cufe: r.cufe ?? undefined,
      proveedorRef: r.proveedorRef ?? undefined,
      pdfUrl: r.pdfUrl ?? undefined,
      xmlUrl: r.xmlUrl ?? undefined,
      qrUrl: r.qrUrl ?? undefined,
      mensajeDian: r.mensaje ?? undefined,
      consecutivo,
      fechaEmision: r.ok ? emision : undefined,
    },
  });

  await prisma.log.create({ data: { usuarioId: user.sub, accion: "FACTURA_EMITIR", detalle: `${factura.numero} → ${r.estadoDian}`, resultado: r.ok ? "OK" : "ERROR" } }).catch(() => {});

  return NextResponse.json({ success: r.ok, data: r, error: r.ok ? undefined : r.mensaje });
}
