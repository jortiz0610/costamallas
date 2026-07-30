// ============================================================
// GET /api/stock — inventario completo con búsqueda y filtros
//
// Complementa a /api/stock/alertas, que solo devuelve lo que está bajo
// mínimos (y con un umbral fijo). Aquí se puede buscar y filtrar sobre
// TODO el catálogo, que es lo que hace falta para trabajar el inventario.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { nivelStock } from "@/lib/utils";

const POR_PAGINA = 50;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const nivel = sp.get("nivel") ?? "";          // OK | ADVERTENCIA | BAJO | CRITICO | AGOTADO
  const categoria = sp.get("categoria") ?? "";
  const orden = sp.get("orden") ?? "stock";      // stock | nombre | sku
  const pagina = Math.max(1, Number(sp.get("pagina")) || 1);

  const where: Prisma.ProductoWhereInput = { intEstado: { not: "ARCHIVADO" } };
  if (q) {
    where.OR = [
      { sku: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
      { acfMarcaFabricante: { contains: q, mode: "insensitive" } },
    ];
  }
  if (categoria) where.categorias = { has: categoria };

  // El nivel depende de comparar stock con stockMinimo (columna contra
  // columna), que Prisma no expresa en `where`. Se calcula después de
  // traer las filas; por eso el filtro por nivel se aplica en memoria.
  const orderBy: Prisma.ProductoOrderByWithRelationInput =
    orden === "nombre" ? { nombre: "asc" } : orden === "sku" ? { sku: "asc" } : { stock: "asc" };

  const todos = await prisma.producto.findMany({
    where,
    orderBy,
    select: {
      id: true, sku: true, nombre: true, stock: true, stockMinimo: true,
      enStock: true, categorias: true, acfUnidadVenta: true, publicado: true,
    },
  });

  const conNivel = todos.map((p) => ({
    ...p,
    nivelStock: nivelStock(p.stock, p.stockMinimo),
    agotado: p.stock <= 0,
  }));

  const filtrados = nivel
    ? conNivel.filter((p) => (nivel === "AGOTADO" ? p.agotado : p.nivelStock === nivel))
    : conNivel;

  // El resumen se calcula sobre TODO el catálogo (sin el filtro de nivel),
  // para que las tarjetas no cambien al filtrar la tabla.
  const resumen = {
    total: conNivel.length,
    agotados: conNivel.filter((p) => p.agotado).length,
    criticos: conNivel.filter((p) => p.nivelStock === "CRITICO").length,
    bajos: conNivel.filter((p) => p.nivelStock === "BAJO").length,
    ok: conNivel.filter((p) => p.nivelStock === "OK").length,
    unidadesTotales: conNivel.reduce((s, p) => s + p.stock, 0),
  };

  const desde = (pagina - 1) * POR_PAGINA;
  return NextResponse.json({
    success: true,
    data: filtrados.slice(desde, desde + POR_PAGINA),
    resumen,
    paginacion: {
      pagina,
      porPagina: POR_PAGINA,
      totalFiltrado: filtrados.length,
      totalPaginas: Math.max(1, Math.ceil(filtrados.length / POR_PAGINA)),
    },
  });
}
