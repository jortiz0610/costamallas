// ============================================================
// Órdenes de compra
//   GET  /api/compras/ordenes                 lista
//   POST /api/compras/ordenes                 crea (opcionalmente autoarmada)
//
// El "autoarmado" toma los productos bajo mínimo que tengan a este
// proveedor asignado y calcula cuánto pedir. Es el atajo que convierte
// "revisar el stock" en un pedido de un clic.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

export interface ItemOrden {
  productoId: string | null;
  sku: string;
  descripcion: string;
  referenciaProveedor?: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/** Consecutivo OC-00001. Se calcula sobre el último número existente. */
async function siguienteNumero(): Promise<string> {
  const ultima = await prisma.ordenCompra.findFirst({
    where: { numero: { startsWith: "OC-" } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const n = ultima ? Number(ultima.numero.replace("OC-", "")) + 1 : 1;
  return `OC-${String(n).padStart(5, "0")}`;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado");
  const ordenes = await prisma.ordenCompra.findMany({
    where: estado ? { estado } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { proveedor: { select: { id: true, nombre: true, email: true } } },
  });

  return NextResponse.json({
    success: true,
    data: ordenes.map(o => ({ ...o, total: Number(o.total) })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { proveedorId, autoarmar, items: itemsManuales, notas, fechaEsperada } = body;

  if (!proveedorId) {
    return NextResponse.json({ success: false, error: "Falta el proveedor" }, { status: 400 });
  }

  const proveedor = await prisma.proveedor.findUnique({
    where: { id: String(proveedorId) },
    select: { id: true, nombre: true, esPropio: true, activo: true, leadTimeDias: true },
  });
  if (!proveedor) {
    return NextResponse.json({ success: false, error: "El proveedor no existe" }, { status: 404 });
  }
  if (proveedor.esPropio) {
    return NextResponse.json(
      {
        success: false,
        error: `"${proveedor.nombre}" está marcado como fabricación propia: no se le hacen órdenes de compra.`,
      },
      { status: 400 },
    );
  }

  let items: ItemOrden[];

  if (autoarmar) {
    // Productos de este proveedor que estén en o por debajo del mínimo.
    const vinculos = await prisma.proveedorProducto.findMany({
      where: { proveedorId: proveedor.id },
      include: {
        producto: {
          select: { id: true, sku: true, nombre: true, stock: true, stockMinimo: true, acfUnidadVenta: true },
        },
      },
    });

    items = vinculos
      .filter(v => v.producto.stock <= v.producto.stockMinimo)
      .map(v => {
        // Se pide lo que falta para llegar al doble del mínimo: repone y
        // deja colchón, en vez de quedar justo en el límite y volver a
        // estar en alerta con la primera venta.
        const objetivo = v.producto.stockMinimo * 2;
        const faltante = Math.max(objetivo - v.producto.stock, 1);
        const cantidad = Math.max(faltante, v.minimoPedido ?? 1);
        const precio = v.precioCompra ? Number(v.precioCompra) : 0;
        return {
          productoId: v.producto.id,
          sku: v.producto.sku,
          descripcion: v.producto.nombre,
          referenciaProveedor: v.referencia,
          cantidad,
          precioUnitario: precio,
          subtotal: Number((cantidad * precio).toFixed(2)),
        };
      });

    if (!items.length) {
      return NextResponse.json(
        {
          success: false,
          error: `No hay productos de "${proveedor.nombre}" por debajo del mínimo. Asígnale productos o crea la orden a mano.`,
        },
        { status: 400 },
      );
    }
  } else {
    if (!Array.isArray(itemsManuales) || !itemsManuales.length) {
      return NextResponse.json({ success: false, error: "La orden no tiene productos" }, { status: 400 });
    }
    items = itemsManuales.map((i: Partial<ItemOrden>) => {
      const cantidad = Number(i.cantidad) || 0;
      const precioUnitario = Number(i.precioUnitario) || 0;
      return {
        productoId: i.productoId ?? null,
        sku: String(i.sku ?? ""),
        descripcion: String(i.descripcion ?? ""),
        referenciaProveedor: i.referenciaProveedor ?? null,
        cantidad,
        precioUnitario,
        subtotal: Number((cantidad * precioUnitario).toFixed(2)),
      };
    });
    if (items.some(i => i.cantidad <= 0)) {
      return NextResponse.json({ success: false, error: "Hay cantidades en cero" }, { status: 400 });
    }
  }

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  // Si no dan fecha esperada se calcula con el lead time del proveedor.
  const esperada = fechaEsperada
    ? new Date(fechaEsperada)
    : proveedor.leadTimeDias
      ? new Date(Date.now() + proveedor.leadTimeDias * 86_400_000)
      : null;

  const orden = await prisma.ordenCompra.create({
    data: {
      numero: await siguienteNumero(),
      proveedorId: proveedor.id,
      estado: "BORRADOR",
      total,
      notas: notas ? String(notas) : null,
      items: JSON.parse(JSON.stringify(items)),
      fechaEsperada: esperada,
      creadaPorId: user.sub,
    },
    include: { proveedor: { select: { nombre: true, email: true } } },
  });

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: "COMPRA_ORDEN_CREADA",
        detalle: `${orden.numero} · ${proveedor.nombre}`,
        resultado: `items=${items.length} total=${total}`,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ success: true, data: { ...orden, total: Number(orden.total) } });
}
