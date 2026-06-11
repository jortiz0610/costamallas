import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getAIConfig, chatAI } from "@/lib/ai";

// Sugiere una respuesta para una conversación de Nexus usando la IA configurada.
// Implementa 2 flujos: consulta de producto y ayuda a cotizar (con transferencia a humano si se complica).
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { conversacionId } = await req.json();
  if (!conversacionId) return NextResponse.json({ success: false, error: "Falta conversacionId" }, { status: 400 });

  const cfg = await getAIConfig();
  if (!cfg) return NextResponse.json({ success: false, sinClave: true, error: "Configura la IA en Configuración → IA." });

  const conv = await prisma.nexusConversacion.findUnique({
    where: { id: conversacionId },
    include: { mensajes: { orderBy: { createdAt: "asc" }, take: 20 } },
  }).catch(() => null);
  if (!conv) return NextResponse.json({ success: false, error: "Conversación no encontrada" }, { status: 404 });

  // Determinar el objetivo según los flujos activos (coincidencia por palabras clave)
  let objetivo = "Atender al cliente de forma amable y profesional, resolver dudas de producto y ayudar a cotizar.";
  let transferirSiComplejo = true;
  try {
    interface FNodo { tipo: string; config: Record<string, unknown> }
    interface FFlujo { disparador: string[]; objetivo: string; activo: boolean; transferirSiComplejo: boolean; nodos?: FNodo[] }
    const flujosRow = await prisma.configuracion.findUnique({ where: { clave: "nexus_flujos" } });
    const flujos: FFlujo[] = flujosRow ? JSON.parse(flujosRow.valor) : [];
    const textoCliente = conv.mensajes.filter(m => m.origen === "contacto").map(m => m.contenido.toLowerCase()).join(" ");
    const match = flujos.find(f => {
      const disp = (f.disparador ?? []).concat(
        (f.nodos ?? []).filter(n => n.tipo === "trigger").flatMap(n => String(n.config.disparador ?? "").split(",").map(s => s.trim()))
      );
      return f.activo && disp.some(d => d && textoCliente.includes(d.toLowerCase()));
    });
    if (match) {
      transferirSiComplejo = match.transferirSiComplejo;
      // Construye el objetivo desde los nodos de IA (contexto + tareas) si existen
      const iaNodos = (match.nodos ?? []).filter(n => n.tipo === "ia");
      if (iaNodos.length) {
        objetivo = iaNodos.map(n => {
          const tareas = Array.isArray(n.config.tareas) ? (n.config.tareas as string[]).filter(Boolean) : [];
          return `Contexto: ${n.config.contexto ?? ""}${tareas.length ? `\nTareas: ${tareas.map(t => `- ${t}`).join("\n")}` : ""}`;
        }).join("\n");
        if ((match.nodos ?? []).some(n => n.tipo === "transferir")) transferirSiComplejo = true;
      } else if (match.objetivo) {
        objetivo = match.objetivo;
      }
    }
  } catch { /* usa el objetivo por defecto */ }

  // Productos publicados (contexto breve para responder consultas)
  const productos = await prisma.producto.findMany({
    where: { publicado: true },
    select: { nombre: true, categorias: true, precioNormal: true },
    take: 40,
  });
  const catalogo = productos.map(p => `- ${p.nombre}${p.precioNormal ? ` (desde $${Number(p.precioNormal)}/m²)` : ""}`).join("\n");

  const historial = conv.mensajes.map(m => `${m.origen === "contacto" ? "Cliente" : "Asesor"}: ${m.contenido}`).join("\n");

  const system = [
    "Eres asesor virtual de Costamallas (Colombia), fabricante de mallas (metálicas, nylon, plásticas, balcones, seguridad perimetral) con instalación.",
    `Objetivo: ${objetivo}`,
    "Reglas de los 2 flujos:",
    "1) CONSULTA DE PRODUCTO: responde con la información disponible del catálogo (abajo). Sé claro y útil.",
    "2) COTIZACIÓN: ayuda amablemente a entender qué necesita (tipo de malla, medidas largo×ancho, cantidad, ciudad, si requiere instalación). Pregunta de forma ordenada, una o dos cosas a la vez.",
    transferirSiComplejo ? "Si la conversación se vuelve compleja, técnica o el cliente lo pide, ofrece transferir a un asesor humano (responde incluyendo la etiqueta [TRANSFERIR] al final)." : "Resuelve la consulta tú mismo de forma completa.",
    "Responde en español, breve, cordial y profesional. Devuelve SOLO el texto de la respuesta sugerida para enviar al cliente.",
    "",
    "Catálogo disponible:",
    catalogo || "(sin productos publicados)",
  ].join("\n");

  const userMsg = `Conversación hasta ahora:\n${historial || "(sin mensajes)"}\n\nRedacta la siguiente respuesta del asesor.`;

  try {
    const respuesta = await chatAI(system, userMsg, cfg);
    const transferir = respuesta.includes("[TRANSFERIR]");
    return NextResponse.json({ success: true, data: { respuesta: respuesta.replace("[TRANSFERIR]", "").trim(), transferir } });
  } catch (e) {
    return NextResponse.json({ success: false, error: `IA: ${(e as Error).message}` }, { status: 500 });
  }
}
