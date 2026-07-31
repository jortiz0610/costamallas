// ============================================================
// Sincronización puntual con la tienda
//
// Al guardar un producto ya se sincronizaba automáticamente, pero las
// operaciones sobre imágenes (subir, reordenar, borrar) NO disparaban
// nada: la galería quedaba correcta en el ERP y desactualizada en
// costamallas.com hasta el siguiente guardado o el cron diario.
//
// Este helper centraliza ese "empujón" para poder llamarlo desde
// cualquier ruta que cambie algo visible en la tienda.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getWCCredentials, syncProductosToWC } from "@/lib/woocommerce";

export interface ResultadoSync {
  estado: "ok" | "error" | "omitido";
  error?: string;
  aviso?: string;
}

/**
 * Sincroniza un producto con WooCommerce si tiene sentido hacerlo.
 *
 * Se omite (sin error) cuando el producto no está publicado ni existe aún
 * en la tienda: sincronizar un borrador lo publicaría antes de tiempo.
 *
 * NUNCA lanza excepción: un fallo de la tienda no debe tumbar la
 * operación del ERP. Si la imagen se guardó bien, se guardó bien; el
 * estado del sync se devuelve para poder avisarlo en la interfaz.
 */
export async function sincronizarProducto(productoId: string): Promise<ResultadoSync> {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { publicado: true, wcId: true },
    });
    if (!producto) return { estado: "omitido", aviso: "El producto ya no existe." };
    if (!producto.publicado && !producto.wcId) {
      return { estado: "omitido", aviso: "El producto no está publicado en la tienda." };
    }

    const creds = await getWCCredentials();
    if (!creds) {
      return { estado: "omitido", aviso: "WooCommerce no está configurado." };
    }

    const r = await syncProductosToWC([productoId], creds);
    if (r.failed > 0) return { estado: "error", error: r.errors[0]?.error };
    return { estado: "ok", aviso: r.avisos[0]?.aviso };
  } catch (e) {
    console.error("[sync-tienda]", e);
    return { estado: "error", error: e instanceof Error ? e.message : String(e) };
  }
}
