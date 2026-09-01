// ============================================================
// GET /api/public/agente/mensajes — lo que el asesor le respondió
//
// El camino de vuelta del chat de la web. Sin esto, un vendedor
// contestaba desde Nexus y el visitante —con el chat abierto delante—
// no veía nada: su respuesta salía por correo y ahí se quedaba.
//
// Es PÚBLICO, como el resto del chat, así que la única llave es el
// `tokenWeb` de la conversación: 24 bytes aleatorios que solo tiene el
// navegador que la abrió. Con el id no bastaría —son consecutivos de
// cuid y adivinables— y por eso no se acepta.
//
// Nunca devuelve las notas internas. Una nota es lo que un asesor le
// escribe a otro sobre este cliente; enviársela al cliente sería el peor
// error posible de este módulo.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getConfigAgenteWeb } from "@/lib/agente-web/config";

export const dynamic = "force-dynamic";

async function cors(req: NextRequest): Promise<Record<string, string>> {
  const cfg = await getConfigAgenteWeb();
  const origen = req.headers.get("origin") ?? "";
  const permitido = cfg.dominios.some(d => d.trim() && origen === d.trim().replace(/\/$/, ""));
  return {
    ...(permitido ? { "Access-Control-Allow-Origin": origen } : {}),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: await cors(req) });
}

export async function GET(req: NextRequest) {
  const headers = await cors(req);

  // El widget pregunta cada pocos segundos. El tope es generoso para no
  // cortarle a alguien que tiene el chat abierto un rato largo, pero
  // existe: es una URL pública.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!rateLimit(`agente-mensajes:${ip}`, 120, 60_000).success) {
    return NextResponse.json({ success: false, error: "Demasiadas peticiones." }, { status: 429, headers });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  const historial = url.searchParams.get("historial") === "1";
  const desdeTexto = url.searchParams.get("desde") ?? "";

  if (token.length < 16) {
    return NextResponse.json({ success: false, error: "Token inválido." }, { status: 400, headers });
  }

  const conv = await prisma.nexusConversacion.findUnique({
    where: { tokenWeb: token },
    select: { id: true, estado: true },
  });
  // Se responde igual que si el token no existiera: no hay nada que
  // ganar diciéndole a quien prueba tokens cuáles existen.
  if (!conv) {
    return NextResponse.json({ success: true, data: { mensajes: [], estado: null } }, { headers });
  }

  const desde = desdeTexto ? new Date(desdeTexto) : null;
  const desdeValida = desde && !Number.isNaN(desde.getTime()) ? desde : null;

  const mensajes = await prisma.nexusMensaje.findMany({
    where: {
      conversacionId: conv.id,
      // El historial trae la conversación entera; el sondeo, solo lo que
      // escribió un HUMANO. Lo del bot y lo que escribió el propio
      // visitante ya están pintados en su pantalla, y volver a mandarlos
      // los duplicaría.
      origen: historial ? { in: ["contacto", "agente-ia", "agente"] } : "agente",
      ...(desdeValida ? { createdAt: { gt: desdeValida } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 60,
    select: { id: true, origen: true, contenido: true, createdAt: true, agente: { select: { nombre: true } } },
  });

  return NextResponse.json({
    success: true,
    data: {
      estado: conv.estado,
      mensajes: mensajes.map(m => ({
        id: m.id,
        // "yo" = lo escribió el visitante. El widget lo pinta a la
        // derecha, igual que cuando lo acaba de escribir.
        quien: m.origen === "contacto" ? "yo" : "ellos",
        // Solo en las respuestas de un humano: saber que ya no habla el
        // bot es la mitad del valor de que un asesor conteste.
        de: m.origen === "agente" ? (m.agente?.nombre ?? null) : null,
        texto: m.contenido,
        en: m.createdAt.toISOString(),
      })),
    },
  }, { headers });
}
