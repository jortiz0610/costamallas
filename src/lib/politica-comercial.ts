// ============================================================
// Política comercial: hasta dónde puede llegar un asesor solo.
//
// Dos reglas, las dos parametrizables (nada quemado en el código):
//   · Descuento máximo sin visto bueno.
//   · Anticipo mínimo exigible.
//
// Pasarse de cualquiera de las dos no bloquea el trabajo: deja la oferta
// esperando aprobación de un administrador. Lo que sí bloquea es
// ENVIARLA o convertirla en pedido, que es donde el descuento se vuelve
// un compromiso con el cliente.
//
// Quién aprobó, cuándo y con qué nota queda guardado en la cotización.
// Una regla que no deja rastro de sus excepciones no es una regla.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface PoliticaComercial {
  /** Descuento máximo (%) que un asesor puede dar sin aprobación. */
  descuentoMaxPct: number;
  /** Anticipo mínimo (%) que debe pactarse. */
  anticipoMinPct: number;
  /** Apagado, las dos reglas se informan pero no frenan nada. */
  exigirAprobacion: boolean;
}

export const POLITICA_DEFAULTS: PoliticaComercial = {
  descuentoMaxPct: 5,
  anticipoMinPct: 50,
  exigirAprobacion: true,
};

const CLAVES: Record<keyof PoliticaComercial, string> = {
  descuentoMaxPct: "com_descuento_max_pct",
  anticipoMinPct: "com_anticipo_min_pct",
  exigirAprobacion: "com_exigir_aprobacion",
};

export async function getPoliticaComercial(): Promise<PoliticaComercial> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  const num = (k: keyof PoliticaComercial) => {
    const v = Number(map[CLAVES[k]]);
    return Number.isFinite(v) && v >= 0 ? v : (POLITICA_DEFAULTS[k] as number);
  };

  return {
    descuentoMaxPct: num("descuentoMaxPct"),
    anticipoMinPct: num("anticipoMinPct"),
    exigirAprobacion: map[CLAVES.exigirAprobacion] === undefined
      ? POLITICA_DEFAULTS.exigirAprobacion
      : map[CLAVES.exigirAprobacion] === "true",
  };
}

export async function setPoliticaComercial(datos: Partial<PoliticaComercial>) {
  for (const [campo, valor] of Object.entries(datos)) {
    const clave = CLAVES[campo as keyof PoliticaComercial];
    if (!clave || valor === undefined) continue;
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: String(valor), descripcion: "Política comercial" },
      update: { valor: String(valor) },
    });
  }
}

/**
 * Descuento efectivo de una cotización, en porcentaje.
 *
 * Suma el descuento por línea y el global: al cliente le da igual dónde
 * se aplicó, y un tope que solo mirara el global se saltaría poniendo el
 * 30% línea por línea.
 */
export function descuentoEfectivoPct(
  items: { cantidad: number; precioUnitario: number }[],
  descuentoGlobalPct: number,
  subtotalConDescuentoDeLinea: number,
): number {
  const bruto = items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  if (bruto <= 0) return 0;
  const neto = subtotalConDescuentoDeLinea * (1 - (descuentoGlobalPct || 0) / 100);
  return Math.round(((bruto - neto) / bruto) * 10000) / 100;
}

export interface Veredicto {
  requiere: boolean;
  motivo: string | null;
}

/** ¿Esta oferta se sale de la política? Devuelve el motivo en castellano. */
export function evaluarPolitica(
  datos: { descuentoPct: number; anticipoPct: number | null },
  cfg: PoliticaComercial,
): Veredicto {
  if (!cfg.exigirAprobacion) return { requiere: false, motivo: null };

  const motivos: string[] = [];
  if (datos.descuentoPct > cfg.descuentoMaxPct) {
    motivos.push(
      `Descuento del ${datos.descuentoPct}% (el tope sin aprobación es ${cfg.descuentoMaxPct}%)`,
    );
  }
  // Un anticipo sin definir NO se castiga: se entiende que aplica el
  // mínimo. Solo se revisa cuando el asesor puso uno más bajo a propósito.
  if (datos.anticipoPct != null && datos.anticipoPct < cfg.anticipoMinPct) {
    motivos.push(
      `Anticipo del ${datos.anticipoPct}% (el mínimo es ${cfg.anticipoMinPct}%)`,
    );
  }

  return motivos.length
    ? { requiere: true, motivo: motivos.join(". ") + "." }
    : { requiere: false, motivo: null };
}
