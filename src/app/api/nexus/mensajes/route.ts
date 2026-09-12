// ============================================================
// GET  /api/nexus/mensajes?conversacionId=…   historial
// POST /api/nexus/mensajes                    responder al cliente
//
// El POST ENVÍA de verdad por el canal. Antes solo guardaba la fila: el
// asesor veía su respuesta en pantalla, la daba por entregada, y el
// cliente nunca recibía nada.
//
// El mensaje se guarda pase lo que pase, con el resultado del envío. Un
// error tiene que quedar a la vista para poder reintentar, no perderse.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { enviarPorCanal } from "@/lib/nexus/canales";
import { puedeVerConversacion } from "@/lib/nexus/alcance";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversacionId = searchParams.get("conversacionId");
  if (!conversacionId) return NextResponse.json({ success: false, error: "conversacionId requerido" }, { status: 400 });

  // Quién puede leer ESTE hilo. El listado ya filtraba, pero aquí no se
  // comprobaba nada: con el id —que va en la URL— cualquiera con sesión
  // se leía la conversación de otro asesor, y de paso se la marcaba como
  // leída. Misma regla que el listado, escrita una sola vez.
  const dueño = await prisma.nexusConversacion.findUnique({
    where: { id: conversacionId },
    select: { asignadoId: true },
  });
  if (!dueño) return NextResponse.json({ success: false, error: "La conversación no existe" }, { status: 404 });
  if (!puedeVerConversacion(user, dueño)) {
    return NextResponse.json(
      { success: false, error: "Esta conversación la atiende otra persona." },
      { status: 403 },
    );
  }

  const mensajes = await prisma.nexusMensaje.findMany({
    where: { conversacionId },
    orderBy: { createdAt: "asc" },
    include: { agente: { select: { nombre: true } } },
  });

  await prisma.nexusConversacion.update({ where: { id: conversacionId }, data: { leida: true } }).catch(() => {});

  return NextResponse.json({ success: true, data: mensajes });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { conversacionId, contenido, tipo = "texto", soloNota } = body;
  if (!conversacionId || !contenido?.trim()) {
    return NextResponse.json({ success: false, error: "Datos incompletos" }, { status: 400 });
  }

  const conv = await prisma.nexusConversacion.findUnique({
    where: { id: conversacionId },
    select: { id: true, primeraRespuestaEn: true, asignadoId: true },
  });
  if (!conv) return NextResponse.json({ success: false, error: "La conversación no existe" }, { status: 404 });

  // Contestarle a un cliente que atiende otro asesor es peor que leerlo:
  // le llega de verdad, por su canal, y ya no se puede recoger.
  if (!puedeVerConversacion(user, conv)) {
    return NextResponse.json(
      { success: false, error: "Esta conversación la atiende otra persona." },
      { status: 403 },
    );
  }

  // Una nota interna no se le manda al cliente: sirve para dejar contexto
  // al compañero que retome la conversación.
  const envio = soloNota
    ? { ok: true as const, refExterna: undefined, error: undefined }
    : await enviarPorCanal(conversacionId, contenido);

  const mensaje = await prisma.nexusMensaje.create({
    data: {
      conversacionId,
      agenteId: user.sub,
      origen: soloNota ? "nota" : "agente",
      contenido,
      tipo,
      estadoEnvio: soloNota ? "NOTA" : envio.ok ? "ENVIADO" : "ERROR",
      errorEnvio: envio.ok ? null : envio.error,
      refExterna: envio.refExterna ?? null,
    },
    include: { agente: { select: { nombre: true } } },
  });

  await prisma.nexusConversacion.update({
    where: { id: conversacionId },
    data: {
      updatedAt: new Date(),
      // Solo la primera respuesta de verdad marca el reloj del SLA: una
      // nota interna no es haberle contestado al cliente.
      ...(!soloNota && envio.ok && !conv.primeraRespuestaEn ? { primeraRespuestaEn: new Date() } : {}),
    },
  }).catch(() => {});

  if (!envio.ok) {
    return NextResponse.json(
      { success: false, error: envio.error, data: mensaje, guardado: true },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, data: mensaje });
}
