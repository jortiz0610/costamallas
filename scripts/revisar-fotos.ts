// ============================================================
// Revisa qué imágenes del catálogo están rotas.
//
//   npx tsx scripts/revisar-fotos.ts
//
// Es de SOLO LECTURA: pide cada imagen con HEAD y reporta las que no
// responden. No borra ni corrige nada — para eso está el botón de
// limpiar imágenes rotas del portal (/api/imagenes/limpiar-rotas).
//
// Sirve para saber el tamaño del problema antes de tocar nada: una
// imagen rota tumba la sincronización con WooCommerce del producto
// entero, así que conviene saber cuántos y cuáles son.
//
// Carga `.env.local` antes que `.env` por lo mismo que
// aplicar-migracion.ts: en `.env` está el host directo de Supabase, que
// resuelve solo por IPv6 y desde muchas redes no responde.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

// Ojo: antes de instanciar PrismaClient.
for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    if (process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

/** HEAD con tope de tiempo. Un servidor que no contesta cuenta como rota. */
async function estado(url: string): Promise<number> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 12_000);
    const r = await fetch(url, { method: "HEAD", signal: c.signal });
    clearTimeout(t);
    return r.status;
  } catch {
    return 0;
  }
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const productos = await prisma.producto.findMany({
    where: { intEstado: { not: "ARCHIVADO" } },
    include: { imagenes: { orderBy: { posicion: "asc" } } },
    orderBy: { nombre: "asc" },
  });

  const rotos: {
    sku: string; nombre: string; wcId: number | null; publicado: boolean;
    total: number; malas: number; principalRota: boolean; enCatalogo: number;
  }[] = [];
  let sinImagenes = 0;

  for (const p of productos) {
    if (p.imagenes.length === 0) { sinImagenes++; continue; }

    let malas = 0, principalRota = false, enCatalogo = 0;
    for (const img of p.imagenes) {
      const st = await estado(img.urlImagen);
      if (st !== 200 && st !== 206) {
        malas++;
        if (img.esPrincipal) principalRota = true;
      }
      if (/catalogo\.costamallas\.com/.test(img.urlImagen)) enCatalogo++;
    }
    if (malas > 0) {
      rotos.push({
        sku: p.sku, nombre: p.nombre, wcId: p.wcId, publicado: p.publicado,
        total: p.imagenes.length, malas, principalRota, enCatalogo,
      });
    }
  }

  console.log(
    `Productos activos: ${productos.length} · sin imágenes: ${sinImagenes} · ` +
    `con imágenes rotas: ${rotos.length}\n`,
  );

  if (rotos.length) {
    console.log(
      "SKU".padEnd(24), "img", "rotas", "princ", "catálogo", " wcId", "pub", "nombre",
    );
    // Primero los que tienen rota la principal: son los que se ven mal
    // en la tienda, no solo en una galería secundaria.
    const orden = rotos.sort(
      (a, b) => Number(b.principalRota) - Number(a.principalRota) || b.malas - a.malas,
    );
    for (const r of orden) {
      console.log(
        r.sku.padEnd(24),
        String(r.total).padStart(3),
        String(r.malas).padStart(5),
        (r.principalRota ? "SÍ" : "no").padStart(5),
        String(r.enCatalogo).padStart(8),
        String(r.wcId ?? "-").padStart(5),
        (r.publicado ? "sí" : "no").padStart(3),
        r.nombre.slice(0, 40),
      );
    }
    console.log(
      "\nPara limpiarlas: Productos → Imágenes → \"Limpiar rotas\" en el portal.",
    );
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
