// ============================================================
// El pipeline comercial: en qué punto está cada oferta.
//
// Los nombres los decidió gerencia y describen LO QUE PASÓ, no lo que
// alguien debería hacer — salvo una, "Para llamar", que lleva nombre
// imperativo a propósito porque es la única etapa donde el vendedor
// tiene que actuar.
//
//   Enviada        acaba de salir, arrancó el reloj
//   Recordada      ya le llegó el correo de las 24 h        (automático)
//   Para llamar    le toca al vendedor                      ← LA SUYA
//   Por vencer     salió el último correo, con el botón de aprobar
//   Vencidas       al final, con ojito para ocultar
//   En producción  el cliente aprobó
//   Completados    la obra salió de producción
//
// La etapa NO se guarda en una columna: se CALCULA de los hechos que ya
// existen —el estado de la cotización, los tres toques del seguimiento y
// el estado del pedido—. Una columna `etapa` sería un cuarto sitio donde
// la verdad puede desincronizarse, y ya hay tres.
//
// Este archivo es cálculo puro y sirve igual en el navegador.
// ============================================================

export type EtapaPipeline =
  | "ENVIADA"
  | "RECORDADA"
  | "PARA_LLAMAR"
  | "POR_VENCER"
  | "VENCIDAS"
  | "EN_PRODUCCION"
  | "COMPLETADOS";

export interface MetaEtapa {
  v: EtapaPipeline;
  l: string;
  /** Qué significa, en una línea. Sale bajo el título de la columna. */
  descripcion: string;
  /** Quién tiene que hacer algo. "—" = nadie, va sola. */
  actua: string;
  color: string;
  bg: string;
  /** Nace plegada. Solo "Vencidas": son historia y llenan la pantalla. */
  ocultaPorDefecto?: boolean;
}

export const ETAPAS: MetaEtapa[] = [
  {
    v: "ENVIADA", l: "Enviada",
    descripcion: "Acaba de salir. Arrancó el reloj.",
    actua: "—", color: "#1d4ed8", bg: "#eff6ff",
  },
  {
    v: "RECORDADA", l: "Recordada",
    descripcion: "Ya le llegó el correo de las 24 h.",
    actua: "Automático", color: "#0369a1", bg: "#e0f2fe",
  },
  {
    v: "PARA_LLAMAR", l: "Para llamar",
    descripcion: "Te toca a ti. Márcala cuando hayas llamado.",
    actua: "Tú", color: "#b45309", bg: "#fef3c7",
  },
  {
    v: "POR_VENCER", l: "Por vencer",
    descripcion: "Salió el último correo, con el botón de aprobar.",
    actua: "Automático", color: "#c2410c", bg: "#ffedd5",
  },
  {
    v: "VENCIDAS", l: "Vencidas",
    descripcion: "Caducaron. Se pueden aplazar.",
    actua: "—", color: "#b91c1c", bg: "#fee2e2",
    ocultaPorDefecto: true,
  },
  {
    v: "EN_PRODUCCION", l: "En producción",
    descripcion: "El cliente aprobó. La obra está en marcha.",
    actua: "Producción", color: "#065f46", bg: "#d1fae5",
  },
  {
    v: "COMPLETADOS", l: "Completados",
    descripcion: "Salió de producción. A las 24 h se manda la encuesta.",
    actua: "—", color: "#4338ca", bg: "#e0e7ff",
  },
];

export const ETAPA_POR_CLAVE: Record<string, MetaEtapa> =
  Object.fromEntries(ETAPAS.map(e => [e.v, e]));

/** Estados de pedido que significan "ya salió de producción". */
export const PEDIDO_TERMINADO = new Set(["ENTREGADO", "INSTALADO", "COMPLETADO"]);
/** Y los que significan "murió": no van a ninguna columna. */
export const PEDIDO_MUERTO = new Set(["CANCELADO", "ANULADO"]);

export interface SenalesPipeline {
  /** BORRADOR · ENVIADA · APROBADA · RECHAZADA · VENCIDA */
  estado: string;
  /** Los toques del seguimiento: número → estado. */
  toques: Record<number, string>;
  /** Estado del pedido que nació de esta oferta, si hay. */
  estadoPedido?: string | null;
}

/**
 * En qué columna va esta oferta.
 *
 * Devuelve `null` para lo que no pinta nada en el tablero: un borrador
 * (nadie lo ha visto) y una rechazada (es historia y no hay nada que
 * hacer con ella).
 */
export function etapaDe(s: SenalesPipeline): EtapaPipeline | null {
  // Lo aprobado manda: una vez hay pedido, el reloj del seguimiento deja
  // de importar.
  if (s.estado === "APROBADA") {
    if (s.estadoPedido && PEDIDO_MUERTO.has(s.estadoPedido)) return null;
    if (s.estadoPedido && PEDIDO_TERMINADO.has(s.estadoPedido)) return "COMPLETADOS";
    return "EN_PRODUCCION";
  }

  if (s.estado === "VENCIDA") return "VENCIDAS";
  if (s.estado !== "ENVIADA") return null; // borrador o rechazada

  // Los tres toques, del último al primero: la etapa es hasta dónde
  // llegó el seguimiento.
  const hecho = (n: number) => ["ENVIADO", "HECHO"].includes(s.toques[n] ?? "");

  if (hecho(3)) return "POR_VENCER";
  // El toque 2 es una TAREA para una persona. Mientras esté pendiente,
  // la oferta está esperando al vendedor: esa es la etapa que lleva
  // nombre imperativo.
  if (s.toques[2] && !hecho(2)) return "PARA_LLAMAR";
  if (hecho(2)) return "RECORDADA"; // llamó y todavía no toca el toque 3
  if (hecho(1)) return "RECORDADA";
  return "ENVIADA";
}

/** Días que lleva parada una oferta. Es lo que delata las estancadas. */
export function diasEn(desde: Date | string, ahora = new Date()): number {
  const d = typeof desde === "string" ? new Date(desde) : desde;
  return Math.max(0, Math.floor((ahora.getTime() - d.getTime()) / 86_400_000));
}
