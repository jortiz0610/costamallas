// ============================================================
// El texto de un producto listo para mandárselo a un cliente.
//
// Vive aparte porque lo usan tres pantallas (la ficha del vendedor, el
// listado del catálogo y el inbox) y tienen que decir exactamente lo
// mismo: si dos sitios arman el mensaje por su cuenta, tarde o temprano
// uno de los dos manda un precio viejo.
//
// Regla: SOLO sale lo que está cargado. Si no hay precio, no hay línea
// de precio. Un renglón inventado en un WhatsApp a un cliente es peor
// que un renglón que falta, y aquí no hay nadie revisando antes de
// pulsar enviar.
// ============================================================

import { formatCOP } from "@/lib/utils";

export interface DatosFicha {
  nombre?: string | null;
  sku?: string | null;
  descCorta?: string | null;
  precioNormal?: number | null;
  precioOferta?: number | null;
  acfUnidadVenta?: string | null;
  acfColores?: string[] | null;
  acfGarantiaAnos?: number | null;
  acfFabricacionMedida?: boolean | null;
  acfInstalacion?: boolean | null;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  wcId?: number | null;
}

/** Teléfonos y correo de ventas, tal como van al pie de todo lo que sale. */
export const PIE_COSTAMALLAS =
  "Costamallas · 3006078956 – 3245912653 · ventas@costamallas.com";

export function medidasLegibles(p: DatosFicha): string | null {
  const partes = [p.largoCm, p.anchoCm, p.altoCm].map(v => (v == null || v === 0 ? null : `${v} cm`));
  if (partes.every(x => x === null)) return null;
  return partes.map(x => x ?? "—").join(" × ");
}

/** La URL del producto en la tienda, si llegó a publicarse. */
export function urlEnTienda(p: DatosFicha): string | null {
  return p.wcId ? `https://costamallas.com/?p=${p.wcId}` : null;
}

export function fichaParaCliente(p: DatosFicha): string {
  const precio = p.precioOferta ?? p.precioNormal ?? null;
  const medidas = medidasLegibles(p);
  const url = urlEnTienda(p);

  const l: string[] = [`*${p.nombre ?? ""}*`];
  if (p.sku) l.push(`Referencia: ${p.sku}`);
  if (p.descCorta) {
    const limpia = String(p.descCorta).replace(/<[^>]*>/g, "").trim();
    if (limpia) l.push("", limpia);
  }
  l.push("");
  if (precio != null) {
    l.push(`Precio: ${formatCOP(precio)}${p.acfUnidadVenta ? ` por ${p.acfUnidadVenta}` : ""}`);
  }
  if (medidas) l.push(`Medidas: ${medidas}`);
  if (p.acfColores?.length) l.push(`Colores: ${p.acfColores.join(", ")}`);
  if (p.acfGarantiaAnos) l.push(`Garantía: ${p.acfGarantiaAnos} año${p.acfGarantiaAnos > 1 ? "s" : ""}`);
  if (p.acfFabricacionMedida) l.push("Se fabrica a la medida.");
  if (p.acfInstalacion) l.push("Con servicio de instalación.");
  if (url) l.push("", url);
  l.push("", PIE_COSTAMALLAS);

  // Nunca más de una línea en blanco seguida: en WhatsApp se ve como un
  // mensaje mal pegado.
  return l.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
