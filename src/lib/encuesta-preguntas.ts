// ============================================================
// Las preguntas de la encuesta.
//
// Archivo aparte y SIN imports a propósito: lo usa la página pública,
// que es un componente de navegador. Tenerlas junto a la lógica de
// servidor arrastraba `node:crypto` y Prisma al bundle del cliente, y el
// build se caía con "Reading from node:crypto is not handled".
//
// Salen del "Formato Valoración de cliente" de la empresa, que hasta hoy
// se llenaba en papel. No se inventó ninguna ni se quitó ninguna.
// ============================================================

export interface Pregunta {
  /** La columna donde se guarda. */
  campo: "recomendaria" | "calidad" | "precio" | "profesionalidad" | "atencion" | "puntualidad" | "limpieza" | "recompra";
  texto: string;
  /** Debajo del texto, en gris. Para desambiguar sin alargar la pregunta. */
  ayuda?: string;
  /** Qué significan los extremos de la escala. */
  bajo: string;
  alto: string;
}

/**
 * El NPS va primero y solo. Es la pregunta que de verdad se compara
 * entre meses, y ponerla en medio de otras siete la convierte en una
 * más.
 */
export const PREGUNTA_NPS: Pregunta = {
  campo: "recomendaria",
  texto: "¿Con qué probabilidad nos recomendaría a un conocido?",
  bajo: "Nada probable",
  alto: "Muy probable",
};

/** Los seis puntajes del formato, en su orden. */
export const PREGUNTAS_SATISFACCION: Pregunta[] = [
  { campo: "calidad", texto: "Calidad de los productos y servicios", bajo: "Mala", alto: "Excelente" },
  { campo: "precio", texto: "Relación calidad-precio", ayuda: "Si lo que recibió vale lo que pagó.", bajo: "Mala", alto: "Excelente" },
  { campo: "profesionalidad", texto: "Profesionalidad del equipo", bajo: "Baja", alto: "Alta" },
  { campo: "atencion", texto: "Atención recibida", ayuda: "Desde la primera llamada hasta la entrega.", bajo: "Mala", alto: "Excelente" },
  { campo: "puntualidad", texto: "Puntualidad y rapidez", bajo: "Lenta", alto: "Puntual" },
  { campo: "limpieza", texto: "Limpieza y orden al terminar", bajo: "Mala", alto: "Impecable" },
];

export const PREGUNTA_RECOMPRA: Pregunta = {
  campo: "recompra",
  texto: "¿Volvería a contratarnos?",
  bajo: "No lo creo",
  alto: "Con seguridad",
};

export const TODAS_LAS_PREGUNTAS = [PREGUNTA_NPS, ...PREGUNTAS_SATISFACCION, PREGUNTA_RECOMPRA];
