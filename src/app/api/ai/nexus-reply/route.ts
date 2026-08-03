// ============================================================
// POST /api/ai/nexus-reply — sugiere la respuesta de una conversación.
//
// Antes usaba `ai.ts`, el motor viejo (OpenAI/Anthropic genérico). Ahora
// va por el núcleo de Sembli con la tarea `nexus`, que corre en Haiku:
// es alto volumen y no necesita el modelo caro. Así hay un solo lugar
// donde se configura la IA y un solo sitio donde se mide lo que cuesta.
//
// Sugiere, no envía. El asesor lee, ajusta y decide.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { pedirTexto } from "@/lib/sembli/agente";

interface NodoFlujo { tipo: string; config: Record<string, unknown> }
interface Flujo {
  disparador: string[]; objetivo: string; activo: boolean;
  transferirSiComplejo: boolean; nodos?: NodoFlujo[];
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { conversacionId } = await req.json();
  if (!conversacionId) return NextResponse.json({ success: false, error: "Falta conversacionId" }, { status: 400 });

  const conv = await prisma.nexusConversacion.findUnique({
    where: { id: conversacionId },
    include: {
      mensajes: { orderBy: { createdAt: "asc" }, take: 20 },
      cliente: { select: { nombre: true, empresa: true, ciudad: true } },
    },
  }).catch(() => null);
  if (!conv) return NextResponse.json({ success: false, error: "Conversación no encontrada" }, { status: 404 });

  // ── Qué flujo aplica ──
  let objetivo = "Atender al cliente de forma amable y profesional, resolver dudas de producto y ayudar a cotizar.";
  let transferirSiComplejo = true;
  try {
    const fila = await prisma.configuracion.findUnique({ where: { clave: "nexus_flujos" } });
    const flujos: Flujo[] = fila ? JSON.parse(fila.valor) : [];
    const textoCliente = conv.mensajes
      .filter(m => m.origen === "contacto")
      .map(m => m.contenido.toLowerCase())
      .join(" ");

    const match = flujos.find(f => {
      const disparadores = (f.disparador ?? []).concat(
        (f.nodos ?? [])
          .filter(n => n.tipo === "trigger")
          .flatMap(n => String(n.config.disparador ?? "").split(",").map(s => s.trim())),
      );
      return f.activo && disparadores.some(d => d && textoCliente.includes(d.toLowerCase()));
    });

    if (match) {
      transferirSiComplejo = match.transferirSiComplejo;
      const nodosIA = (match.nodos ?? []).filter(n => n.tipo === "ia");
      if (nodosIA.length) {
        objetivo = nodosIA.map(n => {
          const tareas = Array.isArray(n.config.tareas) ? (n.config.tareas as string[]).filter(Boolean) : [];
          return `Contexto: ${n.config.contexto ?? ""}${tareas.length ? `\nTareas:\n${tareas.map(t => `- ${t}`).join("\n")}` : ""}`;
        }).join("\n");
        if ((match.nodos ?? []).some(n => n.tipo === "transferir")) transferirSiComplejo = true;
      } else if (match.objetivo) {
        objetivo = match.objetivo;
      }
    }
  } catch {
    // Un flujo mal guardado no debe dejar al asesor sin sugerencia.
  }

  const productos = await prisma.producto.findMany({
    where: { publicado: true },
    select: { nombre: true, precioNormal: true, acfUnidadVenta: true },
    take: 40,
  });
  const catalogo = productos
    .map(p => `- ${p.nombre}${p.precioNormal ? ` (desde ${Number(p.precioNormal)} COP/${p.acfUnidadVenta ?? "unidad"})` : ""}`)
    .join("\n");

  // Lo que el bot ya dedujo al entrar el mensaje, para no volver a
  // preguntar lo que el cliente ya dijo.
  const calificacion = (conv.metadata as { calificacion?: Record<string, unknown> } | null)?.calificacion;

  const system = [
    "Eres asesor comercial de Costamallas (Colombia), fabricante de mallas metálicas, de nylon, plásticas,",
    "para balcones y de seguridad perimetral, con servicio de instalación propio.",
    `Objetivo: ${objetivo}`,
    conv.cliente ? `Quien escribe YA es cliente: ${conv.cliente.empresa ?? conv.cliente.nombre}${conv.cliente.ciudad ? ` (${conv.cliente.ciudad})` : ""}. Trátalo como tal.` : "",
    calificacion ? `Del primer mensaje ya se dedujo: ${JSON.stringify(calificacion)}. No vuelvas a preguntar eso.` : "",
    conv.etiquetas.length ? `Etiquetas: ${conv.etiquetas.join(", ")}.` : "",
    "Para cotizar necesitas: tipo de malla, medidas (largo × ancho), cantidad, ciudad y si requiere instalación.",
    "Pregunta una o dos cosas a la vez, nunca un cuestionario.",
    transferirSiComplejo
      ? "Si se vuelve técnico o el cliente lo pide, ofrece pasarlo con un asesor humano y termina con la etiqueta [TRANSFERIR]."
      : "Resuelve tú la consulta de forma completa.",
    "Responde en español, breve y cordial. Devuelve SOLO el texto que se le enviaría al cliente.",
    "",
    "Catálogo publicado:",
    catalogo || "(sin productos publicados)",
  ].filter(Boolean).join("\n");

  const historial = conv.mensajes
    .map(m => `${m.origen === "contacto" ? "Cliente" : "Asesor"}: ${m.contenido}`)
    .join("\n");

  try {
    const { texto, costoUSD } = await pedirTexto({
      tarea: "nexus",
      system,
      mensaje: `Conversación hasta ahora:\n${historial || "(sin mensajes)"}\n\nRedacta la siguiente respuesta del asesor.`,
      maxTokens: 700,
    });

    const transferir = texto.includes("[TRANSFERIR]");
    return NextResponse.json({
      success: true,
      data: { respuesta: texto.replace("[TRANSFERIR]", "").trim(), transferir, costoUSD },
    });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json(
      { success: false, error: /no está configurada/i.test(msg) ? "La IA no está configurada. Cárgala en Configuración → IA." : `IA: ${msg}` },
      { status: 500 },
    );
  }
}
