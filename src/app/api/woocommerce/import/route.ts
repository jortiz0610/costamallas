// ============================================================
// POST /api/woocommerce/import — Importar productos desde WooCommerce
// GET  /api/woocommerce/import — Previsualizar productos disponibles
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { getWCCredentials } from "@/lib/woocommerce";

interface WCProductRaw {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  low_stock_amount: number | null;
  backorders: string;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  shipping_class: string;
  tax_status: string;
  tax_class: string;
  reviews_allowed: boolean;
  purchase_note: string;
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  images: { id: number; src: string; name: string; alt: string }[];
  meta_data: { key: string; value: unknown }[];
}

async function fetchWCProducts(creds: { storeUrl: string; consumerKey: string; consumerSecret: string }, page = 1, perPage = 50): Promise<WCProductRaw[]> {
  const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
  const url = `${creds.storeUrl}/wp-json/wc/v3/products?page=${page}&per_page=${perPage}&orderby=date&order=desc`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, "User-Agent": "Costamallas-ERP/1.0" },
  });
  if (!res.ok) throw new Error(`WooCommerce error ${res.status}`);
  return res.json();
}

// GET — Previsualizar productos de WooCommerce
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const creds = await getWCCredentials();
  if (!creds) return NextResponse.json({ success: false, error: "WooCommerce no configurado" }, { status: 400 });

  try {
    const productos = await fetchWCProducts(creds);

    // Verificar cuáles ya existen en el ERP
    const wcIds = productos.map((p) => p.id);
    const existentes = await prisma.producto.findMany({
      where: { wcId: { in: wcIds } },
      select: { wcId: true },
    });
    const existentesSet = new Set(existentes.map((e) => e.wcId));

    const preview = productos.map((p) => ({
      wcId: p.id,
      sku: p.sku,
      nombre: p.name,
      tipo: p.type,
      estado: p.status,
      precioNormal: p.regular_price,
      stock: p.stock_quantity,
      categorias: p.categories.map((c) => c.slug),
      imagen: p.images[0]?.src ?? null,
      yaImportado: existentesSet.has(p.id),
    }));

    return NextResponse.json({ success: true, data: preview });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error al conectar con WooCommerce" },
      { status: 502 }
    );
  }
}

// POST — Importar productos seleccionados
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const creds = await getWCCredentials();
  if (!creds) return NextResponse.json({ success: false, error: "WooCommerce no configurado" }, { status: 400 });

  try {
    const { wcIds }: { wcIds: number[] } = await req.json();
    if (!wcIds?.length) return NextResponse.json({ success: false, error: "Sin productos seleccionados" }, { status: 400 });

    // Traer todos los productos de WC
    const wcProductos = await fetchWCProducts(creds, 1, 100);
    const seleccionados = wcProductos.filter((p) => wcIds.includes(p.id));

    let creados = 0, actualizados = 0, errores = 0;
    const detallesError: { sku: string; error: string }[] = [];

    for (const p of seleccionados) {
      try {
        const sku = p.sku || `wc-${p.id}`;
        const slug = p.slug || sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const data = {
          wcId: p.id,
          tipo: (["SIMPLE","VARIABLE","AGRUPADO","EXTERNO"].includes(p.type?.toUpperCase()) ? p.type.toUpperCase() : "SIMPLE") as "SIMPLE" | "VARIABLE" | "AGRUPADO" | "EXTERNO",
          sku,
          nombre: p.name || `Producto WC ${p.id}`,
          slug,
          publicado: p.status === "publish",
          visibilidad: p.catalog_visibility ?? "visible",
          destacado: p.featured,
          descCorta: p.short_description || null,
          descripcion: p.description || null,
          precioNormal: p.regular_price ? parseFloat(p.regular_price) : null,
          precioOferta: p.sale_price ? parseFloat(p.sale_price) : null,
          estadoImpuesto: p.tax_status || null,
          claseImpuesto: p.tax_class || null,
          enStock: (p.stock_quantity ?? 0) > 0,
          stock: p.stock_quantity ?? 0,
          stockMinimo: p.low_stock_amount ?? 15,
          permiteBackorders: p.backorders ?? "no",
          pesoKg: p.weight ? parseFloat(p.weight) : null,
          largoCm: p.dimensions?.length ? parseFloat(p.dimensions.length) : null,
          anchoCm: p.dimensions?.width ? parseFloat(p.dimensions.width) : null,
          altoCm: p.dimensions?.height ? parseFloat(p.dimensions.height) : null,
          categorias: p.categories.map((c) => c.slug),
          etiquetas: p.tags.map((t) => t.name),
          claseEnvio: p.shipping_class || null,
          notaCompra: p.purchase_note || null,
          permiteResenas: p.reviews_allowed,
          intEstado: "BORRADOR" as const,
        };

        // Asegurar slug único
        const slugExistente = await prisma.producto.findUnique({ where: { slug: data.slug } });
        if (slugExistente && slugExistente.wcId !== p.id) {
          data.slug = `${data.slug}-${p.id}`;
        }

        const existente = await prisma.producto.findUnique({ where: { wcId: p.id } });

        if (existente) {
          await prisma.producto.update({ where: { wcId: p.id }, data });
          actualizados++;
        } else {
          const created = await prisma.producto.create({ data });

          // Importar imágenes
          if (p.images?.length) {
            await prisma.acfImagen.createMany({
              data: p.images.map((img, i) => ({
                productoId: created.id,
                posicion: i,
                urlImagen: img.src,
                altText: img.alt || null,
                titulo: img.name || null,
                esPrincipal: i === 0,
              })),
            });
          }
          creados++;
        }
      } catch (err) {
        errores++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[import] SKU ${p.sku} (wcId ${p.id}):`, errMsg);
        detallesError.push({ sku: p.sku || `wc-${p.id}`, error: errMsg });
      }
    }

    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "IMPORTAR_WC",
        detalle: `Creados: ${creados}, Actualizados: ${actualizados}, Errores: ${errores}`,
        resultado: errores === 0 ? "OK" : "PARCIAL",
        totalFilas: creados + actualizados,
      },
    });

    return NextResponse.json({
      success: true,
      data: { creados, actualizados, errores, detallesError },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error en la importación" },
      { status: 500 }
    );
  }
}
