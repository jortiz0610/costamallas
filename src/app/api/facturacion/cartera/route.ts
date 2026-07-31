// ============================================================
// GET /api/facturacion/cartera — análisis de cartera por antigüedad
//
// Saber "cuánto nos deben" no sirve de mucho sin saber "desde cuándo".
// Este endpoint reparte el saldo pendiente en los tramos que se usan para
// cobrar (corriente, 1-30, 31-60, 61-90, +90 días) y lista los clientes
// con más deuda vencida.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

/** Estados que representan plata realmente por cobrar. */
const POR_COBRAR = ["EMITIDA", "PARCIAL", "VENCIDA"];

const DIA = 86_400_000;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const facturas = await prisma.factura.findMany({
    where: { estado: { in: POR_COBRAR }, saldoPendiente: { gt: 0 } },
    select: {
      id: true, numero: true, estado: true, total: true, saldoPendiente: true,
      fechaEmision: true, fechaVence: true, createdAt: true,
      cliente: { select: { id: true, nombre: true, empresa: true, email: true, telefono: true } },
    },
    orderBy: { fechaVence: "asc" },
  });

  const hoy = Date.now();

  const conAntiguedad = facturas.map((f) => {
    // Sin fecha de vencimiento se usa la de emisión: es mejor estimar la
    // antigüedad que dejar la factura fuera del análisis.
    const referencia = f.fechaVence ?? f.fechaEmision ?? f.createdAt;
    const diasVencida = Math.floor((hoy - referencia.getTime()) / DIA);
    const tramo =
      diasVencida <= 0 ? "corriente"
      : diasVencida <= 30 ? "d1_30"
      : diasVencida <= 60 ? "d31_60"
      : diasVencida <= 90 ? "d61_90"
      : "d90_mas";

    return {
      id: f.id,
      numero: f.numero,
      estado: f.estado,
      total: Number(f.total),
      saldoPendiente: Number(f.saldoPendiente),
      fechaVence: f.fechaVence,
      diasVencida: Math.max(diasVencida, 0),
      vencida: diasVencida > 0,
      tramo,
      cliente: f.cliente,
      sinFechaVencimiento: !f.fechaVence,
    };
  });

  const sumar = (tramo: string) =>
    conAntiguedad.filter((f) => f.tramo === tramo).reduce((s, f) => s + f.saldoPendiente, 0);

  const tramos = {
    corriente: { monto: sumar("corriente"), facturas: conAntiguedad.filter(f => f.tramo === "corriente").length },
    d1_30:     { monto: sumar("d1_30"),     facturas: conAntiguedad.filter(f => f.tramo === "d1_30").length },
    d31_60:    { monto: sumar("d31_60"),    facturas: conAntiguedad.filter(f => f.tramo === "d31_60").length },
    d61_90:    { monto: sumar("d61_90"),    facturas: conAntiguedad.filter(f => f.tramo === "d61_90").length },
    d90_mas:   { monto: sumar("d90_mas"),   facturas: conAntiguedad.filter(f => f.tramo === "d90_mas").length },
  };

  // Deuda agrupada por cliente, de mayor a menor.
  const porCliente = new Map<string, {
    clienteId: string; nombre: string; empresa: string | null; email: string | null;
    telefono: string | null; saldo: number; facturas: number; diasMax: number;
  }>();

  for (const f of conAntiguedad) {
    const k = f.cliente.id;
    const actual = porCliente.get(k) ?? {
      clienteId: k,
      nombre: f.cliente.nombre,
      empresa: f.cliente.empresa,
      email: f.cliente.email,
      telefono: f.cliente.telefono,
      saldo: 0, facturas: 0, diasMax: 0,
    };
    actual.saldo += f.saldoPendiente;
    actual.facturas += 1;
    actual.diasMax = Math.max(actual.diasMax, f.diasVencida);
    porCliente.set(k, actual);
  }

  const totalPorCobrar = conAntiguedad.reduce((s, f) => s + f.saldoPendiente, 0);
  const totalVencido = conAntiguedad.filter(f => f.vencida).reduce((s, f) => s + f.saldoPendiente, 0);

  return NextResponse.json({
    success: true,
    data: {
      resumen: {
        totalPorCobrar,
        totalVencido,
        totalCorriente: totalPorCobrar - totalVencido,
        facturasPendientes: conAntiguedad.length,
        facturasVencidas: conAntiguedad.filter(f => f.vencida).length,
        clientesConDeuda: porCliente.size,
        // Días promedio ponderados por monto: un atraso grande en una
        // factura grande pesa más que uno en una pequeña.
        diasPromedioPonderado: totalPorCobrar
          ? Math.round(conAntiguedad.reduce((s, f) => s + f.diasVencida * f.saldoPendiente, 0) / totalPorCobrar)
          : 0,
        sinFechaVencimiento: conAntiguedad.filter(f => f.sinFechaVencimiento).length,
      },
      tramos,
      clientes: [...porCliente.values()].sort((a, b) => b.saldo - a.saldo),
      facturas: conAntiguedad,
    },
  });
}
