// ============================================================
// La foto de cada ítem de la cotización.
//
// El documento SIEMPRE reserva la columna de la miniatura (en EXPRESS y
// en PROPUESTA), así que un ítem sin foto sale con la trama rayada. Lo
// que fallaba era el dato, no la plantilla.
//
// Medido contra producción el 28-ago: de 27 ítems, 19 sin `imagenUrl`.
// Dos causas distintas, y solo una es un fallo del portal:
//
//   · 13 apuntan a productos que NO tienen ninguna foto en el catálogo
//     (los 113 productos de la lista de precios de agosto). Ahí no hay
//     nada que arreglar en el código: falta la foto.
//   · 3 apuntan a productos que SÍ tienen fotos —5 y 4 respectivamente—
//     y aun así se guardaron sin URL. Esos ítems se crearon por un
//     camino que no copiaba la foto. Ese sí es el fallo.
//
// Se arregla por los dos lados:
//   1. Al GUARDAR: si el ítem trae producto y no trae foto, el servidor
//      la busca. Así las cotizaciones nuevas nacen bien.
//   2. Al MOSTRAR: esta función rellena lo que falte. Es lo que hace que
//      las 20 cotizaciones que ya existen muestren la foto sin tener que
//      reescribirlas.
//
// La foto se sigue COPIANDO al ítem al guardar, no se resuelve siempre
// al vuelo: una oferta enviada no debe cambiar de aspecto porque alguien
// haya cambiado la foto del producto después.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface ItemConFoto {
  productoId?: string | null;
  imagenUrl?: string | null;
}

/**
 * Un ítem tal como se escribe en la base. Se declara aquí porque el
 * cuerpo de la petición llega sin tipo (`any`), y sin esto TypeScript
 * infiere el genérico como `ItemConFoto` y pierde el resto de campos.
 */
export interface ItemGuardable extends ItemConFoto {
  productoId: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  unidad: string | null;
  tipo: string;
  imagenUrl: string | null;
  detalle: string | null;
  orden: number;
}

/**
 * Devuelve, para los productos que se le pidan, su foto principal.
 * Una sola consulta, no una por ítem.
 */
export async function fotosPrincipales(productoIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(productoIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const imagenes = await prisma.acfImagen.findMany({
    where: { productoId: { in: ids } },
    select: { productoId: true, urlImagen: true, esPrincipal: true, posicion: true },
    orderBy: [{ esPrincipal: "desc" }, { posicion: "asc" }],
  });

  const mapa = new Map<string, string>();
  for (const img of imagenes) {
    // La primera que llega de cada producto gana: el orden ya pone la
    // principal delante.
    if (!mapa.has(img.productoId)) mapa.set(img.productoId, img.urlImagen);
  }
  return mapa;
}

/**
 * Rellena `imagenUrl` en los ítems a los que les falte y que apunten a un
 * producto con foto. Los demás se devuelven tal cual: un ítem de
 * instalación no tiene producto, y un producto sin fotos sigue sin foto.
 */
export async function completarFotos<T extends ItemConFoto>(items: T[]): Promise<T[]> {
  const faltan = items.filter(i => !i.imagenUrl && i.productoId);
  if (faltan.length === 0) return items;

  const mapa = await fotosPrincipales(faltan.map(i => i.productoId!));
  if (mapa.size === 0) return items;

  return items.map(i =>
    !i.imagenUrl && i.productoId && mapa.has(i.productoId)
      ? ({ ...i, imagenUrl: mapa.get(i.productoId)! } as T)
      : i,
  );
}

/**
 * Igual, pero para el momento de GUARDAR: recibe los ítems que manda el
 * navegador y les pone la foto que falte antes de escribirlos.
 */
export async function conFotoDelCatalogo<T extends ItemConFoto>(items: T[]): Promise<T[]> {
  return completarFotos(items);
}
