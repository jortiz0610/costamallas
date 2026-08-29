// ============================================================
// GET /api/crm/embudo?dias=90 — medición del embudo comercial
//
// La gerencia puso una meta concreta: subir la tasa de cierre del 10% al
// 28%. Hasta ahora nadie podía saber en cuánto va, porque el sistema no
// la calculaba en ninguna parte.
//
// Se mide sobre COTIZACIONES, no sobre pedidos: el embudo empieza cuando
// se hace una oferta y se cierra cuando el cliente la aprueba.
//
// Los tiempos salen de las marcas que dejó la cotización 2.0:
//   creada → enviada    : cuánto se demora el asesor en responder
//   enviada → abierta   : cuánto se demora el cliente en mirarla
//   enviada → aprobada  : cuánto se demora en decidir
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SIN_PRUEBAS } from "@/lib/cotizaciones-prueba";
import { getUserFromRequest } from "@/lib/auth";

const HORA = 3_600_000;

/** Promedio en horas, o null si no hay de dónde sacarlo. */
function promedioHoras(valores: number[]): number | null {
  if (!valores.length) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length / HORA) * 10) / 10;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const dias = Math.min(Math.max(Number(req.nextUrl.searchParams.get("dias")) || 90, 1), 730);
  const desde = new Date(Date.now() - dias * 86_400_000);

  const cotizaciones = await prisma.cotizacion.findMany({
    where: { ...SIN_PRUEBAS, createdAt: { gte: desde } },
    select: {
      id: true, estado: true, total: true, createdAt: true,
      enviadaEn: true, vistaPrimeraEn: true, vistas: true, updatedAt: true,
      vendedor: { select: { id: true, nombre: true } },
    },
  });

  // Un borrador no es una oferta: nadie la ha visto. Contarlo hundiría la
  // tasa de cierre con cotizaciones que el asesor ni siquiera terminó.
  const ofertadas = cotizaciones.filter(c => c.estado !== "BORRADOR");
  const aprobadas = ofertadas.filter(c => c.estado === "APROBADA");
  const rechazadas = ofertadas.filter(c => c.estado === "RECHAZADA");
  const vencidas = ofertadas.filter(c => c.estado === "VENCIDA");
  const abiertas = ofertadas.filter(c => (c.vistas ?? 0) > 0);

  const valorOfertado = ofertadas.reduce((a, c) => a + Number(c.total), 0);
  const valorGanado = aprobadas.reduce((a, c) => a + Number(c.total), 0);

  const tasaCierre = ofertadas.length ? Math.round((aprobadas.length / ofertadas.length) * 1000) / 10 : 0;

  const tiempoRespuesta = promedioHoras(
    ofertadas.filter(c => c.enviadaEn).map(c => c.enviadaEn!.getTime() - c.createdAt.getTime()),
  );
  const tiempoApertura = promedioHoras(
    ofertadas.filter(c => c.enviadaEn && c.vistaPrimeraEn)
      .map(c => c.vistaPrimeraEn!.getTime() - c.enviadaEn!.getTime()),
  );
  // Para el cierre se usa updatedAt: es cuando se marcó APROBADA. No es
  // exacto si alguien editó la cotización después, pero es lo que hay.
  const tiempoCierre = promedioHoras(
    aprobadas.filter(c => c.enviadaEn).map(c => c.updatedAt.getTime() - c.enviadaEn!.getTime()),
  );

  // ── Por asesor ──
  const porAsesor = new Map<string, {
    id: string; nombre: string; ofertadas: number; aprobadas: number;
    valorOfertado: number; valorGanado: number; respuestas: number[];
  }>();

  for (const c of ofertadas) {
    const id = c.vendedor?.id ?? "sin";
    const actual = porAsesor.get(id) ?? {
      id, nombre: c.vendedor?.nombre ?? "Sin asesor",
      ofertadas: 0, aprobadas: 0, valorOfertado: 0, valorGanado: 0, respuestas: [],
    };
    actual.ofertadas += 1;
    actual.valorOfertado += Number(c.total);
    if (c.estado === "APROBADA") {
      actual.aprobadas += 1;
      actual.valorGanado += Number(c.total);
    }
    if (c.enviadaEn) actual.respuestas.push(c.enviadaEn.getTime() - c.createdAt.getTime());
    porAsesor.set(id, actual);
  }

  const asesores = [...porAsesor.values()]
    .map(a => ({
      id: a.id,
      nombre: a.nombre,
      ofertadas: a.ofertadas,
      aprobadas: a.aprobadas,
      tasaCierre: a.ofertadas ? Math.round((a.aprobadas / a.ofertadas) * 1000) / 10 : 0,
      valorOfertado: a.valorOfertado,
      valorGanado: a.valorGanado,
      ticketPromedio: a.aprobadas ? Math.round(a.valorGanado / a.aprobadas) : 0,
      tiempoRespuesta: promedioHoras(a.respuestas),
    }))
    .sort((x, y) => y.valorGanado - x.valorGanado);

  return NextResponse.json({
    success: true,
    data: {
      periodoDias: dias,
      embudo: {
        borradores: cotizaciones.length - ofertadas.length,
        ofertadas: ofertadas.length,
        abiertas: abiertas.length,
        aprobadas: aprobadas.length,
        rechazadas: rechazadas.length,
        vencidas: vencidas.length,
      },
      tasaCierre,
      // La meta que fijó gerencia, para que el número tenga contra qué compararse.
      metaCierre: 28,
      valorOfertado,
      valorGanado,
      ticketPromedio: aprobadas.length ? Math.round(valorGanado / aprobadas.length) : 0,
      tiempos: {
        respuesta: tiempoRespuesta,
        apertura: tiempoApertura,
        cierre: tiempoCierre,
        // El objetivo declarado en la reunión: cotizar en 24-48 horas.
        metaRespuestaHoras: 24,
      },
      // Cuántas ofertas ni siquiera se abrieron: si es alto, el problema
      // no es el precio, es que la cotización no está llegando.
      sinAbrir: ofertadas.filter(c => c.enviadaEn && !(c.vistas ?? 0)).length,
      asesores,
    },
  });
}
