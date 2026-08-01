// ============================================================
// Qué productos nos provee cada proveedor
//   GET    /api/compras/proveedores/[id]/productos
//   POST   /api/compras/proveedores/[id]/productos   crea o actualiza
//   DELETE /api/compras/proveedores/[id]/productos?productoId=…
//
// Es lo que hace posible armar un pedido solo: sin estos vínculos, el
// autoarmado de órdenes no tiene de dónde saber a quién comprarle.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

const numeroOpcional = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const vinculos = await prisma.proveedorProducto.findMany({
    where: { proveedorId: id },
    include: {
      producto: { select: { id: true, sku: true, nombre: true, stock: true, stockMinimo: true, acfUnidadVenta: true } },
    },
    orderBy: [{ preferido: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    success: true,
    data: vinculos.map(v => ({
      ...v,
      precioCompra: v.precioCompra != null ? Number(v.precioCompra) : null,
      // Bajo mínimo = entraría en el próximo pedido automático.
      bajoMinimo: v.producto.stock <= v.producto.stockMinimo,
    })),
  });
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  const productoId = String(b.productoId ?? "");
  if (!productoId) return NextResponse.json({ success: false, error: "Falta el producto" }, { status: 400 });

  const [proveedor, producto] = await Promise.all([
    prisma.proveedor.findUnique({ where: { id }, select: { id: true } }),
    prisma.producto.findUnique({ where: { id: productoId }, select: { id: true } }),
  ]);
  if (!proveedor) return NextResponse.json({ success: false, error: "El proveedor no existe" }, { status: 404 });
  if (!producto) return NextResponse.json({ success: false, error: "El producto no existe" }, { status: 404 });

  const minimoPedido = numeroOpcional(b.minimoPedido);
  if (minimoPedido != null && minimoPedido < 1) {
    return NextResponse.json({ success: false, error: "El mínimo de pedido debe ser al menos 1" }, { status: 400 });
  }

  const datos = {
    referencia: b.referencia ? String(b.referencia).trim() : null,
    precioCompra: numeroOpcional(b.precioCompra),
    minimoPedido: minimoPedido != null ? Math.round(minimoPedido) : null,
    leadTimeDias: numeroOpcional(b.leadTimeDias) != null ? Math.round(Number(b.leadTimeDias)) : null,
    preferido: Boolean(b.preferido),
    notas: b.notas ? String(b.notas) : null,
  };

  const vinculo = await prisma.proveedorProducto.upsert({
    where: { proveedorId_productoId: { proveedorId: id, productoId } },
    create: { proveedorId: id, productoId, ...datos },
    update: datos,
  });

  // Un solo proveedor preferido por producto: si este lo es, los demás
  // dejan de serlo. Si no, al armar un pedido habría dos "preferidos"
  // y la elección quedaría al azar del orden de la consulta.
  if (datos.preferido) {
    await prisma.proveedorProducto.updateMany({
      where: { productoId, proveedorId: { not: id } },
      data: { preferido: false },
    });
  }

  return NextResponse.json({
    success: true,
    data: { ...vinculo, precioCompra: vinculo.precioCompra != null ? Number(vinculo.precioCompra) : null },
  });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const productoId = req.nextUrl.searchParams.get("productoId");
  if (!productoId) return NextResponse.json({ success: false, error: "Falta el producto" }, { status: 400 });

  await prisma.proveedorProducto
    .delete({ where: { proveedorId_productoId: { proveedorId: id, productoId } } })
    .catch(() => undefined);

  return NextResponse.json({ success: true });
}
