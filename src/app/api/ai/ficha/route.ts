import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getAIConfig, chatAI } from "@/lib/ai";

// Analiza la ficha técnica (PDF) del producto con IA y sugiere valores de campos.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { productoId } = await req.json();
  if (!productoId) return NextResponse.json({ success: false, error: "Falta productoId" }, { status: 400 });

  const cfg = await getAIConfig();
  if (!cfg) return NextResponse.json({ success: false, sinClave: true, error: "Configura la IA en Configuración → IA para usar esta función." });

  const producto = await prisma.producto.findUnique({ where: { id: productoId }, select: { acfExtra: true, nombre: true } });
  const acf = (producto?.acfExtra as Record<string, unknown>) ?? {};
  const url = acf.fichaTecnicaUrl as string | undefined;
  if (!url) return NextResponse.json({ success: false, error: "Este producto no tiene ficha técnica PDF cargada." }, { status: 400 });

  // Descargar y extraer texto del PDF
  let texto = "";
  try {
    const pdfRes = await fetch(url);
    if (!pdfRes.ok) throw new Error("No se pudo descargar el PDF");
    const buffer = Buffer.from(await pdfRes.arrayBuffer());
    // @ts-expect-error pdf-parse no trae tipos
    const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    texto = (parsed.text || "").slice(0, 8000);
  } catch (e) {
    return NextResponse.json({ success: false, error: `No se pudo leer el PDF: ${(e as Error).message}` }, { status: 500 });
  }
  if (!texto.trim()) return NextResponse.json({ success: false, error: "El PDF no contiene texto legible (¿es una imagen escaneada?)." }, { status: 400 });

  const system = "Eres experto en fichas técnicas de productos industriales (mallas). Lees una ficha y devuelves SOLO un JSON válido con los campos que puedas extraer. Claves posibles: descripcionLarga (texto de venta), material, calibre, dimensiones, pesoKg (número), garantiaAnos (número), normas (array), certificaciones (array), aplicaciones (array). Omite las claves que no encuentres. No inventes datos.";
  const userMsg = `Producto: ${producto?.nombre}\n\nTexto de la ficha técnica:\n${texto}`;

  try {
    const raw = await chatAI(system, userMsg, cfg);
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const sugerencias = JSON.parse(jsonStr);
    return NextResponse.json({ success: true, data: sugerencias });
  } catch (e) {
    return NextResponse.json({ success: false, error: `IA: ${(e as Error).message}` }, { status: 500 });
  }
}
