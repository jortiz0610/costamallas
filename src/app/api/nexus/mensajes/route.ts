import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversacionId = searchParams.get("conversacionId");
  if (!conversacionId) return NextResponse.json({ success: false, error: "conversacionId requerido" }, { status: 400 });

  const mensajes = await prisma.nexusMensaje.findMany({
    where: { conversacionId },
    orderBy: { createdAt: "asc" },
    include: { agente: { select: { nombre: true } } },
  });

  // Marcar conversación como leída
  await prisma.nexusConversacion.update({ where: { id: conversacionId }, data: { leida: true } }).catch(() => {});

  return NextResponse.json({ success: true, data: mensajes });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { conversacionId, contenido, tipo = "texto" } = body;
  if (!conversacionId || !contenido?.trim()) return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });

  const mensaje = await prisma.nexusMensaje.create({
    data: { conversacionId, agenteId: user.sub, origen: "agente", contenido, tipo },
    include: { agente: { select: { nombre: true } } },
  });

  await prisma.nexusConversacion.update({
    where: { id: conversacionId },
    data: { updatedAt: new Date() },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mensaje });
}
