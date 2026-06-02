import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(_req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: true,
      vendedor: { select: { nombre: true } },
      items: { orderBy: { orden: "asc" } },
      instalacion: { include: { tecnico: { select: { nombre: true } } } },
      cotizacion: { select: { numero: true } },
    },
  });

  if (!pedido) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, data: pedido });
}

export async function PUT(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { estado, notas, fechaEntrega, direccionEntrega } = body;

  const updated = await prisma.pedido.update({
    where: { id },
    data: {
      ...(estado && { estado }),
      ...(notas !== undefined && { notas }),
      ...(fechaEntrega && { fechaEntrega: new Date(fechaEntrega) }),
      ...(direccionEntrega && { direccionEntrega }),
    },
  });

  // Si pasa a EN_PRODUCCION, verificar y descontar stock
  if (estado === "EN_PRODUCCION") {
    const pedido = await prisma.pedido.findUnique({
      where: { id }, include: { items: true },
    });
    if (pedido?.items) {
      for (const item of pedido.items) {
        if (item.productoId) {
          await prisma.producto.update({
            where: { id: item.productoId },
            data: { stock: { decrement: Number(item.cantidad) } },
          }).catch(() => {}); // Ignorar si no hay suficiente stock
        }
      }
    }
  }

  // Si tiene instalación y se entrega, crear instalación pendiente
  if (estado === "DESPACHADO") {
    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (pedido?.tieneInstalacion) {
      await prisma.instalacion.upsert({
        where: { pedidoId: id },
        update: {},
        create: { pedidoId: id, estado: "PENDIENTE" },
      });
    }
  }

  // Log
  await prisma.log.create({
    data: {
      usuarioId: user.sub,
      accion: "PEDIDO_ESTADO",
      detalle: `Pedido ${id} → ${estado}`,
      resultado: "OK",
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: updated });
}
