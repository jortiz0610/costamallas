// ============================================================
// Qué imágenes se aceptan. Escrito UNA vez.
//
// El límite y la lista de tipos estaban en dos sitios: en la ruta que
// recibe el archivo y en la galería que lo elige. Dos copias de la misma
// regla es una regla que tarde o temprano dice cosas distintas en cada
// lado — y el síntoma sería el peor posible: el navegador acepta la foto,
// la sube entera, y el servidor la rechaza al final.
//
// Aquí está una vez y la usan los dos.
// ============================================================

/** Lo que pesa como máximo una imagen de producto. */
export const MAX_IMAGEN_MB = 20;

export const MAX_IMAGEN_BYTES = MAX_IMAGEN_MB * 1024 * 1024;

/** Los formatos que la tienda sabe mostrar. */
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Para el texto de ayuda debajo del recuadro de subir. */
export const TIPOS_IMAGEN_LEGIBLE = "JPG, PNG, WEBP";

/**
 * Por qué NO se acepta este archivo, o null si sí se acepta.
 *
 * Devuelve la frase ya escrita: quien la llama no tiene que volver a
 * decidir cómo se cuenta, y el aviso es el mismo se rechace donde se
 * rechace.
 */
export function motivoRechazoImagen(
  archivo: { name: string; type: string; size: number },
): string | null {
  if (!TIPOS_IMAGEN.includes(archivo.type)) {
    return `${archivo.name}: no es una imagen (${TIPOS_IMAGEN_LEGIBLE})`;
  }
  if (archivo.size > MAX_IMAGEN_BYTES) {
    // Se dice cuánto pesa, no solo que pesa de más: así se sabe si hay
    // que recortarla un poco o si es otra foto la que hay que buscar.
    //
    // Se redondea hacia ARRIBA. Con redondeo normal, un archivo de 20,02
    // MB se anunciaba como "pesa 20.0 MB y el máximo son 20 MB", que se
    // lee como un error del portal en vez de como un archivo pasado.
    const mb = (Math.ceil((archivo.size / 1024 / 1024) * 10) / 10).toFixed(1);
    return `${archivo.name}: pesa ${mb} MB y el máximo son ${MAX_IMAGEN_MB} MB`;
  }
  return null;
}
