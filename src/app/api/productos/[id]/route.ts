// ============================================================
// GET    /api/productos/[id]  — Detalle
// PUT    /api/productos/[id]  — Actualizar
// DELETE /api/productos/[id]  — Eliminar (soft: archivar)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite, isAdmin } from "@/lib/auth";
import { getWCCredentials, syncProductosToWC } from "@/lib/woocommerce";
import { productoSchema } from "@/lib/validations/producto";
import { nivelStock } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getUserFromRequest(_req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const producto = await prisma.producto.findUnique({
    where: { id },
    include: {
      imagenes: { orderBy: { posicion: "asc" } },
    },
  });

  if (!producto) {
    return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...producto,
      precioNormal: producto.precioNormal ? Number(producto.precioNormal) : null,
      precioOferta: producto.precioOferta ? Number(producto.precioOferta) : null,
      pesoKg: producto.pesoKg ? Number(producto.pesoKg) : null,
      largoCm: producto.largoCm ? Number(producto.largoCm) : null,
      anchoCm: producto.anchoCm ? Number(producto.anchoCm) : null,
      altoCm: producto.altoCm ? Number(producto.altoCm) : null,
      nivelStock: nivelStock(producto.stock, producto.stockMinimo),
      createdAt: producto.createdAt.toISOString(),
      updatedAt: producto.updatedAt.toISOString(),
      intExportadoEn: producto.intExportadoEn?.toISOString() ?? null,
    },
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = productoSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const existing = await prisma.producto.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });

    const updated = await prisma.producto.update({
      where: { id },
      data: {
        ...parsed.data,
        precioNormal: parsed.data.precioNormal ?? undefined,
        precioOferta: parsed.data.precioOferta ?? undefined,
        pesoKg: parsed.data.pesoKg ?? undefined,
        largoCm: parsed.data.largoCm ?? undefined,
        anchoCm: parsed.data.anchoCm ?? undefined,
        altoCm: parsed.data.altoCm ?? undefined,
        acfGarantiaAnos: parsed.data.acfGarantiaAnos ?? undefined,
        acfExtra: parsed.data.acfExtra ? JSON.parse(JSON.stringify(parsed.data.acfExtra)) : undefined,
      },
    });

    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "PRODUCTO_EDITAR",
        detalle: `SKU: ${updated.sku}`,
        resultado: "OK",
      },
    });

    // Auto-sincronizar a WooCommerce si está publicado o ya existe en WC
    let wcSync: "ok" | "error" | "skip" = "skip";
    if (updated.publicado || updated.wcId) {
      try {
        const creds = await getWCCredentials();
        if (creds) {
          const r = await syncProductosToWC([id], creds);
          wcSync = r.failed > 0 ? "error" : "ok";
        }
      } catch (e) {
        console.error("[WC auto-sync]", e);
        wcSync = "error";
      }
    }

    return NextResponse.json({ success: true, data: updated, wcSync });
  } catch (err) {
    console.error("[PUT /api/productos/id]", err);
    return NextResponse.json({ success: false, error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: "Solo el Admin puede eliminar" }, { status: 403 });

  const producto = await prisma.producto.findUnique({ where: { id }, select: { sku: true, nombre: true } });
  if (!producto) return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 });

  // Soft delete: archivar en vez de borrar
  await prisma.producto.update({ where: { id }, data: { intEstado: "ARCHIVADO" } });

  await prisma.log.create({
    data: {
      usuarioId: user.sub,
      accion: "PRODUCTO_ARCHIVAR",
      detalle: `SKU: ${producto.sku} — ${producto.nombre}`,
      resultado: "OK",
    },
  });

  return NextResponse.json({ success: true });
}
