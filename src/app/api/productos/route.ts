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

  const {
    busqueda, categoria, estado, publicado, stockCritico, page, limit, orderBy, order,
    nivel, sinImagen, sinPrecio, sinSEO, sinFicha, sinTienda, listoExportar, aMedida,
  } = parsed.data;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductoWhereInput = {};

  if (busqueda) {
    // Busca por cada palabra (AND) y tolera plurales (mallas → malla)
    const terms = busqueda.trim().split(/\s+/).filter(Boolean);
    where.AND = terms.map((t) => {
      const variants = [t];
      if (t.length > 3 && t.toLowerCase().endsWith("s")) variants.push(t.slice(0, -1)); // singular
      const or: Prisma.ProductoWhereInput[] = [];
      for (const v of variants) {
        or.push(
          { sku: { contains: v, mode: "insensitive" } },
          { nombre: { contains: v, mode: "insensitive" } },
          { acfMarcaFabricante: { contains: v, mode: "insensitive" } },
          { categorias: { has: v.toLowerCase() } },
        );
      }
      return { OR: or };
    });
  }
  if (categoria) where.categorias = { has: categoria };
  if (estado) where.intEstado = estado;
  if (publicado !== undefined) where.publicado = publicado;
  if (stockCritico) where.stock = { lte: 5 };

  // ── Filtros de trabajo ──
  if (sinImagen) where.imagenes = { none: {} };
  if (sinPrecio) where.OR = [{ precioNormal: null }, { precioNormal: 0 }];
  if (sinSEO) {
    // Falta cualquiera de las dos: sin título o sin descripción, la ficha
    // no está lista para posicionar.
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ seoTitulo: null }, { seoTitulo: "" }, { seoDescripcion: null }, { seoDescripcion: "" }] },
    ];
  }
  if (sinFicha) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ acfFichaTecnicaPdf: null }, { acfFichaTecnicaPdf: "" }] },
    ];
  }
  if (sinTienda) where.wcId = null;
  if (listoExportar) where.intListoExportar = true;
  if (aMedida) where.acfFabricacionMedida = true;

  // El nivel compara stock con stockMinimo (columna contra columna), que
  // Prisma no expresa en `where`. Cuando se filtra por nivel se traen los
  // ids que cumplen y se acotan aquí; es más caro, pero es la única forma
  // de que la paginación y el total sigan siendo correctos.
  if (nivel) {
    const candidatos = await prisma.producto.findMany({
      where,
      select: { id: true, stock: true, stockMinimo: true },
    });
    const ids = candidatos
      .filter((p) => (nivel === "AGOTADO" ? p.stock <= 0 : nivelStock(p.stock, p.stockMinimo) === nivel))
      .map((p) => p.id);
    where.id = { in: ids };
  }

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
    // Los necesita el cotizador: la bandera decide si se piden medidas y
    // la unidad evita que el asesor tenga que escribirla a mano.
    acfFabricacionMedida: p.acfFabricacionMedida,
    acfUnidadVenta: p.acfUnidadVenta,
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
