// ============================================================
// El horario de atención, y por qué los correos lo respetan.
//
// Un seguimiento que sale a las 11 de la noche del sábado llega cuando
// nadie lo va a leer, y para cuando el cliente abre el correo el lunes
// ya está enterrado bajo otros veinte. Peor: si contesta a esa hora, no
// hay nadie para responderle, y la sensación que queda es la contraria
// de la que se buscaba.
//
// Así que cuando toca mandar algo fuera de horario, se espera al
// siguiente momento hábil. No se pierde: se corre.
//
// ── El horario ──
//
// El de la cartelera de la empresa:
//
//   Lunes a jueves · 8:00–12:30 y 13:30–17:00
//   Viernes        · 8:00–12:30 y 13:30–16:00
//   Sábados        · 9:00–12:00
//   Domingos       · cerrado
//
// Está aquí y no en la base porque es el horario de la puerta, no una
// preferencia: si cambia, cambia el letrero y cambia esto, y las dos
// cosas se hacen a la vez. Tenerlo en Configuración invitaba a que se
// desincronizaran.
//
// ── La zona horaria ──
//
// Todo esto vive en horario de Bogotá (UTC-5, sin cambio de hora). El
// servidor corre en UTC, así que comparar horas sin convertir daría
// resultados desplazados cinco horas — que es justo el ancho de media
// jornada.
// ============================================================

/** Bogotá no tiene horario de verano, así que el desfase es constante. */
const OFFSET_BOGOTA = -5;

export interface Tramo {
  /** Minutos desde medianoche. 8:00 = 480. */
  desde: number;
  hasta: number;
}

const hm = (h: number, m = 0) => h * 60 + m;

/** Índice: 0 = domingo, 6 = sábado. Igual que `getDay()`. */
export const HORARIO: Tramo[][] = [
  [],                                              // domingo
  [{ desde: hm(8), hasta: hm(12, 30) }, { desde: hm(13, 30), hasta: hm(17) }], // lunes
  [{ desde: hm(8), hasta: hm(12, 30) }, { desde: hm(13, 30), hasta: hm(17) }], // martes
  [{ desde: hm(8), hasta: hm(12, 30) }, { desde: hm(13, 30), hasta: hm(17) }], // miércoles
  [{ desde: hm(8), hasta: hm(12, 30) }, { desde: hm(13, 30), hasta: hm(17) }], // jueves
  [{ desde: hm(8), hasta: hm(12, 30) }, { desde: hm(13, 30), hasta: hm(16) }], // viernes
  [{ desde: hm(9), hasta: hm(12) }],               // sábado
];

/** El horario, escrito para una persona. Se usa en los correos. */
export const HORARIO_TEXTO = [
  "Lunes a jueves: 8:00 a. m. – 12:30 p. m. y 1:30 – 5:00 p. m.",
  "Viernes: 8:00 a. m. – 12:30 p. m. y 1:30 – 4:00 p. m.",
  "Sábados: 9:00 a. m. – 12:00 m.",
].join("\n");

/** Una fecha UTC, leída como si fuera un reloj de Bogotá. */
function enBogota(d: Date): { dia: number; minutos: number } {
  const b = new Date(d.getTime() + OFFSET_BOGOTA * 3_600_000);
  return {
    dia: b.getUTCDay(),
    minutos: b.getUTCHours() * 60 + b.getUTCMinutes(),
  };
}

/** Construye un instante a partir de un día de Bogotá y unos minutos. */
function desdeBogota(base: Date, sumarDias: number, minutos: number): Date {
  const b = new Date(base.getTime() + OFFSET_BOGOTA * 3_600_000);
  b.setUTCDate(b.getUTCDate() + sumarDias);
  b.setUTCHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  return new Date(b.getTime() - OFFSET_BOGOTA * 3_600_000);
}

/** ¿Estamos abiertos en este instante? */
export function esHabil(fecha: Date = new Date()): boolean {
  const { dia, minutos } = enBogota(fecha);
  return HORARIO[dia].some(t => minutos >= t.desde && minutos < t.hasta);
}

/**
 * El siguiente momento en que hay alguien.
 *
 * Si ya lo hay, devuelve la misma fecha: lo que está a tiempo sale a
 * tiempo, no se retrasa hasta un múltiplo de nada.
 *
 * Mira hasta ocho días por delante. Con un solo domingo cerrado bastaría
 * con dos, pero si algún día se cierra una semana entera esto sigue
 * dando una respuesta en vez de un bucle.
 */
export function proximoHabil(fecha: Date = new Date()): Date {
  if (esHabil(fecha)) return fecha;

  const { dia, minutos } = enBogota(fecha);

  // ¿Queda algún tramo hoy? (Estamos en el almuerzo, o antes de abrir.)
  for (const t of HORARIO[dia]) {
    if (minutos < t.desde) return desdeBogota(fecha, 0, t.desde);
  }

  // Si no, el primer tramo del próximo día que abra.
  for (let n = 1; n <= 8; n++) {
    const siguiente = (dia + n) % 7;
    const tramos = HORARIO[siguiente];
    if (tramos.length) return desdeBogota(fecha, n, tramos[0].desde);
  }

  // Inalcanzable salvo que se cierre la empresa entera. Se devuelve la
  // fecha original en vez de lanzar: un correo tarde es mejor que una
  // corrida diaria que revienta.
  return fecha;
}

/**
 * ¿Ya se puede mandar algo que estaba previsto para `previsto`?
 *
 * Es la pregunta que hace la corrida diaria: "esto tocaba ayer, ¿lo
 * mando?". La respuesta es sí cuando ya pasó la hora prevista **y**
 * estamos en horario.
 *
 * Con esto, un seguimiento que cumplía sus 24 horas el sábado a las 11
 * de la noche sale el lunes a las 8, no el sábado de madrugada.
 */
export function toca(previsto: Date, ahora: Date = new Date()): boolean {
  if (ahora < previsto) return false;
  return esHabil(ahora);
}

/**
 * Cuándo va a salir de verdad algo previsto para `previsto`.
 *
 * Sirve para decirlo en pantalla: "se envía el lunes a las 8:00" es una
 * frase que evita la llamada de "¿por qué no ha salido?".
 */
export function cuandoSaldra(previsto: Date): Date {
  return proximoHabil(previsto);
}

/** "el lunes a las 8:00 a. m." — para meterlo en una frase. */
export function describirCuando(fecha: Date): string {
  return fecha.toLocaleString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota",
  });
}
