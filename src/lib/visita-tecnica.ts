// ============================================================
// El formato de la visita técnica.
//
// Sale del archivo de la empresa "F. Visita tecnica.xlsx", que en
// realidad son DOS formatos distintos en una misma hoja: cerca eléctrica
// y malla invisible. Un cerramiento perimetral y un balcón no comparten
// ni una sola casilla.
//
// Por eso el formulario se describe aquí como DATOS y no como JSX: la
// pantalla del coordinador dibuja lo que diga esta lista, el PDF imprime
// lo mismo, y añadir una medida el día que producción la pida es agregar
// una línea — no tocar tres archivos y migrar la base.
//
// Los valores llenos viven en `VisitaTecnica.datos` (JSON), por lo mismo:
// una columna por casilla obligaría a una migración cada vez.
// ============================================================

export type TipoCampo = "texto" | "numero" | "si_no" | "area";

export interface CampoVisita {
  /** Clave dentro de `datos`. NO renombrar: queda escrita en la base. */
  k: string;
  label: string;
  tipo: TipoCampo;
  /** Unidad que se pinta a la derecha del número (m, cm, und…). */
  unidad?: string;
  ayuda?: string;
}

export interface SeccionVisita {
  id: string;
  titulo: string;
  /** Para qué producto es. La pantalla enseña solo lo que aplica. */
  aplica: "cerca" | "malla" | "comun";
  campos: CampoVisita[];
}

/**
 * Qué se mide en cada tipo de trabajo.
 *
 * `comun` sale siempre: es lo que hay que saber vaya el técnico a lo que
 * vaya (dónde queda, con quién se entiende, cómo se llega).
 */
export const SECCIONES_VISITA: SeccionVisita[] = [
  {
    id: "sitio",
    titulo: "El sitio",
    aplica: "comun",
    campos: [
      { k: "tipoInmueble", label: "Tipo de inmueble", tipo: "texto", ayuda: "Casa, edificio, bodega, lote…" },
      { k: "pisoUbicacion", label: "Piso o ubicación dentro del inmueble", tipo: "texto" },
      { k: "accesoVehiculo", label: "¿Entra vehículo hasta el sitio?", tipo: "si_no" },
      { k: "requierePermiso", label: "¿Hace falta permiso de administración?", tipo: "si_no" },
      { k: "horarioPermitido", label: "Horario en que dejan trabajar", tipo: "texto" },
    ],
  },

  // ── Cerca eléctrica ──
  {
    id: "muro",
    titulo: "El muro",
    aplica: "cerca",
    campos: [
      { k: "muroAltura", label: "Altura del muro", tipo: "numero", unidad: "m" },
      { k: "muroMaterial", label: "Material del muro", tipo: "texto", ayuda: "Bloque, ladrillo, concreto, malla…" },
      { k: "metrosLineales", label: "Metros lineales a cubrir", tipo: "numero", unidad: "m" },
      { k: "distanciaEntrePostes", label: "Distancia entre postes", tipo: "numero", unidad: "m" },
      { k: "esquinas", label: "Esquinas / cambios de dirección", tipo: "numero", unidad: "und" },
    ],
  },
  {
    id: "materiales_cerca",
    titulo: "Materiales de la cerca",
    aplica: "cerca",
    campos: [
      { k: "postes", label: "Postes", tipo: "numero", unidad: "und" },
      { k: "aisladores", label: "Aisladores", tipo: "numero", unidad: "und" },
      { k: "alambre", label: "Alambre", tipo: "numero", unidad: "m" },
      { k: "tapones", label: "Tapones", tipo: "numero", unidad: "und" },
      { k: "placas", label: "Placas de advertencia", tipo: "numero", unidad: "und" },
      { k: "cable", label: "Cable", tipo: "numero", unidad: "m" },
      { k: "tubosEmt", label: "Tubos EMT", tipo: "numero", unidad: "und" },
      { k: "acabado", label: "Acabado", tipo: "texto", ayuda: "Galvanizado, pintado, en color…" },
    ],
  },
  {
    id: "electrico",
    titulo: "Punto eléctrico",
    aplica: "cerca",
    campos: [
      { k: "hayPuntoElectrico", label: "¿Hay punto eléctrico disponible?", tipo: "si_no" },
      { k: "distanciaPunto", label: "Distancia del punto al energizador", tipo: "numero", unidad: "m" },
      { k: "ubicacionEnergizador", label: "Dónde va el energizador", tipo: "texto" },
      { k: "distanciaSirena", label: "Distancia a la sirena", tipo: "numero", unidad: "m" },
      { k: "puestaTierra", label: "¿Se puede hacer puesta a tierra?", tipo: "si_no" },
    ],
  },

  // ── Malla invisible / balcones ──
  {
    id: "balcon",
    titulo: "Balcón",
    aplica: "malla",
    campos: [
      { k: "balconAncho", label: "Ancho del balcón", tipo: "numero", unidad: "m" },
      { k: "balconAlto", label: "Alto del balcón", tipo: "numero", unidad: "m" },
      { k: "balconTieneVidrio", label: "¿Tiene vidrio?", tipo: "si_no" },
      { k: "balconMaterialSuperior", label: "Material de la parte superior", tipo: "texto",
        ayuda: "De ahí depende con qué se ancla: concreto, drywall, madera, metal…" },
      { k: "balconObservaciones", label: "Observaciones del balcón", tipo: "area" },
    ],
  },
  {
    id: "ventanas",
    titulo: "Ventanas",
    aplica: "malla",
    campos: [
      { k: "ventanasCantidad", label: "Cuántas ventanas", tipo: "numero", unidad: "und" },
      { k: "ventanasMedidas", label: "Medidas de cada ventana", tipo: "area",
        ayuda: "Una por línea: 1,20 × 1,00 · 0,80 × 0,60…" },
      { k: "ventanasTieneVidrio", label: "¿Tienen vidrio?", tipo: "si_no" },
      { k: "ventanasMaterialSuperior", label: "Material de la parte superior", tipo: "texto" },
    ],
  },

  {
    id: "cierre",
    titulo: "Cierre de la visita",
    aplica: "comun",
    campos: [
      { k: "tiempoEstimado", label: "Tiempo estimado de ejecución", tipo: "texto", ayuda: "Ej: 2 días, 1 cuadrilla" },
      { k: "personasRequeridas", label: "Personas necesarias", tipo: "numero", unidad: "und" },
      { k: "trabajoEnAlturas", label: "¿Hay trabajo en alturas?", tipo: "si_no",
        ayuda: "Si es que sí, el trabajo necesita el proceso de SG-SST." },
      { k: "riesgosDetectados", label: "Riesgos detectados", tipo: "area" },
      { k: "recomendaciones", label: "Recomendaciones al vendedor", tipo: "area" },
    ],
  },
];

/** Las secciones que aplican a un tipo de trabajo. */
export function seccionesDe(tipo: "cerca" | "malla" | "ambos"): SeccionVisita[] {
  if (tipo === "ambos") return SECCIONES_VISITA;
  return SECCIONES_VISITA.filter(s => s.aplica === "comun" || s.aplica === tipo);
}

// ─────────────────────────────────────────────
// Requisición de materiales y herramientas
// ─────────────────────────────────────────────

/**
 * Lo que producción entrega al volver de la visita, del formato
 * "FORMATO REQUISICION DE MATERIALES Y HERRAMIENTAS.xlsx".
 */
export interface Requisicion {
  proyecto?: string;
  ubicacion?: string;
  responsable?: string;
  descripcion?: string;
  tiempoEjecucion?: string;
  materiales?: LineaRequisicion[];
  herramientas?: LineaRequisicion[];
  especiales?: string;
}

export interface LineaRequisicion {
  cantidad: number | string;
  detalle: string;
  unidad?: string;
}

export const REQUISICION_VACIA: Requisicion = {
  proyecto: "", ubicacion: "", responsable: "", descripcion: "",
  tiempoEjecucion: "", materiales: [], herramientas: [], especiales: "",
};

// ─────────────────────────────────────────────
// SG-SST
// ─────────────────────────────────────────────

export interface TipoDocumentoSgsst {
  k: string;
  label: string;
  /** Por qué se pide. Sale como ayuda en la pantalla. */
  ayuda: string;
}

/**
 * Los documentos que se le piden a cada persona.
 *
 * Son casillas OPCIONALES: no todo trabajador necesita certificado de
 * alturas, y marcar como obligatorio lo que no aplica solo consigue que
 * la gente marque cualquier cosa para poder seguir.
 */
export const DOCUMENTOS_SGSST: TipoDocumentoSgsst[] = [
  { k: "cedula", label: "Cédula", ayuda: "Copia por ambas caras." },
  { k: "planilla", label: "Planilla de seguridad social", ayuda: "Del mes en que se ejecuta el trabajo." },
  { k: "alturas", label: "Certificado de trabajo en alturas", ayuda: "Solo si va a trabajar por encima de 1,50 m." },
  { k: "arl", label: "Afiliación a ARL", ayuda: "Con el nivel de riesgo del trabajo." },
  { k: "eps", label: "Afiliación a EPS", ayuda: "" },
  { k: "examenes", label: "Exámenes médicos ocupacionales", ayuda: "Con concepto de aptitud vigente." },
  { k: "induccion", label: "Inducción de seguridad", ayuda: "Constancia de la charla previa a la obra." },
];

export const ROLES_SGSST = [
  { v: "TRABAJADOR", l: "Trabajador" },
  { v: "COORD_SST", l: "Coordinador SST" },
  { v: "COORD_ALTURAS", l: "Coordinador de alturas" },
] as const;

export const etiquetaRolSgsst = (rol: string) =>
  ROLES_SGSST.find(r => r.v === rol)?.l ?? rol;
