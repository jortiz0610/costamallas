// ============================================================
// Formas de pago y sus plazos → fecha de vencimiento de la factura.
//
// Había facturas sin `fechaVence`, y la cartera tenía que estimarles la
// antigüedad con la fecha de emisión. Una factura sin vencimiento no se
// puede cobrar: no hay contra qué decir que está vencida.
//
// ⚠️ Los plazos de arranque (contado 0 · crédito 30) son un valor
// razonable, NO la política confirmada de Costamallas. Gerencia tiene
// que revisarlos: está anotado en PENDIENTES-GERENCIA.md. Por eso todo
// esto es editable desde el portal y no está quemado en el código.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface PlazoPago {
  /** Lo que se guarda en `facturas.formaPago`. */
  valor: string;
  label: string;
  /** Días calendario desde la emisión. 0 = se paga de contado. */
  dias: number;
}

export const PLAZOS_DEFAULTS: PlazoPago[] = [
  { valor: "CONTADO", label: "Contado", dias: 0 },
  { valor: "CREDITO_30", label: "Crédito 30 días", dias: 30 },
];

const CLAVE = "fact_plazos";

export async function getPlazosPago(): Promise<PlazoPago[]> {
  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE }, select: { valor: true } });
  if (!fila?.valor) return PLAZOS_DEFAULTS;
  try {
    const parsed = JSON.parse(fila.valor);
    if (!Array.isArray(parsed) || !parsed.length) return PLAZOS_DEFAULTS;
    return parsed
      .filter((p: PlazoPago) => p?.valor && Number.isFinite(Number(p.dias)))
      .map((p: PlazoPago) => ({
        valor: String(p.valor).trim(),
        label: String(p.label ?? p.valor).trim(),
        dias: Math.max(0, Math.round(Number(p.dias))),
      }));
  } catch {
    // Un JSON corrupto no debe dejar sin formas de pago a la facturación.
    return PLAZOS_DEFAULTS;
  }
}

export async function setPlazosPago(plazos: PlazoPago[]) {
  const limpio = plazos
    .filter(p => p?.valor?.trim())
    .map(p => ({
      valor: p.valor.trim().toUpperCase().replace(/\s+/g, "_"),
      label: (p.label || p.valor).trim(),
      dias: Math.max(0, Math.round(Number(p.dias) || 0)),
    }));
  if (!limpio.length) throw new Error("Tiene que quedar al menos una forma de pago.");

  await prisma.configuracion.upsert({
    where: { clave: CLAVE },
    create: { clave: CLAVE, valor: JSON.stringify(limpio), descripcion: "Formas de pago y plazos" },
    update: { valor: JSON.stringify(limpio) },
  });
}

const DIA = 86_400_000;

/**
 * Fecha de vencimiento según la forma de pago.
 *
 * Devuelve null si la forma de pago no está en la tabla: es preferible
 * dejar la factura sin fecha (y que salga en la lista de pendientes por
 * corregir) que inventarle un plazo que nadie pactó.
 */
export function calcularFechaVence(
  formaPago: string | null | undefined,
  desde: Date,
  plazos: PlazoPago[],
): Date | null {
  if (!formaPago) return null;
  const p = plazos.find(x => x.valor === formaPago);
  if (!p) return null;
  return new Date(desde.getTime() + p.dias * DIA);
}
