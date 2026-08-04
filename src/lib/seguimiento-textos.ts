// ============================================================
// Textos y parámetros del seguimiento post-cotización, SIN Prisma.
//
// Vive aparte de `seguimiento.ts` (que sí importa Prisma) por la misma
// razón que `cotizacion-textos.ts`: la pantalla de configuración es un
// componente de cliente y no puede arrastrar el cliente de Postgres al
// navegador.
//
// ⚠️ Los textos NO prometen nada que el sistema no sepa. No hay plazos,
// ni precios, ni garantías inventadas: solo el número de la oferta, su
// total, la fecha en que vence y el enlace. Todo lo demás ya está en la
// cotización que el cliente tiene en la mano.
// ============================================================

/** Los tres toques de la secuencia que pidió la gerencia. */
export const TOQUES = [1, 2, 3] as const;
export type Toque = (typeof TOQUES)[number];

export interface ConfigSeguimiento {
  /** Interruptor general. Apagado, el cron no manda nada. */
  activo: boolean;

  /** Toque 1 — horas después del envío para confirmar que llegó. */
  t1Horas: number;
  /** Toque 2 — horas después del envío en que se le crea la tarea al asesor. */
  t2Horas: number;
  /** Toque 2 — hasta cuándo tiene el asesor para marcarla antes de la alerta. */
  t2LimiteHoras: number;
  /** Toque 3 — días antes del vencimiento en que sale el último aviso. */
  t3DiasAntes: number;

  /**
   * Mandar además por WhatsApp cuando el canal esté aprobado por Meta.
   * Hoy queda registrado como no enviado con el motivo; no se simula.
   */
  porWhatsapp: boolean;

  t1Asunto: string;
  t1Cuerpo: string;
  t1Whatsapp: string;

  /** Toque 2: lo hace una persona. Esto es lo que ve el asesor en la tarea. */
  t2Titulo: string;
  t2Guion: string;

  t3Asunto: string;
  t3Cuerpo: string;
  t3Whatsapp: string;
}

/**
 * Marcadores que se reemplazan en los textos. Se documentan aquí para
 * poder mostrarlos en la pantalla de configuración: un campo de texto
 * libre sin la lista de lo que acepta es una trampa.
 */
export const MARCADORES: { clave: string; descripcion: string }[] = [
  { clave: "{{cliente}}", descripcion: "Nombre del contacto" },
  { clave: "{{empresa}}", descripcion: "Empresa del cliente (o su nombre si es persona)" },
  { clave: "{{numero}}", descripcion: "Número de la cotización" },
  { clave: "{{total}}", descripcion: "Total de la oferta" },
  { clave: "{{enlace}}", descripcion: "Enlace a la cotización" },
  { clave: "{{vence}}", descripcion: "Fecha en que vence la oferta" },
  { clave: "{{diasRestantes}}", descripcion: "Días que le quedan de vigencia" },
  { clave: "{{asesor}}", descripcion: "Nombre del asesor" },
  { clave: "{{telefonoAsesor}}", descripcion: "Celular del asesor" },
  { clave: "{{nosotros}}", descripcion: "Nombre de la empresa" },
];

export const SEGUIMIENTO_DEFAULTS: ConfigSeguimiento = {
  activo: true,

  t1Horas: 24,
  t2Horas: 48,
  t2LimiteHoras: 72,
  t3DiasAntes: 1,

  porWhatsapp: false,

  // ── Toque 1 · automático a las 24 h ──
  // Objetivo: confirmar que la oferta llegó y abrir la puerta a preguntas.
  // No empuja a comprar: a las 24 horas todavía la están mirando.
  t1Asunto: "¿Le llegó bien la cotización {{numero}}?",
  t1Cuerpo:
    "Buen día, {{empresa}}:\n\n" +
    "Le escribimos para confirmar que recibió la cotización {{numero}} que le enviamos.\n\n" +
    "Si tiene dudas sobre las medidas, las cantidades o cualquier punto de la oferta, " +
    "respóndanos este correo o escríbale directamente a {{asesor}} al {{telefonoAsesor}}. " +
    "Ajustarla es rápido.\n\n" +
    "La oferta está vigente hasta el {{vence}}.",
  t1Whatsapp:
    "Buen día, {{empresa}}. Soy {{asesor}} de {{nosotros}}. " +
    "¿Le llegó bien la cotización {{numero}}? Aquí la tiene: {{enlace}} " +
    "Cualquier ajuste me avisa.",

  // ── Toque 2 · lo hace una persona, entre 48 y 72 h ──
  t2Titulo: "Llamar por la cotización {{numero}} — {{empresa}}",
  t2Guion:
    "Llamada de seguimiento a {{cliente}} ({{empresa}}) por la cotización {{numero}}, " +
    "de {{total}}.\n\n" +
    "Qué averiguar:\n" +
    "1. ¿Alcanzó a revisar la oferta? ¿Le quedó clara?\n" +
    "2. ¿Hay algo que haya que ajustar (medidas, cantidades, instalación)?\n" +
    "3. ¿Está comparando con otro proveedor? ¿En qué?\n" +
    "4. ¿Quién más decide y para cuándo lo necesita?\n\n" +
    "Al terminar, marca esta tarea como completada y deja en la descripción lo que dijo. " +
    "Si no se marca, gerencia recibe el aviso de que este cliente quedó sin llamar.\n\n" +
    "La oferta vence el {{vence}}.",

  // ── Toque 3 · automático, un día antes de vencer ──
  // La urgencia es real: la vigencia sale de la propia cotización.
  t3Asunto: "Su cotización {{numero}} vence el {{vence}}",
  t3Cuerpo:
    "Buen día, {{empresa}}:\n\n" +
    "Le recordamos que la cotización {{numero}}, por {{total}}, está vigente hasta el {{vence}}.\n\n" +
    "Después de esa fecha tenemos que revisar precios y disponibilidad, porque dependen de la " +
    "rotación del inventario. Si quiere que avancemos con estas condiciones, respóndanos este " +
    "correo o escríbale a {{asesor}} al {{telefonoAsesor}}.\n\n" +
    "Si necesita más tiempo o cambió algo del proyecto, también díganoslo: le preparamos una " +
    "oferta nueva.",
  t3Whatsapp:
    "{{empresa}}, le recuerdo que su cotización {{numero}} vence el {{vence}}. " +
    "Si quiere avanzar con estas condiciones me avisa y lo dejamos listo hoy. {{enlace}}",
};

/** Reemplaza los marcadores. Lo que no exista queda vacío, no como texto. */
export function aplicarMarcadores(texto: string, datos: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, clave: string) => datos[clave] ?? "");
}
