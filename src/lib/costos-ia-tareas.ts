// ============================================================
// Qué cuesta cada tarea de IA — el registro, SIN Prisma.
//
// Vive aparte de `costos-ia.ts` por lo mismo que `cotizacion-textos.ts`
// vive aparte de `cotizacion-config.ts`: ese archivo importa Prisma, y
// esto lo usa un componente de cliente. Si estuviera todo junto, el
// navegador terminaría arrastrando el cliente de base de datos.
//
// ⚠️ Los números de aquí son el ÚLTIMO recurso: solo se usan mientras
// una tarea no se haya ejecutado nunca. En cuanto hay historial manda el
// promedio REAL de lo que se cobró, que sale de los registros. Se
// comprobó que hacía falta: la estimación del SEO por tamaño de prompt
// daba US$ 0,012 y el promedio real de seis corridas es US$ 0,0176 — un
// 30 % más, porque los productos reales traen más imágenes que describir.
// ============================================================

import { MODELOS, MODELO_POR_TAREA, type IdModelo } from "@/lib/sembli/modelos";

export type ClaveTareaIA = "seo" | "ficha" | "producto" | "nexus";

export interface TareaIA {
  clave: ClaveTareaIA;
  /** Cómo se llama en pantalla. */
  label: string;
  /** Qué hace, en una línea, para el globo de detalle. */
  descripcion: string;
  /** La acción con la que queda en `logs`, de donde sale el costo real. */
  accionLog: string;
  modelo: IdModelo;
  /** Tokens típicos, solo para cuando no hay historial. */
  tokensEntrada: number;
  tokensSalida: number;
}

export const TAREAS_IA: Record<ClaveTareaIA, TareaIA> = {
  seo: {
    clave: "seo",
    label: "Generar SEO",
    descripcion: "Meta título, descripción, palabras clave y el alt de cada imagen.",
    accionLog: "IA_SEO",
    modelo: MODELO_POR_TAREA.seo,
    tokensEntrada: 900,
    tokensSalida: 1050,
  },
  ficha: {
    clave: "ficha",
    label: "Leer ficha técnica",
    descripcion: "Saca los campos del PDF y llena el formulario.",
    accionLog: "IA_FICHA_PDF",
    modelo: MODELO_POR_TAREA.ficha,
    // Un PDF entero de entrada: es con diferencia la tarea más cara.
    tokensEntrada: 12_000,
    tokensSalida: 1_500,
  },
  producto: {
    clave: "producto",
    label: "Redactar producto",
    descripcion: "Escribe la descripción corta y larga a partir del nombre.",
    accionLog: "IA_PRODUCTO",
    modelo: MODELO_POR_TAREA.clasificar,
    tokensEntrada: 700,
    tokensSalida: 600,
  },
  nexus: {
    clave: "nexus",
    label: "Sugerir respuesta",
    descripcion: "Propone una respuesta para la conversación abierta.",
    accionLog: "IA_NEXUS_REPLY",
    modelo: MODELO_POR_TAREA.nexus,
    tokensEntrada: 1_200,
    tokensSalida: 300,
  },
};

/** Lo que costaría según los tokens declarados. Solo sin historial. */
export function costoDeclarado(t: TareaIA): number {
  const tarifa = MODELOS[t.modelo].usdPorMTok;
  return (t.tokensEntrada / 1_000_000) * tarifa.entrada + (t.tokensSalida / 1_000_000) * tarifa.salida;
}

export interface CostoTarea {
  clave: ClaveTareaIA;
  label: string;
  descripcion: string;
  modelo: string;
  /** USD por ejecución. */
  costoUSD: number;
  /** De dónde sale el número: importa más que el número mismo. */
  origen: "medido" | "estimado";
  /** Sobre cuántas corridas está sacado el promedio. */
  corridas: number;
}

/**
 * Formatea el costo para enseñarlo al lado de un botón.
 *
 * Estas tareas cuestan milésimas de dólar, así que redondear a dos
 * decimales las convierte todas en "US$ 0,00" y el aviso deja de decir
 * nada. Se usan cuatro cuando hace falta.
 */
export function formatoUSD(v: number): string {
  if (v <= 0) return "—";
  return `US$ ${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;
}
