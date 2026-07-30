// ============================================================
// POST /api/ai/ficha — lee el PDF de la ficha técnica y llena los campos
//
// Descarga el PDF, extrae el texto y le pide a Sonnet 5 que lo mapee a los
// campos reales del producto. Devuelve SUGERENCIAS: el usuario las revisa
// y decide, porque una ficha mal leída metería datos falsos al catálogo.
//
// Solo se devuelven los campos que el PDF realmente respalda. El esquema
// permite null en todos para que el modelo pueda decir "esto no está".
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { pedirJSON } from "@/lib/sembli/agente";

/** Texto del PDF que se manda al modelo. Suficiente para una ficha. */
const MAX_CARACTERES_PDF = 12_000;

interface FichaIA {
  descCorta: string | null;
  descripcion: string | null;
  acfMarcaFabricante: string | null;
  acfUnidadVenta: string | null;
  acfGarantiaAnos: number | null;
  pesoKg: number | null;
  largoCm: number | null;
  anchoCm: number | null;
  altoCm: number | null;
  acfAplicaciones: string[];
  acfColores: string[];
  acfNormas: string[];
  acfCertificaciones: string[];
  camposFicha: { etiqueta: string; valor: string }[];
  noEncontrado: string[];
}

const texto = (d: string) => ({ type: ["string", "null"], description: d });
const numero = (d: string) => ({ type: ["number", "null"], description: d });
const lista = (d: string) => ({ type: "array", items: { type: "string" }, description: d });

const ESQUEMA = {
  type: "object",
  properties: {
    descCorta: texto("Resumen de venta de 1 o 2 frases. null si el PDF no da para escribirlo."),
    descripcion: texto("Descripción larga en texto plano, con las características técnicas redactadas."),
    acfMarcaFabricante: texto("Marca o fabricante."),
    acfUnidadVenta: texto("Unidad de venta: Rollo, Metro, Kit, Unidad, m²…"),
    acfGarantiaAnos: numero("Años de garantía, solo el número."),
    pesoKg: numero("Peso en kilogramos."),
    largoCm: numero("Largo en centímetros."),
    anchoCm: numero("Ancho en centímetros."),
    altoCm: numero("Alto o calibre en centímetros."),
    acfAplicaciones: lista("Usos del producto. Lista vacía si no aparecen."),
    acfColores: lista("Colores disponibles."),
    acfNormas: lista("Normas técnicas (ISO, ASTM, NTC…)."),
    acfCertificaciones: lista("Certificaciones."),
    camposFicha: {
      type: "array",
      description:
        "Todo dato técnico del PDF que no encaje en los campos anteriores " +
        "(calibre, luz de malla, resistencia, material, recubrimiento…).",
      items: {
        type: "object",
        properties: {
          etiqueta: { type: "string", description: "Nombre del dato tal como aparece en la ficha." },
          valor: { type: "string", description: "Valor con su unidad." },
        },
        required: ["etiqueta", "valor"],
        additionalProperties: false,
      },
    },
    noEncontrado: lista("Campos que buscaste y el PDF no trae. Sirve para avisarle al usuario qué falta."),
  },
  required: [
    "descCorta", "descripcion", "acfMarcaFabricante", "acfUnidadVenta", "acfGarantiaAnos",
    "pesoKg", "largoCm", "anchoCm", "altoCm", "acfAplicaciones", "acfColores",
    "acfNormas", "acfCertificaciones", "camposFicha", "noEncontrado",
  ],
  additionalProperties: false,
};

const SYSTEM = [
  "Lees fichas técnicas de productos industriales (mallas) y extraes sus datos a campos estructurados.",
  "Trabajas para Costamallas, en Colombia. Escribes en español.",
  "",
  "Regla que manda sobre todas: **no inventes nada**. Si un dato no está en el texto,",
  "devuelve null (o lista vacía) y anótalo en `noEncontrado`. Un dato inventado en una",
  "ficha técnica termina en una cotización equivocada y en un cliente molesto.",
  "",
  "· Convierte las unidades a las que se piden: milímetros y metros → centímetros,",
  "  gramos → kilogramos. Si el PDF dice '2 m', devuelve 200 en largoCm.",
  "· Si un valor viene como rango ('1,8 a 2,2 mm'), ponlo en `camposFicha` tal cual,",
  "  no lo promedies para un campo numérico.",
  "· `descripcion` es texto plano, sin HTML ni markdown.",
].join("\n");

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) {
    return NextResponse.json({ success: false, error: "Tu rol no permite editar productos" }, { status: 403 });
  }

  const { productoId, url: urlDirecta } = await req.json();
  if (!productoId && !urlDirecta) {
    return NextResponse.json({ success: false, error: "Falta productoId o url" }, { status: 400 });
  }

  let url = urlDirecta as string | undefined;
  let nombreProducto = "";
  let categorias: string[] = [];

  if (productoId) {
    const producto = await prisma.producto.findUnique({
      where: { id: String(productoId) },
      select: { acfExtra: true, nombre: true, categorias: true, acfFichaTecnicaPdf: true },
    });
    if (!producto) return NextResponse.json({ success: false, error: "El producto no existe" }, { status: 404 });
    nombreProducto = producto.nombre;
    categorias = producto.categorias;
    const acf = (producto.acfExtra as Record<string, unknown>) ?? {};
    url = url ?? (acf.fichaTecnicaUrl as string | undefined) ?? producto.acfFichaTecnicaPdf ?? undefined;
  }

  if (!url) {
    return NextResponse.json(
      { success: false, error: "Este producto no tiene ficha técnica en PDF. Súbela primero en la pestaña Calidad." },
      { status: 400 },
    );
  }

  // ── Descargar y extraer el texto ──
  //
  // OJO: pdf-parse v2 exporta la CLASE `PDFParse`, no una función por
  // defecto. El código anterior hacía `(await import("pdf-parse")).default(buffer)`,
  // que es la API de la v1: con la v2 instalada eso da
  // "pdfParse is not a function" — por eso este botón nunca funcionó.
  let textoPdf = "";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? "el archivo ya no existe en el servidor (404). Vuelve a subir la ficha."
          : `el servidor respondió ${res.status}`,
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText();
      textoPdf = (text || "").replace(/\s+\n/g, "\n").trim().slice(0, MAX_CARACTERES_PDF);
    } finally {
      await parser.destroy(); // libera el worker de pdfjs
    }
  } catch (e) {
    return NextResponse.json(
      { success: false, error: `No pude leer el PDF: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  if (textoPdf.length < 40) {
    return NextResponse.json(
      {
        success: false,
        error:
          "El PDF no tiene texto legible. Seguramente es un escaneo (una imagen). " +
          "Vuelve a exportarlo desde el original o pásalo por un OCR.",
      },
      { status: 400 },
    );
  }

  const mensaje = [
    `Producto: ${nombreProducto || "(sin nombre)"}`,
    categorias.length ? `Categorías: ${categorias.join(", ")}` : "",
    "",
    "Texto de la ficha técnica:",
    "```",
    textoPdf,
    "```",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { datos, costoUSD } = await pedirJSON<FichaIA>({
      tarea: "ficha",
      system: SYSTEM,
      mensaje,
      esquema: ESQUEMA,
      maxTokens: 3000,
    });

    // Se quitan los null y las listas vacías: al formulario solo le
    // interesa lo que sí hay que rellenar.
    const sugerencias: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(datos)) {
      if (clave === "camposFicha" || clave === "noEncontrado") continue;
      if (valor === null || valor === undefined) continue;
      if (Array.isArray(valor) && valor.length === 0) continue;
      sugerencias[clave] = valor;
    }

    await prisma.log
      .create({
        data: {
          usuarioId: user.sub,
          accion: "IA_FICHA_PDF",
          detalle: `Producto ${productoId ?? url}`,
          resultado: `campos=${Object.keys(sugerencias).length} extra=${datos.camposFicha?.length ?? 0} usd=${costoUSD.toFixed(5)}`,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      success: true,
      data: {
        sugerencias,
        camposFicha: datos.camposFicha ?? [],
        noEncontrado: datos.noEncontrado ?? [],
        caracteresLeidos: textoPdf.length,
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    const sinClave = msg.includes("API key") || msg.includes("no está configurada");
    return NextResponse.json({ success: false, sinClave, error: msg }, { status: sinClave ? 200 : 500 });
  }
}
