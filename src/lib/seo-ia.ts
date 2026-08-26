// ============================================================
// Generación de SEO con IA — el motor, sin ruta HTTP.
//
// Vivía entero dentro de `/api/ai/seo`, que va de a un producto y
// devuelve el texto para que una persona lo pegue. Cuando hubo que
// hacer los 175 productos que no tienen SEO, ese código hacía falta en
// dos sitios, así que se saca aquí.
//
// Este archivo NO escribe nada en `productos`. Lo que genera va a la
// cola de revisión (`SeoPropuesta`) o se devuelve al formulario. El
// motivo es concreto: guardar un producto dispara la sincronización con
// WooCommerce, así que escribir aquí es publicar en costamallas.com.
// ============================================================

import { prisma } from "@/lib/prisma";
import { pedirJSON } from "@/lib/sembli/agente";
import { MODELO_POR_TAREA, MODELOS } from "@/lib/sembli/modelos";
import { generateSlug } from "@/lib/utils";

export interface SeoIA {
  seoTitulo: string;
  seoDescripcion: string;
  seoKeywords: string[];
  seoTexto: string;
  slug: string;
  imagenes: { id: string; altText: string; titulo: string }[];
}

export const ESQUEMA_SEO = {
  type: "object",
  properties: {
    seoTitulo: { type: "string", description: "Máximo 60 caracteres. Incluye el término de búsqueda principal y la marca." },
    seoDescripcion: { type: "string", description: "Máximo 155 caracteres. Con llamada a la acción." },
    seoKeywords: {
      type: "array",
      items: { type: "string" },
      description: "Entre 5 y 8 términos de búsqueda reales en Colombia, de más a menos importante.",
    },
    seoTexto: { type: "string", description: "2 a 4 frases de venta con los términos clave integrados con naturalidad." },
    slug: { type: "string", description: "Minúsculas, con guiones, sin acentos ni preposiciones sobrantes." },
    imagenes: {
      type: "array",
      description: "Un objeto por cada imagen recibida, conservando su id.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          altText: { type: "string", description: "Descripción de la imagen para accesibilidad y SEO. Máximo 125 caracteres." },
          titulo: { type: "string", description: "Título corto y descriptivo del archivo." },
        },
        required: ["id", "altText", "titulo"],
        additionalProperties: false,
      },
    },
  },
  required: ["seoTitulo", "seoDescripcion", "seoKeywords", "seoTexto", "slug", "imagenes"],
  additionalProperties: false,
};

export const SYSTEM_SEO = [
  "Eres especialista en SEO de comercio electrónico en Colombia, sector construcción y seguridad.",
  "Escribes en español de Colombia para Costamallas, fabricante de mallas.",
  "",
  "Reglas:",
  "· Usa los términos que la gente REALMENTE busca en Google Colombia ('malla para balcones',",
  "  'malla gallinero', 'cerca perimetral'), no jerga interna ni nombres de catálogo.",
  "· El meta título no debe pasar de 60 caracteres ni la descripción de 155: Google los corta.",
  "· No inventes medidas, materiales, normas ni certificaciones. Usa solo los datos que te doy.",
  "· Nada de superlativos vacíos ('el mejor', 'increíble'). Concreto y verificable.",
  "· El alt de cada imagen describe lo que se ve y ayuda a quien usa lector de pantalla;",
  "  no es un lugar para amontonar palabras clave.",
].join("\n");

/** Lo que hace falta de un producto para escribirle el SEO. */
export const SELECT_CONTEXTO = {
  id: true, nombre: true, sku: true, slug: true, publicado: true,
  categorias: true, descCorta: true, descripcion: true,
  acfMarcaFabricante: true, acfUnidadVenta: true, acfAplicaciones: true,
  acfColores: true, acfNormas: true, acfCertificaciones: true,
  acfGarantiaAnos: true, acfFabricacionMedida: true, acfInstalacion: true,
  largoCm: true, anchoCm: true, altoCm: true, pesoKg: true,
  precioNormal: true, precioOferta: true, acfExtra: true,
  imagenes: { select: { id: true, urlImagen: true, altText: true }, orderBy: { posicion: "asc" as const } },
} as const;

interface ProductoCtx {
  nombre: string; sku: string; categorias: string[];
  descCorta: string | null; descripcion: string | null;
  acfMarcaFabricante: string | null; acfUnidadVenta: string | null;
  acfAplicaciones: string[]; acfColores: string[]; acfNormas: string[];
  acfCertificaciones: string[]; acfGarantiaAnos: number | null;
  acfFabricacionMedida: boolean; acfInstalacion: boolean;
  largoCm: unknown; anchoCm: unknown; altoCm: unknown; pesoKg: unknown;
  precioNormal: unknown; precioOferta: unknown; acfExtra: unknown;
  imagenes: { id: string; urlImagen: string; altText: string | null }[];
}

function contextoDe(p: ProductoCtx): Record<string, unknown> {
  return {
    nombre: p.nombre,
    sku: p.sku,
    categorias: p.categorias,
    descripcionCorta: p.descCorta,
    descripcionLarga: p.descripcion,
    marca: p.acfMarcaFabricante,
    unidadVenta: p.acfUnidadVenta,
    aplicaciones: p.acfAplicaciones,
    colores: p.acfColores,
    normas: p.acfNormas,
    certificaciones: p.acfCertificaciones,
    garantiaAnos: p.acfGarantiaAnos,
    seFabricaAMedida: p.acfFabricacionMedida,
    incluyeInstalacion: p.acfInstalacion,
    medidas: { largoCm: p.largoCm, anchoCm: p.anchoCm, altoCm: p.altoCm, pesoKg: p.pesoKg },
    precio: p.precioOferta ?? p.precioNormal,
    fichaTecnica: p.acfExtra,
  };
}

/** El mensaje exacto que se le manda al modelo. */
export function mensajeSeo(
  ctx: Record<string, unknown>,
  imagenes: { id: string; urlImagen: string; altText: string | null }[],
): string {
  const bloque = "```json\n" + JSON.stringify(ctx, null, 2) + "\n```";
  return [
    "Genera el SEO de este producto de Costamallas.",
    "",
    bloque,
    "",
    imagenes.length
      ? "Imágenes del producto (devuelve un alt y un título para cada una, conservando su id):\n" +
        imagenes
          .map((i) => "- id=" + i.id + " archivo=" + i.urlImagen.split("/").pop() + " altActual=" + (i.altText ?? "(vacío)"))
          .join("\n")
      : "Este producto no tiene imágenes: devuelve `imagenes` como lista vacía.",
  ].join("\n");
}

export interface ResultadoSeo {
  data: SeoIA;
  costoUSD: number;
  modelo: string;
  tokens: { entrada: number; salida: number };
}

/**
 * Recorta a los límites que Google respeta.
 *
 * Se hace al generar y no al mostrar: si el título se cortara al
 * publicar, quien lo revisó habría aprobado un texto distinto del que
 * salió a la tienda.
 */
export function sanear(datos: SeoIA, nombre: string): SeoIA {
  return {
    seoTitulo: (datos.seoTitulo ?? "").slice(0, 60),
    seoDescripcion: (datos.seoDescripcion ?? "").slice(0, 160),
    seoKeywords: (datos.seoKeywords ?? []).slice(0, 8),
    seoTexto: datos.seoTexto ?? "",
    slug: datos.slug || generateSlug(nombre),
    imagenes: (datos.imagenes ?? []).map((i) => ({
      id: i.id,
      altText: (i.altText ?? "").slice(0, 125),
      titulo: (i.titulo ?? "").slice(0, 120),
    })),
  };
}

/**
 * Genera el SEO de un producto ya guardado. No escribe nada.
 *
 * Lanza si la IA no está configurada o si la respuesta viene mal: quien
 * llama decide si eso tumba la operación o solo marca ese producto.
 */
export async function generarSeoDeProducto(productoId: string): Promise<ResultadoSeo> {
  const p = await prisma.producto.findUnique({ where: { id: productoId }, select: SELECT_CONTEXTO });
  if (!p) throw new Error("El producto no existe");

  const ctx = contextoDe(p as unknown as ProductoCtx);
  const r = await pedirJSON<SeoIA>({
    tarea: "seo",
    system: SYSTEM_SEO,
    mensaje: mensajeSeo(ctx, p.imagenes),
    esquema: ESQUEMA_SEO,
    maxTokens: 2000,
  });

  return { data: sanear(r.datos, p.nombre), costoUSD: r.costoUSD, modelo: r.modelo, tokens: r.tokens };
}

// ── Estimación de costo ─────────────────────────────────────

/**
 * Cuánto va a costar el lote, ANTES de lanzarlo.
 *
 * Es una ESTIMACIÓN, no una medida: los tokens de entrada salen del
 * tamaño real del prompt de cada producto (unos 3,6 caracteres por token
 * en español) y la salida, de una corrida típica. El gasto real se
 * acumula propuesta a propuesta mientras el lote corre, y ése sí es el
 * número que va a aparecer en la factura.
 *
 * Se prefiere esto a llamar al contador de tokens de la API una vez por
 * producto: el error es de un dígito porcentual y el lote se lanza en un
 * clic, no después de esperar 175 llamadas.
 */
const CHARS_POR_TOKEN = 3.6;
/** Salida observada en una respuesta de SEO completa, con imágenes. */
const TOKENS_SALIDA_TIPICOS = 700;

export interface Estimacion {
  productos: number;
  tokensEntrada: number;
  tokensSalida: number;
  costoUSD: number;
  modelo: string;
  usdPorMTok: { entrada: number; salida: number };
}

export async function estimarLote(productoIds: string[]): Promise<Estimacion> {
  const modelo = MODELO_POR_TAREA.seo;
  const tarifa = MODELOS[modelo].usdPorMTok;

  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
    select: SELECT_CONTEXTO,
  });

  let chars = 0;
  for (const p of productos) {
    const ctx = contextoDe(p as unknown as ProductoCtx);
    chars += SYSTEM_SEO.length + mensajeSeo(ctx, p.imagenes).length;
  }

  const tokensEntrada = Math.round(chars / CHARS_POR_TOKEN);
  const tokensSalida = productos.length * TOKENS_SALIDA_TIPICOS;
  const costoUSD =
    (tokensEntrada / 1_000_000) * tarifa.entrada + (tokensSalida / 1_000_000) * tarifa.salida;

  return { productos: productos.length, tokensEntrada, tokensSalida, costoUSD, modelo, usdPorMTok: tarifa };
}
