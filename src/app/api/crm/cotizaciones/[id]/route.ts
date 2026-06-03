import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(_req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      vendedor: { select: { nombre: true, email: true } },
      items: { orderBy: { orden: "asc" } },
    },
  });

  if (!cotizacion) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ success: true, data: cotizacion });
}

export async function PUT(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { estado, notas } = await req.json();
  const updated = await prisma.cotizacion.update({
    where: { id },
    data: { ...(estado && { estado }), ...(notas !== undefined && { notas }) },
  });

  // Si se aprueba, crear pedido automáticamente
  if (estado === "APROBADA") {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id }, include: { items: true },
    });
    if (cotizacion) {
      const count = await prisma.pedido.count();
      const numero = `PED-${String(count + 1).padStart(5, "0")}`;
      await prisma.pedido.create({
        data: {
          numero,
          cotizacionId: id,
          clienteId: cotizacion.clienteId,
          vendedorId: cotizacion.vendedorId,
          estado: "NUEVO",
          tieneInstalacion: cotizacion.tieneInstalacion,
          total: cotizacion.total,
          items: {
            create: cotizacion.items.map((item: Record<string, unknown>) => ({
              productoId: item.productoId,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
              unidad: item.unidad,
              orden: item.orden,
            })),
          },
        },
      });
    }
  }

  return NextResponse.json({ success: true, data: updated });
}
