import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";

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
      // Consecutivo atómico compartido: aquí también estaba el `count + 1`
      // que repetía número si se borraba un pedido.
      const numero = await siguienteNumeroSeguro("PED");
      await prisma.pedido.create({
        data: {
          numero,
          cotizacionId: id,
          clienteId: cotizacion.clienteId,
          vendedorId: cotizacion.vendedorId,
          estado: "NUEVO",
          origen: "COTIZACION",
          origenRef: cotizacion.numero,
          tieneInstalacion: cotizacion.tieneInstalacion,
          total: cotizacion.total,
          items: {
            create: cotizacion.items.map((item) => ({
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
