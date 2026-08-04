// ============================================================
// GET  /api/facturacion/sin-vencimiento   las que no tienen fecha
// POST /api/facturacion/sin-vencimiento   las corrige en lote
//
// Una factura sin fecha de vencimiento no se puede cobrar: no hay contra
// qué decir que está vencida, y la cartera tenía que estimarle la
// antigüedad con la fecha de emisión. Esto es para arreglar las que ya
// están así; las nuevas la calculan solas.
//
// Muestra la fecha que le CORRESPONDERÍA a cada una según su forma de
// pago, para poder aceptarlas todas de una vez en lugar de escribir 40
// fechas a mano.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { getPlazosPago, calcularFechaVence } from "@/lib/plazos-pago";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const plazos = await getPlazosPago();

  const facturas = await prisma.factura.findMany({
    where: { fechaVence: null },
    select: {
      id: true, numero: true, estado: true, total: true, saldoPendiente: true,
      formaPago: true, fechaEmision: true, createdAt: true,
      cliente: { select: { nombre: true, empresa: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    data: {
      plazos,
      facturas: facturas.map(f => {
        // La base es la emisión; si nunca se emitió, la fecha en que se
        // creó. Es lo más cercano a la verdad que hay.
        const base = f.fechaEmision ?? f.createdAt;
        const sugerida = calcularFechaVence(f.formaPago, base, plazos);
        return {
          id: f.id,
          numero: f.numero,
          estado: f.estado,
          total: Number(f.total),
          saldoPendiente: Number(f.saldoPendiente),
          formaPago: f.formaPago,
          // Una forma de pago que no está en la tabla no se puede
          // resolver sola: hay que elegirle una.
          formaPagoConocida: plazos.some(p => p.valor === f.formaPago),
          base,
          sugerida,
          cliente: f.cliente,
        };
      }),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  const cambios: { id: string; formaPago?: string; fechaVence?: string }[] =
    Array.isArray(b.cambios) ? b.cambios : [];
  if (!cambios.length) {
    return NextResponse.json({ success: false, error: "No hay nada que aplicar" }, { status: 400 });
  }

  const plazos = await getPlazosPago();
  let aplicadas = 0;
  const problemas: string[] = [];

  for (const c of cambios) {
    const factura = await prisma.factura.findUnique({
      where: { id: c.id },
      select: { numero: true, formaPago: true, fechaEmision: true, createdAt: true },
    });
    if (!factura) { problemas.push(`${c.id}: no existe`); continue; }

    const forma = c.formaPago ?? factura.formaPago;
    const fecha = c.fechaVence
      ? new Date(c.fechaVence)
      : calcularFechaVence(forma, factura.fechaEmision ?? factura.createdAt, plazos);

    if (!fecha || Number.isNaN(fecha.getTime())) {
      problemas.push(`${factura.numero}: la forma de pago "${forma}" no tiene plazo definido`);
      continue;
    }

    await prisma.factura.update({
      where: { id: c.id },
      data: { fechaVence: fecha, ...(c.formaPago ? { formaPago: c.formaPago } : {}) },
    });
    aplicadas++;
  }

  await prisma.log.create({
    data: {
      usuarioId: user.sub,
      accion: "FACTURAS_FECHA_VENCE",
      detalle: `${aplicadas} factura(s) con fecha de vencimiento corregida`,
      resultado: problemas.length ? "PARCIAL" : "OK",
      totalFilas: aplicadas,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    data: { aplicadas, problemas },
    mensaje: `${aplicadas} factura(s) corregida(s)${problemas.length ? `, ${problemas.length} sin resolver` : ""}`,
  });
}
