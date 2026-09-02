// ============================================================
// Formato para la Selección de Proveedores y Contratistas.
//
// Es el formulario que vivía en Google Forms, con sus mismas preguntas y
// sus mismos porcentajes. No se cambió ninguno: son los criterios que la
// empresa ya acordó, y "mejorarlos" al traerlos habría hecho que las
// evaluaciones viejas y las nuevas no se puedan comparar.
//
// Por qué traerlo:
//
//   · En Forms las respuestas quedan en una hoja aparte. Para saber si un
//     proveedor está aprobado había que abrir otra pestaña y buscarlo a
//     mano — así que en la práctica nadie miraba.
//   · El puntaje se calculaba con una fórmula de hoja que nadie revisa.
//     Aquí sale solo, y siempre igual.
//   · El visto bueno de gerencia era un campo de texto en el que podía
//     escribir cualquiera que abriera el enlace.
// ============================================================

// ─────────────────────────────────────────────
// Los criterios, tal cual el formato
// ─────────────────────────────────────────────

/** Los cinco documentos que se revisan. Cada uno vale SI / NO / No aplica. */
export const DOCUMENTOS = [
  { clave: "rut_camara", texto: "Posee RUT y/o Cámara de Comercio vigente" },
  { clave: "certificacion_bancaria", texto: "Cuenta con certificación bancaria" },
  { clave: "sede_ciudad", texto: "Tiene sede o bodega en la ciudad" },
  { clave: "experiencia", texto: "Tiene experiencia en los materiales y/o servicio que va a prestar" },
  { clave: "sistema_gestion", texto: "Cuenta con sistema de gestión, políticas y/o lineamientos" },
] as const;

/**
 * SI vale 100, NO vale 0, y "No aplica" NO cuenta.
 *
 * Lo tercero importa: si "No aplica" valiera 0, marcarlo castigaría al
 * proveedor por algo que no le corresponde, y la gente aprendería a
 * marcar SI para no perjudicarlo. Sacándolo del promedio, decir la verdad
 * no cuesta nada.
 */
export const VALORES_DOCUMENTO = { SI: 100, NO: 0, NA: null } as const;
export type ValorDocumento = keyof typeof VALORES_DOCUMENTO;

export const TIEMPOS_ENTREGA = [
  { v: "INMEDIATA", l: "Inmediata", pct: 100 },
  { v: "DIAS_1_3", l: "De 1 a 3 días", pct: 90 },
  { v: "DIAS_4_7", l: "De 4 a 7 días", pct: 70 },
  { v: "MAS_7", l: "Más de 7 días", pct: 50 },
] as const;

export const OPCIONES_PAGO = [
  { v: "CONTADO", l: "Contado", pct: 70 },
  { v: "CREDITO_30", l: "Crédito 30 días", pct: 85 },
  { v: "CREDITO_45", l: "Crédito 45 días", pct: 90 },
  { v: "CREDITO_60", l: "Crédito 60 días", pct: 100 },
] as const;

export const TIPOS_PROVEEDOR = [
  { v: "NATURAL", l: "Persona natural" },
  { v: "JURIDICA", l: "Persona jurídica" },
] as const;

export interface RespuestaDocumento {
  clave: string;
  texto?: string;
  valor: ValorDocumento;
}

// ─────────────────────────────────────────────
// El puntaje
// ─────────────────────────────────────────────

export interface Puntaje {
  /** De 0 a 100, o null si no se contestó nada. */
  total: number | null;
  documentos: number | null;
  entrega: number | null;
  pago: number | null;
  /** Cuántos documentos se marcaron "no aplica". */
  noAplican: number;
  /** Los que salieron NO. Es lo que hay que pedirle al proveedor. */
  faltantes: string[];
}

/**
 * El puntaje total: promedio simple de los tres bloques.
 *
 * Simple y no ponderado a propósito. El formato de papel no dice pesos,
 * y repartirlos ahora sería inventar una política comercial desde el
 * código. Si gerencia decide que el tiempo de entrega pesa el doble, se
 * cambia aquí en una línea y queda escrito quién lo decidió.
 *
 * Un bloque sin contestar no arrastra el promedio hacia abajo: se
 * excluye. Una evaluación a medio llenar tiene que poder verse sin que
 * parezca que el proveedor sacó 30.
 */
export function calcularPuntaje(datos: {
  documentos?: RespuestaDocumento[];
  tiempoEntrega?: string | null;
  opcionPago?: string | null;
}): Puntaje {
  const docs = datos.documentos ?? [];

  const contados = docs.filter(d => d.valor === "SI" || d.valor === "NO");
  const noAplican = docs.filter(d => d.valor === "NA").length;
  const faltantes = docs
    .filter(d => d.valor === "NO")
    .map(d => d.texto || DOCUMENTOS.find(x => x.clave === d.clave)?.texto || d.clave);

  const pDocs = contados.length
    ? (contados.filter(d => d.valor === "SI").length / contados.length) * 100
    : null;

  const pEntrega = TIEMPOS_ENTREGA.find(t => t.v === datos.tiempoEntrega)?.pct ?? null;
  const pPago = OPCIONES_PAGO.find(o => o.v === datos.opcionPago)?.pct ?? null;

  const bloques = [pDocs, pEntrega, pPago].filter((x): x is number => x !== null);
  const total = bloques.length
    ? Math.round((bloques.reduce((a, b) => a + b, 0) / bloques.length) * 10) / 10
    : null;

  return {
    total,
    documentos: pDocs === null ? null : Math.round(pDocs * 10) / 10,
    entrega: pEntrega,
    pago: pPago,
    noAplican,
    faltantes,
  };
}

/**
 * Cómo se lee ese número.
 *
 * Los cortes son una propuesta, no una regla de la empresa: el formato no
 * los trae. Sirven para que la lista se pueda leer de un vistazo; la
 * decisión sigue siendo de gerencia, que es quien firma el visto bueno.
 */
export function lecturaPuntaje(total: number | null): {
  etiqueta: string; color: string; ayuda: string;
} {
  if (total === null) return { etiqueta: "Sin evaluar", color: "#94a3b8", ayuda: "Falta contestar el formato." };
  if (total >= 90) return { etiqueta: "Muy bueno", color: "#16a34a", ayuda: "Cumple con todo lo que se le pide." };
  if (total >= 75) return { etiqueta: "Aceptable", color: "#65a30d", ayuda: "Cumple, con algo pendiente." };
  if (total >= 60) return { etiqueta: "Con reparos", color: "#d97706", ayuda: "Le faltan cosas. Conviene pedírselas antes de contratar." };
  return { etiqueta: "No recomendado", color: "#dc2626", ayuda: "Le falta lo básico. Requiere una decisión expresa de gerencia." };
}

/** Las cinco filas en blanco, para abrir una evaluación nueva. */
export function documentosEnBlanco(): RespuestaDocumento[] {
  return DOCUMENTOS.map(d => ({ clave: d.clave, texto: d.texto, valor: "NA" as ValorDocumento }));
}
