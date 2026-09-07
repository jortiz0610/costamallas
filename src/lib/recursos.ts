// ============================================================
// Cuántos recursos está gastando el portal.
//
// Memoria, procesador, disco, la latencia de la base y el retraso del
// bucle de eventos. Se mide en el momento de preguntar; no se guarda
// historial, porque un historial hay que mantenerlo y esto es para
// mirar de reojo, no para hacer capacity planning.
//
// ⚠️ LO QUE ESTAS CIFRAS SIGNIFICAN DEPENDE DE DÓNDE CORRA EL PORTAL,
// y la diferencia es tan grande que la pantalla tiene que decirlo:
//
//   · En VERCEL cada petición la atiende una función que nace y muere.
//     "Memoria del sistema" es la de una máquina compartida que no es
//     tuya, el "tiempo encendido" son segundos, y el disco no se puede
//     ni consultar. Ahí estos números no sirven para decidir nada.
//   · En un SERVIDOR PROPIO son la máquina de verdad: si la memoria
//     sube y no baja hay una fuga, y si el disco se llena el portal
//     deja de escribir. Ahí sí valen.
//
// Por eso `entorno` viaja con la medición: la pantalla enseña lo mismo,
// pero avisa de lo que está mirando.
// ============================================================

import os from "node:os";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";

export type NivelRecurso = "ok" | "aviso" | "critico";

export interface Medidor {
  clave: string;
  titulo: string;
  /** 0-100. Es lo que pinta el arco. */
  porcentaje: number;
  /** El número grande, ya formateado. */
  valor: string;
  /** La línea de abajo: "3,1 GB de 7,7 GB". */
  detalle: string;
  nivel: NivelRecurso;
  /** Qué significa que esto se ponga en rojo. */
  significa?: string;
}

export interface Recursos {
  generadoEn: string;
  entorno: "vercel" | "servidor";
  /** El nombre de la máquina, o la región de Vercel. */
  donde: string;
  version: string;
  /** Segundos que lleva vivo el proceso. */
  encendido: number;
  medidores: Medidor[];
  /** Cosas que no son medidores pero se enseñan al lado. */
  datos: { etiqueta: string; valor: string }[];
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function formatoBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(1).replace(".", ",")} GB`;
  if (n >= MB) return `${Math.round(n / MB)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export function formatoTiempo(segundos: number): string {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${Math.round(segundos)} s`;
}

/** Los umbrales van en un solo sitio para que no se desvíen. */
function nivelPorcentaje(p: number, aviso = 75, critico = 90): NivelRecurso {
  return p >= critico ? "critico" : p >= aviso ? "aviso" : "ok";
}

/**
 * Cuánto tarda el bucle de eventos en atender un turno.
 *
 * Es la medida honesta de "¿va lento?". La memoria puede estar bien y el
 * procesador tranquilo, y aun así el portal ir a tirones porque algo
 * bloquea el hilo. Se mide pidiendo un `setTimeout` de 0 ms y viendo
 * cuánto se retrasa de verdad.
 */
function retrasoDelBucle(): Promise<number> {
  return new Promise(resolve => {
    const inicio = process.hrtime.bigint();
    setTimeout(() => {
      resolve(Number(process.hrtime.bigint() - inicio) / 1e6);
    }, 0);
  });
}

/**
 * Cuánto procesador está usando ESTE proceso, en un instante.
 *
 * No es `loadavg`: en Windows siempre da cero y dentro de un contenedor
 * es la carga del anfitrión entero, que incluye lo que no es nuestro.
 * Esto mide el proceso contra el tiempo real transcurrido.
 */
async function usoDeProcesador(ms = 120): Promise<number> {
  const antesCpu = process.cpuUsage();
  const antes = process.hrtime.bigint();
  await new Promise(r => setTimeout(r, ms));
  const usado = process.cpuUsage(antesCpu);
  const transcurrido = Number(process.hrtime.bigint() - antes) / 1000; // µs
  const nucleos = Math.max(os.cpus().length, 1);
  const pct = ((usado.user + usado.system) / transcurrido / nucleos) * 100;
  return Math.min(Math.max(pct, 0), 100);
}

/** Espacio del disco donde vive el portal. Devuelve null si no se puede. */
async function disco(): Promise<{ usado: number; total: number } | null> {
  try {
    // `statfs` no existe en todas las plataformas ni en todos los
    // sandboxes. Si no está, se dice que no se pudo, no se inventa.
    const s = await (fs as unknown as {
      statfs?: (p: string) => Promise<{ bsize: number; blocks: number; bavail: number }>;
    }).statfs?.(process.cwd());
    if (!s) return null;
    const total = s.bsize * s.blocks;
    const libre = s.bsize * s.bavail;
    if (!total) return null;
    return { usado: total - libre, total };
  } catch {
    return null;
  }
}

/** Cuánto tarda la base en contestar lo más simple que hay. */
async function latenciaBase(): Promise<number | null> {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Date.now() - t;
  } catch {
    return null;
  }
}

export async function medirRecursos(): Promise<Recursos> {
  const enVercel = Boolean(process.env.VERCEL);

  const [cpu, retraso, espacio, latencia] = await Promise.all([
    usoDeProcesador(),
    retrasoDelBucle(),
    disco(),
    latenciaBase(),
  ]);

  const mem = process.memoryUsage();
  const totalSistema = os.totalmem();
  const libreSistema = os.freemem();
  const usadoSistema = totalSistema - libreSistema;

  const medidores: Medidor[] = [];

  // ── Procesador ──
  medidores.push({
    clave: "cpu",
    titulo: "Procesador",
    porcentaje: Math.round(cpu),
    valor: `${Math.round(cpu)}%`,
    detalle: `${os.cpus().length} núcleo(s)`,
    nivel: nivelPorcentaje(cpu, 70, 90),
    significa: "Con esto arriba mucho rato, el portal responde lento a todo el mundo a la vez.",
  });

  // ── Memoria del sistema ──
  const pctMem = (usadoSistema / totalSistema) * 100;
  medidores.push({
    clave: "memoria",
    titulo: enVercel ? "Memoria de la máquina" : "Memoria del servidor",
    porcentaje: Math.round(pctMem),
    valor: `${Math.round(pctMem)}%`,
    detalle: `${formatoBytes(usadoSistema)} de ${formatoBytes(totalSistema)}`,
    nivel: nivelPorcentaje(pctMem, 80, 92),
    significa: "Si se llena, el sistema empieza a matar procesos y el portal se cae sin aviso.",
  });

  // ── Memoria del proceso ──
  // Contra el total del sistema, no contra el heap: lo que importa es
  // cuánto de la máquina se está llevando el portal.
  const pctProceso = (mem.rss / totalSistema) * 100;
  medidores.push({
    clave: "proceso",
    titulo: "Memoria del portal",
    porcentaje: Math.round(pctProceso),
    valor: formatoBytes(mem.rss),
    detalle: `${formatoBytes(mem.heapUsed)} en uso activo`,
    nivel: nivelPorcentaje(pctProceso, 60, 80),
    significa: "Si sube y nunca baja, hay una fuga de memoria.",
  });

  // ── Disco ──
  if (espacio) {
    const pctDisco = (espacio.usado / espacio.total) * 100;
    medidores.push({
      clave: "disco",
      titulo: "Disco",
      porcentaje: Math.round(pctDisco),
      valor: `${Math.round(pctDisco)}%`,
      detalle: `${formatoBytes(espacio.total - espacio.usado)} libres de ${formatoBytes(espacio.total)}`,
      nivel: nivelPorcentaje(pctDisco, 75, 88),
      significa: "Sin espacio no entran ni respaldos ni documentos, y la base deja de escribir.",
    });
  }

  // ── La base ──
  // La escala es a 500 ms a propósito: por encima de eso, cada pantalla
  // del portal se siente pesada, aunque técnicamente "funcione".
  if (latencia !== null) {
    medidores.push({
      clave: "base",
      titulo: "Respuesta de la base",
      porcentaje: Math.min(Math.round((latencia / 500) * 100), 100),
      valor: `${latencia} ms`,
      detalle: latencia < 50 ? "Al lado" : latencia < 200 ? "Normal" : "Lenta",
      nivel: latencia >= 400 ? "critico" : latencia >= 150 ? "aviso" : "ok",
      significa: "Es el suelo de lo que tarda CUALQUIER pantalla del portal.",
    });
  }

  // ── El bucle de eventos ──
  medidores.push({
    clave: "bucle",
    titulo: "Fluidez",
    porcentaje: Math.min(Math.round((retraso / 200) * 100), 100),
    valor: `${retraso.toFixed(0)} ms`,
    detalle: retraso < 20 ? "Suelto" : retraso < 80 ? "Con algo de cola" : "Atascado",
    nivel: retraso >= 150 ? "critico" : retraso >= 60 ? "aviso" : "ok",
    significa: "Mide si algo está bloqueando el portal. Alto y con el procesador bajo = hay una tarea pesada atravesada.",
  });

  const datos: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Node", valor: process.version },
    { etiqueta: "Sistema", valor: `${os.type()} ${os.release()}` },
    { etiqueta: "Encendido", valor: formatoTiempo(process.uptime()) },
  ];
  if (latencia === null) datos.push({ etiqueta: "Base de datos", valor: "no responde" });

  return {
    generadoEn: new Date().toISOString(),
    entorno: enVercel ? "vercel" : "servidor",
    donde: enVercel
      ? `Vercel · ${process.env.VERCEL_REGION ?? "región desconocida"}`
      : os.hostname(),
    version: process.env.PORTAL_VERSION ?? "—",
    encendido: Math.round(process.uptime()),
    medidores,
    datos,
  };
}
