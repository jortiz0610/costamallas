import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  // Crear conversación + primer mensaje
  const conversacion = await prisma.nexusConversacion.create({
    data: {
      conexionId: conexion.id,
      canal,
      remitente,
      emailRemit: emailRemit || undefined,
      telRemit: telRemit || undefined,
      asunto,
      estado: "ABIERTA",
      leida: false,
      metadata,
      mensajes: {
        create: {
          origen: "contacto",
          contenido: contenido || "(Sin mensaje)",
          tipo: "texto",
          metadata,
        },
      },
    },
  });

  // Crear notificación
  await prisma.notificacion.create({
    data: {
      tipo: "NEXUS_MENSAJE" as "SISTEMA",
      titulo: `Nuevo mensaje de ${remitente}`,
      mensaje: `Canal: ${canal} · ${asunto ?? ""}`,
      data: { conversacionId: conversacion.id, canal },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, conversacionId: conversacion.id });
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
    const expectedToken = (conexion?.config as Record<string, string>)?.verify_token ?? "";
    if (token === expectedToken || !expectedToken) {
      return new NextResponse(challenge, { status: 200 });
    }
  }

  return NextResponse.json({ ok: true, canal });
}
