// ============================================================
// Las plantillas de correo del portal.
//
// Hasta ahora cada correo armaba su HTML donde le tocaba: el seguimiento
// en `seguimiento-textos.ts`, la orden de compra dentro de su route, el
// aviso al coordinador en `instalaciones.ts`. Consecuencias:
//
//   · Ninguno se podía editar sin desplegar.
//   · Cada uno tenía su propio pie y su propia cabecera, así que el
//     cliente recibía tres correos de la misma empresa con tres diseños.
//
// Aquí están todos, con su texto por defecto y sus marcadores. El texto
// se guarda en `configuracion` con la clave `correo_<clave>_asunto` y
// `correo_<clave>_cuerpo`; mientras nadie lo toque se usa el de aquí.
//
// El cuerpo se escribe en TEXTO PLANO, no en HTML. Quien edita esto es
// gerencia, no un programador: el diseño —banner, botones, pie— lo pone
// `correo-layout.ts` alrededor. Un editor de HTML libre acabaría con un
// correo roto en el primer copiar-pegar desde Word.
// ============================================================

export type CategoriaCorreo = "cotizacion" | "operacion" | "postventa" | "interno";

export interface Marcador {
  k: string;
  /** Qué pone en su lugar. Sale en la ayuda del editor. */
  ejemplo: string;
}

export interface PlantillaCorreo {
  /** Clave estable. NO renombrar: queda escrita en `configuracion`. */
  clave: string;
  categoria: CategoriaCorreo;
  nombre: string;
  /** Cuándo sale. Es lo primero que pregunta quien lo va a editar. */
  cuando: string;
  asunto: string;
  cuerpo: string;
  /** Marcadores que ESTE correo sabe reemplazar. */
  marcadores: Marcador[];
  /** Texto del botón principal, si lleva. */
  boton?: string;
  /** Un aviso para quien edita: qué NO tocar y por qué. */
  nota?: string;
}

export const CATEGORIAS: { v: CategoriaCorreo; l: string; d: string }[] = [
  { v: "cotizacion", l: "Cotizaciones", d: "Lo que recibe el cliente alrededor de su oferta." },
  { v: "operacion", l: "Operación", d: "Visitas, instalaciones y coordinación." },
  { v: "postventa", l: "Postventa", d: "Después de entregar." },
  { v: "interno", l: "Avisos internos", d: "Los que recibe el equipo, no el cliente." },
];

// Marcadores comunes, para no repetirlos en cada plantilla.
const M_CLIENTE: Marcador[] = [
  { k: "{{cliente}}", ejemplo: "Constructora ABC S.A.S." },
  { k: "{{contacto}}", ejemplo: "Juan Rodríguez" },
];
const M_OFERTA: Marcador[] = [
  { k: "{{numero}}", ejemplo: "COT-12076" },
  { k: "{{total}}", ejemplo: "$ 2.450.000" },
  { k: "{{vence}}", ejemplo: "15 de septiembre de 2026" },
  { k: "{{enlace}}", ejemplo: "https://cotizacion.costamallas.com/…" },
];
const M_ASESOR: Marcador[] = [
  { k: "{{asesor}}", ejemplo: "Elkin Fernández" },
  { k: "{{asesorTelefono}}", ejemplo: "3006078956" },
];

/**
 * El cuerpo del correo de envío de cotización.
 *
 * ⚠️ Este texto lo escribió gerencia y va TAL CUAL. No se "mejora": es
 * la voz con la que la empresa le habla a sus clientes desde antes de
 * que existiera el portal.
 */
const CUERPO_ENVIO = `Cordial saludo Estimado cliente,

Esperamos se encuentren muy bien.

De acuerdo con lo conversado, compartimos la propuesta correspondiente al servicio solicitado, la cual incluye el alcance técnico y las condiciones comerciales para su revisión.

Para nosotros es muy valioso acompañarlo y aportar a sus proyectos. Quedamos atentos a sus comentarios o inquietudes, así como a cualquier ajuste que consideren necesario para avanzar.

Agradecemos de antemano su tiempo y la confianza depositada en nuestro equipo`;

export const PLANTILLAS: PlantillaCorreo[] = [
  // ── COTIZACIONES ──
  {
    clave: "cotizacion_envio",
    categoria: "cotizacion",
    nombre: "Envío de la cotización",
    cuando: "Cuando el asesor le manda la oferta al cliente.",
    asunto: "Cotización {{numero}} · {{empresa}}",
    cuerpo: CUERPO_ENVIO,
    boton: "Ver la cotización",
    marcadores: [...M_CLIENTE, ...M_OFERTA, ...M_ASESOR],
    nota:
      "El cuerpo de este correo lo escribió gerencia y va tal cual. " +
      "Si hay que cambiarlo, que lo cambie gerencia — no se “mejora” por " +
      "el camino.",
  },
  {
    clave: "cotizacion_modificada",
    categoria: "cotizacion",
    nombre: "La cotización cambió",
    cuando:
      "Cuando se edita una oferta que el cliente YA tenía. El portal le " +
      "pregunta al asesor si quiere reenviarla; este es el correo que sale.",
    asunto: "Actualizamos su cotización {{numero}}",
    cuerpo: `Cordial saludo {{contacto}},

Hicimos un ajuste en la cotización {{numero}} que le compartimos. El enlace es el mismo, así que al abrirlo verá siempre la versión vigente.

Queda válida hasta el {{vence}}.

Cualquier duda, con gusto la resolvemos.`,
    boton: "Ver la cotización actualizada",
    marcadores: [...M_CLIENTE, ...M_OFERTA, ...M_ASESOR],
  },
  {
    clave: "cotizacion_recordatorio",
    categoria: "cotizacion",
    nombre: "Recordatorio (24 h)",
    cuando: "24 horas después de enviar la oferta, si el cliente no ha contestado.",
    asunto: "¿Le llegó bien nuestra cotización {{numero}}?",
    cuerpo: `Cordial saludo {{contacto}},

Queremos confirmar que le haya llegado la cotización {{numero}} que le compartimos ayer.

Si tiene alguna duda sobre el alcance, los materiales o el plazo, escríbanos y con gusto se lo explicamos.`,
    boton: "Ver la cotización",
    marcadores: [...M_CLIENTE, ...M_OFERTA, ...M_ASESOR],
  },
  {
    clave: "cotizacion_por_vencer",
    categoria: "cotizacion",
    nombre: "Por vencer (último aviso)",
    cuando: "Un día antes de que la oferta caduque. Lleva el botón de aprobar.",
    asunto: "Su cotización {{numero}} vence el {{vence}}",
    cuerpo: `Cordial saludo {{contacto}},

Le recordamos que la cotización {{numero}}, por {{total}}, está vigente hasta el {{vence}}.

Los precios de los materiales se mueven, así que después de esa fecha tendríamos que revisarlos. Si desea que avancemos con estos valores, puede aprobarla desde el mismo enlace.

Si necesita más tiempo, escríbanos y lo coordinamos sin problema.`,
    boton: "Aprobar la cotización",
    marcadores: [...M_CLIENTE, ...M_OFERTA, ...M_ASESOR],
    nota:
      "El botón de aprobar va discreto a propósito. Es el último correo " +
      "de la secuencia y presionar de más en el último toque es lo que " +
      "hace que el cliente deje de abrirlos.",
  },

  // ── OPERACIÓN ──
  {
    clave: "visita_agendada",
    categoria: "operacion",
    nombre: "Visita técnica agendada",
    cuando: "Cuando producción fija la fecha y la hora de ir a medir.",
    asunto: "Visita técnica el {{fecha}} · {{empresa}}",
    cuerpo: `Cordial saludo {{contacto}},

Confirmamos la visita técnica para el {{fecha}} a las {{hora}}, en {{direccion}}.

El técnico toma las medidas del sitio y revisa las condiciones de instalación. La visita toma entre 30 y 45 minutos y no tiene costo.

Si esa fecha no le sirve, respóndanos este correo y la reprogramamos.`,
    marcadores: [
      ...M_CLIENTE,
      { k: "{{fecha}}", ejemplo: "martes 3 de septiembre" },
      { k: "{{hora}}", ejemplo: "10:00 a. m." },
      { k: "{{direccion}}", ejemplo: "Cra 15 #98-23, Barranquilla" },
      ...M_ASESOR,
    ],
  },
  {
    clave: "instalacion_agendada",
    categoria: "operacion",
    nombre: "Instalación agendada",
    cuando: "Cuando se fija la fecha de la instalación.",
    asunto: "Su instalación queda para el {{fecha}}",
    cuerpo: `Cordial saludo {{contacto}},

Su instalación quedó programada para el {{fecha}} a las {{hora}}, en {{direccion}}.

Le pedimos que el día de la visita haya alguien mayor de edad en el sitio y que el área esté despejada. Si hace falta permiso de la administración del edificio, conviene tramitarlo antes.

Cualquier cambio, avísenos con un día de anticipación.`,
    marcadores: [
      ...M_CLIENTE,
      { k: "{{fecha}}", ejemplo: "martes 3 de septiembre" },
      { k: "{{hora}}", ejemplo: "8:00 a. m." },
      { k: "{{direccion}}", ejemplo: "Cra 15 #98-23, Barranquilla" },
      ...M_ASESOR,
    ],
  },

  // ── POSTVENTA ──
  {
    clave: "encuesta_satisfaccion",
    categoria: "postventa",
    nombre: "Encuesta de satisfacción",
    cuando: "24 horas después de que la obra sale de producción.",
    asunto: "¿Cómo nos fue? · {{empresa}}",
    cuerpo: `Cordial saludo {{contacto}},

Ya terminamos el trabajo y queremos saber cómo nos fue.

Son cinco minutos y nos sirven de verdad: con lo que nos diga ajustamos lo que haga falta, y si algo no quedó bien, preferimos enterarnos por usted antes que por nadie más.

Gracias por la confianza.`,
    boton: "Contestar la encuesta",
    marcadores: [
      ...M_CLIENTE,
      { k: "{{enlace}}", ejemplo: "https://portal.costamallas.com/encuesta/…" },
      ...M_ASESOR,
    ],
  },

  // ── INTERNOS ──
  {
    clave: "aviso_cliente_abrio",
    categoria: "interno",
    nombre: "El cliente abrió la cotización",
    cuando:
      "La primera vez que el cliente abre el enlace de su oferta. Va al " +
      "asesor, no al cliente.",
    asunto: "{{cliente}} acaba de abrir {{numero}}",
    cuerpo: `{{contacto}} abrió la cotización {{numero}} ({{total}}) hace un momento.

Es el mejor momento para llamar: la tiene en la pantalla.

Vence el {{vence}}.`,
    boton: "Abrir la cotización en el portal",
    marcadores: [
      ...M_CLIENTE, ...M_OFERTA,
      { k: "{{vistas}}", ejemplo: "3" },
    ],
    nota: "Este correo lo recibe el ASESOR. No le llega nada al cliente.",
  },
  {
    clave: "aviso_aprobada",
    categoria: "interno",
    nombre: "El cliente aprobó la cotización",
    cuando: "Cuando el cliente pulsa Aprobar en su oferta. Va al asesor.",
    asunto: "¡{{cliente}} aprobó {{numero}}!",
    cuerpo: `{{contacto}} aprobó la cotización {{numero}} por {{total}}.

Ya se creó el pedido {{pedido}}. Revísalo, confírmale al cliente y coordina el anticipo.`,
    boton: "Ver el pedido",
    marcadores: [
      ...M_CLIENTE, ...M_OFERTA,
      { k: "{{pedido}}", ejemplo: "PED-00043" },
    ],
  },
  {
    clave: "aviso_visita_lista",
    categoria: "interno",
    nombre: "Producción entregó la visita técnica",
    cuando: "Cuando el coordinador entrega la visita. Va al asesor que la pidió.",
    asunto: "Visita técnica lista: {{numero}}",
    cuerpo: `Producción ya entregó la visita técnica de {{numero}} ({{cliente}}), con las medidas y la requisición de materiales.

La oportunidad volvió a pendiente de cotizar. Te toca cotizar en firme.`,
    boton: "Ver la visita",
    marcadores: [...M_CLIENTE, ...M_OFERTA],
  },
];

export const PLANTILLA_POR_CLAVE: Record<string, PlantillaCorreo> =
  Object.fromEntries(PLANTILLAS.map(p => [p.clave, p]));

/** Las claves con las que se guarda en `configuracion`. */
export const claveAsunto = (clave: string) => `correo_${clave}_asunto`;
export const claveCuerpo = (clave: string) => `correo_${clave}_cuerpo`;
export const claveBoton = (clave: string) => `correo_${clave}_boton`;

/**
 * Reemplaza los marcadores. Lo que no venga en `datos` se BORRA en vez
 * de quedarse escrito: es mejor una frase que cojea que un correo al
 * cliente que dice "{{total}}".
 */
export function aplicarMarcadores(texto: string, datos: Record<string, string | number | null | undefined>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
    const v = datos[k];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Marcadores que quedaron sin reemplazar. Sirve para avisar en la vista previa. */
export function marcadoresSueltos(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[0]))];
}
