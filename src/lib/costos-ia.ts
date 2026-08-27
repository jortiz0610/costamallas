// ============================================================
// Qué cuesta cada tarea de IA — con los números REALES.
//
// Cada ruta de IA ya venía dejando el costo en `logs`
// (`resultado: "… usd=0.01827"`). Nadie lo miraba. Aquí se lee ese
// historial y se saca el promedio, que es lo que se le enseña a quien
// está a punto de apretar el botón.
//
// Por qué el promedio real y no una estimación por tamaño de prompt: se
// probaron las dos. La estimación del SEO daba US$ 0,012 y el promedio
// real de seis corridas es US$ 0,0176 — un 30 % más, porque los
// productos de verdad traen más imágenes que describir de las que
// supone el cálculo. Un aviso de costo que se queda corto es peor que
// no tenerlo: da confianza falsa.
//
// La mediana en vez del promedio, además, porque una sola corrida rara
// (un PDF de 80 páginas) arrastra el promedio y hace que todas las demás
// parezcan más caras de lo que son.
// ============================================================

import { prisma } from "@/lib/prisma";
import {
  TAREAS_IA, costoDeclarado, type ClaveTareaIA, type CostoTarea, type TareaIA,
} from "@/lib/costos-ia-tareas";

export { TAREAS_IA, formatoUSD } from "@/lib/costos-ia-tareas";
export type { ClaveTareaIA, CostoTarea } from "@/lib/costos-ia-tareas";

/** Cuántas corridas se miran hacia atrás. Suficiente para que un cambio
 *  de modelo o de prompt se refleje pronto, y no tantas como para que un
 *  precio viejo siga mandando. */
const VENTANA = 30;

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Saca el `usd=` que las rutas de IA dejan en el campo `resultado`. */
function usdDe(resultado: string | null): number | null {
  const m = resultado?.match(/usd=([\d.]+)/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export async function costosIA(): Promise<CostoTarea[]> {
  const claves = Object.keys(TAREAS_IA) as ClaveTareaIA[];

  const registros = await prisma.log.findMany({
    where: { accion: { in: claves.map(c => TAREAS_IA[c].accionLog) } },
    select: { accion: true, resultado: true },
    orderBy: { createdAt: "desc" },
    take: VENTANA * claves.length,
  });

  const porAccion = new Map<string, number[]>();
  for (const r of registros) {
    const usd = usdDe(r.resultado);
    if (usd === null) continue;
    const lista = porAccion.get(r.accion) ?? [];
    if (lista.length < VENTANA) lista.push(usd);
    porAccion.set(r.accion, lista);
  }

  return claves.map((clave) => {
    const t: TareaIA = TAREAS_IA[clave];
    const reales = porAccion.get(t.accionLog) ?? [];
    const medido = reales.length > 0;
    return {
      clave,
      label: t.label,
      descripcion: t.descripcion,
      modelo: t.modelo,
      costoUSD: medido ? mediana(reales) : costoDeclarado(t),
      origen: medido ? "medido" : "estimado",
      corridas: reales.length,
    };
  });
}

/** Lo que cuesta UNA tarea. Lo usa el estimador del lote de SEO. */
export async function costoDeTarea(clave: ClaveTareaIA): Promise<CostoTarea> {
  const todos = await costosIA();
  return todos.find(c => c.clave === clave)!;
}
