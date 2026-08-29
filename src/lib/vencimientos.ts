// ============================================================
// Lo que se vence solo: cotizaciones y facturas.
//
// El estado VENCIDA existía en las dos pantallas y en el embudo, pero
// **nadie lo escribía nunca**: solo se leía. Una oferta que caducó hace
// tres semanas seguía figurando como ENVIADA, y el embudo la contaba
// como negocio en juego. Eso hunde la tasa de cierre — precisamente la
// métrica que gerencia quiere subir del 10% al 28% — porque el
// denominador se llena de ofertas muertas que nadie va a cerrar.
//
// Lo mismo con las facturas: la cartera calculaba el vencimiento por
// fecha (así que los tramos salían bien), pero el estado se quedaba en
// EMITIDA para siempre y no se podía filtrar "muéstrame lo vencido".
//
// Corre una vez al día dentro de /api/cron/diario. No hace falta más:
// una oferta no se vence a las 3 de la tarde, se vence ese día.
// ============================================================

import { prisma } from "@/lib/prisma";

const DIA = 86_400_000;

export interface ResumenVencimientos {
  cotizaciones: { revisadas: number; vencidas: string[] };
  facturas: { revisadas: number; vencidas: string[] };
}

/**
 * Marca como VENCIDA lo que ya caducó.
 *
 * `dry` informa qué haría sin escribir nada.
 */
export async function marcarVencidos(opts: { dry?: boolean } = {}): Promise<ResumenVencimientos> {
  const ahora = Date.now();

  // ── Cotizaciones ──
  // Solo las ENVIADAS: un borrador no vence (nadie lo ha visto) y una
  // aprobada o rechazada ya terminó su vida.
  const cotizaciones = await prisma.cotizacion.findMany({
    where: { estado: "ENVIADA" },
    select: { id: true, numero: true, createdAt: true, validezDias: true, prorrogaDias: true },
  });

  // La prórroga se suma aparte de validezDias: el documento sigue
  // diciendo la validez que se le ofreció al cliente, y aquí se tiene en
  // cuenta lo que se estiró después. Sin esto, aplazar una oferta no
  // servía de nada: la corrida de esa noche la volvía a vencer.
  const cotVencidas = cotizaciones.filter(
    c => c.createdAt.getTime() + (c.validezDias + c.prorrogaDias) * DIA < ahora,
  );

  if (!opts.dry && cotVencidas.length) {
    await prisma.cotizacion.updateMany({
      where: { id: { in: cotVencidas.map(c => c.id) } },
      data: { estado: "VENCIDA" },
    });
  }

  // ── Facturas ──
  // Con saldo pendiente y fecha de vencimiento pasada. Las que no tienen
  // fecha se quedan como están: no se les inventa un vencimiento, salen
  // en /facturacion/sin-vencimiento para que alguien las corrija.
  const facturas = await prisma.factura.findMany({
    where: {
      estado: { in: ["EMITIDA", "PARCIAL"] },
      saldoPendiente: { gt: 0 },
      fechaVence: { not: null, lt: new Date() },
    },
    select: { id: true, numero: true },
  });

  if (!opts.dry && facturas.length) {
    await prisma.factura.updateMany({
      where: { id: { in: facturas.map(f => f.id) } },
      data: { estado: "VENCIDA" },
    });
  }

  return {
    cotizaciones: { revisadas: cotizaciones.length, vencidas: cotVencidas.map(c => c.numero) },
    facturas: { revisadas: facturas.length, vencidas: facturas.map(f => f.numero) },
  };
}
