// ============================================================
// Dónde se guardan los documentos de SG-SST.
//
// Hoy: EN NINGUNA PARTE, y eso es una decisión, no un olvido.
//
// Son datos personales de terceros —cédulas, planillas de seguridad
// social, exámenes médicos— y los dos sitios donde el portal sabe subir
// archivos hoy no sirven para esto:
//
//   · El FTP de Hostinger está roto (ver §10.1 de CONTEXTO-IA).
//   · La biblioteca de WordPress es PÚBLICA: cualquiera con la URL abre
//     el archivo, y las URLs de WordPress son adivinables. Subir ahí la
//     cédula de un trabajador sería una fuga de datos personales, no un
//     atajo.
//
// Gerencia decidió esperar a la migración al VPS de Hostinger, donde
// habrá disco privado. Mientras tanto se registra QUÉ documento se
// entregó, cuándo y quién lo entregó —que es lo que hace falta para
// saber si el trabajador puede entrar a la obra— y la pantalla dice con
// todas las letras que el archivo NO se está guardando.
//
// Esto NO es simular que funciona: es guardar el registro y avisar de lo
// que falta. Un portal que dijera "documento cargado ✓" sin haber
// guardado nada sería mucho peor que uno que dice la verdad.
//
// **Cuando llegue el VPS**: escribir un driver `disco` que implemente
// `Almacenamiento`, cambiar `ALMACENAMIENTO_ACTIVO` y ya. Los registros
// que existan seguirán marcados con `almacenado: false`, así se sabrá
// exactamente cuáles hay que volver a pedir.
// ============================================================

export interface DocumentoRegistrado {
  /** Clave de `DOCUMENTOS_SGSST`. */
  tipo: string;
  nombreArchivo: string;
  tamano: number;
  subidoEn: string;
  subidoPorId: string | null;
  /** ¿El archivo está guardado de verdad? Hoy siempre false. */
  almacenado: boolean;
  /** Si no está guardado, por qué. Se muestra en pantalla. */
  motivo?: string;
  /** Ruta o id en el almacén, cuando lo haya. */
  ref?: string;
}

export interface Almacenamiento {
  nombre: string;
  /** ¿Guarda el archivo de verdad? */
  guardaArchivos: boolean;
  /** Por qué no, si no. */
  motivo?: string;
  guardar(
    archivo: { nombre: string; tamano: number; contenido?: Buffer },
    contexto: { cotizacionId: string; personaId: string; tipo: string },
  ): Promise<{ almacenado: boolean; ref?: string; motivo?: string }>;
}

/**
 * El de hoy: registra y no guarda.
 *
 * Devuelve `almacenado: false` con el motivo, que es lo que la API
 * escribe en la fila y lo que la pantalla enseña.
 */
export const almacenamientoPendiente: Almacenamiento = {
  nombre: "pendiente-vps",
  guardaArchivos: false,
  motivo:
    "El archivo todavía no se guarda: son datos personales y el portal " +
    "aún no tiene almacenamiento privado. Queda el registro de que se " +
    "entregó; guárdalo tú por ahora.",
  async guardar() {
    return {
      almacenado: false,
      motivo: almacenamientoPendiente.motivo,
    };
  },
};

/**
 * El almacén activo. Cambiar esta línea el día que haya disco privado.
 */
export const ALMACENAMIENTO_ACTIVO: Almacenamiento = almacenamientoPendiente;

/** Aviso para la pantalla, en una sola línea. Null = todo bien. */
export function avisoDeAlmacenamiento(): string | null {
  return ALMACENAMIENTO_ACTIVO.guardaArchivos ? null : (ALMACENAMIENTO_ACTIVO.motivo ?? null);
}
