// ============================================================
// La cola de revisión del SEO: generar en lote y aprobar de a uno.
//
// ⚠️ Lo que hay que entender antes de tocar esto: **aprobar publica**.
// Guardar el SEO de un producto que está en la tienda dispara la
// sincronización con WooCommerce, así que el texto sale a
// costamallas.com. Por eso la IA no escribe nunca directo: deja una
// propuesta, y una persona la lee antes.
//
// El lote se procesa en tandas cortas y no de un tirón porque la
// función de Vercel se corta al minuto. Quien llama vuelve a pedir
// hasta que no queden pendientes.
// ============================================================

import { prisma } from "@/lib/prisma";
import { generarSeoDeProducto } from "@/lib/seo-ia";
import { sincronizarProducto } from "@/lib/sync-tienda";

export const ESTADOS = ["PROPUESTO", "APROBADO", "RECHAZADO", "ERROR"] as const;
export type EstadoPropuesta = (typeof ESTADOS)[number];

export interface ResultadoTanda {
  loteId: string;
  procesados: number;
  ok: number;
  fallidos: number;
  costoUSD: number;
  /** Cuántos del lote pedido quedan sin procesar. */
  restantes: number;
  detalle: { productoId: string; sku: string; ok: boolean; error?: string }[];
}

/**
 * Genera el SEO de unos cuantos productos y lo deja en la cola.
 *
 * Un producto que falla NO detiene el lote: se guarda su propuesta en
 * estado ERROR con el motivo y se sigue. Con 175 productos, que el
 * número 12 se caiga y arrastre a los otros 163 sería absurdo.
 *
 * Si un producto ya tenía una propuesta sin revisar, se reemplaza: la
 * vieja nunca llegó a la tienda y tener dos versiones esperando solo
 * confunde a quien revisa.
 */
export async function generarTanda(opciones: {
  productoIds: string[];
  loteId: string;
  usuarioId: string;
  /** Cuántos procesar en esta llamada. El resto queda para la siguiente. */
  tanda?: number;
}): Promise<ResultadoTanda> {
  const { productoIds, loteId, usuarioId } = opciones;
  const tanda = Math.max(1, Math.min(opciones.tanda ?? 3, 10));

  // Los que ya tienen propuesta de ESTE lote ya se hicieron: así el
  // cliente puede reintentar una tanda que se cortó a mitad sin pagar
  // dos veces por los mismos productos.
  const yaHechos = await prisma.seoPropuesta.findMany({
    where: { loteId, productoId: { in: productoIds } },
    select: { productoId: true },
  });
  const hechos = new Set(yaHechos.map((p) => p.productoId));
  const pendientes = productoIds.filter((id) => !hechos.has(id));
  const aProcesar = pendientes.slice(0, tanda);

  const detalle: ResultadoTanda["detalle"] = [];
  let costoUSD = 0;
  let ok = 0;

  for (const productoId of aProcesar) {
    const p = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { sku: true, publicado: true, nombre: true },
    });
    if (!p) {
      detalle.push({ productoId, sku: "?", ok: false, error: "El producto ya no existe" });
      continue;
    }

    try {
      const r = await generarSeoDeProducto(productoId);
      costoUSD += r.costoUSD;

      await reemplazarPendiente(productoId);
      await prisma.seoPropuesta.create({
        data: {
          productoId,
          loteId,
          estado: "PROPUESTO",
          seoTitulo: r.data.seoTitulo,
          seoDescripcion: r.data.seoDescripcion,
          seoKeywords: r.data.seoKeywords,
          seoTexto: r.data.seoTexto,
          slug: r.data.slug,
          imagenes: r.data.imagenes,
          // Un producto que todavía no está en la tienda no tiene URL
          // que romper, así que su slug se puede aplicar sin más. Uno
          // publicado ya está indexado: cambiarlo lo tiene que decidir
          // una persona.
          aplicaSlug: !p.publicado,
          modelo: r.modelo,
          tokensEntrada: r.tokens.entrada,
          tokensSalida: r.tokens.salida,
          costoUSD: r.costoUSD,
          generadoPor: usuarioId,
        },
      });
      ok++;
      detalle.push({ productoId, sku: p.sku, ok: true });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await reemplazarPendiente(productoId);
      await prisma.seoPropuesta.create({
        data: { productoId, loteId, estado: "ERROR", error: error.slice(0, 500), generadoPor: usuarioId },
      });
      detalle.push({ productoId, sku: p.sku, ok: false, error });
    }
  }

  return {
    loteId,
    procesados: aProcesar.length,
    ok,
    fallidos: aProcesar.length - ok,
    costoUSD,
    restantes: pendientes.length - aProcesar.length,
    detalle,
  };
}

/** Deja sin efecto la propuesta anterior que aún nadie revisó. */
const reemplazarPendiente = (productoId: string) =>
  prisma.seoPropuesta.deleteMany({ where: { productoId, estado: { in: ["PROPUESTO", "ERROR"] } } });

export interface ResultadoAplicar {
  ok: boolean;
  detalle: string;
  /** Estado de la sincronización con la tienda, si se intentó. */
  sync?: string;
}

/**
 * Aprueba una propuesta: la escribe en el producto y empuja a la tienda.
 *
 * Éste es el único punto de todo el módulo que toca `productos`. El
 * texto se guarda tal cual se aprobó, sin volver a recortar: quien lo
 * leyó aprobó exactamente eso.
 */
export async function aprobarPropuesta(id: string, usuarioId: string): Promise<ResultadoAplicar> {
  const p = await prisma.seoPropuesta.findUnique({
    where: { id },
    include: { producto: { select: { id: true, sku: true, publicado: true, slug: true } } },
  });
  if (!p) return { ok: false, detalle: "La propuesta no existe" };
  if (p.estado === "APROBADO") return { ok: false, detalle: "Esta propuesta ya se había aprobado" };
  if (p.estado === "ERROR") return { ok: false, detalle: "Esta propuesta falló al generarse: vuelve a generarla" };

  // El slug solo cambia si alguien lo pidió, y aun así se comprueba que
  // no choque con otro producto: `slug` es único y un choque tumbaría el
  // guardado entero, llevándose por delante el SEO que sí estaba bien.
  let slug: string | undefined;
  let avisoSlug = "";
  if (p.aplicaSlug && p.slug && p.slug !== p.producto.slug) {
    const choca = await prisma.producto.findFirst({
      where: { slug: p.slug, NOT: { id: p.producto.id } },
      select: { sku: true },
    });
    if (choca) {
      avisoSlug = ` La dirección "${p.slug}" ya la usa ${choca.sku}, así que se dejó la anterior.`;
    } else {
      slug = p.slug;
    }
  }

  await prisma.producto.update({
    where: { id: p.producto.id },
    data: {
      seoTitulo: p.seoTitulo,
      seoDescripcion: p.seoDescripcion,
      seoKeywords: p.seoKeywords,
      seoTexto: p.seoTexto,
      ...(slug ? { slug } : {}),
    },
  });

  // El alt y el título de cada imagen son metadato de la misma
  // propuesta: si se aprueba el texto, se aprueban también.
  const imagenes = Array.isArray(p.imagenes) ? (p.imagenes as { id: string; altText: string; titulo: string }[]) : [];
  let imagenesOk = 0;
  if (imagenes.length) {
    const validas = new Set(
      (await prisma.acfImagen.findMany({ where: { productoId: p.producto.id }, select: { id: true } })).map((i) => i.id),
    );
    for (const im of imagenes) {
      if (!validas.has(im.id)) continue;
      await prisma.acfImagen
        .update({ where: { id: im.id }, data: { altText: im.altText, titulo: im.titulo } })
        .then(() => { imagenesOk++; })
        .catch(() => undefined);
    }
  }

  await prisma.seoPropuesta.update({
    where: { id },
    data: { estado: "APROBADO", revisadoPor: usuarioId, revisadoEn: new Date() },
  });

  // Ahora sí sale a costamallas.com. Se omite solo si el producto no
  // está publicado: en ese caso el SEO viaja cuando alguien lo publique.
  const sync = await sincronizarProducto(p.producto.id);

  return {
    ok: true,
    detalle:
      `SEO aplicado a ${p.producto.sku}` +
      (imagenesOk ? ` · ${imagenesOk} imagen(es) con alt nuevo` : "") +
      (slug ? ` · dirección cambiada a "${slug}"` : "") +
      avisoSlug,
    sync: sync.estado === "ok" ? "Publicado en la tienda" : (sync.aviso ?? sync.error ?? "Sin sincronizar"),
  };
}

export async function rechazarPropuesta(id: string, usuarioId: string): Promise<ResultadoAplicar> {
  const p = await prisma.seoPropuesta.findUnique({ where: { id }, select: { estado: true } });
  if (!p) return { ok: false, detalle: "La propuesta no existe" };
  if (p.estado === "APROBADO") {
    return { ok: false, detalle: "Ya se aplicó al producto: rechazarla ahora no lo deshace" };
  }
  await prisma.seoPropuesta.update({
    where: { id },
    data: { estado: "RECHAZADO", revisadoPor: usuarioId, revisadoEn: new Date() },
  });
  return { ok: true, detalle: "Propuesta descartada" };
}
