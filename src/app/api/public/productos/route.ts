import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

// Catálogo público para el cotizador web (solo datos no sensibles)
export async function GET() {
  const productos = await prisma.producto.findMany({
    where: { publicado: true },
    select: { id: true, nombre: true, sku: true, precioNormal: true, categorias: true },
    orderBy: { nombre: "asc" },
    take: 200,
  });
  const data = productos.map(p => ({
    id: p.id, nombre: p.nombre, sku: p.sku,
    precio: p.precioNormal ? Number(p.precioNormal) : 0,
    categoria: p.categorias[0] ?? "",
  }));
  return NextResponse.json({ success: true, data }, { headers: CORS });
}
