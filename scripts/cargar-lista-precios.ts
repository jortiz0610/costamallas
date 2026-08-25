// ============================================================
// Carga la lista de precios de Costamallas al catálogo.
//
//   npx tsx scripts/cargar-lista-precios.ts "<ruta>.xlsx" --dry
//   npx tsx scripts/cargar-lista-precios.ts "<ruta>.xlsx"
//
// SIEMPRE correr primero con --dry: informa qué crearía y qué cambiaría
// sin escribir nada.
//
// Qué hace:
//   · Productos nuevos → se crean SIN PUBLICAR. Quedan disponibles para
//     cotizar en el CRM pero no aparecen en costamallas.com, que es
//     justamente lo que se pidió: "no quiero que salgan en la página,
//     sino tenerlos en la base para cotizar".
//   · Productos que ya existen → se les actualiza SOLO el precio. No se
//     tocan nombre, descripción, imágenes ni fichas: eso es trabajo que
//     ya se hizo a mano y una lista de precios no tiene por qué pisarlo.
//   · La hoja SERVICIOS no son productos: van al catálogo de instalación
//     (Configuración → Instalación), que es de donde el cotizador saca
//     la mano de obra.
//
// Los precios se cargan SIN IVA (la columna "Valor Unitario"), porque el
// cotizador suma el 19% aparte. Cargar el valor total lo cobraría dos
// veces.
//
// Es idempotente: correrlo dos veces con la misma lista no duplica nada
// ni vuelve a cambiar precios que ya quedaron iguales.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (!m || process.env[`__${m[1]}_F`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_F`] = "1";
  }
}

import { leerLibro, type Hoja } from "./lib-xlsx";

/**
 * Dónde está cada dato en cada hoja y a qué categoría del catálogo
 * corresponde. Los layouts NO son iguales entre hojas: unas empiezan en
 * la fila 3 y otras en la 5, y la columna del código cambia de sitio.
 */
const HOJAS: Record<string, {
  desde: number; sku: string; desc: string; unidad?: string; precio: string;
  categoria: string;
}> = {
  "CICLON":           { desde: 4, sku: "A", desc: "B", unidad: "D", precio: "C", categoria: "mallas-metalicas" },
  "ELECTROSOLDADAS":  { desde: 5, sku: "A", desc: "B", unidad: "C", precio: "D", categoria: "mallas-metalicas" },
  "PLASTICAS":        { desde: 4, sku: "B", desc: "C", unidad: "D", precio: "E", categoria: "mallas-plasticas" },
  "SEGURIDAD":        { desde: 3, sku: "A", desc: "B", unidad: "C", precio: "D", categoria: "seguridad-perimetral" },
  "PROTECCION HOGAR": { desde: 3, sku: "B", desc: "C", unidad: "D", precio: "E", categoria: "mallas-para-balcones" },
  "NYLON":            { desde: 3, sku: "A", desc: "B", unidad: "C", precio: "D", categoria: "mallas-nylon" },
  "LONAS Y SOMBRAS ": { desde: 4, sku: "A", desc: "B", precio: "C", categoria: "lonas-y-sombras" },
};

/** La hoja de mano de obra. No son productos: son servicios de instalación. */
const HOJA_SERVICIOS = { nombre: "SERVICIOS", desde: 5, sku: "C", desc: "D", unidad: "E", precio: "F" };

/** Las unidades vienen escritas de varias formas en el Excel. */
const UNIDADES: Record<string, string> = {
  m2: "m2", rollo: "rollo", und: "und", unidad: "und", u: "und",
  metro: "ml", m: "ml", ml: "ml", paq: "paq", tramo: "tramo", par: "par",
  kit: "kit", panel: "panel",
};

const normUnidad = (u: string) => UNIDADES[u.trim().toLowerCase()] ?? "und";

/** Un slug estable y único: el nombre manda, el SKU desempata. */
function slugDe(nombre: string, sku: string): string {
  const base = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 70);
  const cola = sku.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${base || "producto"}-${cola}`;
}

interface Item { hoja: string; categoria: string; sku: string; nombre: string; unidad: string; precio: number }

function extraer(hoja: Hoja, m: { desde: number; sku: string; desc: string; unidad?: string; precio: string }) {
  const filas: { sku: string; desc: string; unidad: string; precio: number }[] = [];
  for (const f of hoja) {
    if (f.fila < m.desde) continue;
    const sku = (f.celdas[m.sku] ?? "").trim();
    const desc = (f.celdas[m.desc] ?? "").trim();
    const precio = Number(f.celdas[m.precio] ?? 0);
    // Se descartan separadores, subtotales y encabezados repetidos.
    if (!sku || !desc || desc === "0") continue;
    if (!Number.isFinite(precio) || precio <= 0) continue;
    if (/^(descripci|producto|valor|lista de|und)/i.test(desc)) continue;
    filas.push({ sku, desc, unidad: (f.celdas[m.unidad ?? ""] ?? "").trim(), precio });
  }
  return filas;
}

async function main() {
  const ruta = process.argv[2];
  const dry = process.argv.includes("--dry");
  if (!ruta) {
    console.error('Uso: npx tsx scripts/cargar-lista-precios.ts "<ruta>.xlsx" [--dry]');
    process.exit(1);
  }

  const libro = leerLibro(ruta);
  console.log(`Hojas encontradas: ${Object.keys(libro).join(" · ")}\n`);

  // ── Productos ──
  const items: Item[] = [];
  const repetidos: string[] = [];
  const vistos = new Set<string>();

  for (const [nombreHoja, m] of Object.entries(HOJAS)) {
    const hoja = libro[nombreHoja];
    if (!hoja) { console.log(`  ⚠ falta la hoja "${nombreHoja}"`); continue; }
    for (const f of extraer(hoja, m)) {
      if (vistos.has(f.sku)) { repetidos.push(`${f.sku} (${nombreHoja})`); continue; }
      vistos.add(f.sku);
      items.push({
        hoja: nombreHoja, categoria: m.categoria, sku: f.sku,
        nombre: f.desc, unidad: normUnidad(f.unidad), precio: f.precio,
      });
    }
  }

  // ── Servicios de instalación ──
  const servicios = libro[HOJA_SERVICIOS.nombre]
    ? extraer(libro[HOJA_SERVICIOS.nombre], HOJA_SERVICIOS)
    : [];

  console.log(`Productos en la lista: ${items.length}`);
  console.log(`Servicios de instalación: ${servicios.length}`);
  if (repetidos.length) {
    console.log(`\nCódigos repetidos (se usa la primera aparición): ${repetidos.join(", ")}`);
  }

  const { prisma } = await import("../src/lib/prisma");

  // ── Catálogos que deben existir antes ──
  const categorias = [...new Set(items.map(i => i.categoria))];
  const unidades = [...new Set(items.map(i => i.unidad))];

  const catExistentes = new Set(
    (await prisma.catalogo.findMany({ where: { tipo: "CATEGORIA" }, select: { valor: true } })).map(c => c.valor),
  );
  const uniExistentes = new Set(
    (await prisma.catalogo.findMany({ where: { tipo: "UNIDAD_VENTA" }, select: { valor: true } })).map(c => c.valor),
  );

  const catFaltan = categorias.filter(c => !catExistentes.has(c));
  const uniFaltan = unidades.filter(u => !uniExistentes.has(u));
  if (catFaltan.length) console.log(`\nCategorías a crear: ${catFaltan.join(", ")}`);
  if (uniFaltan.length) console.log(`Unidades a crear:   ${uniFaltan.join(", ")}`);

  if (!dry) {
    for (const valor of catFaltan) {
      await prisma.catalogo.create({
        data: { tipo: "CATEGORIA", valor, label: valor.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
      });
    }
    for (const valor of uniFaltan) {
      await prisma.catalogo.create({ data: { tipo: "UNIDAD_VENTA", valor, label: valor } });
    }
  }

  // ── Productos: crear o actualizar precio ──
  const existentes = await prisma.producto.findMany({
    where: { sku: { in: items.map(i => i.sku) } },
    select: { id: true, sku: true, precioNormal: true, publicado: true, wcId: true, nombre: true },
  });
  const porSku = new Map(existentes.map(p => [p.sku, p]));

  const nuevos = items.filter(i => !porSku.has(i.sku));
  const cambian = items.filter(i => {
    const p = porSku.get(i.sku);
    return p && Number(p.precioNormal ?? 0) !== i.precio;
  });
  const igual = items.length - nuevos.length - cambian.length;

  console.log(`\n── Productos ──`);
  console.log(`  nuevos (sin publicar):     ${nuevos.length}`);
  console.log(`  cambian de precio:         ${cambian.length}`);
  console.log(`  ya estaban al día:         ${igual}`);

  const publicadosQueCambian = cambian.filter(i => porSku.get(i.sku)!.publicado);
  if (publicadosQueCambian.length) {
    console.log(`\n  De los que cambian, ${publicadosQueCambian.length} están PUBLICADOS en la tienda.`);
    console.log(`  Se marcan para exportar: el precio nuevo llegará a costamallas.com`);
    console.log(`  en la sincronización diaria.`);
  }

  if (dry) {
    console.log("\n(simulacro: no se escribió nada)");
    for (const i of nuevos.slice(0, 8)) {
      console.log(`  + ${i.sku.padEnd(16)} ${i.precio.toLocaleString("es-CO").padStart(11)} ${i.unidad.padEnd(6)} ${i.nombre.slice(0, 46)}`);
    }
    if (nuevos.length > 8) console.log(`  … y ${nuevos.length - 8} nuevos más`);
    await prisma.$disconnect();
    return;
  }

  let creados = 0, actualizados = 0;
  const fallos: string[] = [];

  for (const i of nuevos) {
    try {
      await prisma.producto.create({
        data: {
          sku: i.sku,
          nombre: i.nombre,
          slug: slugDe(i.nombre, i.sku),
          // Sin publicar: existe para cotizar, no para la tienda.
          publicado: false,
          visibilidad: "oculto",
          precioNormal: i.precio,
          categorias: [i.categoria],
          acfUnidadVenta: i.unidad,
          acfSkuInterno: i.sku,
          // Los arrays del esquema no tienen valor por defecto, así que
          // hay que darlos explícitamente o Postgres rechaza la fila.
          etiquetas: [],
          acfAplicaciones: [],
          acfColores: [],
          acfNormas: [],
          acfCertificaciones: [],
          // No se marcan listos para exportar: nada de esto debe salir a
          // la tienda por accidente en la sincronización de la noche.
          intListoExportar: false,
          intEstado: "BORRADOR",
          intObservaciones: `Cargado desde la lista de precios (${i.hoja}).`,
          stock: 0,
          enStock: true,
        },
      });
      creados++;
    } catch (e) {
      fallos.push(`${i.sku}: ${(e as Error).message.split("\n").slice(-1)[0].slice(0, 90)}`);
    }
  }

  for (const i of cambian) {
    const p = porSku.get(i.sku)!;
    try {
      await prisma.producto.update({
        where: { id: p.id },
        data: {
          precioNormal: i.precio,
          // Solo si ya vive en la tienda: así el precio nuevo viaja en la
          // sincronización. A un producto interno no se le toca esto.
          ...(p.publicado && p.wcId ? { intListoExportar: true } : {}),
        },
      });
      actualizados++;
    } catch (e) {
      fallos.push(`${i.sku}: ${(e as Error).message.split("\n").slice(-1)[0].slice(0, 90)}`);
    }
  }

  // ── Servicios de instalación ──
  //
  // En el Excel el nombre y el detalle vienen en la misma celda, pegados
  // por un "Descripción:" o un "incluye:". Se separan: el nombre corto es
  // lo que ve el cliente en la línea de la oferta, y el detalle largo va
  // debajo. Una línea de cotización con un párrafo entero de nombre se ve
  // mal y no cabe.
  let servCreados = 0, servActualizados = 0;
  for (const s of servicios) {
    const completo = s.desc.replace(/\s+/g, " ").trim();
    const corte = completo.match(/^(.*?)[\s,]*\b(descripci[oó]n|incluye)\b\s*:?\s*(.*)$/i);
    const nombre = (corte ? corte[1] : completo).replace(/[\s:.,-]+$/, "").trim();
    const detalle = corte ? corte[3].trim() : "";

    // `startsWith` y no igualdad: así una carga anterior que hubiera
    // guardado el nombre largo se corrige sola en vez de duplicarse.
    const existente = await prisma.servicioInstalacion.findFirst({
      where: { nombre: { startsWith: nombre } },
    });

    const datos = {
      nombre,
      precioBase: s.precio,
      unidad: normUnidad(s.unidad),
      descripcion: detalle || null,
    };

    if (existente) {
      const cambia =
        Number(existente.precioBase) !== s.precio ||
        existente.nombre !== nombre ||
        (existente.descripcion ?? "") !== (detalle || "");
      if (cambia) {
        await prisma.servicioInstalacion.update({ where: { id: existente.id }, data: datos });
        servActualizados++;
      }
    } else {
      await prisma.servicioInstalacion.create({ data: { ...datos, activo: true } });
      servCreados++;
    }
  }

  console.log(`\n── Resultado ──`);
  console.log(`  productos creados:      ${creados}`);
  console.log(`  precios actualizados:   ${actualizados}`);
  console.log(`  servicios creados:      ${servCreados}`);
  console.log(`  servicios actualizados: ${servActualizados}`);
  if (fallos.length) {
    console.log(`\n  ${fallos.length} fallo(s):`);
    for (const f of fallos.slice(0, 15)) console.log(`    ${f}`);
  }

  await prisma.log.create({
    data: {
      accion: "PRODUCTOS_CARGA_MASIVA",
      detalle: `Lista de precios: ${creados} creados, ${actualizados} precios actualizados, ${servCreados + servActualizados} servicios`,
      resultado: fallos.length ? "PARCIAL" : "OK",
      totalFilas: creados + actualizados,
    },
  }).catch(() => undefined);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
