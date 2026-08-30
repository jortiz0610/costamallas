// ============================================================
// GET  /api/nexus/interno            mis chats + con quién puedo hablar
// POST /api/nexus/interno            abrir (o recuperar) un chat directo
//
// El chat interno es del EQUIPO: no hay clientes, no hay canales y no
// cuenta para el informe de tiempos de respuesta. Por eso vive en sus
// propias tablas y no como una conexión más de Nexus.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const sinPermiso = await exigirPermiso(req, "nexus.interno");
  if (sinPermiso) return sinPermiso;

  const miembros = await prisma.chatInternoMiembro.findMany({
    where: { usuarioId: user.sub },
    include: {
      chat: {
        include: {
          miembros: { include: { usuario: { select: { id: true, nombre: true, rol: true } } } },
          mensajes: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  // Sin leer = mensajes posteriores a MI última lectura y que no escribí
  // yo. Se calcula por chat en la misma pasada para no hacer una consulta
  // por conversación.
  const chats = await Promise.all(
    miembros.map(async m => {
      const sinLeer = await prisma.chatInternoMensaje.count({
        where: {
          chatId: m.chatId,
          autorId: { not: user.sub },
          ...(m.ultimaLecturaEn ? { createdAt: { gt: m.ultimaLecturaEn } } : {}),
        },
      });
      const otros = m.chat.miembros.filter(x => x.usuarioId !== user.sub).map(x => x.usuario);
      return {
        id: m.chat.id,
        tipo: m.chat.tipo,
        // Un chat directo se nombra con la otra persona, y eso depende de
        // quién lo esté mirando: por eso el nombre se arma aquí y no se
        // guarda en la tabla.
        nombre: m.chat.tipo === "GRUPO"
          ? (m.chat.nombre ?? "Grupo")
          : (otros[0]?.nombre ?? "Chat"),
        participantes: otros,
        ultimoMensaje: m.chat.mensajes[0]
          ? {
              contenido: m.chat.mensajes[0].contenido,
              createdAt: m.chat.mensajes[0].createdAt,
              mio: m.chat.mensajes[0].autorId === user.sub,
            }
          : null,
        ultimoMensajeEn: m.chat.ultimoMensajeEn,
        sinLeer,
      };
    }),
  );

  chats.sort((a, b) => {
    const fa = a.ultimoMensajeEn?.getTime() ?? 0;
    const fb = b.ultimoMensajeEn?.getTime() ?? 0;
    return fb - fa;
  });

  // Con quién se puede abrir un chat: cualquier compañero activo que no
  // sea un login de cliente.
  const companeros = await prisma.usuario.findMany({
    where: { activo: true, id: { not: user.sub }, rol: { not: "CLIENTE" } },
    select: { id: true, nombre: true, email: true, rol: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: { chats, companeros, sinLeerTotal: chats.reduce((s, c) => s + c.sinLeer, 0) },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const sinPermiso = await exigirPermiso(req, "nexus.interno");
  if (sinPermiso) return sinPermiso;

  const { usuarioId, nombre, miembros } = await req.json();

  // ── Chat directo ──
  if (usuarioId) {
    if (usuarioId === user.sub) {
      return NextResponse.json({ success: false, error: "No puedes abrir un chat contigo mismo" }, { status: 400 });
    }
    const otro = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, activo: true } });
    if (!otro?.activo) {
      return NextResponse.json({ success: false, error: "Esa persona no está activa" }, { status: 404 });
    }

    // Si ya existe el chat entre los dos, se devuelve ese. Sin esto, cada
    // vez que alguien pulsa el nombre de un compañero nacería un hilo
    // nuevo y el historial quedaría repartido en cinco conversaciones.
    const existente = await prisma.chatInterno.findFirst({
      where: {
        tipo: "DIRECTO",
        AND: [
          { miembros: { some: { usuarioId: user.sub } } },
          { miembros: { some: { usuarioId } } },
        ],
      },
      select: { id: true },
    });
    if (existente) return NextResponse.json({ success: true, data: { id: existente.id, nuevo: false } });

    const chat = await prisma.chatInterno.create({
      data: {
        tipo: "DIRECTO",
        creadoPorId: user.sub,
        miembros: { create: [{ usuarioId: user.sub }, { usuarioId }] },
      },
      select: { id: true },
    });
    return NextResponse.json({ success: true, data: { id: chat.id, nuevo: true } }, { status: 201 });
  }

  // ── Grupo ──
  const ids: string[] = Array.isArray(miembros) ? miembros.filter((x: unknown) => typeof x === "string") : [];
  if (!nombre?.trim() || ids.length === 0) {
    return NextResponse.json({ success: false, error: "Un grupo necesita nombre y al menos una persona" }, { status: 400 });
  }
  const todos = Array.from(new Set([user.sub, ...ids]));
  const chat = await prisma.chatInterno.create({
    data: {
      tipo: "GRUPO",
      nombre: nombre.trim(),
      creadoPorId: user.sub,
      miembros: { create: todos.map(id => ({ usuarioId: id })) },
    },
    select: { id: true },
  });
  return NextResponse.json({ success: true, data: { id: chat.id, nuevo: true } }, { status: 201 });
}
