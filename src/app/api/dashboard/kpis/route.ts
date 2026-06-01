// GET /api/dashboard/kpis

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { nivelStock } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const [productos, stockAlertas, erroresPendientes, ultimaSync] = await Promise.all([
    prisma.producto.findMany({
      where: { intEstado: { not: "ARCHIVADO" } },
      select: {
        publicado: true, intEstado: true, precioNormal: true,
        stock: true, stockMinimo: true, categorias: true,
        imagenes: { take: 1, select: { id: true } },
      },
    }),
    prisma.producto.findMany({
      where: { stock: { lte: 30 }, intEstado: { not: "ARCHIVADO" } },
      select: { id: true, sku: true, nombre: true, stock: true, stockMinimo: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    prisma.errorValidacion.count({
      where: { estadoCorreccion: { in: ["PENDIENTE", "EN_PROCESO"] } },
    }),
    prisma.wooCommerceSync.findFirst({
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, estado: true },
    }),
  ]);

  const total = productos.length;
  const publicados = productos.filter((p) => p.publicado).length;
  const borradores = productos.filter((p) => p.intEstado === "BORRADOR").length;
  const listos = productos.filter((p) => p.intEstado === "LISTO").length;
  const sinPrecio = productos.filter((p) => !p.precioNormal).length;
  const sinImagen = productos.filter((p) => p.imagenes.length === 0).length;
  const precios = productos.filter((p) => p.precioNormal).map((p) => Number(p.precioNormal));
  const precioPromedio = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0;

  const stockNiveles = stockAlertas.map((p) => ({
    ...p,
    nivelStock: nivelStock(p.stock, p.stockMinimo),
  }));

  const criticos = stockNiveles.filter((p) => p.nivelStock === "CRITICO").length;
  const bajos = stockNiveles.filter((p) => p.nivelStock === "BAJO").length;
  const advertencia = stockNiveles.filter((p) => p.nivelStock === "ADVERTENCIA").length;
  const ok = total - criticos - bajos - advertencia;

  // Categorías
  const catCounts: Record<string, number> = {};
  for (const p of productos) {
    for (const cat of p.categorias) {
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }
  }
  const categorias = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, count]) => ({
      categoria,
      total: count,
      porcentaje: total ? Math.round((count / total) * 100) : 0,
    }));

  const pendientesExportar = productos.filter((p) => p.intEstado === "LISTO" && !p.publicado).length;

  return NextResponse.json({
    success: true,
    data: {
      productos: { total, publicados, borradores, listos, sinPrecio, sinImagen, precioPromedio },
      stock: { criticos, bajos, advertencia, ok, alertas: stockNiveles },
      categorias,
      woocommerce: {
        ultimaSync: ultimaSync?.startedAt?.toISOString() ?? null,
        pendientesExportar,
        erroresPendientes,
      },
    },
  });
}
