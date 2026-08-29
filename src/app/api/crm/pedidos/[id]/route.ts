import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";

/** El orden del flujo. El indice dice si un cambio avanza o retrocede. */
const FLUJO = ["NUEVO", "CONFIRMADO", "EN_PRODUCCION", "LISTO", "DESPACHADO", "ENTREGADO", "INSTALADO"];

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

  // El reloj de "días en etapa" solo se reinicia cuando el estado cambia
  // de verdad: si se guarda el mismo estado, el pedido no se movió.
  const previo = estado ? await prisma.pedido.findUnique({ where: { id }, select: { estado: true } }) : null;
  const cambioEstado = Boolean(estado && previo && previo.estado !== estado);

  // Ir HACIA ATRÁS en el flujo lo hace solo un administrador.
  //
  // Es la decisión de gerencia de que "solo el admin puede devolver un
  // pedido a cotización", y aquí es donde de verdad se puede imponer:
  // retroceder un pedido descuadra el stock que ya se descontó, deja al
  // coordinador con una obra agendada que quizá no va, y borra el rastro
  // de por qué el negocio se movió.
  if (cambioEstado && estado) {
    const antes = FLUJO.indexOf(previo!.estado);
    const ahora = FLUJO.indexOf(estado);
    const retrocede = antes >= 0 && ahora >= 0 && ahora < antes;
    if (retrocede && !esAdmin(user.rol)) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Devolver un pedido de ${previo!.estado} a ${estado} lo tiene que hacer un ` +
            "administrador. Retroceder descuadra el stock ya descontado y la obra agendada.",
        },
        { status: 403 },
      );
    }
  }

  const updated = await prisma.pedido.update({
    where: { id },
    data: {
      ...(estado && { estado }),
      ...(cambioEstado && { estadoDesde: new Date() }),
      ...(notas !== undefined && { notas }),
      ...(fechaEntrega && { fechaEntrega: new Date(fechaEntrega) }),
      ...(direccionEntrega && { direccionEntrega }),
    },
  });

  if (estado === "EN_PRODUCCION") {
    const pedido = await prisma.pedido.findUnique({ where: { id }, include: { items: true } });
    if (pedido?.items) {
      for (const item of pedido.items) {
        if (item.productoId) {
          await prisma.producto.update({
            where: { id: item.productoId },
            data: { stock: { decrement: Number(item.cantidad) } },
          }).catch(() => {});
        }
      }
    }
  }

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

  await prisma.log.create({
    data: { usuarioId: user.sub, accion: "PEDIDO_ESTADO", detalle: `Pedido ${id} -> ${estado}`, resultado: "OK" },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: updated });
}
