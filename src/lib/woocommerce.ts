// ============================================================
// COSTAMALLAS ERP — Cliente WooCommerce REST API v3
// Documentación: https://woocommerce.github.io/woocommerce-rest-api-docs/
// ============================================================

import { prisma } from "@/lib/prisma";
import { decryptIfNeeded } from "@/lib/encryption";
import type { ProductoDetalle } from "@/types";

export interface WCCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface WCProduct {
  id?: number;
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
  sold_individually: boolean;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  shipping_class: string;
  tax_status: string;
  tax_class: string;
  reviews_allowed: boolean;
  purchase_note: string;
  categories: { slug: string }[];
  tags: { name: string }[];
  images: { src: string; name?: string; alt?: string }[];
  meta_data: { key: string; value: string | boolean | number | (string | number)[] }[];
}

// ── Obtener credenciales desde la BD ─────────

export async function getWCCredentials(): Promise<WCCredentials | null> {
  const configs = await prisma.configuracion.findMany({
    where: { clave: { in: ["wc_store_url", "wc_consumer_key", "wc_consumer_secret"] } },
  });

  const map = Object.fromEntries(configs.map((c) => [c.clave, c]));

  const storeUrl = map["wc_store_url"]?.valor;
  const consumerKey = map["wc_consumer_key"]?.valor;
  const consumerSecret = map["wc_consumer_secret"]?.valor;

  if (!storeUrl || !consumerKey || !consumerSecret) return null;

  return {
    storeUrl: storeUrl.replace(/\/$/, ""),
    consumerKey: map["wc_consumer_key"].encrypted ? decryptIfNeeded(consumerKey) : consumerKey,
    consumerSecret: map["wc_consumer_secret"].encrypted ? decryptIfNeeded(consumerSecret) : consumerSecret,
  };
}

// ── Cliente HTTP con autenticación Basic ──────

async function wcFetch<T>(
  creds: WCCredentials,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${creds.storeUrl}/wp-json/wc/v3/${endpoint}`;
  const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      "User-Agent": "Costamallas-ERP/1.0",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`WooCommerce API error ${res.status}: ${error.message ?? JSON.stringify(error)}`);
  }

  return res.json() as Promise<T>;
}

// ── Test de conexión ──────────────────────────

export async function testWCConnection(creds: WCCredentials): Promise<{
  ok: boolean;
  storeName: string;
  version: string;
}> {
  const data = await wcFetch<{ name: string; woocommerce_version: string }>(
    creds,
    "system_status",
    { method: "GET" }
  );
  return { ok: true, storeName: data.name, version: data.woocommerce_version };
}

// ── Verificar que una URL de imagen sea descargable por WooCommerce ──
// WooCommerce rechaza TODO el producto si una imagen da 404/no responde.
// Filtramos las imágenes rotas antes de enviar para que el sync no falle.

async function urlAccesible(url: string): Promise<boolean> {
  const intento = async (method: string, headers?: Record<string, string>) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, { method, headers, signal: ctrl.signal });
      return r;
    } finally {
      clearTimeout(t);
    }
  };
  try {
    let r = await intento("HEAD");
    // Algunos servidores no soportan HEAD → probar GET parcial
    if (r.status === 405 || r.status === 501) r = await intento("GET", { Range: "bytes=0-0" });
    return r.ok || r.status === 206;
  } catch {
    return false;
  }
}

// ── Convertir Producto a formato WooCommerce ──

export function productoToWC(producto: ProductoDetalle): WCProduct {
  const metaData: WCProduct["meta_data"] = [
    { key: "sku_interno", value: producto.acfSkuInterno ?? "" },
    { key: "marca_fabricante", value: producto.acfMarcaFabricante ?? "" },
    { key: "unidad_venta", value: producto.acfUnidadVenta ?? "" },
    { key: "fabricacion_medida", value: producto.acfFabricacionMedida },
    { key: "instalacion_disponible", value: producto.acfInstalacion },
    { key: "garantia_anos", value: producto.acfGarantiaAnos ?? 0 },
    // aplicaciones y colores_disponibles se emiten como repeater ACF en fichasMetaData()
    { key: "normas_calidad", value: producto.acfNormas.join(" | ") },
    { key: "certificaciones", value: producto.acfCertificaciones.join(" | ") },
    { key: "ficha_tecnica_pdf", value: producto.acfFichaTecnicaPdf ?? "" },
  ];

  return {
    name: producto.nombre,
    slug: producto.slug,
    type: producto.tipo.toLowerCase(),
    status: producto.publicado ? "publish" : "draft",
    featured: producto.destacado,
    catalog_visibility: producto.visibilidad as string,
    description: producto.descripcion ?? "",
    short_description: producto.descCorta ?? "",
    sku: producto.sku,
    regular_price: producto.precioNormal ? String(producto.precioNormal) : "",
    sale_price: producto.precioOferta ? String(producto.precioOferta) : "",
    manage_stock: true,
    stock_quantity: producto.stock,
    low_stock_amount: producto.stockMinimo,
    backorders: producto.permiteBackorders,
    sold_individually: false,
    weight: producto.pesoKg ? String(producto.pesoKg) : "",
    dimensions: {
      length: producto.largoCm ? String(producto.largoCm) : "",
      width: producto.anchoCm ? String(producto.anchoCm) : "",
      height: producto.altoCm ? String(producto.altoCm) : "",
    },
    shipping_class: producto.claseEnvio ?? "",
    tax_status: producto.estadoImpuesto ?? "taxable",
    tax_class: producto.claseImpuesto ?? "",
    reviews_allowed: producto.permiteResenas,
    purchase_note: producto.notaCompra ?? "",
    categories: producto.categorias.map((slug) => ({ slug })),
    tags: producto.etiquetas.map((name) => ({ name })),
    images: producto.imagenes
      .sort((a, b) => a.posicion - b.posicion)
      .map((img) => ({
        src: img.urlImagen,
        name: img.titulo ?? undefined,
        alt: img.altText ?? undefined,
      })),
    meta_data: metaData,
  };
}

// ── Diagnóstico de sincronización (SOLO LECTURA) ──────────────
// Ejecuta las mismas comprobaciones que hace el sync pero sin escribir,
// para detectar por qué falla: conexión, categorías inexistentes,
// imágenes no accesibles, SKU duplicado / wcId desalineado.

export interface WCDiagItem {
  sku: string;
  nombre: string;
  wcId: number | null;
  ok: boolean;
  problemas: string[];
}
export interface WCDiagResult {
  conexion: { ok: boolean; storeName?: string; version?: string; error?: string };
  categoriasEnWC: string[];
  items: WCDiagItem[];
}

export async function diagnosticarWC(creds: WCCredentials, limite = 8): Promise<WCDiagResult> {
  const out: WCDiagResult = { conexion: { ok: false }, categoriasEnWC: [], items: [] };

  // 1. Conexión
  try {
    const sys = await testWCConnection(creds);
    out.conexion = { ok: true, storeName: sys.storeName, version: sys.version };
  } catch (e) {
    out.conexion = { ok: false, error: e instanceof Error ? e.message : String(e) };
    return out; // sin conexión no tiene sentido seguir
  }

  // 2. Categorías existentes en WC (para detectar slugs inexistentes)
  try {
    const cats = await wcFetch<{ slug: string }[]>(creds, "products/categories?per_page=100", { method: "GET" });
    out.categoriasEnWC = Array.isArray(cats) ? cats.map((c) => c.slug) : [];
  } catch { /* no crítico */ }

  // 3. Productos recientes
  const productos = await prisma.producto.findMany({
    orderBy: { updatedAt: "desc" },
    take: limite,
    include: { imagenes: true },
  });

  for (const p of productos) {
    const problemas: string[] = [];

    // Categorías inexistentes en WC
    const catsFaltantes = p.categorias.filter((s) => !out.categoriasEnWC.includes(s));
    if (catsFaltantes.length) problemas.push(`Categorías que no existen en WooCommerce: ${catsFaltantes.join(", ")}`);

    // Imágenes no accesibles por WooCommerce
    for (const img of p.imagenes) {
      try {
        const r = await fetch(img.urlImagen, { method: "HEAD" });
        if (!r.ok) problemas.push(`Imagen no accesible (HTTP ${r.status}): ${img.urlImagen}`);
      } catch (e) {
        problemas.push(`Imagen inaccesible (${e instanceof Error ? e.message : "error"}): ${img.urlImagen}`);
      }
    }

    // SKU duplicado / wcId desalineado
    try {
      const found = await wcFetch<{ id: number }[]>(creds, `products?sku=${encodeURIComponent(p.sku)}`, { method: "GET" });
      const wcHit = Array.isArray(found) && found.length ? found[0] : null;
      if (wcHit) {
        if (!p.wcId) problemas.push(`El SKU ya existe en WC (id ${wcHit.id}) pero el CRM no tiene wcId → al sincronizar intenta CREAR y falla por SKU duplicado`);
        else if (p.wcId !== wcHit.id) problemas.push(`wcId del CRM (${p.wcId}) no coincide con el de WC (${wcHit.id})`);
      }
    } catch (e) {
      problemas.push(`No se pudo consultar el SKU en WC: ${e instanceof Error ? e.message : "error"}`);
    }

    out.items.push({ sku: p.sku, nombre: p.nombre, wcId: p.wcId, ok: problemas.length === 0, problemas });
  }

  return out;
}

// ── Fichas por categoría (acfExtra JSON) → meta_data de ACF ────
// Convierte las claves de acfExtra (mm_/bh_/ny_/pl_/sp_… y campos dinámicos)
// en meta_data. Los nombres coinciden con los campos ACF de WordPress.
//   • escalares (texto/número) → tal cual
//   • booleanos → 1/0 (para campos ACF true_false)
//   • arrays de escalares (checkbox) → se envían como array
//   • arrays de objetos (repeaters: mm_tabla_variantes, bh_accesorios_incluidos)
//     y objetos sueltos → se OMITEN (ACF los guarda en formato de filas; requieren
//     un mapeo especial que no hacemos aquí para no corromper el dato).

// Repeaters ACF conocidos (nombre → field_key y sub-campos). Los field_key vienen
// del export de ACF (acf-export-2026-07-10.json). Si se recrea el grupo ACF, revisar.
const ACF_REPEATERS: Record<string, { key: string; subs: Record<string, string> }> = {
  aplicaciones:            { key: "field_cm_aplicaciones",         subs: { aplicacion_item: "field_cm_aplicacion_item" } },
  colores_disponibles:     { key: "field_cm_colores_disponibles",  subs: { color_item: "field_cm_color_item" } },
  mm_tabla_variantes:      { key: "field_mm_tabla_variantes",      subs: { var_hueco: "field_mm_var_hueco", var_calibre: "field_mm_var_calibre", var_unidad: "field_mm_var_unidad", var_peso: "field_mm_var_peso" } },
  bh_accesorios_incluidos: { key: "field_bh_accesorios_incluidos", subs: { accesorio_item: "field_bh_accesorio_item", accesorio_qty: "field_bh_accesorio_qty" } },
};

// Emite un repeater en el formato que espera ACF: contador + referencia de campo
// + una entrada por fila/sub-campo (valor y referencia `_`).
function pushRepeater(out: WCProduct["meta_data"], name: string, rows: Record<string, unknown>[]) {
  const cfg = ACF_REPEATERS[name];
  if (!cfg) return;
  out.push({ key: name, value: rows.length });
  out.push({ key: `_${name}`, value: cfg.key });
  rows.forEach((row, i) => {
    for (const [sub, subKey] of Object.entries(cfg.subs)) {
      const raw = row[sub];
      const val = typeof raw === "boolean" ? (raw ? 1 : 0) : (raw ?? "") as string | number;
      out.push({ key: `${name}_${i}_${sub}`, value: val });
      out.push({ key: `_${name}_${i}_${sub}`, value: subKey });
    }
  });
}

// Genera TODA la meta_data de fichas: aplicaciones/colores (repeater) + acfExtra
// (fichas por categoría). Los nombres coinciden con los campos ACF de WordPress.
export function fichasMetaData(producto: {
  acfAplicaciones?: string[]; acfColores?: string[]; acfExtra?: unknown;
}): WCProduct["meta_data"] {
  const out: WCProduct["meta_data"] = [];

  // Repeaters generales (desde columnas del producto)
  pushRepeater(out, "aplicaciones", (producto.acfAplicaciones ?? []).map((v) => ({ aplicacion_item: v })));
  pushRepeater(out, "colores_disponibles", (producto.acfColores ?? []).map((v) => ({ color_item: v })));

  // Fichas por categoría (acfExtra)
  const extra = producto.acfExtra && typeof producto.acfExtra === "object" ? (producto.acfExtra as Record<string, unknown>) : {};
  for (const [key, v] of Object.entries(extra)) {
    if (v === null || v === undefined || v === "") continue;
    if (ACF_REPEATERS[key] && Array.isArray(v)) {
      pushRepeater(out, key, v as Record<string, unknown>[]); // repeater de objetos (mm_tabla_variantes, bh_accesorios_incluidos)
    } else if (typeof v === "boolean") {
      out.push({ key, value: v ? 1 : 0 });
    } else if (typeof v === "string" || typeof v === "number") {
      out.push({ key, value: v });
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) {
      out.push({ key, value: v as (string | number)[] }); // checkbox (bh_espacios_aplicacion, co_colores, co_aplicacion)
    }
    // objetos sueltos → omitidos
  }
  return out;
}

// ── Exportar productos a WooCommerce ──────────

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: { sku: string; error: string }[];
}

export async function syncProductosToWC(
  productIds: string[],
  creds: WCCredentials,
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const result: SyncResult = { total: productIds.length, created: 0, updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < productIds.length; i++) {
    const id = productIds[i];
    onProgress?.(i, productIds.length);

    try {
      const producto = await prisma.producto.findUnique({
        where: { id },
        include: { imagenes: true },
      });

      if (!producto) continue;

      // Necesitamos el tipo ProductoDetalle — mapeamos desde Prisma
      const detalleProducto = mapPrismaToDetalle(producto);

      // Filtrar imágenes rotas (WooCommerce falla el producto entero si una da 404)
      const teniaImagenes = detalleProducto.imagenes.length > 0;
      const accesibles = await Promise.all(detalleProducto.imagenes.map((img) => urlAccesible(img.urlImagen)));
      detalleProducto.imagenes = detalleProducto.imagenes.filter((_, idx) => accesibles[idx]);

      const wcData = productoToWC(detalleProducto);

      // Si todas las imágenes están rotas pero el producto SÍ tenía imágenes,
      // no enviamos el campo images para no borrar las que WC ya tenga.
      if (teniaImagenes && detalleProducto.imagenes.length === 0) {
        delete (wcData as Partial<WCProduct>).images;
      }

      // Fichas técnicas (aplicaciones/colores + acfExtra por categoría) → meta_data ACF.
      wcData.meta_data.push(...fichasMetaData(producto));

      if (producto.wcId) {
        // Actualizar
        await wcFetch(creds, `products/${producto.wcId}`, {
          method: "PUT",
          body: JSON.stringify(wcData),
        });
        result.updated++;
      } else {
        // Crear
        const created = await wcFetch<{ id: number }>(creds, "products", {
          method: "POST",
          body: JSON.stringify(wcData),
        });

        await prisma.producto.update({
          where: { id },
          data: { wcId: created.id, intExportadoEn: new Date() },
        });
        result.created++;
      }

      await prisma.producto.update({
        where: { id },
        data: { intExportadoEn: new Date() },
      });
    } catch (err) {
      result.failed++;
      const productoFallido = await prisma.producto.findUnique({
        where: { id },
        select: { sku: true },
      });
      result.errors.push({
        sku: productoFallido?.sku ?? id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  onProgress?.(productIds.length, productIds.length);
  return result;
}

// ── Generar CSV de exportación (formato WC) ───

export function generarCSVWooCommerce(productos: ProductoDetalle[]): string {
  const SEP = " | ";
  const headers = [
    "ID", "Type", "SKU", "Name", "Published", "Is featured?", "Visibility in catalog",
    "Short description", "Description", "Sale price", "Regular price",
    "Tax status", "Tax class", "In stock?", "Stock", "Low stock amount", "Backorders allowed?",
    "Weight (kg)", "Length (cm)", "Width (cm)", "Height (cm)",
    "Categories", "Tags", "Shipping class", "Images",
    "Purchase note", "Allow customer reviews?",
  ].join(",");

  const rows = productos.map((p) => {
    const fields = [
      p.wcId ?? "",
      p.tipo.toLowerCase(),
      p.sku,
      `"${p.nombre.replace(/"/g, '""')}"`,
      p.publicado ? "1" : "0",
      p.destacado ? "1" : "0",
      p.visibilidad,
      `"${(p.descCorta ?? "").replace(/"/g, '""')}"`,
      `"${(p.descripcion ?? "").replace(/"/g, '""')}"`,
      p.precioOferta ?? "",
      p.precioNormal ?? "",
      p.estadoImpuesto ?? "taxable",
      p.claseImpuesto ?? "",
      p.enStock ? "1" : "0",
      p.stock,
      p.stockMinimo,
      p.permiteBackorders,
      p.pesoKg ?? "",
      p.largoCm ?? "",
      p.anchoCm ?? "",
      p.altoCm ?? "",
      `"${p.categorias.join(SEP)}"`,
      `"${p.etiquetas.join(SEP)}"`,
      p.claseEnvio ?? "",
      `"${p.imagenes.sort((a, b) => a.posicion - b.posicion).map((i) => i.urlImagen).join(SEP)}"`,
      `"${(p.notaCompra ?? "").replace(/"/g, '""')}"`,
      p.permiteResenas ? "1" : "0",
    ];
    return fields.join(",");
  });

  return [headers, ...rows].join("\n");
}

// ── Helper: mapear Prisma a ProductoDetalle ───

function mapPrismaToDetalle(p: {
  id: string; wcId: number | null; tipo: string; sku: string; nombre: string;
  slug: string; publicado: boolean; visibilidad: string; destacado: boolean;
  descCorta: string | null; descripcion: string | null;
  precioNormal: unknown; precioOferta: unknown;
  estadoImpuesto: string | null; claseImpuesto: string | null;
  enStock: boolean; stock: number; stockMinimo: number;
  permiteBackorders: string; pesoKg: unknown; largoCm: unknown;
  anchoCm: unknown; altoCm: unknown; categorias: string[];
  etiquetas: string[]; claseEnvio: string | null; notaCompra: string | null;
  permiteResenas: boolean; acfSkuInterno: string | null;
  acfMarcaFabricante: string | null; acfUnidadVenta: string | null;
  acfFabricacionMedida: boolean; acfInstalacion: boolean;
  acfGarantiaAnos: number | null; acfAplicaciones: string[];
  acfColores: string[]; acfNormas: string[]; acfFichaTecnicaPdf: string | null;
  acfCertificaciones: string[]; intEstado: string;
  intResponsable: string | null; intObservaciones: string | null;
  intListoExportar: boolean; intExportadoEn: Date | null;
  createdAt: Date; updatedAt: Date;
  imagenes: {
    id: string; posicion: number; urlImagen: string;
    altText: string | null; titulo: string | null;
    esPrincipal: boolean; urlValida: boolean | null;
  }[];
}): ProductoDetalle {
  const toNum = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: p.id,
    wcId: p.wcId,
    tipo: p.tipo as ProductoDetalle["tipo"],
    sku: p.sku,
    nombre: p.nombre,
    slug: p.slug,
    publicado: p.publicado,
    visibilidad: p.visibilidad,
    destacado: p.destacado,
    descCorta: p.descCorta,
    descripcion: p.descripcion,
    precioNormal: toNum(p.precioNormal),
    precioOferta: toNum(p.precioOferta),
    estadoImpuesto: p.estadoImpuesto,
    claseImpuesto: p.claseImpuesto,
    enStock: p.enStock,
    stock: p.stock,
    stockMinimo: p.stockMinimo,
    nivelStock: "OK",
    permiteBackorders: p.permiteBackorders,
    pesoKg: toNum(p.pesoKg),
    largoCm: toNum(p.largoCm),
    anchoCm: toNum(p.anchoCm),
    altoCm: toNum(p.altoCm),
    categorias: p.categorias,
    etiquetas: p.etiquetas,
    claseEnvio: p.claseEnvio,
    notaCompra: p.notaCompra,
    permiteResenas: p.permiteResenas,
    acfSkuInterno: p.acfSkuInterno,
    acfMarcaFabricante: p.acfMarcaFabricante,
    acfUnidadVenta: p.acfUnidadVenta,
    acfFabricacionMedida: p.acfFabricacionMedida,
    acfInstalacion: p.acfInstalacion,
    acfGarantiaAnos: p.acfGarantiaAnos,
    acfAplicaciones: p.acfAplicaciones,
    acfColores: p.acfColores,
    acfNormas: p.acfNormas,
    acfFichaTecnicaPdf: p.acfFichaTecnicaPdf,
    acfCertificaciones: p.acfCertificaciones,
    intEstado: p.intEstado as ProductoDetalle["intEstado"],
    intResponsable: p.intResponsable,
    intObservaciones: p.intObservaciones,
    intListoExportar: p.intListoExportar,
    intExportadoEn: p.intExportadoEn?.toISOString() ?? null,
    imagenes: p.imagenes.map((img) => ({
      id: img.id, posicion: img.posicion, urlImagen: img.urlImagen,
      altText: img.altText, titulo: img.titulo,
      esPrincipal: img.esPrincipal, urlValida: img.urlValida,
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ── Importar PEDIDOS desde WooCommerce ────────────────────────
// Identifica/crea el cliente por email o teléfono y crea el Pedido en el CRM.

interface WCOrder {
  id: number; number: string; status: string; total: string; date_created: string;
  customer_note?: string;
  billing: { first_name?: string; last_name?: string; email?: string; phone?: string; city?: string; address_1?: string; company?: string };
  line_items: { name: string; quantity: number; price: number; total: string; sku?: string; product_id?: number }[];
}

const WC_ESTADO_MAP: Record<string, string> = {
  pending: "NUEVO", "on-hold": "NUEVO", processing: "CONFIRMADO",
  completed: "ENTREGADO", cancelled: "CANCELADO", refunded: "CANCELADO", failed: "NUEVO",
};

export interface ImportOrdersResult { total: number; importados: number; omitidos: number; clientesCreados: number; errores: string[]; }

export async function importarPedidosWC(creds: WCCredentials, perPage = 50): Promise<ImportOrdersResult> {
  const res: ImportOrdersResult = { total: 0, importados: 0, omitidos: 0, clientesCreados: 0, errores: [] };

  const orders = await wcFetch<WCOrder[]>(creds, `orders?per_page=${perPage}&orderby=date&order=desc`, { method: "GET" });
  res.total = orders.length;

  for (const order of orders) {
    try {
      const numero = `WC-${order.number}`;
      const existe = await prisma.pedido.findUnique({ where: { numero } });
      if (existe) { res.omitidos++; continue; }

      const email = order.billing?.email?.trim().toLowerCase() || null;
      const telefono = order.billing?.phone?.trim() || null;
      const nombre = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" ").trim() || order.billing?.company || "Cliente WooCommerce";

      // Identificar cliente por email o teléfono
      let cliente = null as { id: string } | null;
      if (email || telefono) {
        cliente = await prisma.cliente.findFirst({
          where: { OR: [...(email ? [{ email }] : []), ...(telefono ? [{ telefono }] : [])] },
          select: { id: true },
        });
      }
      if (!cliente) {
        cliente = await prisma.cliente.create({
          data: {
            nombre, email, telefono,
            empresa: order.billing?.company || null,
            ciudad: order.billing?.city || null,
            direccion: order.billing?.address_1 || null,
            estado: "CLIENTE_ACTIVO",
            tipo: order.billing?.company ? "empresa" : "persona",
            notas: "Cliente identificado automáticamente desde un pedido de WooCommerce.",
          },
          select: { id: true },
        });
        res.clientesCreados++;
      }

      // Mapear ítems (vincula a producto por SKU si existe)
      const items = [] as { productoId: string | null; descripcion: string; cantidad: number; precioUnitario: number; subtotal: number; unidad: string | null; orden: number }[];
      for (let i = 0; i < order.line_items.length; i++) {
        const li = order.line_items[i];
        let productoId: string | null = null;
        if (li.sku) {
          const prod = await prisma.producto.findUnique({ where: { sku: li.sku }, select: { id: true } });
          productoId = prod?.id ?? null;
        }
        items.push({
          productoId, descripcion: li.name, cantidad: Number(li.quantity),
          precioUnitario: Number(li.price), subtotal: Number(li.total), unidad: "und", orden: i,
        });
      }

      await prisma.pedido.create({
        data: {
          numero, clienteId: cliente.id,
          estado: WC_ESTADO_MAP[order.status] ?? "NUEVO",
          total: Number(order.total),
          notas: order.customer_note || null,
          direccionEntrega: order.billing?.address_1 || null,
          items: { create: items },
        },
      });
      res.importados++;
    } catch (e) {
      res.errores.push(`Pedido ${order.number}: ${(e as Error).message}`);
    }
  }

  return res;
}
