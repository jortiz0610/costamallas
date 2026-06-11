import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getAIConfig, chatAI } from "@/lib/ai";
import { generateSlug } from "@/lib/utils";

interface SeoOut { seoTitulo: string; seoDescripcion: string; seoKeywords: string[]; seoTexto: string; slug: string; }

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { productoId, nombre, categorias, descripcion } = await req.json();

  let p = { nombre, categorias: categorias ?? [], descripcion: descripcion ?? "" };
  if (productoId) {
    const prod = await prisma.producto.findUnique({ where: { id: productoId }, select: { nombre: true, categorias: true, descCorta: true, descripcion: true } });
    if (prod) p = { nombre: prod.nombre, categorias: prod.categorias, descripcion: prod.descCorta || prod.descripcion || "" };
  }
  if (!p.nombre) return NextResponse.json({ success: false, error: "Falta el nombre del producto" }, { status: 400 });

  const cfg = await getAIConfig();

  // Fallback sin IA (genera algo útil con reglas)
  if (!cfg) {
    const cat = (p.categorias[0] ?? "").replace(/-/g, " ");
    const fb: SeoOut = {
      seoTitulo: `${p.nombre} | Costamallas`.slice(0, 60),
      seoDescripcion: `${p.nombre} de Costamallas: ${cat || "alta calidad"}. Cotiza en línea, asesoría experta y envíos a toda Colombia.`.slice(0, 160),
      seoKeywords: [p.nombre.toLowerCase(), cat, "costamallas"].filter(Boolean),
      seoTexto: `${p.nombre} fabricado por Costamallas con materiales de alta durabilidad. Ideal para ${cat || "múltiples usos"}. Solicita tu cotización a la medida.`,
      slug: generateSlug(p.nombre),
    };
    return NextResponse.json({ success: true, data: fb, conIA: false });
  }

  const system = "Eres experto en SEO para e-commerce en Colombia (español). Devuelves SOLO un JSON válido, sin texto adicional, con las claves: seoTitulo (máx 60 car), seoDescripcion (máx 160 car), seoKeywords (array de 5-8 strings), seoTexto (2-3 frases de venta), slug (en minúsculas con guiones).";
  const userMsg = `Producto: ${p.nombre}\nCategoría: ${p.categorias.join(", ")}\nDescripción: ${p.descripcion}\nMarca: Costamallas.`;

  try {
    const raw = await chatAI(system, userMsg, cfg);
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr) as Partial<SeoOut>;
    const data: SeoOut = {
      seoTitulo: (parsed.seoTitulo ?? "").slice(0, 60),
      seoDescripcion: (parsed.seoDescripcion ?? "").slice(0, 160),
      seoKeywords: Array.isArray(parsed.seoKeywords) ? parsed.seoKeywords : [],
      seoTexto: parsed.seoTexto ?? "",
      slug: parsed.slug || generateSlug(p.nombre),
    };
    return NextResponse.json({ success: true, data, conIA: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: `IA: ${(e as Error).message}` }, { status: 500 });
  }
}
