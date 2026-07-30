// ============================================================
// POST /api/ai/seo — genera el SEO del producto con Sonnet 5
//
// Lee TODO lo que afecta el posicionamiento (nombre, categorías,
// descripciones, ficha técnica, medidas, aplicaciones, precio) y devuelve
// meta título, meta descripción, palabras clave, texto de venta, slug y el
// texto alternativo de cada imagen.
//
// Usa salidas estructuradas: la API garantiza que la respuesta cumple el
// esquema, así que no hay que recortar texto buscando llaves.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { pedirJSON } from "@/lib/sembli/agente";
import { generateSlug } from "@/lib/utils";

interface SeoIA {
  seoTitulo: string;
  seoDescripcion: string;
  seoKeywords: string[];
  seoTexto: string;
  slug: string;
  imagenes: { id: string; altText: string; titulo: string }[];
}

const ESQUEMA = {
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

const SYSTEM = [
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

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) {
    return NextResponse.json({ success: false, error: "Tu rol no permite editar productos" }, { status: 403 });
  }

  const { productoId, nombre, categorias, descripcion } = await req.json();

  // Con productoId se arma el contexto completo desde la BD; sin él
  // (producto todavía sin guardar) se usa lo que mande el formulario.
  let ctx: Record<string, unknown>;
  let imagenes: { id: string; urlImagen: string; altText: string | null }[] = [];

  if (productoId) {
    const p = await prisma.producto.findUnique({
      where: { id: String(productoId) },
      include: { imagenes: { select: { id: true, urlImagen: true, altText: true }, orderBy: { posicion: "asc" } } },
    });
    if (!p) return NextResponse.json({ success: false, error: "El producto no existe" }, { status: 404 });
    imagenes = p.imagenes;
    ctx = {
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
  } else {
    if (!nombre) return NextResponse.json({ success: false, error: "Falta el nombre del producto" }, { status: 400 });
    ctx = { nombre, categorias: categorias ?? [], descripcionCorta: descripcion ?? "" };
  }

  const mensaje = [
    "Genera el SEO de este producto de Costamallas.",
    "",
    "```json",
    JSON.stringify(ctx, null, 2),
    "```",
    "",
    imagenes.length
      ? `Imágenes del producto (devuelve un alt y un título para cada una, conservando su id):\n${imagenes
          .map((i) => `- id=${i.id} archivo=${i.urlImagen.split("/").pop()} altActual=${i.altText ?? "(vacío)"}`)
          .join("\n")}`
      : "Este producto no tiene imágenes: devuelve `imagenes` como lista vacía.",
  ].join("\n");

  try {
    const { datos, costoUSD } = await pedirJSON<SeoIA>({
      tarea: "seo",
      system: SYSTEM,
      mensaje,
      esquema: ESQUEMA,
      maxTokens: 2000,
    });

    // Se recortan los límites por si el modelo se pasa: Google los corta
    // igual, mejor que el usuario vea el texto que de verdad se publica.
    const data = {
      seoTitulo: datos.seoTitulo.slice(0, 60),
      seoDescripcion: datos.seoDescripcion.slice(0, 160),
      seoKeywords: (datos.seoKeywords ?? []).slice(0, 8),
      seoTexto: datos.seoTexto,
      slug: datos.slug || generateSlug(String(ctx.nombre)),
      imagenes: datos.imagenes ?? [],
    };

    // El alt de las imágenes sí se guarda de una: es metadato, no texto
    // editable del formulario, y así queda listo para el sync a la tienda.
    let imagenesActualizadas = 0;
    if (data.imagenes.length && productoId) {
      const validas = new Set(imagenes.map((i) => i.id));
      await Promise.all(
        data.imagenes
          .filter((im) => validas.has(im.id))
          .map((im) =>
            prisma.acfImagen
              .update({
                where: { id: im.id },
                data: { altText: im.altText.slice(0, 125), titulo: im.titulo.slice(0, 120) },
              })
              .then(() => {
                imagenesActualizadas++;
              })
              .catch(() => undefined),
          ),
      );
    }

    await prisma.log
      .create({
        data: {
          usuarioId: user.sub,
          accion: "IA_SEO",
          detalle: `Producto ${productoId ?? ctx.nombre}`,
          resultado: `imagenes=${imagenesActualizadas} usd=${costoUSD.toFixed(5)}`,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ success: true, data, conIA: true, imagenesActualizadas });
  } catch (e) {
    const msg = (e as Error).message;
    const sinClave = msg.includes("API key") || msg.includes("no está configurada");
    return NextResponse.json({ success: false, sinClave, error: msg }, { status: sinClave ? 200 : 500 });
  }
}
