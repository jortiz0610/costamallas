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

  const body = await req.json();
  const { estado, notas, items, plantilla, validezDias, descuentoGlobal, ciudadInstalacion, direccionInstalacion, tieneInstalacion } = body;

  // ── Edición del borrador ──
  // Solo mientras la cotización no se haya enviado: una oferta que el
  // cliente ya tiene en la mano no puede cambiar de precio por detrás.
  if (Array.isArray(items)) {
    const actual = await prisma.cotizacion.findUnique({ where: { id }, select: { estado: true } });
    if (!actual) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
    if (actual.estado !== "BORRADOR") {
      return NextResponse.json(
        { success: false, error: "Solo se pueden editar los ítems de una cotización en borrador." },
        { status: 400 },
      );
    }
    if (!items.length) {
      return NextResponse.json({ success: false, error: "Agrega al menos un producto" }, { status: 400 });
    }

    const IVA_PCT = 0.19;
    let subtotal = 0;
    const itemsData = items.map((item: {
      productoId?: string; descripcion: string; cantidad: number; precioUnitario: number;
      descuento?: number; unidad?: string; tipo?: string; imagenUrl?: string; detalle?: string;
    }, i: number) => {
      const desc = item.descuento ?? 0;
      const sub = item.cantidad * item.precioUnitario * (1 - desc / 100);
      subtotal += sub;
      return {
        productoId: item.productoId ?? null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: desc,
        subtotal: sub,
        unidad: item.unidad ?? null,
        tipo: item.tipo === "INSTALACION" ? "INSTALACION" : "PRODUCTO",
        imagenUrl: item.imagenUrl ?? null,
        detalle: item.detalle ?? null,
        orden: i,
      };
    });

    const descGlobal = descuentoGlobal ?? 0;
    const subtotalConDesc = subtotal * (1 - descGlobal / 100);
    const iva = subtotalConDesc * IVA_PCT;

    // Se reemplazan los ítems en bloque: es más simple y más seguro que
    // intentar casar cuáles cambiaron, y un borrador no tiene historial
    // que preservar.
    const guardada = await prisma.$transaction(async tx => {
      await tx.itemCotizacion.deleteMany({ where: { cotizacionId: id } });
      return tx.cotizacion.update({
        where: { id },
        data: {
          subtotal,
          descuento: subtotal - subtotalConDesc,
          iva,
          total: subtotalConDesc + iva,
          ...(notas !== undefined && { notas }),
          ...(plantilla && { plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS" }),
          ...(validezDias != null && { validezDias: Number(validezDias) }),
          ...(tieneInstalacion !== undefined && { tieneInstalacion: Boolean(tieneInstalacion) }),
          ciudadInstalacion: ciudadInstalacion || null,
          direccionInstalacion: direccionInstalacion || null,
          items: { create: itemsData },
        },
        include: { items: { orderBy: { orden: "asc" } } },
      });
    });

    return NextResponse.json({ success: true, data: guardada });
  }

  const updated = await prisma.cotizacion.update({
    where: { id },
    data: {
      ...(estado && { estado }),
      ...(notas !== undefined && { notas }),
      ...(plantilla && { plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS" }),
    },
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
