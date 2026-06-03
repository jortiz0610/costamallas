import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado");
  const clienteId = req.nextUrl.searchParams.get("clienteId");

  const tareas = await prisma.tarea.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(clienteId ? { clienteId } : {}),
    },
    include: {
      cliente: { select: { id: true, nombre: true, empresa: true } },
      asignado: { select: { id: true, nombre: true } },
    },
    orderBy: [{ estado: "asc" }, { fechaVence: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json({ success: true, data: tareas });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { titulo, descripcion, tipo, prioridad, fechaVence, clienteId, asignadoId } = body;
  if (!titulo?.trim()) return NextResponse.json({ success: false, error: "Título requerido" }, { status: 400 });

  const tarea = await prisma.tarea.create({
    data: {
      titulo: titulo.trim(),
      descripcion: descripcion || null,
      tipo: tipo ?? "SEGUIMIENTO",
      prioridad: prioridad ?? "NORMAL",
      fechaVence: fechaVence ? new Date(fechaVence) : null,
      clienteId: clienteId || null,
      asignadoId: asignadoId || user.sub,
    },
  });

  return NextResponse.json({ success: true, data: tarea }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { id, estado, prioridad, titulo, descripcion, fechaVence } = await req.json();
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const tarea = await prisma.tarea.update({
    where: { id },
    data: {
      ...(estado !== undefined && { estado, completadaEn: estado === "COMPLETADA" ? new Date() : null }),
      ...(prioridad !== undefined && { prioridad }),
      ...(titulo !== undefined && { titulo }),
      ...(descripcion !== undefined && { descripcion }),
      ...(fechaVence !== undefined && { fechaVence: fechaVence ? new Date(fechaVence) : null }),
    },
  });

  return NextResponse.json({ success: true, data: tarea });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  await prisma.tarea.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
