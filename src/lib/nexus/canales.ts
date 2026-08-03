// ============================================================
// NEXUS — envío de mensajes hacia el canal.
//
// Hasta ahora "responder" en Nexus solo escribía una fila en la base: el
// asesor veía su mensaje en pantalla y el cliente nunca recibía nada.
// Este archivo es la salida real.
//
// Cada canal se configura en su conexión (`nexus_conexiones.config`). El
// token va cifrado igual que el resto de credenciales del sistema, y se
// descifra con try/catch: una clave de cifrado que no corresponde no debe
// tumbar el módulo entero, solo ese canal.
// ============================================================

import { prisma } from "@/lib/prisma";
import { decryptIfNeeded, encrypt } from "@/lib/encryption";

export interface ResultadoEnvio {
  ok: boolean;
  /** Id del mensaje en el canal (wamid en WhatsApp), si lo devuelve. */
  refExterna?: string;
  error?: string;
}

/** Claves de `config` que se guardan cifradas. */
const CIFRADAS = new Set(["token", "apiKey", "appSecret"]);

type Config = Record<string, string>;

function leerConfig(bruto: unknown): Config {
  const cfg = (bruto ?? {}) as Config;
  const salida: Config = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (typeof v !== "string") continue;
    if (!CIFRADAS.has(k)) { salida[k] = v; continue; }
    try {
      salida[k] = decryptIfNeeded(v);
    } catch {
      // Cifrado con otra ENCRYPTION_KEY (típico: se cargó desde local y
      // esto es producción). Se trata como ausente.
      console.error(`[nexus] No se pudo descifrar "${k}" en este entorno.`);
      salida[k] = "";
    }
  }
  return salida;
}

/** Cifra las claves sensibles antes de guardar la configuración del canal. */
export function prepararConfig(datos: Config): Config {
  const salida: Config = {};
  for (const [k, v] of Object.entries(datos)) {
    if (v === undefined || v === null) continue;
    salida[k] = CIFRADAS.has(k) && v ? encrypt(v) : v;
  }
  return salida;
}

/** Un número colombiano en el formato que espera WhatsApp: 57XXXXXXXXXX. */
function normalizarTelefono(tel: string): string {
  const solo = tel.replace(/\D/g, "").replace(/^0+/, "");
  return solo.length <= 10 ? `57${solo}` : solo;
}

// ── WhatsApp Cloud API ──────────────────────────────────────
async function enviarWhatsApp(cfg: Config, destino: string, texto: string): Promise<ResultadoEnvio> {
  if (!cfg.phoneNumberId || !cfg.token) {
    return { ok: false, error: "Falta el Phone Number ID o el token de WhatsApp en la conexión." };
  }
  if (!destino) return { ok: false, error: "La conversación no tiene teléfono del contacto." };

  const version = cfg.version || "v21.0";
  const url = `https://graph.facebook.com/${version}/${cfg.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizarTelefono(destino),
        type: "text",
        text: { preview_url: true, body: texto },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const j = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Meta devuelve el motivo real dentro de `error.message`. Sin
      // sacarlo, el asesor solo vería "400" y no sabría qué corregir.
      const detalle = j?.error?.message ?? `HTTP ${res.status}`;
      const ventana = /24|re-?engagement|template/i.test(String(detalle))
        ? " La ventana de 24 horas se cerró: fuera de ella WhatsApp solo permite plantillas aprobadas."
        : "";
      return { ok: false, error: `WhatsApp: ${detalle}.${ventana}` };
    }

    return { ok: true, refExterna: j?.messages?.[0]?.id };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, error: /timeout|abort/i.test(msg) ? "WhatsApp no respondió a tiempo." : `WhatsApp: ${msg}` };
  }
}

// ── Webhook saliente genérico ───────────────────────────────
// Para canales conectados por un intermediario (n8n, Make, un puente
// propio). Se le hace POST con el mensaje y él sabe cómo entregarlo.
async function enviarWebhook(cfg: Config, destino: string, texto: string, canal: string): Promise<ResultadoEnvio> {
  if (!cfg.urlSalida) return { ok: false, error: `El canal "${canal}" no tiene URL de salida configurada.` };
  try {
    const res = await fetch(cfg.urlSalida, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({ canal, para: destino, texto }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `El servicio de salida respondió ${res.status}.` };
    const j = await res.json().catch(() => ({}));
    return { ok: true, refExterna: j?.id };
  } catch (e) {
    return { ok: false, error: `Salida de ${canal}: ${(e as Error).message}` };
  }
}

/**
 * Envía un texto por el canal de la conversación.
 *
 * Nunca lanza excepción: devuelve el resultado para que quien llama lo
 * guarde en el mensaje. Un envío fallido tiene que quedar registrado, no
 * desaparecer en un catch.
 */
export async function enviarPorCanal(conversacionId: string, texto: string): Promise<ResultadoEnvio> {
  const conv = await prisma.nexusConversacion.findUnique({
    where: { id: conversacionId },
    include: { conexion: true },
  });
  if (!conv) return { ok: false, error: "La conversación no existe." };
  if (!conv.conexion.activo) return { ok: false, error: `El canal "${conv.canal}" está desactivado.` };

  const cfg = leerConfig(conv.conexion.config);
  const destino = conv.telRemit ?? conv.emailRemit ?? "";

  switch (conv.canal) {
    case "whatsapp":
      return enviarWhatsApp(cfg, destino, texto);
    case "wordpress_form":
      // Un formulario web no es un canal de ida y vuelta: se responde por
      // correo. Decirlo claro es mejor que fingir que se envió.
      return { ok: false, error: "Los mensajes de formulario web se responden por correo, no por este canal." };
    default:
      return enviarWebhook(cfg, destino, texto, conv.canal);
  }
}

/** ¿Este canal puede responder hoy? Sirve para no ofrecer lo que no hay. */
export async function canalPuedeEnviar(conexionId: string): Promise<{ puede: boolean; motivo?: string }> {
  const conexion = await prisma.nexusConexion.findUnique({ where: { id: conexionId } });
  if (!conexion) return { puede: false, motivo: "La conexión no existe." };
  if (!conexion.activo) return { puede: false, motivo: "El canal está desactivado." };

  const cfg = leerConfig(conexion.config);
  if (conexion.canal === "whatsapp") {
    if (!cfg.phoneNumberId || !cfg.token) {
      return { puede: false, motivo: "Falta el Phone Number ID o el token de WhatsApp." };
    }
    return { puede: true };
  }
  if (conexion.canal === "wordpress_form") {
    return { puede: false, motivo: "El formulario web no recibe respuestas; se contesta por correo." };
  }
  return cfg.urlSalida ? { puede: true } : { puede: false, motivo: "Falta la URL de salida del canal." };
}
