// ============================================================
// GET /api/productos  — Lista paginada con filtros
// POST /api/productos — Crear nuevo producto
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { filtrosProductosSchema, productoSchema } from "@/lib/validations/producto";
import { nivelStock, generateSlug } from "@/lib/utils";
import type { ProductoListItem } from "@/types";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = filtrosProductosSchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Parámetros inválidos" }, { status: 400 });
  }

  const { busqueda, categoria, estado, publicado, stockCritico, page, limit, orderBy, order } = parsed.data;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductoWhereInput = {};

  if (busqueda) {
    where.OR = [
      { sku: { contains: busqueda, mode: "insensitive" } },
      { nombre: { contains: busqueda, mode: "insensitive" } },
      { acfMarcaFabricante: { contains: busqueda, mode: "insensitive" } },
    ];
  }
  if (categoria) where.categorias = { has: categoria };
  if (estado) where.intEstado = estado;
  if (publicado !== undefined) where.publicado = publicado;
  if (stockCritico) where.stock = { lte: 5 };

  const [productos, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderBy]: order },
      include: {
        imagenes: { where: { esPrincipal: true }, take: 1, select: { urlImagen: true } },
        _count: { select: { imagenes: true } },
      },
    }),
    prisma.producto.count({ where }),
  ]);

  const data: ProductoListItem[] = productos.map((p) => ({
    id: p.id,
    wcId: p.wcId,
    sku: p.sku,
    nombre: p.nombre,
    slug: p.slug,
    publicado: p.publicado,
    precioNormal: p.precioNormal ? Number(p.precioNormal) : null,
    precioOferta: p.precioOferta ? Number(p.precioOferta) : null,
    stock: p.stock,
    stockMinimo: p.stockMinimo,
    nivelStock: nivelStock(p.stock, p.stockMinimo),
    categorias: p.categorias,
    intEstado: p.intEstado,
    intListoExportar: p.intListoExportar,
    updatedAt: p.updatedAt.toISOString(),
    imagenPrincipal: p.imagenes[0]?.urlImagen ?? null,
    _count: { imagenes: p._count.imagenes },
  }));

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = productoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const slug = data.slug || generateSlug(data.nombre);

    // Verificar unicidad SKU
    const existing = await prisma.producto.findUnique({ where: { sku: data.sku } });
    if (existing) {
      return NextResponse.json({ success: false, error: `El SKU "${data.sku}" ya existe` }, { status: 409 });
    }

    const producto = await prisma.producto.create({
      data: {
        ...data,
        slug,
        intResponsable: data.intResponsable ?? user.nombre,
        precioNormal: data.precioNormal ?? undefined,
        precioOferta: data.precioOferta ?? undefined,
        pesoKg: data.pesoKg ?? undefined,
        largoCm: data.largoCm ?? undefined,
        anchoCm: data.anchoCm ?? undefined,
        altoCm: data.altoCm ?? undefined,
        acfGarantiaAnos: data.acfGarantiaAnos ?? undefined,
        acfExtra: data.acfExtra ? JSON.parse(JSON.stringify(data.acfExtra)) : {},
      },
    });

    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "PRODUCTO_CREAR",
        detalle: `SKU: ${producto.sku} — ${producto.nombre}`,
        resultado: "OK",
      },
    });

    return NextResponse.json({ success: true, data: producto }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/productos]", err);
    return NextResponse.json({ success: false, error: "Error al crear el producto" }, { status: 500 });
  }
}
