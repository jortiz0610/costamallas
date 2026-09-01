// ============================================================
// AGENTE WEB — el motor de la conversación.
//
// Recibe un mensaje del widget de costamallas.com, lo contesta y deja
// todo registrado en Nexus como una conversación del canal WEB: el
// asesor la ve en su bandeja, puede tomarla, y queda medida por el
// compromiso de responder en una hora.
//
// ⚠️ Una decisión que define el módulo: la conversación NUNCA se marca
// como respondida porque haya contestado el agente. `primeraRespuestaEn`
// se sella solo cuando escribe una persona. Si el bot contara como
// respuesta, el indicador del compromiso daría 100 % siempre y dejaría
// de significar nada — que es exactamente como mueren los indicadores.
//
// Guardas de gasto, en orden de lo que cortan:
//   · tope por conversación  — una charla que se fue de precio
//   · tope diario            — el día entero
//   · máximo de mensajes     — una charla infinita
//   · límite por IP          — quien quiera usar la API de juguete
//
// Sin esas cuatro, un endpoint público que llama a Claude es una
// factura esperando a que alguien encuentre la URL.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getMarca } from "@/lib/marca";
import { obtenerClaveAnthropic } from "@/lib/sembli/agente";
import { MODELOS, costoUSD } from "@/lib/sembli/modelos";
import { getConfigAgenteWeb, gastoDeHoy, type ConfigAgenteWeb } from "@/lib/agente-web/config";
import { identidad, primerTurno } from "@/lib/agente-web/prompt";
import {
  HERRAMIENTAS_AGENTE, ejecutarHerramientaAgente, type ContextoEjecucion,
} from "@/lib/agente-web/herramientas";

export type { ConfigAgenteWeb };

export interface RespuestaAgente {
  ok: boolean;
  /** Lo que se le muestra al cliente. Siempre hay algo que mostrar. */
  texto: string;
  /** El token con el que el navegador retoma esta conversación. */
  token: string;
  /** Si el agente pasó el caso a una persona. */
  escalado: boolean;
  /** Motivo cuando el agente no pudo responder (tope, apagado, sin clave). */
  motivo?: "apagado" | "sin-clave" | "tope-diario" | "tope-conversacion" | "demasiados-mensajes" | "error";
  costoUSD: number;
}

/** Lo que se le dice al cliente cuando el agente no puede seguir. */
function salidaDigna(cfg: ConfigAgenteWeb, marca: string): string {
  const wa = cfg.whatsapp
    ? ` También puede escribirnos por WhatsApp al ${cfg.whatsapp}.`
    : "";
  return (
    `Disculpe, en este momento no puedo seguir atendiéndole por aquí. ` +
    `Un asesor de ${marca} puede ayudarle: déjenos su nombre y un número de contacto ` +
    `y lo llamamos.${wa}`
  );
}

/**
 * La conexión de Nexus del canal WEB.
 *
 * Se crea sola la primera vez. Es una conexión "interna": no tiene
 * credenciales de ningún proveedor porque el canal es la propia página.
 */
async function conexionWeb(): Promise<string> {
  const existente = await prisma.nexusConexion.findFirst({
    where: { canal: "WEB" },
    select: { id: true },
  });
  if (existente) return existente.id;

  const nueva = await prisma.nexusConexion.create({
    data: {
      canal: "WEB",
      nombre: "Chat de costamallas.com",
      descripcion: "Conversaciones que atiende el agente en la página web.",
      activo: true,
    },
    select: { id: true },
  });
  return nueva.id;
}

/** Recupera la conversación por su token, o abre una nueva. */
/**
 * Quién escribe.
 *
 * Antes toda conversación de la web se llamaba "Visitante de la web", y
 * en la bandeja de Nexus eso significaba una lista de doce filas
 * idénticas: no se sabía a quién devolverle la llamada. Ahora el widget
 * pide nombre y correo ANTES de dejar escribir, y esos datos llegan
 * aquí.
 *
 * Se piden con la aceptación de la política de datos: son datos
 * personales de alguien que no es cliente todavía.
 */
async function conversacionDe(
  token: string | null,
  visitante?: { nombre?: string; email?: string; telefono?: string; deWordPress?: boolean },
) {
  if (token) {
    const c = await prisma.nexusConversacion.findUnique({
      where: { tokenWeb: token },
      select: { id: true, tokenWeb: true, costoUSD: true, estado: true, clienteId: true },
    });
    // Se retoma SOLO si sigue abierta. Una conversación que el asesor ya
    // archivó no debe revivir porque el visitante volvió a escribir: eso
    // hacía reaparecer hilos cerrados al final de la bandeja, ordenados
    // por una fecha que no correspondía a lo que se estaba hablando.
    if (c && c.estado === "ABIERTA") return c;
  }

  const nombre = (visitante?.nombre ?? "").trim();
  const email = (visitante?.email ?? "").trim();
  const telefono = (visitante?.telefono ?? "").trim();

  // ¿Ya es cliente? Si el correo o el teléfono coinciden con una ficha
  // del CRM, la conversación nace vinculada. Es lo que permite que el
  // asesor vea de entrada "este ya compró tres veces" en vez de tratar a
  // un cliente de años como si fuera un desconocido.
  const cliente = (email || telefono)
    ? await prisma.cliente.findFirst({
        where: {
          OR: [
            ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
            ...(telefono ? [{ telefono }, { whatsapp: telefono }] : []),
          ],
        },
        select: { id: true, vendedorId: true },
      })
    : null;

  const etiquetas = ["agente-web"];
  if (nombre) etiquetas.push("identificado");
  if (visitante?.deWordPress) etiquetas.push("sesion-web");
  if (cliente) etiquetas.push("ya-es-cliente");

  const nuevo = randomBytes(24).toString("base64url");
  const c = await prisma.nexusConversacion.create({
    data: {
      conexionId: await conexionWeb(),
      canal: "WEB",
      // Sin nombre se mantiene el texto de siempre: una conversación
      // anónima sigue siendo mejor que ninguna.
      remitente: nombre || "Visitante de la web",
      emailRemit: email || null,
      telRemit: telefono || null,
      estado: "ABIERTA",
      tokenWeb: nuevo,
      clienteId: cliente?.id ?? null,
      // Si ya es cliente de alguien, su asesor la recibe directamente.
      asignadoId: cliente?.vendedorId ?? null,
      etiquetas,
    },
    select: { id: true, tokenWeb: true, costoUSD: true, estado: true, clienteId: true },
  });
  return c;
}

export async function responder(opciones: {
  mensaje: string;
  token: string | null;
  /** Lo que el visitante puso en el registro previo del widget, o lo
   *  que venía de su sesión de WordPress. */
  visitante?: { nombre?: string; email?: string; telefono?: string; deWordPress?: boolean };
}): Promise<RespuestaAgente> {
  const cfg = await getConfigAgenteWeb();
  const marca = await getMarca();

  const conv = await conversacionDe(opciones.token, opciones.visitante);
  const token = conv.tokenWeb!;

  const rendirse = (motivo: RespuestaAgente["motivo"]): RespuestaAgente => ({
    ok: false, texto: salidaDigna(cfg, marca.companyName), token, escalado: false, motivo, costoUSD: 0,
  });

  if (!cfg.activo) return rendirse("apagado");

  const clave = await obtenerClaveAnthropic();
  if (!clave) return rendirse("sin-clave");

  // ── Guardas de gasto, antes de llamar a nadie ──
  if (conv.costoUSD >= cfg.topeConversacionUSD) return rendirse("tope-conversacion");
  if ((await gastoDeHoy()) >= cfg.topeDiarioUSD) return rendirse("tope-diario");

  const historial = await prisma.nexusMensaje.findMany({
    where: { conversacionId: conv.id, tipo: { not: "nota" } },
    orderBy: { createdAt: "asc" },
    select: { origen: true, contenido: true },
    take: cfg.maxMensajes + 1,
  });
  if (historial.length >= cfg.maxMensajes) return rendirse("demasiados-mensajes");

  // El mensaje del cliente se guarda ANTES de contestar. Si la llamada
  // al modelo falla, la pregunta no se pierde: queda en la bandeja y un
  // asesor puede retomarla.
  await prisma.nexusMensaje.create({
    data: {
      conversacionId: conv.id,
      origen: "contacto",
      contenido: opciones.mensaje,
      estadoEnvio: "RECIBIDO",
    },
  });

  const ctx: ContextoEjecucion = { conversacionId: conv.id, escalado: null, clienteId: conv.clienteId };

  try {
    const { texto, costo } = await conversar(cfg, marca.companyName, historial, opciones.mensaje, clave, ctx);

    await prisma.nexusMensaje.create({
      data: {
        conversacionId: conv.id,
        origen: "agente-ia",
        contenido: texto,
        estadoEnvio: "ENVIADO",
        metadata: { modelo: cfg.modelo, costoUSD: costo },
      },
    });

    await prisma.nexusConversacion.update({
      where: { id: conv.id },
      data: { costoUSD: { increment: costo } },
    });

    return { ok: true, texto, token, escalado: !!ctx.escalado, costoUSD: costo };
  } catch (e) {
    console.error("[agente-web]", e);
    // El cliente no tiene por qué enterarse de que se cayó una API. Se
    // le da una salida útil y la pregunta ya quedó en la bandeja.
    return { ...rendirse("error"), escalado: false };
  }
}

/** El bucle: pregunta, herramientas, respuesta. */
async function conversar(
  cfg: ConfigAgenteWeb,
  empresa: string,
  historial: { origen: string; contenido: string }[],
  mensaje: string,
  clave: string,
  ctx: ContextoEjecucion,
): Promise<{ texto: string; costo: number }> {
  const cliente = new Anthropic({ apiKey: clave });

  // El contexto estático va en el PRIMER turno del usuario, no en el
  // system: es lo que recomienda Anthropic para atención al cliente, y
  // además permite cachearlo. Con `cache_control` aquí, a partir del
  // segundo mensaje de cada conversación ese bloque cuesta la décima
  // parte — que es lo que hace viable un agente público sin bajar de
  // modelo.
  const contexto = await primerTurno();

  const mensajes: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: contexto, cache_control: { type: "ephemeral" } },
        { type: "text", text: "Entendido. Atiende a quien escriba desde aquí." },
      ],
    },
    { role: "assistant", content: "Entendido. Listo para atender." },
    ...historial.map((m): Anthropic.MessageParam => ({
      role: m.origen === "contacto" ? "user" : "assistant",
      content: m.contenido,
    })),
    { role: "user", content: mensaje },
  ];

  const cap = MODELOS[cfg.modelo];
  let costo = 0;
  let texto = "";

  // Tope de vueltas: el agente puede consultar el catálogo, escalar y
  // guardar el contacto. Más de cuatro vueltas significa que se atascó,
  // y dar vueltas delante de un cliente cuesta plata y paciencia.
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const respuesta = await cliente.messages.create({
      model: cfg.modelo,
      max_tokens: 900, // respuestas de 4-5 líneas: no hace falta más
      system: identidad(cfg.nombre, empresa),
      messages: mensajes,
      tools: HERRAMIENTAS_AGENTE as unknown as Anthropic.Tool[],
      ...(cap.soportaEsfuerzo
        ? { thinking: { type: "disabled" as const } }
        : { temperature: 0.3 }),
    });

    costo += costoUSD(cfg.modelo, respuesta.usage);

    texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim();

    const llamadas = respuesta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!llamadas.length) break;

    mensajes.push({ role: "assistant", content: respuesta.content });

    // Todos los resultados en UN solo mensaje: repartirlos en varios le
    // enseña al modelo a dejar de pedir herramientas en paralelo.
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const ll of llamadas) {
      const salida = await ejecutarHerramientaAgente(
        ctx, ll.name, ll.input as Record<string, unknown>,
      );
      resultados.push({ type: "tool_result", tool_use_id: ll.id, content: salida });
    }
    mensajes.push({ role: "user", content: resultados });
  }

  if (!texto) {
    texto =
      "Disculpe, no le entendí bien. ¿Me cuenta qué necesita proteger y en qué ciudad está? " +
      "Con eso le ayudo o le paso con un asesor.";
  }

  return { texto, costo };
}
