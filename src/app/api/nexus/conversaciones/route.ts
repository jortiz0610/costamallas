import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

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

  const noLeidas = await prisma.nexusConversacion.count({ where: { leida: false, estado: "ABIERTA" } });

  return NextResponse.json({ success: true, data: conversaciones, noLeidas });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { id, estado, leida, prioridad } = body;
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

  const updated = await prisma.nexusConversacion.update({
    where: { id },
    data: {
      ...(estado !== undefined && { estado }),
      ...(leida !== undefined && { leida }),
      ...(prioridad !== undefined && { prioridad }),
    },
  });
  return NextResponse.json({ success: true, data: updated });
}
