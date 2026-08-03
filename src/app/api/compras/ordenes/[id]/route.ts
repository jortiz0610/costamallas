// ============================================================
// PATCH  /api/compras/ordenes/[id]   cambia el estado de la orden
// DELETE /api/compras/ordenes/[id]   cancela (no borra)
//
// Faltaba el final del ciclo: una orden se creaba y se enviaba, pero no
// había forma de decir que la mercancía llegó. Todas se quedaban en
// ENVIADA para siempre y el stock nunca reflejaba la compra.
//
// Al marcarla RECIBIDA se suma el stock de cada ítem que apunte a un
// producto del catálogo. Se hace UNA sola vez: `recibidaEn` es el seguro
// contra sumar dos veces si alguien vuelve a darle al botón.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import type { ItemOrden } from "../route";

type P = { params: Promise<{ id: string }> };

const ESTADOS = ["BORRADOR", "ENVIADA", "RECIBIDA_PARCIAL", "RECIBIDA", "CANCELADA"];

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const orden = await prisma.ordenCompra.findUnique({
    where: { id },
    include: { proveedor: { select: { id: true, nombre: true, email: true } } },
  });
  if (!orden) return NextResponse.json({ success: false, error: "La orden no existe" }, { status: 404 });

  return NextResponse.json({ success: true, data: { ...orden, total: Number(orden.total) } });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { estado, notas } = await req.json();

  if (estado && !ESTADOS.includes(estado)) {
    return NextResponse.json({ success: false, error: `Estado desconocido: ${estado}` }, { status: 400 });
  }

  const orden = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!orden) return NextResponse.json({ success: false, error: "La orden no existe" }, { status: 404 });

  if (orden.estado === "CANCELADA" && estado && estado !== "CANCELADA") {
    return NextResponse.json(
      { success: false, error: "La orden está cancelada. Crea una nueva en vez de revivirla." },
      { status: 400 },
    );
  }

  // ── Entrada de mercancía ──
  // Solo la primera vez que se marca recibida. Si ya tiene fecha de
  // recepción, se respeta el estado pero no se vuelve a sumar el stock:
  // duplicar inventario es peor que no registrarlo.
  const entraMercancia = estado === "RECIBIDA" && !orden.recibidaEn;
  const movimientos: string[] = [];

  if (entraMercancia) {
    const items = (orden.items as unknown as ItemOrden[]) ?? [];
    for (const item of items) {
      if (!item.productoId) continue;
      const cantidad = Number(item.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;

      const actualizado = await prisma.producto
        .update({
          where: { id: item.productoId },
          data: { stock: { increment: Math.round(cantidad) } },
          select: { sku: true, stock: true },
        })
        .catch(() => null);

      // Un producto borrado del catálogo no debe tumbar la recepción
      // completa: se anota y se sigue con los demás.
      if (actualizado) movimientos.push(`${actualizado.sku}: +${Math.round(cantidad)} → ${actualizado.stock}`);
      else movimientos.push(`${item.sku}: el producto ya no existe en el catálogo`);
    }
  }

  const actualizada = await prisma.ordenCompra.update({
    where: { id },
    data: {
      ...(estado && { estado }),
      ...(notas !== undefined && { notas }),
      ...(entraMercancia && { recibidaEn: new Date() }),
    },
    include: { proveedor: { select: { id: true, nombre: true, email: true } } },
  });

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: entraMercancia ? "COMPRA_ORDEN_RECIBIDA" : "COMPRA_ORDEN_ESTADO",
        detalle: `${orden.numero} → ${estado ?? orden.estado}`,
        resultado: movimientos.length ? movimientos.join(" · ").slice(0, 300) : "OK",
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    success: true,
    data: { ...actualizada, total: Number(actualizada.total) },
    movimientos,
    mensaje: entraMercancia
      ? `Mercancía recibida · ${movimientos.length} producto(s) actualizados en stock`
      : undefined,
  });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const orden = await prisma.ordenCompra.findUnique({ where: { id }, select: { estado: true, recibidaEn: true } });
  if (!orden) return NextResponse.json({ success: false, error: "La orden no existe" }, { status: 404 });

  // Cancelar una orden ya recibida dejaría el stock sumado sin respaldo.
  if (orden.recibidaEn) {
    return NextResponse.json(
      { success: false, error: "Esta orden ya se recibió y su mercancía entró al stock. No se puede cancelar." },
      { status: 400 },
    );
  }

  // No se borra: una orden que se le mandó a un proveedor es un hecho, y
  // el historial de compras tiene que poder explicarse después.
  await prisma.ordenCompra.update({ where: { id }, data: { estado: "CANCELADA" } });

  await prisma.log
    .create({ data: { usuarioId: user.sub, accion: "COMPRA_ORDEN_CANCELADA", detalle: id, resultado: "OK" } })
    .catch(() => undefined);

  return NextResponse.json({ success: true });
}
