import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarCopiaConversacion } from "@/lib/nexus/copia-chat";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { filtroConversaciones, ESTADOS_ACTIVOS } from "@/lib/nexus/alcance";

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
  // El filtro llega en su forma canónica (ver `normalizarCanal`), pero en
  // la base conviven mayúsculas, minúsculas y el nombre viejo del
  // formulario de WordPress. Se busca por TODAS las formas que
  // correspondan a ese canal, si no el filtro no encuentra nada.
  if (canal) {
    const formas: Record<string, string[]> = {
      // El formulario de WordPress se atiende como correo.
      EMAIL: ["EMAIL", "email", "Email", "wordpress_form", "WORDPRESS_FORM", "MAIL", "CORREO"],
      WEB: ["WEB", "web", "Web"],
      WHATSAPP: ["WHATSAPP", "whatsapp", "WhatsApp"],
      INSTAGRAM: ["INSTAGRAM", "instagram"],
      FACEBOOK: ["FACEBOOK", "facebook"],
    };
    where.canal = { in: formas[canal.toUpperCase()] ?? [canal] };
  }
  if (prioridad) where.prioridad = prioridad;
  if (soloNoLeidas) where.leida = false;

  // ── Buscar ──
  // La búsqueda era del navegador: filtraba las 100 conversaciones que
  // ya estaban cargadas. Con dos chats daba igual; en cuanto entre
  // WhatsApp, buscar "Santa Marta" dejaría de encontrar al cliente de
  // Santa Marta por el simple hecho de que su conversación es la 130.
  //
  // Se busca por lo que una persona recuerda: el nombre, el asunto, el
  // teléfono, el correo, lo que dedujo el bot, y el nombre de la empresa
  // si ya es cliente.
  const q = (searchParams.get("q") ?? "").trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    where.AND = [
      {
        OR: [
          { remitente: contiene },
          { asunto: contiene },
          { emailRemit: contiene },
          { telRemit: contiene },
          { etiquetas: { has: q.toLowerCase() } },
          { cliente: { is: { nombre: contiene } } },
          { cliente: { is: { empresa: contiene } } },
        ],
      },
    ];
  }

  // Los no-admin ven las suyas y las que no tienen dueño todavía. La
  // regla vive en lib/nexus/alcance.ts porque el historial de mensajes
  // tiene que aplicar exactamente la misma.
  Object.assign(where, filtroConversaciones(user));

  const conversaciones = await prisma.nexusConversacion.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      conexion: { select: { nombre: true, canal: true } },
      mensajes: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { mensajes: true } },
      // Lo que hace útil la bandeja: saber si quien escribe ya es cliente
      // antes de abrir la conversación. El nombre del asesor lo resuelve
      // la pantalla con la lista de usuarios que ya tiene cargada.
      cliente: { select: { id: true, nombre: true, empresa: true } },
    },
    take: 100,
  });

  // Sin leer = lo que está esperando respuesta. Incluye EN_PROCESO: un
  // mensaje nuevo en un chat que alguien ya tomó es justamente el que no
  // se puede dejar enfriar, y antes no contaba.
  const noLeidasWhere: Record<string, unknown> = {
    leida: false,
    estado: { in: ESTADOS_ACTIVOS },
    ...filtroConversaciones(user),
  };
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

  // Al cerrar un chat de la web, al cliente le llega la conversación
  // completa por correo. Es el único correo que recibe: durante la charla
  // las respuestas le aparecen en el propio chat.
  //
  // Se espera el envío en vez de dispararlo y olvidarlo porque esto corre
  // en una función sin servidor: cerrar la petición mata lo que quede
  // pendiente, y el correo no saldría nunca. Si falla, se registra y el
  // cierre se devuelve igual: un correo caído no puede impedir que un
  // asesor cierre su bandeja.
  let copia: { ok: boolean; omitida?: boolean; motivo?: string } | null = null;
  if (estado === "CERRADA" || estado === "ARCHIVADA") {
    copia = await enviarCopiaConversacion(id);
    if (!copia.ok) console.error("[nexus] No se pudo enviar la copia del chat:", copia.motivo);
  }

  return NextResponse.json({ success: true, data: updated, copia });
}
