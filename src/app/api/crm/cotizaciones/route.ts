import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";

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
  const {
    clienteId, items, notas, tieneInstalacion, validezDias, descuentoGlobal,
    plantilla, ciudadInstalacion, direccionInstalacion,
  } = body;

  if (!clienteId) return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ success: false, error: "Agrega al menos un producto" }, { status: 400 });

  // Calcular totales
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
      // La foto se copia del catálogo al cotizar: si mañana cambian la
      // imagen del producto, la oferta ya enviada no se altera sola.
      tipo: item.tipo === "INSTALACION" ? "INSTALACION" : "PRODUCTO",
      imagenUrl: item.imagenUrl ?? null,
      detalle: item.detalle ?? null,
      orden: i,
    };
  });

  const descGlobal = descuentoGlobal ?? 0;
  const subtotalConDesc = subtotal * (1 - descGlobal / 100);
  const iva = subtotalConDesc * IVA_PCT;
  const total = subtotalConDesc + iva;

  // Consecutivo atómico. Antes era `count() + 1`, que repetía números
  // si se borraba una cotización y chocaba entre usuarios simultáneos.
  const numero = await siguienteNumeroSeguro("COT");

  // El token del enlace público es aleatorio y largo a propósito: la
  // cotización se comparte sin login, así que no puede llegarse a ella
  // adivinando un id.
  const publicId = randomBytes(16).toString("base64url");

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
      plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS",
      ciudadInstalacion: ciudadInstalacion || null,
      direccionInstalacion: direccionInstalacion || null,
      publicId,
      items: { create: itemsData },
    },
    include: {
      items: true,
      cliente: { select: { nombre: true, empresa: true } },
    },
  });

  return NextResponse.json({ success: true, data: cotizacion }, { status: 201 });
}
