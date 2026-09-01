import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

/** La obra completa. La usa el acta de entrega, que necesita el pedido,
 *  sus ítems y los datos del cliente en una sola llamada. */
export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const inst = await prisma.instalacion.findUnique({
    where: { id },
    include: {
      tecnico: { select: { id: true, nombre: true, telefono: true } },
      pedido: {
        select: {
          id: true, numero: true, total: true, fechaEntrega: true, direccionEntrega: true, notas: true,
          cliente: {
            select: {
              nombre: true, empresa: true, nit: true, telefono: true,
              email: true, direccion: true, ciudad: true,
            },
          },
          vendedor: { select: { nombre: true } },
          items: { orderBy: { orden: "asc" } },
        },
      },
    },
  });
  if (!inst) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: {
      ...inst,
      // Nulo en una VISITA. La pantalla ya sabe distinguirlo por .
      pedido: inst.pedido ? {
        ...inst.pedido,
        total: Number(inst.pedido.total),
        items: inst.pedido.items.map(i => ({
          ...i,
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precioUnitario),
          subtotal: Number(i.subtotal),
        })),
      } : null,
    },
  });
}

export async function PUT(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const {
    estado, fechaAgendada, fechaRealizada, tecnicoId, direccion, ciudad, notas, fotos, checklist,
    actaRecibidoPor, actaDocumento, actaObservaciones, actaFirmada,
  } = body;

  const data: Record<string, unknown> = {};
  if (estado) data.estado = estado;
  if (fechaAgendada) data.fechaAgendada = new Date(fechaAgendada);
  if (fechaRealizada) data.fechaRealizada = new Date(fechaRealizada);
  if (tecnicoId !== undefined) data.tecnicoId = tecnicoId;
  if (direccion !== undefined) data.direccion = direccion;
  if (ciudad !== undefined) data.ciudad = ciudad;
  if (notas !== undefined) data.notas = notas;
  if (Array.isArray(fotos)) data.fotos = fotos;
  if (Array.isArray(checklist)) data.checklist = checklist;

  // ── Acta de entrega ──
  // Quién recibió la obra en sitio, con qué documento y con qué
  // observaciones. No siempre recibe quien compró, y cuando aparece un
  // reclamo lo primero que se pregunta es quién firmó.
  if (actaRecibidoPor !== undefined) data.actaRecibidoPor = actaRecibidoPor || null;
  if (actaDocumento !== undefined) data.actaDocumento = actaDocumento || null;
  if (actaObservaciones !== undefined) data.actaObservaciones = actaObservaciones || null;
  if (actaFirmada === true) data.actaFirmadaEn = new Date();
  if (actaFirmada === false) data.actaFirmadaEn = null;

  // Si se completa, actualizar pedido a INSTALADO
  if (estado === "COMPLETADA") {
    const inst = await prisma.instalacion.findUnique({ where: { id } });

    // No se cierra una obra con puntos del checklist sin cumplir: el
    // checklist existe justamente para que nadie la dé por terminada de
    // memoria y después aparezca el reclamo.
    const lista = (Array.isArray(checklist) ? checklist : (inst?.checklist as { hecho?: boolean }[] | null)) ?? [];
    const pendientes = lista.filter(c => !c?.hecho).length;
    if (pendientes > 0) {
      return NextResponse.json(
        { success: false, error: `Quedan ${pendientes} punto(s) del checklist sin marcar.` },
        { status: 400 },
      );
    }

    if (inst?.pedidoId) {
      await prisma.pedido.update({
        where: { id: inst.pedidoId },
        data: { estado: "INSTALADO", estadoDesde: new Date() },
      });
    }
    data.fechaRealizada = new Date();
  }

  const updated = await prisma.instalacion.update({ where: { id }, data: data as never });
  return NextResponse.json({ success: true, data: updated });
}
