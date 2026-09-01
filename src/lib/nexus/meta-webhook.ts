// ============================================================
// Traducir lo que manda Meta a lo que entiende Nexus.
//
// El webhook esperaba un cuerpo PLANO (`from`, `body`) y Meta manda uno
// ANIDADO: entry[] → changes[] → value → messages[]. Con el código
// anterior, Meta habría dado la conexión por buena y cada mensaje habría
// entrado vacío: sin teléfono, sin texto y sin nombre. Eso es peor que no
// estar conectado, porque parece que sí.
//
// Dos cosas que hay que respetar de este formato:
//
//   1. Un solo POST puede traer VARIOS mensajes. Meta agrupa. Procesar
//      solo el primero pierde los demás sin dejar rastro.
//   2. Hay eventos que NO son mensajes: los `statuses` (entregado,
//      leído). Si se tratan como mensajes, cada acuse de recibo abre una
//      conversación en blanco y la bandeja se llena de basura.
// ============================================================

export interface MensajeEntrante {
  /** El nombre del perfil de WhatsApp, o el número si no lo comparte. */
  remitente: string;
  telefono: string;
  /** Ya en texto. Para audios e imágenes, una marca legible. */
  contenido: string;
  /** texto · imagen · audio · video · documento · ubicacion · otro */
  tipo: string;
  /** El `wamid`. Sirve para no guardar dos veces el mismo mensaje. */
  refExterna: string | null;
  metadata: Record<string, unknown>;
}

interface MensajeMeta {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  video?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  sticker?: { id?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  contacts?: unknown[];
  context?: { id?: string };
}

/** ¿Esto viene de Meta? Si no, que lo trate el camino de siempre. */
export function esPayloadDeMeta(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.object === "whatsapp_business_account" || Array.isArray(b.entry);
}

/**
 * Saca los mensajes de un webhook de WhatsApp Cloud API.
 *
 * Devuelve lista vacía cuando el evento no trae ninguno —un acuse de
 * entrega, por ejemplo—, y eso NO es un error: es la mitad de lo que
 * manda Meta.
 */
export function mensajesDeMeta(body: unknown): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  if (!esPayloadDeMeta(body)) return salida;

  const entradas = (body as { entry?: unknown[] }).entry ?? [];

  for (const entrada of entradas) {
    const cambios = (entrada as { changes?: unknown[] })?.changes ?? [];

    for (const cambio of cambios) {
      const c = cambio as { field?: string; value?: Record<string, unknown> };
      // Solo interesa `messages`. Los demás campos (`message_template_status_update`,
      // `account_update`…) no son conversaciones.
      if (c.field && c.field !== "messages") continue;

      const valor = c.value ?? {};
      const mensajes = (valor.messages as MensajeMeta[] | undefined) ?? [];
      if (!mensajes.length) continue;   // acuse de entrega o lectura

      // El nombre del perfil viene aparte, en `contacts`, emparejado por
      // el número. Sin esto, en la bandeja todos se llaman "WhatsApp".
      const contactos = (valor.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
      const nombreDe = new Map(contactos.map(c2 => [c2.wa_id ?? "", c2.profile?.name ?? ""]));

      const telefonoLinea = (valor.metadata as { display_phone_number?: string } | undefined)?.display_phone_number;

      for (const m of mensajes) {
        const telefono = String(m.from ?? "").trim();
        const { texto, tipo } = leerContenido(m);

        salida.push({
          remitente: (nombreDe.get(telefono) || "").trim() || telefono || "WhatsApp",
          telefono,
          contenido: texto,
          tipo,
          refExterna: m.id ?? null,
          metadata: {
            fuente: "WhatsApp",
            wamid: m.id,
            lineaDeLaEmpresa: telefonoLinea,
            enviadoEn: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : null,
            // Si el cliente respondió a un mensaje concreto, se guarda cuál.
            respondeA: m.context?.id ?? null,
            // Para audios, imágenes y documentos: el id del archivo en
            // Meta. Descargarlo necesita otra llamada con el token, y eso
            // todavía no está hecho — pero el id queda para cuando lo esté.
            adjunto: idDelAdjunto(m),
            crudo: m,
          },
        });
      }
    }
  }

  return salida;
}

function idDelAdjunto(m: MensajeMeta): string | null {
  return m.image?.id ?? m.audio?.id ?? m.video?.id ?? m.document?.id ?? m.sticker?.id ?? null;
}

/**
 * De cada tipo de mensaje, el texto que va a ver el asesor.
 *
 * Los archivos todavía no se descargan de Meta, así que en vez de una
 * fila en blanco se pone una marca que dice qué llegó. Un asesor que ve
 * "🎤 Nota de voz" sabe que tiene que abrir WhatsApp; uno que ve una fila
 * vacía cree que el sistema se rompió.
 */
function leerContenido(m: MensajeMeta): { texto: string; tipo: string } {
  switch (m.type) {
    case "text":
      return { texto: m.text?.body ?? "", tipo: "texto" };

    case "image":
      return { texto: m.image?.caption?.trim() || "📷 Imagen", tipo: "imagen" };

    case "audio":
      return { texto: m.audio?.voice ? "🎤 Nota de voz" : "🎵 Audio", tipo: "audio" };

    case "video":
      return { texto: m.video?.caption?.trim() || "🎬 Video", tipo: "video" };

    case "document":
      return {
        texto: `📎 ${m.document?.filename ?? "Documento"}${m.document?.caption ? ` — ${m.document.caption}` : ""}`,
        tipo: "documento",
      };

    case "sticker":
      return { texto: "Sticker", tipo: "otro" };

    case "location": {
      const l = m.location ?? {};
      const donde = [l.name, l.address].filter(Boolean).join(", ");
      const coords = l.latitude != null && l.longitude != null
        ? `https://maps.google.com/?q=${l.latitude},${l.longitude}`
        : "";
      return { texto: `📍 Ubicación${donde ? `: ${donde}` : ""}${coords ? `\n${coords}` : ""}`, tipo: "ubicacion" };
    }

    // Cuando el cliente toca un botón de una plantilla, lo que importa es
    // QUÉ tocó, no que fuera un botón.
    case "button":
      return { texto: m.button?.text ?? "(botón)", tipo: "texto" };

    case "interactive":
      return {
        texto: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "(respuesta)",
        tipo: "texto",
      };

    case "contacts":
      return { texto: "👤 Contacto compartido", tipo: "otro" };

    default:
      return { texto: `(mensaje de tipo "${m.type ?? "desconocido"}")`, tipo: "otro" };
  }
}
