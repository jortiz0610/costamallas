// ============================================================
// El estado de un cliente, calculado.
//
// Antes era un desplegable de siete opciones que alguien elegía a mano.
// Lo que quedó en la base después de meses: 19 "cliente activo", 9
// "interesado", 2 "recurrente" y 1 "prospecto". Es decir, casi todo el
// mundo activo — porque nadie vuelve a una ficha a degradar a alguien
// que dejó de comprar. Un campo que solo sube no informa de nada, y
// encima el embudo y los informes lo estaban usando como si fuera cierto.
//
// Ahora sale de los hechos: cotizaciones, aprobaciones y la última señal
// de vida. No se puede escribir a mano, a propósito.
//
// Este archivo es cálculo puro: sirve igual en el servidor y en el
// navegador. Quien lee la base y guarda el resultado es
// `estados-cliente-server.ts`.
// ============================================================

export type EstadoCliente =
  | "PROSPECTO"
  | "INTERESADO"
  | "EN_SEGUIMIENTO"
  | "CLIENTE_ACTIVO"
  | "VIP"
  | "INACTIVO";

export interface MetaEstado {
  v: EstadoCliente;
  l: string;
  /** Cuándo se llega a este estado, en una línea. Sale en la pantalla. */
  cuando: string;
  dot: string;
  bg: string;
  text: string;
}

/** El orden es el del recorrido comercial, no alfabético. */
export const ESTADOS_CLIENTE: MetaEstado[] = [
  {
    v: "PROSPECTO", l: "Prospecto",
    cuando: "Hubo un primer contacto y todavía no ha pedido una cotización.",
    dot: "#9ca3af", bg: "#f3f4f6", text: "#6b7280",
  },
  {
    v: "INTERESADO", l: "Interesado",
    cuando: "Pidió una cotización y sigue viva.",
    dot: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8",
  },
  {
    v: "EN_SEGUIMIENTO", l: "En seguimiento",
    cuando: "Se le cotizó y nunca aprobó. Sigue recibiendo publicidad.",
    dot: "#94a3b8", bg: "#f1f5f9", text: "#475569",
  },
  {
    v: "CLIENTE_ACTIVO", l: "Cliente activo",
    cuando: "Ya compró: aprobó una cotización o tiene un pedido.",
    dot: "#10b981", bg: "#d1fae5", text: "#065f46",
  },
  {
    v: "VIP", l: "VIP",
    cuando: "Empresa con más de 5 negocios cerrados.",
    dot: "#eab308", bg: "#fef9c3", text: "#854d0e",
  },
  {
    v: "INACTIVO", l: "Inactivo",
    cuando: "Más de 6 meses sin ninguna interacción, chat incluido.",
    dot: "#dc2626", bg: "#fee2e2", text: "#991b1b",
  },
];

export const ESTADO_POR_CLAVE: Record<string, MetaEstado> =
  Object.fromEntries(ESTADOS_CLIENTE.map(e => [e.v, e]));

/**
 * Los tres que se retiran, y a qué se traducen.
 *
 * Se conserva el mapa —y no solo el UPDATE de la migración— porque una
 * ficha vieja abierta en una pestaña, o un export guardado, pueden traer
 * el valor antiguo. Es preferible pintarlo traducido que pintar un hueco.
 */
export const ESTADOS_RETIRADOS: Record<string, EstadoCliente> = {
  CALIFICADO: "INTERESADO",
  RECURRENTE: "CLIENTE_ACTIVO",
  NO_CALIFICADO: "EN_SEGUIMIENTO",
};

/** Cómo pintar un estado, incluidos los que ya no se calculan. */
export function metaEstado(estado: string | null | undefined): MetaEstado {
  if (!estado) return ESTADO_POR_CLAVE.PROSPECTO;
  const directo = ESTADO_POR_CLAVE[estado];
  if (directo) return directo;
  const traducido = ESTADOS_RETIRADOS[estado];
  return traducido ? ESTADO_POR_CLAVE[traducido] : ESTADO_POR_CLAVE.PROSPECTO;
}

// ─────────────────────────────────────────────
// El cálculo
// ─────────────────────────────────────────────

/** Meses de silencio a partir de los cuales un cliente queda inactivo. */
export const MESES_PARA_INACTIVO = 6;

/** Empresa que supera esto pasa a VIP. "Más de 5" es estrictamente > 5. */
export const APROBADAS_PARA_VIP = 5;

/**
 * Estados de cotización que cuentan como "todavía puede cerrarse".
 * Una vencida o rechazada ya no mantiene a nadie en "interesado": ahí es
 * donde empezaba a mentir el estado escrito a mano.
 */
export const COTIZACION_VIVA = new Set(["BORRADOR", "ENVIADA", "EN_REVISION"]);

/**
 * Pedidos que NO cuentan como una compra. Todo lo demás sí: un pedido
 * nuevo o confirmado ya es una venta hecha.
 */
export const PEDIDO_NO_CUENTA = new Set(["CANCELADO", "ANULADO"]);

export interface SenalesCliente {
  /** "persona" o "empresa". Solo las empresas pueden llegar a VIP. */
  tipo: string;
  creadoEn: Date;
  cotizacionesTotal: number;
  cotizacionesAprobadas: number;
  /** Cuántas siguen pudiendo cerrarse. */
  cotizacionesVivas: number;
  /**
   * Compras que NO nacieron de una cotización del portal: las de la
   * tienda web, las telefónicas, las importadas de WooCommerce.
   *
   * ⚠️ Existe por un hallazgo contra la base real: la regla tal como se
   * pidió —"cliente activo = aprobó una cotización"— degradaba a
   * PROSPECTO a 20 de los 31 clientes, porque casi todos compraron por
   * la tienda y nunca tuvieron una cotización en el portal. Un cliente
   * con un pedido entregado es un cliente, se le haya cotizado o no.
   *
   * Se cuentan solo los que NO tienen cotización asociada, para no
   * contar dos veces la misma venta: una cotización aprobada crea su
   * pedido automáticamente.
   */
  pedidosGanados: number;
  /**
   * Lo más reciente de todo: cotización, pedido o mensaje de chat. Nulo
   * = nunca pasó nada, y entonces manda la fecha de creación.
   */
  ultimaInteraccion: Date | null;
}

export interface ResultadoEstado {
  estado: EstadoCliente;
  /** Por qué salió ese estado. Se muestra en la ficha. */
  motivo: string;
  ultimaInteraccion: Date;
}

/**
 * El estado que le corresponde a un cliente ahora mismo.
 *
 * El orden importa y es deliberado: el silencio manda sobre todo lo
 * demás. Un VIP que lleva ocho meses sin aparecer es un problema
 * comercial, y dejarlo pintado de dorado en la lista es justamente lo
 * que impide verlo.
 */
export function calcularEstadoCliente(s: SenalesCliente, ahora = new Date()): ResultadoEstado {
  const ultima = s.ultimaInteraccion ?? s.creadoEn;

  const corte = new Date(ahora);
  corte.setMonth(corte.getMonth() - MESES_PARA_INACTIVO);

  if (ultima < corte) {
    return {
      estado: "INACTIVO",
      motivo: `Sin ninguna interacción desde hace más de ${MESES_PARA_INACTIVO} meses.`,
      ultimaInteraccion: ultima,
    };
  }

  // Negocios cerrados: cotizaciones aprobadas más las compras que nunca
  // pasaron por una cotización (tienda web, teléfono).
  const cierres = s.cotizacionesAprobadas + s.pedidosGanados;

  if (s.tipo === "empresa" && cierres > APROBADAS_PARA_VIP) {
    return {
      estado: "VIP",
      motivo: `Empresa con ${cierres} negocios cerrados.`,
      ultimaInteraccion: ultima,
    };
  }

  if (cierres > 0) {
    const partes: string[] = [];
    if (s.cotizacionesAprobadas > 0) {
      partes.push(s.cotizacionesAprobadas === 1
        ? "aprobó una cotización"
        : `aprobó ${s.cotizacionesAprobadas} cotizaciones`);
    }
    if (s.pedidosGanados > 0) {
      partes.push(s.pedidosGanados === 1
        ? "tiene un pedido sin cotización previa"
        : `tiene ${s.pedidosGanados} pedidos sin cotización previa`);
    }
    return {
      estado: "CLIENTE_ACTIVO",
      motivo: `Ya compró: ${partes.join(" y ")}.`,
      ultimaInteraccion: ultima,
    };
  }

  if (s.cotizacionesVivas > 0) {
    return {
      estado: "INTERESADO",
      motivo: s.cotizacionesVivas === 1
        ? "Tiene una cotización abierta."
        : `Tiene ${s.cotizacionesVivas} cotizaciones abiertas.`,
      ultimaInteraccion: ultima,
    };
  }

  if (s.cotizacionesTotal > 0) {
    return {
      estado: "EN_SEGUIMIENTO",
      motivo: `Se le cotizó ${s.cotizacionesTotal} ${s.cotizacionesTotal === 1 ? "vez" : "veces"} y nunca aprobó.`,
      ultimaInteraccion: ultima,
    };
  }

  return {
    estado: "PROSPECTO",
    motivo: "Hubo contacto, todavía no ha pedido una cotización.",
    ultimaInteraccion: ultima,
  };
}
