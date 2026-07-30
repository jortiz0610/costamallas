// ============================================================
// POST /api/ai/producto — asistente de redacción del producto
//
// Recibe una instrucción libre (o una acción predefinida) y devuelve texto
// listo para pegar en un campo. Va en Haiku: es alto volumen y la tarea es
// redactar, no razonar.
//
// Devuelve TEXTO, no guarda nada: el usuario decide qué campo recibe qué.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { pedirTexto } from "@/lib/sembli/agente";

/** Acciones de un clic. La clave llega desde el frontend. */
const ACCIONES: Record<string, { etiqueta: string; instruccion: string; campo?: string }> = {
  desc_corta: {
    etiqueta: "Descripción corta",
    campo: "descCorta",
    instruccion:
      "Escribe la descripción corta de venta: 1 o 2 frases, máximo 200 caracteres. " +
      "Que diga qué es y para qué sirve. Sin adornos ni superlativos.",
  },
  desc_larga: {
    etiqueta: "Descripción larga",
    campo: "descripcion",
    instruccion:
      "Escribe la descripción larga del producto en 2 o 3 párrafos cortos: qué es, para qué " +
      "se usa y qué lo diferencia. Texto plano, sin HTML ni markdown, sin títulos.",
  },
  beneficios: {
    etiqueta: "Beneficios",
    instruccion:
      "Lista de 4 a 6 beneficios concretos del producto, uno por línea, empezando con '· '. " +
      "Cada uno de máximo 12 palabras. Basados solo en los datos que te doy.",
  },
  nombre: {
    etiqueta: "Mejorar el nombre",
    campo: "nombre",
    instruccion:
      "Propón un nombre comercial mejor para este producto: claro, con la medida o " +
      "característica que lo distingue, y con los términos que busca la gente. " +
      "Devuelve SOLO el nombre, sin comillas ni explicación.",
  },
  aplicaciones: {
    etiqueta: "Aplicaciones",
    instruccion:
      "Lista de 4 a 8 aplicaciones o usos reales del producto, una por línea, empezando con '· '. " +
      "Cada una de 2 a 5 palabras.",
  },
};

const SYSTEM = [
  "Redactas fichas de producto para Costamallas, fabricante colombiano de mallas",
  "(metálicas, nylon, plásticas, para balcones, sombra, agrícolas, seguridad perimetral,",
  "construcción y anticaída). Escribes en español de Colombia.",
  "",
  "Reglas:",
  "· **No inventes datos.** Medidas, materiales, normas, certificaciones y garantías salen",
  "  solo de la información que te doy. Si falta un dato, escribe sin él.",
  "· Nada de superlativos vacíos ('el mejor', 'incomparable', 'revolucionario').",
  "· Escribe para alguien que va a comprar, no para un catálogo técnico: concreto y útil.",
  "· Devuelve SOLO el texto pedido. Sin preámbulos, sin comillas, sin explicar qué hiciste.",
].join("\n");

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) {
    return NextResponse.json({ success: false, error: "Tu rol no permite editar productos" }, { status: 403 });
  }

  const { productoId, accion, instruccion, borrador } = await req.json();

  const pedido = accion ? ACCIONES[String(accion)]?.instruccion : String(instruccion ?? "").trim();
  if (!pedido) {
    return NextResponse.json({ success: false, error: "Dime qué quieres que escriba" }, { status: 400 });
  }
  if (pedido.length > 1000) {
    return NextResponse.json({ success: false, error: "La instrucción es demasiado larga" }, { status: 400 });
  }

  // Contexto del producto: de la BD si ya existe, o del borrador que
  // manda el formulario cuando todavía no se ha guardado.
  let ctx: Record<string, unknown>;
  if (productoId) {
    const p = await prisma.producto.findUnique({
      where: { id: String(productoId) },
      select: {
        nombre: true, sku: true, categorias: true, descCorta: true, descripcion: true,
        acfMarcaFabricante: true, acfUnidadVenta: true, acfAplicaciones: true,
        acfColores: true, acfNormas: true, acfCertificaciones: true, acfGarantiaAnos: true,
        acfFabricacionMedida: true, acfInstalacion: true, precioNormal: true,
        pesoKg: true, largoCm: true, anchoCm: true, altoCm: true, acfExtra: true,
      },
    });
    if (!p) return NextResponse.json({ success: false, error: "El producto no existe" }, { status: 404 });
    ctx = p;
  } else if (borrador && typeof borrador === "object") {
    ctx = borrador as Record<string, unknown>;
  } else {
    return NextResponse.json({ success: false, error: "Falta el producto" }, { status: 400 });
  }

  if (!ctx.nombre) {
    return NextResponse.json(
      { success: false, error: "Ponle nombre al producto primero: sin eso no tengo de dónde partir." },
      { status: 400 },
    );
  }

  const mensaje = [
    "Datos del producto:",
    "```json",
    JSON.stringify(ctx, null, 2),
    "```",
    "",
    `Tarea: ${pedido}`,
  ].join("\n");

  try {
    const { texto, costoUSD } = await pedirTexto({
      tarea: "chat",
      system: SYSTEM,
      mensaje,
      maxTokens: 900,
    });

    await prisma.log
      .create({
        data: {
          usuarioId: user.sub,
          accion: "IA_PRODUCTO",
          detalle: `${accion ?? "libre"} · ${String(ctx.nombre).slice(0, 80)}`,
          resultado: `usd=${costoUSD.toFixed(5)}`,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      success: true,
      data: { texto: texto.trim(), campo: accion ? ACCIONES[String(accion)]?.campo : undefined },
    });
  } catch (e) {
    const msg = (e as Error).message;
    const sinClave = msg.includes("API key") || msg.includes("no está configurada");
    return NextResponse.json({ success: false, sinClave, error: msg }, { status: sinClave ? 200 : 500 });
  }
}

/** GET — las acciones disponibles, para pintar los botones. */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  return NextResponse.json({
    success: true,
    data: Object.entries(ACCIONES).map(([id, a]) => ({ id, etiqueta: a.etiqueta, campo: a.campo })),
  });
}
