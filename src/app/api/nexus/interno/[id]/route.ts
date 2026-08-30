// ============================================================
// GET  /api/nexus/interno/[id]   los mensajes del chat
// POST /api/nexus/interno/[id]   escribir
//
// El GET admite `?desde=<ISO>` para traer SOLO lo nuevo. Es lo que hace
// que el chat se sienta rápido: la pantalla pregunta cada dos segundos y
// casi siempre la respuesta es una lista vacía, no el hilo entero.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";

type P = { params: Promise<{ id: string }> };

/** Nadie lee ni escribe en un chat del que no es miembro. */
async function esMiembro(chatId: string, usuarioId: string) {
  return Boolean(
    await prisma.chatInternoMiembro.findUnique({
      where: { chatId_usuarioId: { chatId, usuarioId } },
      select: { id: true },
    }),
  );
}

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const sinPermiso = await exigirPermiso(req, "nexus.interno");
  if (sinPermiso) return sinPermiso;
  if (!(await esMiembro(id, user.sub))) {
    return NextResponse.json({ success: false, error: "No estás en ese chat" }, { status: 403 });
  }

  const desdeParam = req.nextUrl.searchParams.get("desde");
  const desde = desdeParam ? new Date(desdeParam) : null;
  const incremental = Boolean(desde && !Number.isNaN(desde.getTime()));

  const mensajes = await prisma.chatInternoMensaje.findMany({
    where: { chatId: id, ...(incremental ? { createdAt: { gt: desde! } } : {}) },
    orderBy: { createdAt: "asc" },
    // Sin `desde` se traen los últimos 200 y no el hilo entero: nadie
    // sube a leer el mensaje 3.000 y bajarlo cuesta lo mismo cada vez.
    ...(incremental ? {} : { take: 200 }),
    include: { autor: { select: { id: true, nombre: true } } },
  });

  // Marcar leído hasta ahora. Se hace en el GET porque abrir el chat ES
  // leerlo; pedirle a la pantalla una llamada aparte solo añade latencia.
  await prisma.chatInternoMiembro.update({
    where: { chatId_usuarioId: { chatId: id, usuarioId: user.sub } },
    data: { ultimaLecturaEn: new Date() },
  }).catch(() => { /* que no tumbe la lectura */ });

  return NextResponse.json({ success: true, data: mensajes, incremental });
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const sinPermiso = await exigirPermiso(req, "nexus.interno");
  if (sinPermiso) return sinPermiso;
  if (!(await esMiembro(id, user.sub))) {
    return NextResponse.json({ success: false, error: "No estás en ese chat" }, { status: 403 });
  }

  const { contenido, tipo = "texto", adjuntoUrl } = await req.json();
  if (!contenido?.trim()) {
    return NextResponse.json({ success: false, error: "El mensaje está vacío" }, { status: 400 });
  }

  const mensaje = await prisma.chatInternoMensaje.create({
    data: {
      chatId: id,
      autorId: user.sub,
      contenido: String(contenido).slice(0, 4000),
      tipo,
      adjuntoUrl: adjuntoUrl || null,
    },
    include: { autor: { select: { id: true, nombre: true } } },
  });

  // El sello del chat y la lectura del autor, en paralelo: son dos
  // escrituras que no dependen una de otra y encadenarlas se nota.
  await Promise.all([
    prisma.chatInterno.update({ where: { id }, data: { ultimoMensajeEn: mensaje.createdAt } }),
    prisma.chatInternoMiembro.update({
      where: { chatId_usuarioId: { chatId: id, usuarioId: user.sub } },
      data: { ultimaLecturaEn: mensaje.createdAt },
    }),
  ]).catch(() => { /* el mensaje ya está guardado, que es lo que importa */ });

  return NextResponse.json({ success: true, data: mensaje }, { status: 201 });
}
