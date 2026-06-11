import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") ?? "";
  const canal = searchParams.get("canal") ?? "";
  const prioridad = searchParams.get("prioridad") ?? "";
  const soloNoLeidas = searchParams.get("noLeidas") === "true";

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (canal) where.canal = canal;
  if (prioridad) where.prioridad = prioridad;
  if (soloNoLeidas) where.leida = false;

  // Los no-admin solo ven las conversaciones asignadas a ellos
  if (!esAdmin(user.rol)) where.asignadoId = user.sub;

  const conversaciones = await prisma.nexusConversacion.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      conexion: { select: { nombre: true, canal: true } },
      mensajes: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { mensajes: true } },
    },
    take: 100,
  });

  const noLeidasWhere: Record<string, unknown> = { leida: false, estado: "ABIERTA" };
  if (!esAdmin(user.rol)) noLeidasWhere.asignadoId = user.sub;
  const noLeidas = await prisma.nexusConversacion.count({ where: noLeidasWhere });

  return NextResponse.json({ success: true, data: conversaciones, noLeidas });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { id, estado, leida, prioridad, asignadoId } = body;
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

  // Transferencia: admins o el usuario actualmente asignado
  if (asignadoId !== undefined) {
    const conv = await prisma.nexusConversacion.findUnique({ where: { id }, select: { asignadoId: true } });
    if (!esAdmin(user.rol) && conv?.asignadoId !== user.sub) {
      return NextResponse.json({ success: false, error: "Solo puedes transferir conversaciones asignadas a ti" }, { status: 403 });
    }
  }

  const updated = await prisma.nexusConversacion.update({
    where: { id },
    data: {
      ...(estado !== undefined && { estado }),
      ...(leida !== undefined && { leida }),
      ...(prioridad !== undefined && { prioridad }),
      ...(asignadoId !== undefined && { asignadoId: asignadoId || null }),
    },
  });
  return NextResponse.json({ success: true, data: updated });
}
