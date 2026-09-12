// ============================================================
// Los servicios de instalación, también como productos.
//
// POR QUÉ
// -------
// La mano de obra —instalar una malla, mantener un cerramiento— se
// cotiza igual que un producto: tiene nombre, unidad y precio. Pero
// vivía en su propio catálogo (Configuración → Instalación), así que en
// el cotizador solo aparecía como unos botones aparte y NO salía al
// buscar. Quien cotiza no distingue entre "producto" y "servicio": pone
// lo que va en la oferta.
//
// UNA SOLA FUENTE DE LA VERDAD
// ----------------------------
// El servicio sigue siendo el original y el producto se DERIVA de él.
// Podría haberse hecho al revés —migrarlos y borrar la tabla— pero los
// servicios tienen cosas que un producto no: el mínimo facturable y a
// qué categorías aplican, que es lo que permite sugerir solo lo que
// tiene sentido con lo ya cotizado.
//
// Así que se copian, y se vuelven a copiar cada vez que alguien los
// edita. El precio se cambia en UN sitio: Configuración → Instalación.
// Dos sitios para editar el mismo precio es como quedan distintos.
//
// ⚠️ NUNCA SE PUBLICAN EN LA TIENDA. Nacen con `publicado: false` y sin
// `intListoExportar`, así que la sincronización con WooCommerce ni los
// mira: cobrar mano de obra por la web es otra conversación, y que un
// servicio aparezca en costamallas.com por accidente sería un problema
// comercial, no un detalle técnico.
// ============================================================

import { prisma } from "@/lib/prisma";
import { EstadoProducto } from "@prisma/client";

/** La categoría donde viven. Sale en el selector del producto. */
export const CATEGORIA_SERVICIOS = "servicios";

/** Prefijo del SKU. Hace obvio de un vistazo que no es material. */
const PREFIJO_SKU = "SERV-";

export interface ResultadoServicios {
  creados: string[];
  actualizados: string[];
  archivados: string[];
  errores: string[];
}

/**
 * El SKU de un servicio, derivado de su id.
 *
 * Se usa el id y no el nombre porque el nombre cambia —«INSTALACION DE
 * GRAMA» puede pasar a «Instalación de grama»— y si el SKU cambiara con
 * él, cada renombrado crearía un producto nuevo en vez de actualizar el
 * que ya estaba, dejando duplicados en las cotizaciones viejas.
 */
export function skuDeServicio(servicioId: string): string {
  return PREFIJO_SKU + servicioId.slice(-8).toUpperCase();
}

function slugDe(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Crea o actualiza un producto por cada servicio activo.
 *
 * Es idempotente: correrlo dos veces no duplica nada. Se llama al
 * guardar la configuración de instalación y se puede correr a mano.
 */
export async function sincronizarServiciosComoProductos(): Promise<ResultadoServicios> {
  const r: ResultadoServicios = { creados: [], actualizados: [], archivados: [], errores: [] };

  const servicios = await prisma.servicioInstalacion.findMany({
    orderBy: { orden: "asc" },
  });

  for (const s of servicios) {
    const sku = skuDeServicio(s.id);
    try {
      const existente = await prisma.producto.findUnique({
        where: { sku },
        select: { id: true },
      });

      // Un servicio desactivado no se borra: se archiva. Borrarlo
      // rompería las cotizaciones que ya lo llevan.
      if (!s.activo) {
        if (existente) {
          await prisma.producto.update({
            where: { id: existente.id },
            data: { intEstado: EstadoProducto.ARCHIVADO, publicado: false },
          });
          r.archivados.push(s.nombre);
        }
        continue;
      }

      const datos = {
        nombre: s.nombre,
        descripcion: s.descripcion ?? "",
        descCorta: s.descripcion?.slice(0, 160) ?? "",
        precioNormal: s.precioBase,
        categorias: [CATEGORIA_SERVICIOS],
        acfUnidadVenta: s.unidad,
        // Mano de obra: no hay nada que contar en bodega, y un servicio
        // con "stock 0" se vería como agotado en las pantallas.
        stock: 0,
        stockMinimo: 0,
        // Las tres cosas que lo mantienen fuera de la tienda.
        publicado: false,
        intListoExportar: false,
        // El enum no tiene ACTIVO. LISTO es "terminado pero sin publicar",
        // que es exactamente lo que es un servicio.
        intEstado: EstadoProducto.LISTO,
      };

      // Los arreglos de la ficha tecnica son obligatorios en el esquema y
      // no tienen valor por defecto: sin esto, crear el producto falla con
      // "Null constraint violation". Un servicio no tiene normas ni
      // colores, asi que van vacios — que es distinto de nulo.
      const arreglosVacios = {
        etiquetas: [] as string[],
        acfAplicaciones: [] as string[],
        acfColores: [] as string[],
        acfNormas: [] as string[],
        acfCertificaciones: [] as string[],
      };

      if (existente) {
        await prisma.producto.update({ where: { id: existente.id }, data: datos });
        r.actualizados.push(s.nombre);
      } else {
        await prisma.producto.create({
          data: { ...datos, ...arreglosVacios, sku, slug: slugDe(s.nombre) || sku.toLowerCase() },
        });
        r.creados.push(s.nombre);
      }
    } catch (e) {
      r.errores.push(`${s.nombre}: ${(e as Error).message}`);
    }
  }

  return r;
}
