// ============================================================
// POST /api/nexus/webhook/[canal] — por aquí entran los mensajes
//
// Dos formatos conviven a propósito:
//
//   · El de META (WhatsApp Cloud API), anidado y con varios mensajes por
//     petición. Se traduce en lib/nexus/meta-webhook.ts.
//   · El PLANO ({from, body}), que es el que manda un puente tipo n8n o
//     el formulario de WordPress. Se conserva porque hay integraciones
//     apuntando aquí.
//
// Se distingue por el contenido, no por el canal: alguien puede conectar
// WhatsApp por un puente en vez de por Meta.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asignarConversacion } from "@/lib/nexus/asignacion";
import { calificarMensaje, etiquetasDe, prioridadDe } from "@/lib/nexus/bot";
import { esPayloadDeMeta, mensajesDeMeta, type MensajeEntrante } from "@/lib/nexus/meta-webhook";

type P = { params: Promise<{ canal: string }> };

/** Webhook genérico que recibe eventos de cualquier canal */
export async function POST(req: NextRequest, { params }: P) {
  const { canal } = await params;

  // Buscar conexión activa para este canal
  const conexion = await prisma.nexusConexion.findFirst({
    where: { canal, activo: true },
  });

  if (!conexion) {
    return NextResponse.json({ ok: false, error: "Canal no configurado" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* form-encoded o vacío */ }

  // ── Camino de Meta ──
  //
  // Se responde 200 SIEMPRE, incluso cuando el evento no trae mensajes
  // (un acuse de entrega, por ejemplo). Meta reintenta lo que no le
  // devuelve 200 y acaba desactivando el webhook: contestarle un error
  // por un acuse de recibo sería apagarnos solos.
  if (esPayloadDeMeta(body)) {
    const entrantes = mensajesDeMeta(body);
    if (!entrantes.length) return NextResponse.json({ ok: true, sinMensajes: true });

    const ids: string[] = [];
    for (const m of entrantes) {
      const id = await guardarEntrante(conexion.id, canal, m).catch(e => {
        console.error("[nexus] No se pudo guardar un mensaje de Meta:", e);
        return null;
      });
      if (id) ids.push(id);
    }
    return NextResponse.json({ ok: true, conversaciones: ids });
  }

  // Extraer datos según el canal
  let remitente = "Desconocido";
  let emailRemit: string | undefined;
  let telRemit: string | undefined;
  let asunto: string | undefined;
  let contenido = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let metadata: any = {};

  if (canal === "wordpress_form") {
    // CF7, WPForms, Gravity Forms, etc.
    remitente = String(body.your_name ?? body.name ?? body.nombre ?? body["your-name"] ?? "Visitante web");
    emailRemit = String(body.your_email ?? body.email ?? body["your-email"] ?? "");
    telRemit = String(body.phone ?? body.telefono ?? body.tel ?? "");
    asunto = String(body.subject ?? body.asunto ?? body.your_subject ?? body["your-subject"] ?? "Formulario web");
    contenido = String(body.message ?? body.mensaje ?? body.your_message ?? body["your-message"] ?? JSON.stringify(body));
    metadata = { fuente: "WordPress", formId: body.form_id ?? body._wpcf7 ?? "desconocido", rawData: body };
  } else if (canal === "whatsapp") {
    remitente = String(body.from_name ?? body.name ?? body.profile_name ?? "WhatsApp");
    telRemit = String(body.from ?? body.phone ?? "");
    contenido = String(body.body ?? body.text ?? body.message ?? "");
    asunto = "WhatsApp";
    metadata = { fuente: "WhatsApp", ...body };
  } else if (canal === "instagram") {
    remitente = String(body.sender_name ?? body.username ?? "Instagram");
    contenido = String(body.message ?? body.text ?? "");
    asunto = "Instagram DM";
    metadata = { fuente: "Instagram", ...body };
  } else if (canal === "tiktok") {
    remitente = String(body.username ?? body.display_name ?? "TikTok");
    contenido = String(body.message ?? body.comment ?? "");
    asunto = "TikTok";
    metadata = { fuente: "TikTok", ...body };
  } else {
    remitente = String(body.name ?? body.from ?? "Contacto");
    contenido = String(body.message ?? body.content ?? JSON.stringify(body));
    asunto = canal;
    metadata = body;
  }

  // ── Si ya hay una conversación abierta con este contacto, el mensaje
  // se suma a ella. Abrir una nueva por cada mensaje partía el hilo y
  // el asesor perdía el contexto de lo que ya había hablado.
  const abierta = (telRemit || emailRemit)
    ? await prisma.nexusConversacion.findFirst({
        where: {
          canal,
          estado: "ABIERTA",
          OR: [
            ...(telRemit ? [{ telRemit }] : []),
            ...(emailRemit ? [{ emailRemit }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    : null;

  if (abierta) {
    await prisma.nexusMensaje.create({
      data: {
        conversacionId: abierta.id,
        origen: "contacto",
        contenido: contenido || "(Sin mensaje)",
        tipo: "texto",
        estadoEnvio: "RECIBIDO",
        metadata,
      },
    });
    await prisma.nexusConversacion.update({
      where: { id: abierta.id },
      data: { leida: false, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, conversacionId: abierta.id, continuacion: true });
  }

  // ── Conversación nueva ──
  // El bot califica y el reparto decide a quién le toca. Las dos cosas
  // pueden fallar sin que el mensaje se pierda: peor que un lead sin
  // clasificar es un lead que no entró.
  const [calificacion, asignacion] = await Promise.all([
    calificarMensaje(contenido),
    asignarConversacion({ telefono: telRemit, email: emailRemit, preferido: conexion.asignadoId }),
  ]);

  const conversacion = await prisma.nexusConversacion.create({
    data: {
      conexionId: conexion.id,
      canal,
      remitente,
      emailRemit: emailRemit || undefined,
      telRemit: telRemit || undefined,
      asunto,
      estado: "ABIERTA",
      // Ya no hereda el dueño fijo de la línea: se reparte por turno para
      // que todos los asesores tengan la misma oportunidad.
      asignadoId: asignacion.usuarioId ?? undefined,
      clienteId: asignacion.clienteId ?? undefined,
      prioridad: prioridadDe(calificacion),
      etiquetas: etiquetasDe(calificacion),
      leida: false,
      metadata: { ...metadata, calificacion, asignacion: asignacion.motivo },
      mensajes: {
        create: {
          origen: "contacto",
          contenido: contenido || "(Sin mensaje)",
          tipo: "texto",
          estadoEnvio: "RECIBIDO",
          metadata,
        },
      },
    },
  });

  await prisma.notificacion.create({
    data: {
      tipo: "NEXUS_MENSAJE" as "SISTEMA",
      titulo: `Nuevo mensaje de ${remitente}`,
      mensaje: [
        `Canal: ${canal}`,
        calificacion?.resumen,
        calificacion?.urgencia === "ALTA" ? "URGENTE" : null,
      ].filter(Boolean).join(" · "),
      data: { conversacionId: conversacion.id, canal, asignadoId: asignacion.usuarioId },
    },
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    conversacionId: conversacion.id,
    asignadoA: asignacion.usuarioId,
    motivo: asignacion.motivo,
    calificacion,
  });
}

/**
 * Guarda un mensaje entrante: lo suma a la conversación abierta con ese
 * contacto, o abre una nueva y la reparte.
 *
 * Devuelve el id de la conversación.
 */
async function guardarEntrante(conexionId: string, canal: string, m: MensajeEntrante): Promise<string> {
  // El mismo mensaje puede llegar dos veces: Meta reintenta cuando cree
  // que no le contestamos a tiempo. El wamid es único, así que sirve para
  // no duplicarlo en la bandeja.
  if (m.refExterna) {
    const yaEsta = await prisma.nexusMensaje.findFirst({
      where: { refExterna: m.refExterna },
      select: { conversacionId: true },
    });
    if (yaEsta) return yaEsta.conversacionId;
  }

  const abierta = m.telefono
    ? await prisma.nexusConversacion.findFirst({
        where: { canal, estado: "ABIERTA", telRemit: m.telefono },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    : null;

  if (abierta) {
    await prisma.nexusMensaje.create({
      data: {
        conversacionId: abierta.id,
        origen: "contacto",
        contenido: m.contenido || "(Sin mensaje)",
        tipo: m.tipo,
        estadoEnvio: "RECIBIDO",
        refExterna: m.refExterna,
        metadata: m.metadata as never,
      },
    });
    await prisma.nexusConversacion.update({
      where: { id: abierta.id },
      data: { leida: false, updatedAt: new Date() },
    });
    return abierta.id;
  }

  const conexion = await prisma.nexusConexion.findUnique({
    where: { id: conexionId },
    select: { asignadoId: true },
  });

  const [calificacion, asignacion] = await Promise.all([
    calificarMensaje(m.contenido),
    asignarConversacion({ telefono: m.telefono, preferido: conexion?.asignadoId ?? null }),
  ]);

  const conversacion = await prisma.nexusConversacion.create({
    data: {
      conexionId,
      canal,
      remitente: m.remitente,
      telRemit: m.telefono || undefined,
      asunto: "WhatsApp",
      estado: "ABIERTA",
      asignadoId: asignacion.usuarioId ?? undefined,
      clienteId: asignacion.clienteId ?? undefined,
      prioridad: prioridadDe(calificacion),
      etiquetas: etiquetasDe(calificacion),
      leida: false,
      metadata: { ...m.metadata, calificacion, asignacion: asignacion.motivo } as never,
      mensajes: {
        create: {
          origen: "contacto",
          contenido: m.contenido || "(Sin mensaje)",
          tipo: m.tipo,
          estadoEnvio: "RECIBIDO",
          refExterna: m.refExterna,
          metadata: m.metadata as never,
        },
      },
    },
    select: { id: true },
  });

  await prisma.notificacion.create({
    data: {
      tipo: "NEXUS_MENSAJE" as "SISTEMA",
      titulo: `Nuevo mensaje de ${m.remitente}`,
      mensaje: [
        `Canal: ${canal}`,
        calificacion?.resumen,
        calificacion?.urgencia === "ALTA" ? "URGENTE" : null,
      ].filter(Boolean).join(" · "),
      data: { conversacionId: conversacion.id, canal, asignadoId: asignacion.usuarioId },
    },
  }).catch(() => {});

  return conversacion.id;
}

/** Verificación de webhook (GET) — para plataformas como Meta */
export async function GET(req: NextRequest, { params }: P) {
  const { canal } = await params;
  const { searchParams } = new URL(req.url);

  // Meta webhook verification
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge) {
    const conexion = await prisma.nexusConexion.findFirst({ where: { canal, activo: true } });
    const cfg = (conexion?.config ?? {}) as Record<string, string>;
    // La pantalla guarda `verifyToken` y esto buscaba `verify_token`, así
    // que nunca encontraba nada y el `|| !esperado` de más abajo dejaba
    // pasar CUALQUIER token: el webhook lo podía registrar un extraño.
    // Se aceptan las dos formas y se exige que coincida.
    const esperado = (cfg.verifyToken || cfg.verify_token || "").trim();

    if (!esperado) {
      // Sin token configurado no hay nada contra qué comparar. Se deja
      // pasar para no bloquear el primer registro, pero queda escrito.
      console.warn(`[nexus] Webhook "${canal}" verificado SIN token. Cárgalo en la conexión.`);
      return new NextResponse(challenge, { status: 200 });
    }
    if (token === esperado) return new NextResponse(challenge, { status: 200 });

    return NextResponse.json(
      { ok: false, error: "El token de verificación no coincide con el de la conexión." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, canal });
}
