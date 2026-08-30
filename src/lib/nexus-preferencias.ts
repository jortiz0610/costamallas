// ============================================================
// Lo que cada persona configura de su propio inbox.
//
// Vive en el navegador (`localStorage`) y no en la base a propósito: son
// gustos de quien atiende —qué color le pone a WhatsApp, si quiere que
// suene— y no datos de la empresa. Guardarlos en el servidor obligaría a
// una consulta más en cada carga del inbox para algo que no le importa a
// nadie más.
// ============================================================

export interface PrefsNexus {
  /** Sonido al entrar un mensaje. */
  sonido: boolean;
  /** Volumen del aviso, de 0 a 1. */
  volumen: number;
  /** Color por canal. La clave es el canal: WHATSAPP, WEB, EMAIL… */
  colores: Record<string, string>;
  /** Etiqueta corta por canal, la que se pinta en la lista. */
  etiquetas: Record<string, string>;
  /** Fondo del chat. Ver `TEMAS`. */
  tema: ClaveTema;
}

export type ClaveTema = "claro" | "papel" | "noche";

export interface Tema {
  v: ClaveTema;
  l: string;
  /** El fondo de la zona de mensajes. */
  fondo: string;
  /** La burbuja de quien escribe (la nuestra). */
  mia: string;
  /** La burbuja de la otra persona. */
  suya: string;
  /** Color del texto sobre `suya`. */
  textoSuya: string;
}

/**
 * Tres fondos, no doce.
 *
 * Los tres son legibles: no hay ninguno donde el texto gris sobre el
 * fondo se pierda. Un selector con veinte fotos de paisajes se ve muy
 * bien el primer día y deja a alguien leyendo negro sobre azul el resto
 * del año.
 */
export const TEMAS: Tema[] = [
  { v: "claro", l: "Claro", fondo: "#f6f7f9", mia: "#7c3aed", suya: "#ffffff", textoSuya: "#1f2937" },
  { v: "papel", l: "Papel", fondo: "#f3efe6", mia: "#8a6d1f", suya: "#fffdf7", textoSuya: "#3b352a" },
  { v: "noche", l: "Noche", fondo: "#0f172a", mia: "#7c3aed", suya: "#1e293b", textoSuya: "#e2e8f0" },
];

export const TEMA_POR_CLAVE: Record<string, Tema> =
  Object.fromEntries(TEMAS.map(t => [t.v, t]));

export const temaDe = (prefs: PrefsNexus): Tema =>
  TEMA_POR_CLAVE[prefs.tema] ?? TEMAS[0];

export const CANALES_CONOCIDOS = ["WHATSAPP", "WEB", "EMAIL", "INSTAGRAM", "FACEBOOK", "INTERNO"] as const;

/**
 * El canal, en su forma canónica.
 *
 * Dos motivos para que exista:
 *
 *   1. En la base conviven mayúsculas y minúsculas: el agente web
 *      guarda `WEB` y el mapa de canales del inbox estaba escrito en
 *      minúsculas (`whatsapp`, `email`). Comparar sin normalizar hacía
 *      que el color configurado no se aplicara nunca.
 *   2. **El formulario de WordPress y el correo son el mismo canal.** A
 *      quien atiende le da igual si el mensaje entró por el formulario de
 *      la página o por el buzón: los dos se contestan por escrito, sin
 *      nadie esperando en vivo al otro lado. Tenerlos separados obligaba
 *      a mirar dos filtros para el mismo trabajo.
 *
 * ⚠️ El chat en vivo de la web (`WEB`) NO se une a correo: ahí sí hay
 * alguien esperando delante de la pantalla, y mezclarlo con el buzón es
 * la forma de dejarlo sin contestar.
 */
export function normalizarCanal(canal: string | null | undefined): string {
  const c = (canal ?? "").toUpperCase().trim();
  if (c === "WORDPRESS_FORM" || c === "WORDPRESS" || c === "FORMULARIO") return "EMAIL";
  if (c === "MAIL" || c === "CORREO") return "EMAIL";
  return c || "WEB";
}

export const PREFS_POR_DEFECTO: PrefsNexus = {
  sonido: true,
  volumen: 0.5,
  tema: "claro",
  colores: {
    WHATSAPP: "#25D366",
    WEB: "#0891b2",
    EMAIL: "#BA7517",
    INSTAGRAM: "#d946ef",
    FACEBOOK: "#1d4ed8",
    INTERNO: "#7c3aed",
  },
  etiquetas: {
    WHATSAPP: "WhatsApp",
    WEB: "Web",
    // El canal de WordPress y el de correo se muestran como uno solo: al
    // que atiende le da igual si el formulario llegó por la web o por el
    // buzón, lo que necesita saber es que hay que contestar por escrito.
    // El formulario de WordPress entra aquí: ver `normalizarCanal`.
    EMAIL: "Correo y web",
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    INTERNO: "Equipo",
  },
};

const CLAVE = "cm_nexus_prefs";

export function leerPrefs(): PrefsNexus {
  if (typeof window === "undefined") return PREFS_POR_DEFECTO;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return PREFS_POR_DEFECTO;
    const p = JSON.parse(crudo) as Partial<PrefsNexus>;
    return {
      sonido: p.sonido ?? PREFS_POR_DEFECTO.sonido,
      volumen: typeof p.volumen === "number" ? Math.min(1, Math.max(0, p.volumen)) : PREFS_POR_DEFECTO.volumen,
      colores: { ...PREFS_POR_DEFECTO.colores, ...(p.colores ?? {}) },
      etiquetas: { ...PREFS_POR_DEFECTO.etiquetas, ...(p.etiquetas ?? {}) },
      tema: TEMA_POR_CLAVE[p.tema ?? ""] ? p.tema! : PREFS_POR_DEFECTO.tema,
    };
  } catch {
    return PREFS_POR_DEFECTO;
  }
}

export function guardarPrefs(p: PrefsNexus) {
  try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* modo incógnito */ }
}

export const colorCanal = (canal: string, prefs = leerPrefs()) =>
  prefs.colores[normalizarCanal(canal)] ?? "#6b7280";

export const etiquetaCanal = (canal: string, prefs = leerPrefs()) =>
  prefs.etiquetas[normalizarCanal(canal)] ?? normalizarCanal(canal);

// ─────────────────────────────────────────────
// El sonido
// ─────────────────────────────────────────────

let contexto: AudioContext | null = null;

/**
 * Un "pin" corto, sintetizado.
 *
 * No es un archivo de audio a propósito: un mp3 son 20 KB que hay que
 * bajar, cachear y servir, y encima el navegador bloquea la reproducción
 * hasta que la persona interactúa con la página. Dos osciladores pesan
 * cero y suenan igual de bien para lo que hace falta — avisar, no
 * entretener.
 */
export function sonarMensaje() {
  const prefs = leerPrefs();
  if (!prefs.sonido || typeof window === "undefined") return;

  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    contexto = contexto ?? new Ctx();
    // El navegador suspende el contexto hasta el primer clic de la
    // persona. Reanudarlo aquí hace que el primer aviso ya suene.
    if (contexto.state === "suspended") void contexto.resume();

    const ahora = contexto.currentTime;
    const ganancia = contexto.createGain();
    ganancia.connect(contexto.destination);
    ganancia.gain.setValueAtTime(0, ahora);
    ganancia.gain.linearRampToValueAtTime(prefs.volumen * 0.25, ahora + 0.01);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.28);

    // Dos notas ascendentes: se distingue de una notificación del sistema.
    for (const [frecuencia, retraso] of [[880, 0], [1170, 0.09]] as const) {
      const osc = contexto.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frecuencia, ahora + retraso);
      osc.connect(ganancia);
      osc.start(ahora + retraso);
      osc.stop(ahora + retraso + 0.18);
    }
  } catch {
    // Sin audio disponible no pasa nada: el aviso visual sigue estando.
  }
}
