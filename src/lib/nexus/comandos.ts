// ============================================================
// Los comandos del chat: `/` para atajos y `@mallita` para la IA.
//
// Por qué comandos y no más botones: la barra de escribir ya tiene
// cámara, archivo, micrófono y enviar. Cada atajo nuevo que fuera un
// botón dejaría menos sitio para lo único que importa ahí, que es el
// texto. Escribiendo `/` aparecen todos y se eligen con el teclado, sin
// soltar las manos.
//
// `@mallita` es lo mismo para la IA: en vez de un botón permanente que
// cuesta dinero cada vez que alguien lo toca por curiosidad, se escribe
// cuando de verdad hace falta ayuda.
//
// Este archivo es cálculo puro: qué comandos hay y cómo se interpreta lo
// escrito. Quién puede usarlos y cuánto lo decide el servidor.
// ============================================================

export interface Comando {
  /** Sin la barra. */
  nombre: string;
  descripcion: string;
  /** Lo que se escribe después, si lleva algo. */
  argumento?: string;
  /** Solo tiene sentido en el chat con clientes. */
  soloClientes?: boolean;
}

export const COMANDOS: Comando[] = [
  {
    nombre: "plantilla",
    descripcion: "Insertar una respuesta preescrita",
    argumento: "nombre",
    soloClientes: true,
  },
  {
    nombre: "cotizacion",
    descripcion: "Pegar el enlace de una cotización",
    argumento: "número",
    soloClientes: true,
  },
  {
    nombre: "producto",
    descripcion: "Buscar un producto y pegar su ficha",
    argumento: "nombre o SKU",
  },
  {
    nombre: "cliente",
    descripcion: "Guardar a quien escribe como cliente del CRM",
    soloClientes: true,
  },
  {
    nombre: "ia",
    descripcion: "Pedirle a Mallita que redacte la respuesta",
  },
];

/** La palabra que despierta a la IA dentro del texto. */
export const MENCION_IA = "@mallita";

/**
 * Qué está escribiendo la persona ahora mismo.
 *
 * Solo cuenta como comando si la barra abre el mensaje: un `/` en mitad
 * de una frase —"2/4 pulgadas"— no debe abrir el menú.
 */
export function leerEntrada(texto: string): {
  esComando: boolean;
  nombre: string;
  argumento: string;
  llamaALaIA: boolean;
} {
  const llamaALaIA = texto.toLowerCase().includes(MENCION_IA);

  if (!texto.startsWith("/")) {
    return { esComando: false, nombre: "", argumento: "", llamaALaIA };
  }
  const sinBarra = texto.slice(1);
  const espacio = sinBarra.indexOf(" ");
  return {
    esComando: true,
    nombre: (espacio === -1 ? sinBarra : sinBarra.slice(0, espacio)).toLowerCase(),
    argumento: espacio === -1 ? "" : sinBarra.slice(espacio + 1).trim(),
    llamaALaIA,
  };
}

/** Los comandos que encajan con lo escrito, para el menú. */
export function sugerir(nombre: string, conClientes: boolean): Comando[] {
  return COMANDOS
    .filter(c => conClientes || !c.soloClientes)
    .filter(c => !nombre || c.nombre.startsWith(nombre));
}

/** Lo que queda del mensaje al quitarle la mención a la IA. */
export function sinMencion(texto: string): string {
  return texto.replace(new RegExp(MENCION_IA, "gi"), "").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────
// El cupo diario de IA
// ─────────────────────────────────────────────

/**
 * Cuántas veces al día puede una persona pedirle ayuda a la IA.
 *
 * Existe porque cada llamada cuesta, y el gasto de un chat no lo ve
 * nadie hasta que llega la factura. Es un tope por PERSONA y por día, no
 * global: un tope global se lo come el primero que llegue y deja al
 * resto del equipo sin la herramienta a media mañana.
 */
export const CUPO_IA_POR_DEFECTO = 30;

export const CLAVE_CUPO_IA = "nexus_cupo_ia_diario";

/** La clave donde se lleva la cuenta del día de una persona. */
export function claveUsoIA(usuarioId: string, dia = new Date()): string {
  const iso = dia.toISOString().slice(0, 10);
  return `nexus_uso_ia:${usuarioId}:${iso}`;
}
