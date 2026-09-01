// ============================================================
// La encuesta de satisfacción.
//
// Las preguntas salen del "Formato Valoración de cliente" de la empresa,
// que hasta hoy se llenaba en papel. No se inventó ninguna ni se quitó
// ninguna: si el formato pregunta por la limpieza del sitio de trabajo,
// aquí también, porque es lo que la empresa quiere saber.
//
// Vive en el dominio de las cotizaciones y no en el portal: el cliente
// ya conoce ese enlace —es donde vio su oferta— y no tiene que entrar a
// ningún sitio que parezca interno.
// ============================================================

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { urlCotizacion } from "@/lib/url-portal";

export type { Pregunta } from "@/lib/encuesta-preguntas";
export {
  PREGUNTA_NPS, PREGUNTAS_SATISFACCION, PREGUNTA_RECOMPRA, TODAS_LAS_PREGUNTAS,
} from "@/lib/encuesta-preguntas";

/** Una respuesta llega completa o no llega: los puntajes son de 0 a 10. */
export function puntajeValido(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10;
}

// ─────────────────────────────────────────────
// Crear y responder
// ─────────────────────────────────────────────

/**
 * Prepara la encuesta de una obra y devuelve su enlace.
 *
 * Si ya había una sin responder se reutiliza: mandar dos enlaces
 * distintos por la misma obra parte las respuestas en dos y ninguna
 * cuenta entera.
 */
export async function prepararEncuesta(instalacionId: string): Promise<{
  token: string;
  url: string;
  yaRespondida: boolean;
}> {
  const existente = await prisma.encuestaSatisfaccion.findFirst({
    where: { instalacionId },
    orderBy: { createdAt: "desc" },
    select: { token: true, respondidaEn: true },
  });

  if (existente) {
    return {
      token: existente.token,
      url: `${urlCotizacion()}/encuesta/${existente.token}`,
      yaRespondida: Boolean(existente.respondidaEn),
    };
  }

  const inst = await prisma.instalacion.findUnique({
    where: { id: instalacionId },
    select: { pedido: { select: { clienteId: true, vendedorId: true } } },
  });

  const token = randomBytes(18).toString("base64url");
  await prisma.encuestaSatisfaccion.create({
    data: {
      instalacionId,
      clienteId: inst?.pedido?.clienteId ?? null,
      vendedorId: inst?.pedido?.vendedorId ?? null,
      token,
      enviadaEn: new Date(),
    },
  });

  return { token, url: `${urlCotizacion()}/encuesta/${token}`, yaRespondida: false };
}

export interface RespuestaEncuesta {
  recomendaria?: number;
  calidad?: number;
  precio?: number;
  profesionalidad?: number;
  atencion?: number;
  puntualidad?: number;
  limpieza?: number;
  recompra?: number;
  destacaria?: string;
  recomendaciones?: string;
}

export async function guardarRespuesta(
  token: string,
  r: RespuestaEncuesta,
): Promise<{ ok: boolean; error?: string }> {
  const encuesta = await prisma.encuestaSatisfaccion.findUnique({
    where: { token },
    select: { id: true, respondidaEn: true },
  });
  if (!encuesta) return { ok: false, error: "Este enlace no corresponde a ninguna encuesta." };
  if (encuesta.respondidaEn) return { ok: false, error: "Esta encuesta ya se respondió. Gracias." };

  // El NPS es lo único obligatorio. Exigir las ocho preguntas hace que
  // la gente abandone a la mitad, y media encuesta contestada vale más
  // que ninguna.
  if (!puntajeValido(r.recomendaria)) {
    return { ok: false, error: "Falta la primera pregunta: ¿con qué probabilidad nos recomendaría?" };
  }

  const num = (v: unknown) => (puntajeValido(v) ? v : null);

  await prisma.encuestaSatisfaccion.update({
    where: { token },
    data: {
      recomendaria: r.recomendaria,
      calidad: num(r.calidad),
      precio: num(r.precio),
      profesionalidad: num(r.profesionalidad),
      atencion: num(r.atencion),
      puntualidad: num(r.puntualidad),
      limpieza: num(r.limpieza),
      recompra: num(r.recompra),
      destacaria: (r.destacaria ?? "").trim().slice(0, 2000) || null,
      recomendaciones: (r.recomendaciones ?? "").trim().slice(0, 2000) || null,
      respondidaEn: new Date(),
    },
  });

  return { ok: true };
}

// ─────────────────────────────────────────────
// Los resultados
// ─────────────────────────────────────────────

export interface ResumenEncuestas {
  enviadas: number;
  respondidas: number;
  /** Porcentaje que contesta. Es lo primero que hay que mirar: con un
   *  5 % de respuesta, los promedios no dicen nada. */
  tasaRespuesta: number;
  /** NPS clásico: % promotores (9-10) menos % detractores (0-6). */
  nps: number | null;
  promotores: number;
  pasivos: number;
  detractores: number;
  /** Promedio de cada puntaje, o null si nadie lo contestó. */
  promedios: Record<string, number | null>;
}

export async function resumenEncuestas(desde?: Date): Promise<ResumenEncuestas> {
  const where = desde ? { createdAt: { gte: desde } } : {};

  const [enviadas, respuestas] = await Promise.all([
    prisma.encuestaSatisfaccion.count({ where }),
    prisma.encuestaSatisfaccion.findMany({
      where: { ...where, respondidaEn: { not: null } },
      select: {
        recomendaria: true, calidad: true, precio: true, profesionalidad: true,
        atencion: true, puntualidad: true, limpieza: true, recompra: true,
      },
    }),
  ]);

  const n = respuestas.length;
  const promedio = (campo: keyof (typeof respuestas)[number]) => {
    const vals = respuestas.map(r => r[campo]).filter((v): v is number => typeof v === "number");
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const notas = respuestas.map(r => r.recomendaria).filter((v): v is number => typeof v === "number");
  const promotores = notas.filter(v => v >= 9).length;
  const detractores = notas.filter(v => v <= 6).length;
  const pasivos = notas.length - promotores - detractores;

  return {
    enviadas,
    respondidas: n,
    tasaRespuesta: enviadas ? Math.round((n / enviadas) * 100) : 0,
    nps: notas.length ? Math.round(((promotores - detractores) / notas.length) * 100) : null,
    promotores, pasivos, detractores,
    promedios: {
      calidad: promedio("calidad"),
      precio: promedio("precio"),
      profesionalidad: promedio("profesionalidad"),
      atencion: promedio("atencion"),
      puntualidad: promedio("puntualidad"),
      limpieza: promedio("limpieza"),
      recompra: promedio("recompra"),
    },
  };
}

export interface RespuestaListada {
  id: string;
  cliente: string | null;
  pedido: string | null;
  vendedor: string | null;
  nps: number | null;
  /** promotor · pasivo · detractor. Null si no contestó el NPS. */
  grupo: "promotor" | "pasivo" | "detractor" | null;
  destacaria: string | null;
  recomendaciones: string | null;
  respondidaEn: Date | null;
  enviadaEn: Date | null;
}

/**
 * Las respuestas, de la más reciente a la más vieja.
 *
 * Devuelve también las que nadie contestó todavía: son la mitad de la
 * historia. Una tasa de respuesta del 20 % con un NPS de 80 no significa
 * que el 80 % esté encantado, significa que contestaron los contentos.
 */
export async function ultimasRespuestas(limite = 100): Promise<RespuestaListada[]> {
  const filas = await prisma.encuestaSatisfaccion.findMany({
    orderBy: [{ respondidaEn: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limite,
    select: {
      id: true, recomendaria: true, destacaria: true, recomendaciones: true,
      respondidaEn: true, enviadaEn: true, vendedorId: true,
      cliente: { select: { nombre: true, empresa: true } },
      instalacion: { select: { pedido: { select: { numero: true } } } },
    },
  });

  // `vendedorId` se guarda suelto, sin relación, para que reasignarle el
  // cliente a otro asesor no reescriba la historia. El nombre se busca
  // aparte, de una sola vez.
  const ids = [...new Set(filas.map(f => f.vendedorId).filter((v): v is string => Boolean(v)))];
  const vendedores = ids.length
    ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
    : [];
  const nombreDe = new Map(vendedores.map(v => [v.id, v.nombre]));

  return filas.map(f => ({
    id: f.id,
    cliente: f.cliente?.empresa || f.cliente?.nombre || null,
    pedido: f.instalacion?.pedido?.numero ?? null,
    vendedor: f.vendedorId ? (nombreDe.get(f.vendedorId) ?? null) : null,
    nps: f.recomendaria,
    grupo: f.recomendaria === null
      ? null
      : f.recomendaria >= 9 ? "promotor" : f.recomendaria >= 7 ? "pasivo" : "detractor",
    destacaria: f.destacaria,
    recomendaciones: f.recomendaciones,
    respondidaEn: f.respondidaEn,
    enviadaEn: f.enviadaEn,
  }));
}
