// ============================================================
// El catálogo de SIIGO, para revisarlo antes de traerlo.
//
// POR QUÉ NO SE IMPORTAN DE UNA VEZ como los clientes o las facturas:
//
// De los 1.044 productos de SIIGO, solo el 29% tiene precio. Traerlos
// todos metería ~738 fichas sin precio en el catálogo, y una ficha sin
// precio no se puede publicar en la tienda ni meter en una cotización.
// El catálogo pasaría de 194 productos útiles a 1.238, de los cuales más
// de la mitad estorban.
//
// Además hay 194 SKU que YA existen en el portal, con fotos, categorías
// y descripción escritas a mano. Eso no se pisa.
//
// Así que aquí se hacen dos cosas separadas:
//   1. `sincronizarCatalogoSiigo()` trae una COPIA de lo que hay en
//      SIIGO a una tabla de paso, sin tocar el catálogo.
//   2. `traerProducto()` crea el Producto de verdad, uno a uno, cuando
//      alguien lo decide.
// ============================================================

import { prisma } from "@/lib/prisma";
import { recorrerSiigo } from "./cliente-api";
import { EstadoProducto } from "@prisma/client";

export interface ProductoSiigoApi {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  type?: string;
  active?: boolean;
  available_quantity?: number;
  unit_label?: string;
  account_group?: { name?: string };
  taxes?: { percentage?: number }[];
  prices?: { currency_code?: string; price_list?: { name?: string; value?: number }[] }[];
}

/** El precio de la primera lista con valor. Nulo si SIIGO no le puso. */
function precioDe(p: ProductoSiigoApi): number | null {
  for (const moneda of p.prices ?? []) {
    for (const lista of moneda.price_list ?? []) {
      const v = Number(lista.value ?? 0);
      if (v > 0) return v;
    }
  }
  return null;
}

export interface ResultadoSync {
  leidos: number;
  nuevos: number;
  actualizados: number;
  yaEnPortal: number;
  sinPrecio: number;
}

/**
 * Trae una copia del catálogo de SIIGO a la sala de espera.
 *
 * Se puede correr las veces que haga falta: actualiza los datos (precio,
 * existencias, nombre) pero NO toca la decisión que alguien ya tomó.
 */
export async function sincronizarCatalogoSiigo(): Promise<ResultadoSync> {
  const r: ResultadoSync = { leidos: 0, nuevos: 0, actualizados: 0, yaEnPortal: 0, sinPrecio: 0 };

  // Los SKU del portal, para marcar cuáles ya existen. Es lo primero que
  // hay que saber para decidir: un código que ya está no se trae.
  const skus = new Set(
    (await prisma.producto.findMany({ select: { sku: true } }))
      .map(p => p.sku.trim().toUpperCase()),
  );

  const existentes = new Set(
    (await prisma.productoSiigo.findMany({ select: { siigoId: true } })).map(x => x.siigoId),
  );

  await recorrerSiigo<ProductoSiigoApi>("/v1/products", async lote => {
    for (const p of lote) {
      r.leidos++;
      const codigo = String(p.code ?? "").trim();
      const nombre = String(p.name ?? "").trim();
      if (!codigo || !nombre) continue;

      const precio = precioDe(p);
      if (precio === null) r.sinPrecio++;

      const ya = skus.has(codigo.toUpperCase());
      if (ya) r.yaEnPortal++;

      const datos = {
        codigo,
        nombre: nombre.slice(0, 255),
        descripcion: String(p.description ?? "").trim() || null,
        precio,
        ivaPct: p.taxes?.[0]?.percentage ?? null,
        unidad: p.unit_label?.trim() || null,
        tipo: p.type ?? "Product",
        activoEnSiigo: p.active !== false,
        existencias: Number(p.available_quantity ?? 0),
        grupo: p.account_group?.name?.trim() || null,
        yaEnPortal: ya,
      };

      if (existentes.has(p.id)) {
        // Se actualizan los DATOS, nunca la decisión: alguien ya la tomó
        // y una sincronización no tiene por qué deshacerla.
        await prisma.productoSiigo.update({ where: { siigoId: p.id }, data: datos });
        r.actualizados++;
      } else {
        await prisma.productoSiigo.create({ data: { siigoId: p.id, ...datos } });
        r.nuevos++;
      }
    }
  });

  return r;
}

/**
 * Crea el Producto de verdad a partir de una ficha revisada.
 *
 * Nace SIN publicar y en BORRADOR a propósito: traerlo al catálogo no es
 * lo mismo que ponerlo en la tienda. Eso lo decide quien lo revise
 * después, con la ficha delante.
 */
export async function traerProducto(
  idRevision: string,
  usuarioId: string | null,
): Promise<{ ok: boolean; error?: string; productoId?: string }> {
  const f = await prisma.productoSiigo.findUnique({ where: { id: idRevision } });
  if (!f) return { ok: false, error: "Esa ficha no existe." };
  if (f.productoId) return { ok: false, error: "Ese producto ya se trajo." };

  const sku = f.codigo.trim();
  const choque = await prisma.producto.findUnique({ where: { sku } });
  if (choque) {
    // Se marca como ya traído apuntando al que existe: así deja de salir
    // como pendiente y queda claro con cuál se corresponde.
    await prisma.productoSiigo.update({
      where: { id: idRevision },
      data: { productoId: choque.id, yaEnPortal: true, decision: "TRAER", decididoPorId: usuarioId, decididoEn: new Date() },
    });
    return { ok: false, error: `El SKU ${sku} ya existe en el catálogo. Se enlazó con el que había.` };
  }

  try {
    const creado = await prisma.producto.create({
      data: {
        sku,
        nombre: f.nombre,
        slug: sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        descCorta: f.descripcion?.slice(0, 500) ?? null,
        precioNormal: f.precio ?? undefined,
        stock: Math.max(0, Math.round(Number(f.existencias))),
        acfUnidadVenta: f.unidad,
        // Nace apagado: traerlo al catálogo no es publicarlo en la
        // tienda. Falta ponerle fotos, categoría y revisar el texto.
        publicado: false,
        intListoExportar: false,
        intEstado: EstadoProducto.BORRADOR,
        intObservaciones: `Traído del catálogo de SIIGO (código ${f.codigo}).`,
        // Estos arreglos son obligatorios en el esquema y no tienen
        // valor por defecto: sin ellos, el create falla.
        categorias: [],
        etiquetas: [],
        acfAplicaciones: [],
        acfColores: [],
        acfNormas: [],
        acfCertificaciones: [],
      },
      select: { id: true },
    });

    await prisma.productoSiigo.update({
      where: { id: idRevision },
      data: {
        productoId: creado.id,
        decision: "TRAER",
        decididoPorId: usuarioId,
        decididoEn: new Date(),
        errorAlTraer: null,
      },
    });

    return { ok: true, productoId: creado.id };
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 300) : String(e);
    await prisma.productoSiigo.update({
      where: { id: idRevision },
      data: { errorAlTraer: error },
    }).catch(() => undefined);
    return { ok: false, error };
  }
}

/** Marcar que NO se trae. No borra nada: deja constancia de la decisión. */
export async function descartarProducto(idRevision: string, usuarioId: string | null) {
  await prisma.productoSiigo.update({
    where: { id: idRevision },
    data: { decision: "DESCARTAR", decididoPorId: usuarioId, decididoEn: new Date() },
  });
  return { ok: true };
}
