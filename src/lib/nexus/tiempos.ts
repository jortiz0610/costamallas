// ============================================================
// NEXUS — ¿cumplimos el compromiso de responder en una hora?
//
// El dato ya se guardaba (`primeraRespuestaEn`, desde la Fase 4) pero no
// lo miraba nadie: lo único que hacía era pintar una etiqueta "Respondida"
// en la conversación abierta. Un compromiso que no se mide no existe.
//
// ⚠️ La decisión que hace o rompe esta métrica: **se cuenta solo el tiempo
// dentro del horario de atención**. Un mensaje que entra a las 8 de la
// noche y se contesta a las 8 de la mañana no son 12 horas de demora: son
// 0 minutos hábiles. Si se midiera a reloj corrido, el informe saldría en
// rojo todos los lunes, nadie se lo creería y se dejaría de mirar — que es
// como mueren los indicadores.
//
// Se muestran los dos relojes, pero el que manda es el hábil.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface ConfigTiempos {
  /** El compromiso, en minutos. Gerencia dijo una hora. */
  compromisoMin: number;
  /** Hora local a la que abre la atención (0-23). */
  horaInicio: number;
  /** Hora local a la que cierra (0-23). */
  horaFin: number;
  /** Días hábiles: 1 = lunes … 6 = sábado, 0 = domingo. */
  dias: number[];
}

export const TIEMPOS_DEFAULTS: ConfigTiempos = {
  compromisoMin: 60,
  horaInicio: 8,
  horaFin: 17,
  // Lunes a sábado: en este sector se atiende el sábado. Si no es así, se
  // cambia desde la pantalla y el informe se recalcula.
  dias: [1, 2, 3, 4, 5, 6],
};

const CLAVES = {
  compromisoMin: "nexus_compromiso_min",
  horaInicio: "nexus_hora_inicio",
  horaFin: "nexus_hora_fin",
  dias: "nexus_dias",
};

export async function getConfigTiempos(): Promise<ConfigTiempos> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  const num = (clave: string, porDefecto: number, min: number, max: number) => {
    const v = Number(map[clave]);
    return Number.isFinite(v) && v >= min && v <= max ? v : porDefecto;
  };

  let dias = TIEMPOS_DEFAULTS.dias;
  try {
    const parsed = JSON.parse(map[CLAVES.dias] ?? "");
    if (Array.isArray(parsed) && parsed.length) {
      dias = parsed.map(Number).filter(d => d >= 0 && d <= 6);
    }
  } catch {
    // Un JSON corrupto no puede dejar el informe sin días hábiles.
  }

  return {
    compromisoMin: num(CLAVES.compromisoMin, 60, 1, 10_080),
    horaInicio: num(CLAVES.horaInicio, 8, 0, 23),
    horaFin: num(CLAVES.horaFin, 17, 1, 24),
    dias: dias.length ? dias : TIEMPOS_DEFAULTS.dias,
  };
}

export async function setConfigTiempos(datos: Partial<ConfigTiempos>) {
  const entradas: [string, string][] = [];
  if (datos.compromisoMin != null) entradas.push([CLAVES.compromisoMin, String(datos.compromisoMin)]);
  if (datos.horaInicio != null) entradas.push([CLAVES.horaInicio, String(datos.horaInicio)]);
  if (datos.horaFin != null) entradas.push([CLAVES.horaFin, String(datos.horaFin)]);
  if (datos.dias) entradas.push([CLAVES.dias, JSON.stringify(datos.dias)]);

  for (const [clave, valor] of entradas) {
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor, descripcion: "Compromiso de respuesta de Nexus" },
      update: { valor },
    });
  }
}

// ── Reloj hábil ─────────────────────────────────────────────

const MIN = 60_000;
/**
 * Colombia es UTC-5 todo el año (no hay horario de verano), así que basta
 * con restar 5 horas para razonar en hora local. Se hace a mano y no con
 * una librería de zonas horarias porque meter una dependencia entera para
 * un offset fijo no se justifica.
 */
const OFFSET_CO_MS = 5 * 60 * MIN;

const aLocal = (d: Date) => new Date(d.getTime() - OFFSET_CO_MS);

/**
 * Minutos hábiles entre dos instantes, contando solo las horas de
 * atención de los días laborables.
 *
 * Recorre día a día en vez de hacer una fórmula cerrada: son ventanas de
 * pocos días y así el festivo o el cambio de horario que haya que meter
 * mañana entra sin reescribir nada.
 */
export function minutosHabiles(desde: Date, hasta: Date, cfg: ConfigTiempos): number {
  if (hasta <= desde) return 0;

  const inicio = aLocal(desde);
  const fin = aLocal(hasta);
  let total = 0;

  // Se empieza a las 00:00 del día de entrada y se avanza de día en día.
  const cursor = new Date(inicio);
  cursor.setUTCHours(0, 0, 0, 0);

  // Tope de seguridad: una conversación sin responder de hace un año no
  // puede poner a girar el bucle indefinidamente.
  for (let i = 0; i < 400 && cursor <= fin; i++) {
    if (cfg.dias.includes(cursor.getUTCDay())) {
      const abre = new Date(cursor); abre.setUTCHours(cfg.horaInicio, 0, 0, 0);
      const cierra = new Date(cursor); cierra.setUTCHours(cfg.horaFin, 0, 0, 0);

      // La parte de la jornada que cae dentro del intervalo pedido.
      const desdeHoy = inicio > abre ? inicio : abre;
      const hastaHoy = fin < cierra ? fin : cierra;
      if (hastaHoy > desdeHoy) total += (hastaHoy.getTime() - desdeHoy.getTime()) / MIN;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.round(total);
}

/** ¿El instante cae dentro del horario de atención? */
export function enHorario(d: Date, cfg: ConfigTiempos): boolean {
  const local = aLocal(d);
  if (!cfg.dias.includes(local.getUTCDay())) return false;
  const h = local.getUTCHours();
  return h >= cfg.horaInicio && h < cfg.horaFin;
}

/** Mediana. Se prefiere al promedio: una sola conversación olvidada tres
 *  días arrastra el promedio y hace que el informe parezca peor de lo que
 *  es (o al revés, que un buen promedio tape diez casos malos). */
export function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
}

// ── El informe ──────────────────────────────────────────────

export interface FilaAsesor {
  usuarioId: string | null;
  nombre: string;
  atendidas: number;
  enPlazo: number;
  pct: number;
  medianaMin: number;
  sinResponder: number;
}

export interface Pendiente {
  id: string;
  canal: string;
  remitente: string;
  asunto: string | null;
  asignado: string | null;
  esperandoMin: number;
  esperandoCorridoMin: number;
  vencido: boolean;
  createdAt: Date;
  etiquetas: string[];
}

export async function informeTiempos(dias: number) {
  const cfg = await getConfigTiempos();
  const desde = new Date(Date.now() - dias * 24 * 60 * MIN);

  const conversaciones = await prisma.nexusConversacion.findMany({
    where: { createdAt: { gte: desde } },
    select: {
      id: true, canal: true, remitente: true, asunto: true, estado: true,
      createdAt: true, primeraRespuestaEn: true, asignadoId: true, etiquetas: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const asesores = await prisma.usuario.findMany({
    where: { id: { in: [...new Set(conversaciones.map(c => c.asignadoId).filter(Boolean))] as string[] } },
    select: { id: true, nombre: true },
  });
  const nombre = new Map(asesores.map(a => [a.id, a.nombre]));

  const ahora = new Date();
  const respondidas: number[] = [];
  const corridas: number[] = [];
  let enPlazo = 0;
  let fueraDeHorario = 0;

  const porAsesor = new Map<string, FilaAsesor>();
  /** Los tiempos de cada asesor, aparte, para sacarles la mediana al final. */
  const tiemposPorAsesor = new Map<string, number[]>();
  const pendientes: Pendiente[] = [];

  for (const c of conversaciones) {
    const clave = c.asignadoId ?? "__sin__";
    const fila = porAsesor.get(clave) ?? {
      usuarioId: c.asignadoId,
      nombre: c.asignadoId ? (nombre.get(c.asignadoId) ?? "—") : "Sin asignar",
      atendidas: 0, enPlazo: 0, pct: 0, medianaMin: 0, sinResponder: 0,
    };

    if (!enHorario(c.createdAt, cfg)) fueraDeHorario++;

    if (c.primeraRespuestaEn) {
      const habil = minutosHabiles(c.createdAt, c.primeraRespuestaEn, cfg);
      const corrido = Math.round((c.primeraRespuestaEn.getTime() - c.createdAt.getTime()) / MIN);
      respondidas.push(habil);
      corridas.push(corrido);
      fila.atendidas++;
      if (habil <= cfg.compromisoMin) { enPlazo++; fila.enPlazo++; }
      tiemposPorAsesor.set(clave, [...(tiemposPorAsesor.get(clave) ?? []), habil]);
    } else if (c.estado !== "CERRADA") {
      // Todavía esperando. Esto es lo accionable HOY, no el promedio del mes.
      const esperando = minutosHabiles(c.createdAt, ahora, cfg);
      fila.sinResponder++;
      pendientes.push({
        id: c.id,
        canal: c.canal,
        remitente: c.remitente,
        asunto: c.asunto,
        asignado: c.asignadoId ? (nombre.get(c.asignadoId) ?? null) : null,
        esperandoMin: esperando,
        esperandoCorridoMin: Math.round((ahora.getTime() - c.createdAt.getTime()) / MIN),
        vencido: esperando > cfg.compromisoMin,
        createdAt: c.createdAt,
        etiquetas: c.etiquetas,
      });
    }

    porAsesor.set(clave, fila);
  }

  const filas: FilaAsesor[] = [...porAsesor.entries()]
    .map(([clave, f]) => ({
      ...f,
      pct: f.atendidas ? Math.round((f.enPlazo / f.atendidas) * 100) : 0,
      medianaMin: mediana(tiemposPorAsesor.get(clave) ?? []),
    }))
    .sort((a, b) => b.atendidas - a.atendidas);

  // Reparto por tramos: dice DÓNDE se pierde el tiempo, no solo cuánto.
  const tramos = [
    { id: "menos15", label: "Menos de 15 min", desde: 0, hasta: 15 },
    { id: "m15_60", label: "15 a 60 min", desde: 15, hasta: cfg.compromisoMin },
    { id: "m60_240", label: `${cfg.compromisoMin} min a 4 h`, desde: cfg.compromisoMin, hasta: 240 },
    { id: "mas240", label: "Más de 4 horas", desde: 240, hasta: Infinity },
  ].map(t => ({
    ...t,
    cantidad: respondidas.filter(v => v > t.desde && v <= t.hasta).length,
  }));
  // El primer tramo incluye el 0 (respuesta inmediata), que el filtro de
  // arriba deja fuera por usar "mayor que".
  tramos[0].cantidad = respondidas.filter(v => v <= 15).length;

  return {
    config: cfg,
    ventanaDias: dias,
    resumen: {
      total: conversaciones.length,
      respondidas: respondidas.length,
      sinResponder: pendientes.length,
      enPlazo,
      pctEnPlazo: respondidas.length ? Math.round((enPlazo / respondidas.length) * 100) : 0,
      medianaMin: mediana(respondidas),
      medianaCorridaMin: mediana(corridas),
      peorMin: respondidas.length ? Math.max(...respondidas) : 0,
      vencidasAhora: pendientes.filter(p => p.vencido).length,
      // Cuántas entraron fuera del horario de atención: si son muchas, el
      // problema no es que el equipo tarde, es a qué hora escriben.
      fueraDeHorario,
    },
    tramos,
    asesores: filas,
    pendientes: pendientes.sort((a, b) => b.esperandoMin - a.esperandoMin),
  };
}
