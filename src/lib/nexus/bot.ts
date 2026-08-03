// ============================================================
// NEXUS — el bot que califica el lead que entra.
//
// Lo que pidió gerencia: "el bot califica producto, ciudad y urgencia" y
// el asesor recibe la conversación ya clasificada, en vez de empezar
// preguntando lo mismo de siempre.
//
// Usa el núcleo de Sembli con la tarea `clasificar`, que va en Haiku: es
// alto volumen y no necesita el modelo caro.
//
// Nada de esto puede tumbar la entrada de un mensaje. Si la IA no está
// configurada o falla, la conversación se crea igual sin etiquetas: es
// preferible un lead sin clasificar que un lead perdido.
// ============================================================

import { prisma } from "@/lib/prisma";
import { pedirJSON } from "@/lib/sembli/agente";

export interface Calificacion {
  producto: string | null;
  ciudad: string | null;
  urgencia: "ALTA" | "MEDIA" | "BAJA" | null;
  intencion: "COTIZAR" | "COMPRAR" | "SOPORTE" | "INFORMACION" | "OTRO" | null;
  resumen: string | null;
}

const ESQUEMA = {
  type: "object",
  properties: {
    producto: { type: ["string", "null"], description: "Qué producto o servicio menciona. null si no se entiende." },
    ciudad: { type: ["string", "null"], description: "Ciudad o departamento que menciona. null si no dice." },
    urgencia: { type: ["string", "null"], enum: ["ALTA", "MEDIA", "BAJA", null], description: "ALTA si dice que es urgente, que lo necesita ya o menciona una fecha cercana." },
    intencion: { type: ["string", "null"], enum: ["COTIZAR", "COMPRAR", "SOPORTE", "INFORMACION", "OTRO", null] },
    resumen: { type: ["string", "null"], description: "Una frase de máximo 90 caracteres con lo que necesita." },
  },
  required: ["producto", "ciudad", "urgencia", "intencion", "resumen"],
  additionalProperties: false,
} as const;

/**
 * Califica el primer mensaje de una conversación.
 * Devuelve null si no se pudo (sin IA configurada, error de red, etc.).
 */
export async function calificarMensaje(texto: string): Promise<Calificacion | null> {
  const limpio = texto.trim();
  // Un "hola" suelto no tiene nada que clasificar: no vale la llamada.
  if (limpio.length < 8) return null;

  // Se le dan las categorías reales para que no invente nombres de
  // producto que no existen en el catálogo.
  const categorias = await prisma.catalogo
    .findMany({ where: { tipo: "CATEGORIA" as never, activo: true }, select: { label: true }, take: 30 })
    .catch(() => []);

  const system = [
    "Clasificas mensajes que llegan a Costamallas, fabricante colombiano de mallas",
    "(metálicas, para balcones, nylon deportivas, plásticas y seguridad perimetral) con servicio de instalación.",
    "Extrae solo lo que el mensaje dice. No inventes: si algo no está, devuelve null.",
    categorias.length ? `Categorías del catálogo: ${categorias.map(c => c.label).join(", ")}.` : "",
  ].filter(Boolean).join("\n");

  try {
    const { datos } = await pedirJSON<Calificacion>({
      tarea: "clasificar",
      system,
      mensaje: limpio.slice(0, 1500),
      esquema: ESQUEMA as unknown as Record<string, unknown>,
      maxTokens: 400,
    });
    return datos;
  } catch (e) {
    // Se registra y se sigue: la conversación importa más que la etiqueta.
    console.error("[nexus/bot] No se pudo calificar:", (e as Error).message);
    return null;
  }
}

/** Convierte la calificación en etiquetas cortas para la bandeja. */
export function etiquetasDe(c: Calificacion | null): string[] {
  if (!c) return [];
  const salida: string[] = [];
  if (c.producto) salida.push(c.producto.toLowerCase().slice(0, 40));
  if (c.ciudad) salida.push(c.ciudad.toLowerCase().slice(0, 40));
  if (c.urgencia) salida.push(`urgencia:${c.urgencia.toLowerCase()}`);
  if (c.intencion) salida.push(c.intencion.toLowerCase());
  return salida;
}

/** La urgencia del bot decide la prioridad con la que se ve en la bandeja. */
export function prioridadDe(c: Calificacion | null): string {
  if (c?.urgencia === "ALTA") return "ALTA";
  if (c?.urgencia === "BAJA") return "BAJA";
  return "NORMAL";
}
