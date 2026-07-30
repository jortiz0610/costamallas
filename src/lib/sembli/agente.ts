// ============================================================
// SEMBLI — Núcleo del agente (by ESEK)
//
// Bucle de tool-use manual sobre la API de Anthropic. Se usa bucle
// manual en vez del tool runner del SDK (que está en beta) porque
// necesitamos: tope duro de iteraciones para controlar el gasto,
// revalidación de permisos en cada llamada y registro de consumo.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { decryptIfNeeded } from "@/lib/encryption";
import {
  MODELO_POR_TAREA, parametrosDeModelo, costoUSD,
  type IdModelo, type Tarea,
} from "./modelos";
import { DESCRIPCION_ALCANCE, type Solicitante } from "./alcance";
import { categoriasDisponibles, definicionesPara, ejecutarHerramienta } from "./herramientas";

/** Máximo de vueltas del bucle de herramientas. Cota de costo y latencia. */
const MAX_VUELTAS = 6;

export interface RespuestaSembli {
  respuesta: string;
  herramientasUsadas: string[];
  uso: { entrada: number; salida: number; cacheLeido: number; costoUSD: number };
  modelo: IdModelo;
}

/** Turno de conversación tal como lo manda el cliente. */
export interface TurnoChat {
  rol: "user" | "assistant";
  texto: string;
}

// ─────────────────────────────────────────────
// Cliente de Anthropic
// ─────────────────────────────────────────────

/**
 * La API key vive cifrada en la tabla `configuracion` (clave `ai_api_key`),
 * igual que las demás credenciales del portal. `ANTHROPIC_API_KEY` del
 * entorno sirve solo como respaldo para desarrollo local.
 */
export async function obtenerClaveAnthropic(): Promise<string | null> {
  const fila = await prisma.configuracion.findUnique({ where: { clave: "ai_api_key" } });
  if (fila?.valor) return fila.encrypted ? decryptIfNeeded(fila.valor) : fila.valor;
  return process.env.ANTHROPIC_API_KEY ?? null;
}

let clienteCache: { clave: string; cliente: Anthropic } | null = null;

async function obtenerCliente(): Promise<Anthropic | null> {
  const clave = await obtenerClaveAnthropic();
  if (!clave) return null;
  if (clienteCache?.clave === clave) return clienteCache.cliente;
  const cliente = new Anthropic({ apiKey: clave });
  clienteCache = { clave, cliente };
  return cliente;
}

// ─────────────────────────────────────────────
// Prompt del sistema
// ─────────────────────────────────────────────

const IDENTIDAD = [
  "Eres **Sembli**, el asistente de inteligencia artificial de la plataforma Sembla · by ESEK,",
  "trabajando para Costamallas: empresa colombiana que fabrica, vende e instala mallas",
  "(metálicas, de nylon/deportivas, plásticas, para balcones, de sombra, agrícolas,",
  "de seguridad perimetral y de construcción/anticaída).",
  "",
  "Cómo respondes:",
  "· Siempre en español de Colombia, claro y directo. Sin rodeos ni relleno.",
  "· Los precios en pesos colombianos con separador de miles (ej. $392.500).",
  "· Cuando tengas datos concretos, muéstralos en tabla o lista corta. Nada de párrafos largos.",
  "· Si necesitas datos del sistema, usa las herramientas disponibles. No inventes cifras nunca:",
  "  si una herramienta no te devuelve el dato, dilo abiertamente.",
  "· Si la pregunta está fuera de tu alcance, explica en una frase qué sí puedes hacer y sigue.",
  "· No repitas el rol ni el alcance del usuario en cada respuesta; ya lo sabe.",
].join("\n");

function construirSystem(quien: Solicitante, categorias: string, contextoExtra?: string) {
  const bloques = [
    IDENTIDAD,
    // Sin esta lista el modelo inventa slugs ("balcones" en vez de
    // "mallas-para-balcones") y las búsquedas salen vacías.
    `\n## Categorías reales del catálogo\nUsa exactamente estos identificadores al filtrar:\n${categorias}`,
    `\n## Tu alcance en esta conversación\n${DESCRIPCION_ALCANCE[quien.nivel]}`,
    quien.nombre ? `\nEl usuario se llama ${quien.nombre}.` : "",
    contextoExtra ? `\n## Contexto de la pantalla actual\n${contextoExtra}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // El marcador va en el último bloque estable, así cachearía las
  // definiciones de herramientas + el system juntos (las tools se
  // renderizan antes del system).
  //
  // MEDIDO (2026-07-30, con countTokens): el prefijo pesa ~1.370 tokens
  // para CLIENTE y ~2.364 para ADMIN. Haiku 4.5 exige 4.096 tokens
  // mínimo, así que HOY la caché no entra nunca — `cache_read_input_tokens`
  // vuelve en 0 y no hay error ni cobro extra. Se deja puesto porque no
  // cuesta nada y empieza a servir solo si el prompt crece.
  //
  // Para bajar el costo, la palanca real no es la caché sino el tamaño de
  // lo que devuelven las herramientas: los resultados son el grueso de los
  // tokens de entrada y van DESPUÉS del marcador.
  return [{ type: "text" as const, text: bloques, cache_control: { type: "ephemeral" as const } }];
}

// ─────────────────────────────────────────────
// Bucle principal
// ─────────────────────────────────────────────

export async function conversarConSembli(opciones: {
  quien: Solicitante;
  historial: TurnoChat[];
  contextoPantalla?: string;
}): Promise<RespuestaSembli> {
  const { quien, historial, contextoPantalla } = opciones;

  const cliente = await obtenerCliente();
  if (!cliente) {
    throw new Error(
      "Sembli no está activado: falta la API key de Claude. Un superadministrador debe cargarla en Configuración → IA.",
    );
  }

  const modelo = MODELO_POR_TAREA.chat;
  const herramientas = definicionesPara(quien.nivel);
  const categorias = (await categoriasDisponibles())
    .map((c) => `· ${c.valor} — ${c.label} (${c.productos} productos)`)
    .join("\n");
  const system = construirSystem(quien, categorias, contextoPantalla);

  const mensajes: Anthropic.MessageParam[] = historial.map((t) => ({
    role: t.rol,
    content: t.texto,
  }));

  const usadas: string[] = [];
  const uso = { entrada: 0, salida: 0, cacheLeido: 0, costoUSD: 0 };

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const respuesta = await cliente.messages.create({
      model: modelo,
      max_tokens: 2048,
      system,
      tools: herramientas,
      messages: mensajes,
      ...parametrosDeModelo(modelo, { pensar: false }),
    });

    uso.entrada += respuesta.usage.input_tokens ?? 0;
    uso.salida += respuesta.usage.output_tokens ?? 0;
    uso.cacheLeido += respuesta.usage.cache_read_input_tokens ?? 0;
    uso.costoUSD += costoUSD(modelo, respuesta.usage);

    // ¿Terminó? Devolvemos el texto.
    if (respuesta.stop_reason !== "tool_use") {
      const texto = respuesta.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        respuesta: texto || "No logré armar una respuesta. ¿Puedes reformular la pregunta?",
        herramientasUsadas: usadas,
        uso,
        modelo,
      };
    }

    // Pidió herramientas: se ejecutan todas y se devuelven en UN solo
    // mensaje de usuario (partirlas hace que el modelo deje de pedirlas
    // en paralelo).
    mensajes.push({ role: "assistant", content: respuesta.content });

    const bloquesTool = respuesta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const resultados: Anthropic.ToolResultBlockParam[] = await Promise.all(
      bloquesTool.map(async (bloque) => {
        usadas.push(bloque.name);
        const { resultado, error } = await ejecutarHerramienta(
          bloque.name,
          (bloque.input ?? {}) as Record<string, unknown>,
          quien,
        );
        return {
          type: "tool_result" as const,
          tool_use_id: bloque.id,
          content: typeof resultado === "string" ? resultado : JSON.stringify(resultado),
          ...(error ? { is_error: true } : {}),
        };
      }),
    );

    mensajes.push({ role: "user", content: resultados });
  }

  return {
    respuesta:
      "La consulta resultó más larga de lo esperado y la corté para no gastar de más. " +
      "Intenta preguntarme algo más específico.",
    herramientasUsadas: usadas,
    uso,
    modelo,
  };
}

// ─────────────────────────────────────────────
// Utilidad para tareas de un solo tiro (SEO, ficha PDF, Nexus)
// ─────────────────────────────────────────────

/**
 * Una llamada sin herramientas que devuelve JSON.
 *
 * Usa salidas estructuradas (`output_config.format`), así que la API
 * garantiza que el texto de respuesta es JSON válido conforme al esquema:
 * `JSON.parse` no puede fallar por texto de más. Esto reemplaza el
 * `raw.slice(indexOf("{"), lastIndexOf("}"))` que se rompía cuando Claude
 * añadía una frase antes del objeto.
 *
 * Nota: el esquema debe ser JSON Schema plano (no Zod). Los campos ACF
 * varían por categoría y se arman en tiempo de ejecución, así que un
 * esquema dinámico encaja mejor aquí que un tipo Zod estático.
 */
export async function pedirJSON<T>(opciones: {
  tarea: Tarea;
  system: string;
  mensaje: string;
  esquema: Record<string, unknown>;
  maxTokens?: number;
  pensar?: boolean;
}): Promise<{ datos: T; costoUSD: number }> {
  const cliente = await obtenerCliente();
  if (!cliente) throw new Error("La IA no está configurada (falta la API key de Claude).");

  const modelo = MODELO_POR_TAREA[opciones.tarea];
  const respuesta = await cliente.messages.create({
    model: modelo,
    max_tokens: opciones.maxTokens ?? 2048,
    system: opciones.system,
    messages: [{ role: "user", content: opciones.mensaje }],
    output_config: { format: { type: "json_schema", schema: opciones.esquema } },
    ...parametrosDeModelo(modelo, { pensar: opciones.pensar ?? false, esfuerzo: "medium" }),
  });

  const texto = respuesta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (respuesta.stop_reason === "max_tokens") {
    throw new Error("La respuesta de la IA se cortó por longitud. Intenta con menos contenido.");
  }
  try {
    return { datos: JSON.parse(texto) as T, costoUSD: costoUSD(modelo, respuesta.usage) };
  } catch {
    throw new Error("La IA no devolvió datos con el formato esperado. Intenta de nuevo.");
  }
}

/** Llamada simple de texto (sin herramientas ni JSON). */
export async function pedirTexto(opciones: {
  tarea: Tarea;
  system: string;
  mensaje: string;
  maxTokens?: number;
}): Promise<{ texto: string; costoUSD: number }> {
  const cliente = await obtenerCliente();
  if (!cliente) throw new Error("La IA no está configurada (falta la API key de Claude).");

  const modelo = MODELO_POR_TAREA[opciones.tarea];
  const respuesta = await cliente.messages.create({
    model: modelo,
    max_tokens: opciones.maxTokens ?? 1024,
    system: opciones.system,
    messages: [{ role: "user", content: opciones.mensaje }],
    ...parametrosDeModelo(modelo, { pensar: false }),
  });

  const texto = respuesta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return { texto, costoUSD: costoUSD(modelo, respuesta.usage) };
}
