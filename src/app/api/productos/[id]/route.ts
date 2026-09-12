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
import { exigirPermiso } from "@/lib/permisos-server";

type Params = { params: Promise<{ id: string }> };

/**
 * Lo único que puede tocar quien NO tiene `erp.productos.editar`.
 * Es una lista blanca a propósito: si mañana el esquema gana un campo,
 * el que no tiene permiso sigue sin poder tocarlo.
 */
const CAMPOS_DE_STOCK = new Set(["stock", "enStock", "stockMinimo", "permiteBackorders"]);

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

    // Sin `erp.productos.editar` la ficha es de SOLO LECTURA salvo el
    // stock. Es exactamente lo que necesita un vendedor: corregir
    // existencias cuando descarga mercancía, sin poder tocar el precio
    // ni la descripción de un producto que está publicado en la tienda.
    const soloStock = Object.keys(body as Record<string, unknown>).every(k => CAMPOS_DE_STOCK.has(k));
    if (!soloStock) {
      const sinPermiso = await exigirPermiso(req, "erp.productos.editar");
      if (sinPermiso) return sinPermiso;
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

    // ── Subir el cambio a la tienda ──
    //
    // Solo sube lo que está publicado o lo que ya existe en la web, y esa
    // regla es deliberada: un producto sin publicar NO debe aparecer en
    // costamallas.com hasta que alguien lo decida.
    //
    // ⚠️ Lo que estaba mal no era la regla, era el SILENCIO. Cuando se
    // saltaba, esta ruta devolvía `skip` sin motivo y la pantalla no
    // decía nada: el usuario guardaba, no veía ningún mensaje y daba por
    // hecho que había subido. Así se editaron durante días productos que
    // nunca llegaron a la web —111 de 172 están sin publicar— y el
    // problema se vivió como "la conexión no funciona" cuando la
    // conexión estaba perfecta.
    //
    // Ahora el motivo viaja SIEMPRE, y la pantalla lo dice con todas las
    // letras.
    let wcSync: "ok" | "error" | "skip" = "skip";
    let wcError: string | undefined;
    let wcAviso: string | undefined;
    let wcMotivo: string | undefined;

    if (updated.publicado || updated.wcId) {
      try {
        const creds = await getWCCredentials();
        if (creds) {
          const r = await syncProductosToWC([id], creds);
          wcSync = r.failed > 0 ? "error" : "ok";
          if (r.failed > 0) wcError = r.errors[0]?.error;
          if (r.avisos.length > 0) wcAviso = r.avisos[0]?.aviso;
        } else {
          wcSync = "error";
          wcError = "WooCommerce no está configurado (Configuración → WooCommerce).";
        }
      } catch (e) {
        console.error("[WC auto-sync]", e);
        wcSync = "error";
        wcError = e instanceof Error ? e.message : String(e);
      }
    } else {
      wcMotivo = "No está marcado «Publicado en tienda», así que el cambio se guardó "
        + "solo en el ERP. Para que aparezca en costamallas.com, activa ese interruptor.";
    }

    // Que el registro diga lo que pasó con la tienda, no solo que se
    // editó. Antes ponía OK pasara lo que pasara, así que mirar el log
    // no servía para averiguar por qué un producto no estaba en la web.
    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "PRODUCTO_SYNC_WEB",
        detalle: `${updated.sku}: ${wcSync}${wcError ? ` — ${wcError.slice(0, 120)}` : ""}`,
        resultado: wcSync === "error" ? "ERROR" : "OK",
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, data: updated, wcSync, wcError, wcAviso, wcMotivo });
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
