// ============================================================
// SEMBLI — Registro de modelos de Claude y forma de cada request
//
// ⚠️ Cada modelo de Claude acepta parámetros distintos. Enviar el
// parámetro equivocado devuelve 400 y rompe el agente en producción.
// Este archivo centraliza esas diferencias en un solo lugar.
//
// Fuente: docs de Anthropic (2026-07). Resumen de las trampas:
//
//  claude-haiku-4-5   200K ctx · US$1/US$5 por MTok
//    · `output_config.effort` NO existe → error si se envía.
//    · Thinking usa el formato viejo {type:"enabled", budget_tokens}.
//    · `temperature` sí se acepta.
//    · Prefijo mínimo cacheable: 4096 tokens.
//
//  claude-sonnet-5    1M ctx · US$3/US$15 (intro US$2/US$10 hasta 2026-08-31)
//    · Si se OMITE `thinking`, piensa igual (adaptive por defecto) y
//      gasta tokens. Hay que apagarlo explícitamente.
//    · `budget_tokens` → 400. Solo {type:"adaptive"} o {type:"disabled"}.
//    · `temperature`/`top_p`/`top_k` con valor no-default → 400.
//    · `effort`: low | medium | high | xhigh | max.
// ============================================================

export type IdModelo = "claude-haiku-4-5" | "claude-sonnet-5";

/** Nivel de esfuerzo (solo Sonnet 5 lo soporta). */
export type Esfuerzo = "low" | "medium" | "high" | "xhigh" | "max";

interface Capacidades {
  /** Ventana de contexto en tokens. */
  contexto: number;
  /** Tokens mínimos para que el prompt caching realmente guarde algo. */
  prefijoMinimoCache: number;
  /** ¿Acepta output_config.effort? (Haiku 4.5 no) */
  soportaEsfuerzo: boolean;
  /** ¿Acepta temperature? (Sonnet 5 no, con valor distinto al default) */
  soportaTemperatura: boolean;
  /** Si se omite `thinking`, ¿piensa de todos modos? (Sonnet 5 sí) */
  piensaPorDefecto: boolean;
  /** Costo aproximado en USD por millón de tokens, para estimar gasto. */
  usdPorMTok: { entrada: number; salida: number };
}

export const MODELOS: Record<IdModelo, Capacidades> = {
  "claude-haiku-4-5": {
    contexto: 200_000,
    prefijoMinimoCache: 4096,
    soportaEsfuerzo: false,
    soportaTemperatura: true,
    piensaPorDefecto: false,
    usdPorMTok: { entrada: 1, salida: 5 },
  },
  "claude-sonnet-5": {
    contexto: 1_000_000,
    prefijoMinimoCache: 4096,
    soportaEsfuerzo: true,
    soportaTemperatura: false,
    piensaPorDefecto: true,
    usdPorMTok: { entrada: 3, salida: 15 },
  },
};

/**
 * Qué modelo usa cada tarea. Estrategia híbrida para gastar poco:
 * el chat (alto volumen) va en Haiku; solo las tareas puntuales de
 * calidad alta pagan Sonnet.
 */
export const MODELO_POR_TAREA = {
  /** Conversación del asistente Sembli. Alto volumen → el más barato. */
  chat: "claude-haiku-4-5",
  /** Redactar respuestas sugeridas en Nexus. Alto volumen. */
  nexus: "claude-haiku-4-5",
  /** Clasificar / extraer datos cortos. */
  clasificar: "claude-haiku-4-5",
  /** Leer la ficha técnica PDF y llenar campos. Calidad importa. */
  ficha: "claude-sonnet-5",
  /** Generar SEO del producto. Calidad importa. */
  seo: "claude-sonnet-5",
} as const satisfies Record<string, IdModelo>;

export type Tarea = keyof typeof MODELO_POR_TAREA;

/**
 * Construye los parámetros específicos del modelo, saneados.
 *
 * Devuelve solo los campos que ESE modelo acepta: nunca manda `effort`
 * a Haiku ni `temperature` a Sonnet, y siempre define `thinking` de
 * forma explícita para que Sonnet no piense (y cobre) sin querer.
 */
export function parametrosDeModelo(
  modelo: IdModelo,
  opciones: { pensar?: boolean; esfuerzo?: Esfuerzo; temperatura?: number } = {},
): Record<string, unknown> {
  const cap = MODELOS[modelo];
  const pensar = opciones.pensar ?? false;
  const params: Record<string, unknown> = {};

  if (cap.soportaEsfuerzo) {
    // Sonnet 5: thinking siempre explícito. Omitirlo activa adaptive
    // y gasta tokens de pensamiento que normalmente no necesitamos.
    params.thinking = pensar ? { type: "adaptive" } : { type: "disabled" };
    if (pensar) params.output_config = { effort: opciones.esfuerzo ?? "medium" };
  } else if (pensar) {
    // Haiku 4.5: formato antiguo. budget_tokens debe ser < max_tokens.
    params.thinking = { type: "enabled", budget_tokens: 2048 };
  }

  if (cap.soportaTemperatura && opciones.temperatura !== undefined) {
    params.temperature = opciones.temperatura;
  }

  return params;
}

/** Costo estimado en USD de una llamada, para el registro de consumo. */
export function costoUSD(
  modelo: IdModelo,
  // La API devuelve `null` (no `undefined`) en los campos de caché cuando no hubo.
  uso: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): number {
  const { entrada, salida } = MODELOS[modelo].usdPorMTok;
  const entradaViva = (uso.input_tokens ?? 0) / 1_000_000;
  // Los tokens leídos de caché cuestan ~10% del precio de entrada.
  const entradaCache = ((uso.cache_read_input_tokens ?? 0) / 1_000_000) * 0.1;
  const salidaTok = (uso.output_tokens ?? 0) / 1_000_000;
  return (entradaViva + entradaCache) * entrada + salidaTok * salida;
}
