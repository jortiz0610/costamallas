import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado");

  const instalaciones = await prisma.instalacion.findMany({
    where: estado ? { estado } : undefined,
    include: {
      pedido: { select: { numero: true, total: true, cliente: { select: { nombre: true, empresa: true } } } },
      tecnico: { select: { nombre: true } },
    },
    orderBy: [{ estado: "asc" }, { fechaAgendada: "asc" }],
  });

  return NextResponse.json({ success: true, data: instalaciones });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { pedidoId, fechaAgendada, direccion, ciudad, tecnicoId, notas } = body;
  if (!pedidoId) return NextResponse.json({ success: false, error: "Selecciona un pedido" }, { status: 400 });

  // Evitar duplicados
  const existe = await prisma.instalacion.findFirst({ where: { pedidoId } });
  if (existe) return NextResponse.json({ success: false, error: "Este pedido ya tiene una instalación agendada" }, { status: 409 });

  const instalacion = await prisma.instalacion.create({
    data: {
      pedidoId,
      estado: fechaAgendada ? "AGENDADA" : "PENDIENTE",
      fechaAgendada: fechaAgendada ? new Date(fechaAgendada) : null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      tecnicoId: tecnicoId || null,
      notas: notas || null,
    },
  });

  // Marcar el pedido como con instalación
  await prisma.pedido.update({ where: { id: pedidoId }, data: { tieneInstalacion: true } }).catch(() => {});

  return NextResponse.json({ success: true, data: instalacion }, { status: 201 });
}
