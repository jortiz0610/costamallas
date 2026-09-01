// ============================================================
// La copia de la conversación, cuando se cierra.
//
// El chat de la web se responde EN el chat: el asesor escribe desde
// Nexus y al visitante le aparece en su ventana. El correo no es el
// canal, es el recibo.
//
// Se manda una sola vez, al cerrar la conversación, con todo lo que se
// habló. Sirve para dos cosas concretas: que el cliente conserve los
// precios y medidas que le dijeron, y que tenga a la vista con quién
// habló si quiere retomarlo.
//
// Mandar un correo por CADA respuesta era lo anterior y no servía: a
// quien está chateando en vivo se le llena el buzón de fragmentos de una
// conversación que está viendo entera en pantalla.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enviarCorreo } from "@/lib/correo";
import { envolverCorreo, PIE_EMAIL } from "@/lib/correo-layout";
import { getMarca } from "@/lib/marca";

/** Marca en `metadata` para no mandar dos copias de lo mismo. */
const YA_ENVIADA = "copiaEnviadaEn";

export interface ResultadoCopia {
  ok: boolean;
  /** true = no había nada que mandar, y está bien. No es un fallo. */
  omitida?: boolean;
  motivo?: string;
}

/**
 * Le manda al visitante la conversación completa.
 *
 * No lanza: la llama el cierre de una conversación, y que falle un
 * correo no puede impedir que un asesor cierre su bandeja.
 */
export async function enviarCopiaConversacion(conversacionId: string): Promise<ResultadoCopia> {
  const conv = await prisma.nexusConversacion.findUnique({
    where: { id: conversacionId },
    select: {
      id: true, canal: true, remitente: true, emailRemit: true, metadata: true,
      mensajes: {
        where: { origen: { in: ["contacto", "agente-ia", "agente"] } },
        orderBy: { createdAt: "asc" },
        select: { origen: true, contenido: true, createdAt: true, agente: { select: { nombre: true } } },
      },
    },
  });

  if (!conv) return { ok: false, motivo: "La conversación no existe." };
  if (conv.canal.toLowerCase() !== "web") return { ok: true, omitida: true, motivo: "No es del chat de la web." };

  const meta = (conv.metadata ?? {}) as Record<string, unknown>;
  if (meta[YA_ENVIADA]) return { ok: true, omitida: true, motivo: "Ya se había mandado la copia." };

  const para = (conv.emailRemit ?? "").trim();
  if (!para) return { ok: true, omitida: true, motivo: "La conversación no tiene correo." };

  // Un chat donde el cliente escribió y nadie le contestó no es una
  // conversación: mandarle "su copia" de su propio monólogo es peor que
  // no mandar nada.
  const hayRespuesta = conv.mensajes.some(m => m.origen !== "contacto");
  if (!conv.mensajes.length || !hayRespuesta) {
    return { ok: true, omitida: true, motivo: "No hubo conversación que copiar." };
  }

  const marca = await getMarca();
  const hora = (d: Date) =>
    d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Bogota" });

  const quien = (m: (typeof conv.mensajes)[number]) => {
    if (m.origen === "contacto") return conv.remitente || "Usted";
    if (m.origen === "agente") return m.agente?.nombre ?? marca.companyName;
    return marca.companyName;
  };

  const cuerpo = [
    "Le dejamos por escrito lo que hablamos en el chat, para que tenga a mano las medidas y los precios.",
    "",
    ...conv.mensajes.map(m => `[${hora(m.createdAt)}] ${quien(m)}:\n${m.contenido}`),
    "",
    "Si quedó algo pendiente, responda a este correo y seguimos.",
  ].join("\n\n");

  const { html, texto } = envolverCorreo({
    titulo: "Su conversación con nosotros",
    cuerpo,
    marca,
  });

  try {
    await enviarCorreo({
      para,
      asunto: `Su conversación con ${marca.companyName}`,
      html,
      texto,
      responderA: PIE_EMAIL,
    });
  } catch (e) {
    return { ok: false, motivo: (e as Error).message };
  }

  await prisma.nexusConversacion.update({
    where: { id: conv.id },
    data: { metadata: { ...meta, [YA_ENVIADA]: new Date().toISOString() } },
  }).catch(() => {});

  return { ok: true };
}
