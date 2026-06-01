// GET /api/stock/alertas

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { nivelStock } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const productos = await prisma.producto.findMany({
    where: { stock: { lte: 30 }, intEstado: { not: "ARCHIVADO" } },
    select: { id: true, sku: true, nombre: true, stock: true, stockMinimo: true },
    orderBy: { stock: "asc" },
    take: 50,
  });

  const alertas = productos
    .map((p) => ({ ...p, nivelStock: nivelStock(p.stock, p.stockMinimo) }))
    .filter((p) => p.nivelStock !== "OK");

  // Crear notificaciones para críticos nuevos
  const criticos = alertas.filter((a) => a.nivelStock === "CRITICO");
  for (const c of criticos) {
    await prisma.notificacion.upsert({
      where: {
        // Evitar duplicados — la única opción es usar un id único
        id: `stock-critico-${c.id}`,
      },
      update: { leida: false, createdAt: new Date() },
      create: {
        id: `stock-critico-${c.id}`,
        tipo: "STOCK_CRITICO",
        titulo: `Stock crítico: ${c.sku}`,
        mensaje: `${c.nombre} — quedan ${c.stock} unidades (mínimo: ${c.stockMinimo})`,
        data: { productoId: c.id, sku: c.sku, stock: c.stock },
      },
    }).catch(() => {
      // Si el upsert falla por constraint, ignorar
    });
  }

  return NextResponse.json({ success: true, data: alertas });
}
