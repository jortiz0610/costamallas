import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

function generarNumero(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  const estado = req.nextUrl.searchParams.get("estado");

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      ...(clienteId ? { clienteId } : {}),
      ...(estado ? { estado } : {}),
    },
    include: {
      cliente: { select: { nombre: true, empresa: true } },
      vendedor: { select: { nombre: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data: cotizaciones });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { clienteId, items, notas, tieneInstalacion, validezDias, descuentoGlobal } = body;

  if (!clienteId) return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ success: false, error: "Agrega al menos un producto" }, { status: 400 });

  // Calcular totales
  const IVA_PCT = 0.19;
  let subtotal = 0;
  const itemsData = items.map((item: { productoId?: string; descripcion: string; cantidad: number; precioUnitario: number; descuento?: number; unidad?: string }, i: number) => {
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
      orden: i,
    };
  });

  const descGlobal = descuentoGlobal ?? 0;
  const subtotalConDesc = subtotal * (1 - descGlobal / 100);
  const iva = subtotalConDesc * IVA_PCT;
  const total = subtotalConDesc + iva;

  const count = await prisma.cotizacion.count();
  const numero = generarNumero("COT", count);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      numero,
      clienteId,
      vendedorId: user.sub,
      estado: "BORRADOR",
      subtotal,
      descuento: subtotal - subtotalConDesc,
      iva,
      total,
      validezDias: validezDias ?? 30,
      notas,
      tieneInstalacion: tieneInstalacion ?? false,
      items: { create: itemsData },
    },
    include: {
      items: true,
      cliente: { select: { nombre: true, empresa: true } },
    },
  });

  return NextResponse.json({ success: true, data: cotizacion }, { status: 201 });
}
