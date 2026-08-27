// ============================================================
// AGENTE WEB — configuración.
//
// Todo lo que gerencia puede cambiar sin tocar código: si está
// encendido, con qué modelo responde, cuánto puede gastar al día, a qué
// WhatsApp escala y con qué frase saluda.
//
// ⚠️ El tope de gasto no es una comodidad, es lo que impide que un
// endpoint público que llama a Claude se convierta en una factura. Sin
// tope, cualquiera con la URL puede hacer preguntas toda la noche.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { IdModelo } from "@/lib/sembli/modelos";

export interface ConfigAgenteWeb {
  /** Si está apagado, el endpoint responde que no está disponible. */
  activo: boolean;
  /** Cómo se presenta. */
  nombre: string;
  /** Primer mensaje, antes de que el cliente escriba. */
  saludo: string;
  /**
   * Sonnet 5 por defecto y no Haiku, a diferencia del asistente interno.
   * Aquí quien está del otro lado es un cliente que no conoce la
   * empresa: una respuesta floja no es una molestia interna, es una
   * venta que no se hizo. El costo se controla con la caché del
   * contexto —que es lo que abarata de verdad— y con el tope diario,
   * no bajando de modelo. Se puede cambiar desde el portal.
   */
  modelo: IdModelo;
  /** Tope de gasto por día, en USD. Al llegar, el agente deja de responder. */
  topeDiarioUSD: number;
  /** Tope por conversación: corta una charla que se fue de precio. */
  topeConversacionUSD: number;
  /** Máximo de mensajes en una misma conversación. */
  maxMensajes: number;
  /** WhatsApp al que se manda a quien pide hablar con una persona. */
  whatsapp: string;
  /** Dominios desde los que se acepta el widget. Vacío = solo la tienda. */
  dominios: string[];
}

export const AGENTE_WEB_DEFAULTS: ConfigAgenteWeb = {
  activo: false, // apagado hasta que alguien lo revise y lo encienda
  nombre: "Mallita",
  saludo:
    "¡Hola! Soy el asistente de Costamallas. Puedo ayudarle con mallas para " +
    "balcones, mascotas, gallineros o cerramientos: qué sirve para su caso, " +
    "medidas y precios del catálogo. ¿Qué necesita proteger?",
  modelo: "claude-sonnet-5",
  topeDiarioUSD: 3,
  topeConversacionUSD: 0.25,
  maxMensajes: 40,
  whatsapp: "",
  dominios: ["https://costamallas.com", "https://www.costamallas.com"],
};

const CLAVES: Record<keyof ConfigAgenteWeb, string> = {
  activo: "agweb_activo",
  nombre: "agweb_nombre",
  saludo: "agweb_saludo",
  modelo: "agweb_modelo",
  topeDiarioUSD: "agweb_tope_dia",
  topeConversacionUSD: "agweb_tope_conv",
  maxMensajes: "agweb_max_mensajes",
  whatsapp: "agweb_whatsapp",
  dominios: "agweb_dominios",
};

export async function getConfigAgenteWeb(): Promise<ConfigAgenteWeb> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  const num = (clave: string, porDefecto: number, min: number, max: number) => {
    const v = Number(map[clave]);
    return Number.isFinite(v) && v >= min && v <= max ? v : porDefecto;
  };

  let dominios = AGENTE_WEB_DEFAULTS.dominios;
  try {
    const parsed = JSON.parse(map[CLAVES.dominios] ?? "");
    if (Array.isArray(parsed) && parsed.length) dominios = parsed.map(String);
  } catch {
    // Un JSON corrupto no puede dejar el widget sin dominios permitidos:
    // se cae a los de fábrica, que son los de la tienda.
  }

  const modelo = map[CLAVES.modelo];

  return {
    activo: map[CLAVES.activo] === "true",
    nombre: map[CLAVES.nombre] || AGENTE_WEB_DEFAULTS.nombre,
    saludo: map[CLAVES.saludo] || AGENTE_WEB_DEFAULTS.saludo,
    modelo: modelo === "claude-haiku-4-5" || modelo === "claude-sonnet-5"
      ? modelo
      : AGENTE_WEB_DEFAULTS.modelo,
    topeDiarioUSD: num(CLAVES.topeDiarioUSD, AGENTE_WEB_DEFAULTS.topeDiarioUSD, 0.1, 500),
    topeConversacionUSD: num(CLAVES.topeConversacionUSD, AGENTE_WEB_DEFAULTS.topeConversacionUSD, 0.01, 20),
    maxMensajes: num(CLAVES.maxMensajes, AGENTE_WEB_DEFAULTS.maxMensajes, 4, 200),
    whatsapp: map[CLAVES.whatsapp] ?? "",
    dominios,
  };
}

export async function setConfigAgenteWeb(datos: Partial<ConfigAgenteWeb>) {
  for (const [campo, valor] of Object.entries(datos)) {
    const clave = CLAVES[campo as keyof ConfigAgenteWeb];
    if (!clave || valor === undefined) continue;
    const guardado = Array.isArray(valor) ? JSON.stringify(valor) : String(valor);
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: guardado, descripcion: "Agente web" },
      update: { valor: guardado },
    });
  }
}

/**
 * Lo gastado hoy por el agente en la web.
 *
 * Se suma sobre las conversaciones del canal WEB del día, no sobre los
 * registros de log: el costo vive en la conversación justamente para que
 * esta consulta sea una suma indexada y no un recorrido de la tabla de
 * logs en cada mensaje.
 */
export async function gastoDeHoy(): Promise<number> {
  const inicio = new Date();
  inicio.setUTCHours(0, 0, 0, 0);
  const r = await prisma.nexusConversacion.aggregate({
    where: { canal: "WEB", createdAt: { gte: inicio } },
    _sum: { costoUSD: true },
  });
  return r._sum.costoUSD ?? 0;
}
