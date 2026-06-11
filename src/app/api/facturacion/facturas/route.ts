import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { siguienteNumeroInterno, getFacturacionConfig } from "@/lib/facturacion";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado");
  const facturas = await prisma.factura.findMany({
    where: estado ? { estado } : undefined,
    include: { cliente: { select: { nombre: true, empresa: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ success: true, data: facturas });
}

interface ItemIn { productoId?: string | null; descripcion: string; cantidad: number; precioUnitario: number; descuento?: number; ivaPct?: number; unidad?: string | null; }

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  let { clienteId } = b;
  let itemsIn: ItemIn[] = Array.isArray(b.items) ? b.items : [];
  const cfg = await getFacturacionConfig();

  // Generar desde un pedido existente
  if (b.pedidoId) {
    const pedido = await prisma.pedido.findUnique({ where: { id: b.pedidoId }, include: { items: true } });
    if (!pedido) return NextResponse.json({ success: false, error: "Pedido no encontrado" }, { status: 404 });
    clienteId = pedido.clienteId;
    itemsIn = pedido.items.map(it => ({ productoId: it.productoId, descripcion: it.descripcion, cantidad: Number(it.cantidad), precioUnitario: Number(it.precioUnitario), descuento: 0, ivaPct: cfg.ivaPorDefecto, unidad: it.unidad }));
  }

  if (!clienteId) return NextResponse.json({ success: false, error: "Selecciona un cliente" }, { status: 400 });
  if (!itemsIn.length) return NextResponse.json({ success: false, error: "Agrega al menos un ítem" }, { status: 400 });

  let subtotal = 0, ivaTotal = 0, descTotal = 0;
  const itemsData = itemsIn.map((it, i) => {
    const desc = it.descuento ?? 0;
    const ivaPct = it.ivaPct ?? cfg.ivaPorDefecto;
    const baseLinea = it.cantidad * it.precioUnitario;
    const descLinea = baseLinea * (desc / 100);
    const sub = baseLinea - descLinea;
    subtotal += baseLinea; descTotal += descLinea; ivaTotal += sub * (ivaPct / 100);
    return { productoId: it.productoId ?? null, descripcion: it.descripcion, cantidad: it.cantidad, precioUnitario: it.precioUnitario, descuento: desc, ivaPct, subtotal: sub, unidad: it.unidad ?? null, orden: i };
  });
  const total = subtotal - descTotal + ivaTotal;
  const numero = await siguienteNumeroInterno();

  const factura = await prisma.factura.create({
    data: {
      numero, clienteId, pedidoId: b.pedidoId ?? null, cotizacionId: b.cotizacionId ?? null,
      estado: "BORRADOR",
      estadoDian: cfg.proveedor === "manual" ? "NO_APLICA" : "PENDIENTE",
      prefijo: cfg.prefijo,
      subtotal, descuento: descTotal, iva: ivaTotal, total, saldoPendiente: total,
      formaPago: b.formaPago ?? "CONTADO", metodoPago: b.metodoPago ?? null,
      fechaVence: b.fechaVence ? new Date(b.fechaVence) : null,
      notas: b.notas ?? null,
      items: { create: itemsData },
    },
    include: { items: true },
  });

  await prisma.log.create({ data: { usuarioId: user.sub, accion: "FACTURA_CREAR", detalle: `${numero}`, resultado: "OK" } }).catch(() => {});
  return NextResponse.json({ success: true, data: factura }, { status: 201 });
}
