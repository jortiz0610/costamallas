import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { estado, fechaAgendada, fechaRealizada, tecnicoId, direccion, ciudad, notas } = body;

  const data: Record<string, unknown> = {};
  if (estado) data.estado = estado;
  if (fechaAgendada) data.fechaAgendada = new Date(fechaAgendada);
  if (fechaRealizada) data.fechaRealizada = new Date(fechaRealizada);
  if (tecnicoId !== undefined) data.tecnicoId = tecnicoId;
  if (direccion !== undefined) data.direccion = direccion;
  if (ciudad !== undefined) data.ciudad = ciudad;
  if (notas !== undefined) data.notas = notas;

  // Si se completa, actualizar pedido a INSTALADO
  if (estado === "COMPLETADA") {
    const inst = await prisma.instalacion.findUnique({ where: { id } });
    if (inst?.pedidoId) {
      await prisma.pedido.update({ where: { id: inst.pedidoId }, data: { estado: "INSTALADO" } });
    }
    data.fechaRealizada = new Date();
  }

  const updated = await prisma.instalacion.update({ where: { id }, data: data as never });
  return NextResponse.json({ success: true, data: updated });
}
