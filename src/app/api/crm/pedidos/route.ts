import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const ESTADOS_PEDIDO = ["NUEVO","CONFIRMADO","EN_PRODUCCION","LISTO","DESPACHADO","ENTREGADO","INSTALADO","CANCELADO"];

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado");
  const clienteId = req.nextUrl.searchParams.get("clienteId");

  const pedidos = await prisma.pedido.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(clienteId ? { clienteId } : {}),
    },
    include: {
      cliente: { select: { nombre: true, empresa: true } },
      vendedor: { select: { nombre: true } },
      _count: { select: { items: true } },
      instalacion: { select: { estado: true, fechaAgendada: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ success: true, data: pedidos });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { cotizacionId, clienteId, items, notas, tieneInstalacion, fechaEntrega, direccionEntrega } = body;

  if (!clienteId) return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ success: false, error: "Sin items" }, { status: 400 });

  // Verificar stock
  const stockWarnings: string[] = [];
  for (const item of items) {
    if (item.productoId) {
      const prod = await prisma.producto.findUnique({ where: { id: item.productoId }, select: { sku: true, stock: true, nombre: true } });
      if (prod && prod.stock < Number(item.cantidad)) {
        stockWarnings.push(`${prod.sku}: stock insuficiente (${prod.stock} disponible, ${item.cantidad} requerido)`);
      }
    }
  }

  let total = 0;
  const itemsData = items.map((item: Record<string, unknown>, i: number) => {
    const sub = Number(item.cantidad) * Number(item.precioUnitario);
    total += sub;
    return { productoId: (item.productoId as string) ?? null, descripcion: item.descripcion as string, cantidad: Number(item.cantidad), precioUnitario: Number(item.precioUnitario), subtotal: sub, unidad: (item.unidad as string) ?? null, orden: i };
  });

  const count = await prisma.pedido.count();
  const numero = `PED-${String(count + 1).padStart(5, "0")}`;

  const pedido = await prisma.pedido.create({
    data: {
      numero, cotizacionId: cotizacionId ?? null, clienteId, vendedorId: user.sub,
      estado: "NUEVO", tieneInstalacion: tieneInstalacion ?? false,
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      direccionEntrega, notas, total,
      items: { create: itemsData },
      ...(tieneInstalacion ? { instalacion: { create: { estado: "PENDIENTE", direccion: direccionEntrega } } } : {}),
    },
    include: { items: true, cliente: { select: { nombre: true } }, instalacion: true },
  });

  // Actualizar cotización si viene de una
  if (cotizacionId) {
    await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: "APROBADA" } });
  }

  return NextResponse.json({ success: true, data: pedido, stockWarnings }, { status: 201 });
}
