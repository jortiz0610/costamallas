// ============================================================
// Convertir un fallo de validación en algo que se pueda leer.
//
// Antes se devolvía `error.errors[0].message` a secas, y eso producía
// mensajes como «URL inválida» — sin decir QUÉ campo. Cuando el
// formulario tiene cuarenta campos, ese mensaje no ayuda a arreglar
// nada: hay que ir a leer el esquema para saber de qué habla.
//
// Y pasó de verdad: crear un producto fallaba con «URL inválida» y
// nadie podía saber que hablaba de la ficha técnica en PDF.
// ============================================================

import type { ZodError } from "zod";

/** Nombres en español de los campos, para no enseñar `acfFichaTecnicaPdf`. */
const NOMBRES: Record<string, string> = {
  sku: "SKU",
  nombre: "Nombre",
  descCorta: "Descripción corta",
  descripcion: "Descripción",
  seoTitulo: "Título SEO",
  seoDescripcion: "Descripción SEO",
  precioNormal: "Precio normal",
  precioOferta: "Precio de oferta",
  stock: "Stock",
  stockMinimo: "Stock mínimo",
  pesoKg: "Peso",
  largoCm: "Largo",
  anchoCm: "Ancho",
  altoCm: "Alto",
  categorias: "Categorías",
  etiquetas: "Etiquetas",
  acfSkuInterno: "SKU interno",
  acfMarcaFabricante: "Marca / fabricante",
  acfUnidadVenta: "Unidad de venta",
  acfGarantiaAnos: "Garantía (años)",
  acfFichaTecnicaPdf: "Ficha técnica (PDF)",
  acfAplicaciones: "Aplicaciones",
  acfColores: "Colores",
  acfNormas: "Normas",
  acfCertificaciones: "Certificaciones",
  intEstado: "Estado interno",
  intResponsable: "Responsable",
  intObservaciones: "Observaciones",
};

/**
 * Un mensaje que dice qué campo está mal y por qué.
 *
 * Si hay varios errores se nombran los tres primeros: corregir uno para
 * que aparezca el siguiente, de uno en uno, es la forma más lenta que
 * hay de llenar un formulario.
 */
export function mensajeDeValidacion(error: ZodError, porDefecto = "Datos inválidos"): string {
  const errores = error.errors;
  if (!errores.length) return porDefecto;

  const describir = (e: (typeof errores)[number]) => {
    const campo = e.path.join(".");
    if (!campo) return e.message;
    return `${NOMBRES[campo] ?? campo}: ${e.message}`;
  };

  const primeros = errores.slice(0, 3).map(describir);
  const resto = errores.length - primeros.length;
  return primeros.join(" · ") + (resto > 0 ? ` (y ${resto} más)` : "");
}
