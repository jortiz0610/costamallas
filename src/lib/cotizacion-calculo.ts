// ============================================================
// La cuenta de una cotización, en un solo sitio.
//
// Vivía duplicada en `/api/crm/cotizaciones` (POST) y en
// `.../[id]` (PUT), con `IVA_PCT = 0.19` escrito en los dos. Dos copias
// de una fórmula de dinero tienen garantizado separarse, y la que se
// separa es siempre la que nadie mira.
//
// ── AIU ─────────────────────────────────────────────────────
// Administración, Imprevistos y Utilidad. Es como se cotiza una obra en
// Colombia, y cambia el IVA por completo: en un contrato de
// construcción el IVA va sobre la UTILIDAD del constructor, no sobre el
// valor del contrato.
//
// Medido contra una cotización real de Costamallas (cerramiento de
// 1.350 m², costo directo $119.041.161):
//
//   como lo hacía el portal   IVA 19 % de todo  →  $22.617.821
//   como lo factura la empresa IVA 19 % de la U →  $ 2.261.782
//
// Diez veces. Por eso esto existe.
//
// ⚠️ Si un trabajo concreto va por el régimen de AIU lo decide el
// contador de la empresa, no este archivo. Aquí solo se hace la cuenta
// cuando alguien marca la casilla en la cotización.
//
// ── Por qué el material va aparte ───────────────────────────
// Decisión de gerencia (27-ago): en una oferta que mezcla material
// suelto con obra, el material lleva su 19 % normal y solo la obra pasa
// por AIU. Es el criterio conservador ante la DIAN. Por eso la base del
// AIU son los ítems de INSTALACIÓN, no el subtotal completo.
// ============================================================

/** El IVA general en Colombia. Único sitio donde vive este número. */
export const IVA_PCT = 0.19;

export interface ItemCalculo {
  cantidad: number;
  precioUnitario: number;
  /** Descuento de línea, en %. */
  descuento?: number;
  /** PRODUCTO (material) o INSTALACION (obra). */
  tipo?: string;
}

export interface OpcionesAIU {
  activo: boolean;
  adminPct: number;
  imprevPct: number;
  utilidadPct: number;
  /** Montos escritos a mano. `null` = se calcula del porcentaje. */
  adminMonto?: number | null;
  imprevMonto?: number | null;
  utilidadMonto?: number | null;
}

export const AIU_DEFAULTS: OpcionesAIU = {
  activo: false,
  adminPct: 10,
  imprevPct: 5,
  utilidadPct: 10,
};

export interface ResultadoCalculo {
  /** Suma de las líneas, antes del descuento global. */
  subtotal: number;
  /** Lo que se descontó en total (global sobre el subtotal). */
  descuento: number;
  /** Subtotal después del descuento global. */
  subtotalConDesc: number;

  /** Parte del subtotal que es material (ítems PRODUCTO). */
  subtotalMaterial: number;
  /** Parte que es obra (ítems INSTALACION). Es la base del AIU. */
  subtotalObra: number;

  aiuActivo: boolean;
  admin: number;
  imprevistos: number;
  utilidad: number;

  /** 19 % del material. */
  ivaMaterial: number;
  /** 19 % de la utilidad. Cero si el AIU está apagado. */
  ivaUtilidad: number;
  /** El IVA que se cobra en total. Es lo que va en `cotizacion.iva`. */
  iva: number;

  total: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Calcula una cotización completa.
 *
 * Sin AIU se comporta EXACTAMENTE como antes: 19 % sobre todo el
 * subtotal con descuento. Eso importa — las cotizaciones que ya existen
 * no pueden cambiar de total porque se agregó una función nueva.
 */
export function calcularCotizacion(
  items: ItemCalculo[],
  descuentoGlobalPct = 0,
  aiu: OpcionesAIU = AIU_DEFAULTS,
): ResultadoCalculo {
  let subtotal = 0;
  let brutoMaterial = 0;
  let brutoObra = 0;

  for (const it of items) {
    const sub = it.cantidad * it.precioUnitario * (1 - (it.descuento ?? 0) / 100);
    subtotal += sub;
    if (it.tipo === "INSTALACION") brutoObra += sub;
    else brutoMaterial += sub;
  }

  // El descuento global se reparte proporcionalmente entre material y
  // obra. Cargárselo entero a uno de los dos movería la base del AIU y
  // con ella el IVA, que es justo lo que no puede depender de un detalle
  // de implementación.
  const factor = 1 - descuentoGlobalPct / 100;
  const subtotalConDesc = subtotal * factor;
  const subtotalMaterial = brutoMaterial * factor;
  const subtotalObra = brutoObra * factor;

  const pct = (p: number, base: number) => (Number.isFinite(p) ? (p / 100) * base : 0);
  /** El monto escrito a mano manda; si no hay, sale del porcentaje. */
  const monto = (manual: number | null | undefined, p: number, base: number) =>
    manual != null && Number.isFinite(manual) ? manual : pct(p, base);

  const activo = aiu.activo;
  const admin = activo ? redondear(monto(aiu.adminMonto, aiu.adminPct, subtotalObra)) : 0;
  const imprevistos = activo ? redondear(monto(aiu.imprevMonto, aiu.imprevPct, subtotalObra)) : 0;
  const utilidad = activo ? redondear(monto(aiu.utilidadMonto, aiu.utilidadPct, subtotalObra)) : 0;

  // Con AIU: el material paga su IVA y la obra paga solo por la utilidad.
  // Sin AIU: todo paga 19 %, igual que siempre.
  const ivaMaterial = activo ? redondear(subtotalMaterial * IVA_PCT) : redondear(subtotalConDesc * IVA_PCT);
  const ivaUtilidad = activo ? redondear(utilidad * IVA_PCT) : 0;
  const iva = redondear(ivaMaterial + ivaUtilidad);

  const total = redondear(subtotalConDesc + admin + imprevistos + utilidad + iva);

  return {
    subtotal: redondear(subtotal),
    descuento: redondear(subtotal - subtotalConDesc),
    subtotalConDesc: redondear(subtotalConDesc),
    subtotalMaterial: redondear(subtotalMaterial),
    subtotalObra: redondear(subtotalObra),
    aiuActivo: activo,
    admin,
    imprevistos,
    utilidad,
    ivaMaterial,
    ivaUtilidad,
    iva,
    total,
  };
}

/**
 * Saca las opciones de AIU de lo que manda el formulario, saneadas.
 *
 * Los porcentajes se topan en 100: un 1000 % de administración por un
 * dedazo produciría una cotización absurda que alguien podría llegar a
 * mandar.
 */
export function leerAIU(b: Record<string, unknown>): OpcionesAIU {
  const num = (v: unknown, porDefecto: number, max: number) => {
    if (v == null || v === "") return porDefecto;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : porDefecto;
  };
  const montoOpc = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return {
    activo: b.aiuActivo === true,
    adminPct: num(b.aiuAdminPct, AIU_DEFAULTS.adminPct, 100),
    imprevPct: num(b.aiuImprevPct, AIU_DEFAULTS.imprevPct, 100),
    utilidadPct: num(b.aiuUtilidadPct, AIU_DEFAULTS.utilidadPct, 100),
    adminMonto: montoOpc(b.aiuAdmin),
    imprevMonto: montoOpc(b.aiuImprev),
    utilidadMonto: montoOpc(b.aiuUtilidad),
  };
}
