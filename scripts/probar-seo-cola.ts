// ============================================================
// Comprueba la cola de revisión del SEO contra la base REAL.
//
//   npx tsx scripts/probar-seo-cola.ts
//
// Qué comprueba y por qué esto y no otra cosa:
//
//  1. La ESTIMACIÓN de costo, con los productos de verdad. Es el número
//     que se mira antes de gastar; si estuviera mal, se decidiría a
//     ciegas.
//  2. Que APROBAR escribe en el producto lo que se aprobó, aplica el alt
//     de las imágenes y respeta la regla del slug. Ésta es la mitad
//     peligrosa: aprobar publica en costamallas.com.
//  3. Que un producto SIN PUBLICAR no dispara sincronización.
//
// Lo que NO comprueba: la llamada a Claude. La API key vive cifrada en
// `configuracion` con la ENCRYPTION_KEY de producción, que no es la de
// local, así que desde este PC no se puede descifrar. Ese tramo se
// ejercita la primera vez que alguien lance un lote desde el portal.
//
// ⚠️ Escribe en la base de producción, pero SOLO sobre un producto que
// no está publicado, y deja todo como estaba: guarda los valores
// previos y los restaura en el `finally`, pase lo que pase.
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

let fallos = 0;
function comprobar(titulo: string, ok: boolean, detalle = "") {
  console.log(`  ${ok ? "✔" : "✘"} ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { estimarLote } = await import("../src/lib/seo-ia");
  const { aprobarPropuesta, rechazarPropuesta } = await import("../src/lib/seo-cola");

  // ── 1. Estimación ────────────────────────────────────────
  console.log("\n1. ESTIMACIÓN DE COSTO (productos reales, sin llamar a la IA)\n");

  const sinSeo = await prisma.producto.findMany({
    where: { intEstado: { not: "ARCHIVADO" }, OR: [{ seoTitulo: null }, { seoTitulo: "" }] },
    select: { id: true, publicado: true },
  });
  const est = await estimarLote(sinSeo.map(p => p.id));

  console.log(`   productos sin SEO ....... ${est.productos}`);
  console.log(`   publicados de esos ...... ${sinSeo.filter(p => p.publicado).length}`);
  console.log(`   modelo .................. ${est.modelo}`);
  console.log(`   tokens entrada (est.) ... ${est.tokensEntrada.toLocaleString("es-CO")}`);
  console.log(`   tokens salida  (est.) ... ${est.tokensSalida.toLocaleString("es-CO")}`);
  console.log(`   COSTO TOTAL (est.) ...... US$ ${est.costoUSD.toFixed(2)}`);
  console.log(`   por producto ............ US$ ${(est.costoUSD / Math.max(est.productos, 1)).toFixed(4)}\n`);

  comprobar("la estimación encuentra productos", est.productos > 0);
  comprobar("el costo estimado es positivo", est.costoUSD > 0);
  comprobar(
    "el prompt no se dispara de tamaño",
    est.tokensEntrada / Math.max(est.productos, 1) < 20_000,
    `${Math.round(est.tokensEntrada / Math.max(est.productos, 1))} tokens por producto`,
  );

  // ── 2. Aprobar escribe lo aprobado ───────────────────────
  console.log("\n2. APROBAR UNA PROPUESTA (sobre un producto SIN PUBLICAR)\n");

  const cobaya = await prisma.producto.findFirst({
    where: { publicado: false, wcId: null, intEstado: { not: "ARCHIVADO" } },
    select: {
      id: true, sku: true, nombre: true, slug: true, publicado: true,
      seoTitulo: true, seoDescripcion: true, seoKeywords: true, seoTexto: true,
      imagenes: { select: { id: true, altText: true, titulo: true }, take: 1 },
    },
  });

  if (!cobaya) {
    console.log("   No hay ningún producto sin publicar sobre el que probar sin tocar la tienda.");
    console.log("   Se omite esta parte: probarlo contra un producto publicado lo mandaría a costamallas.com.");
    await prisma.$disconnect();
    return resumen();
  }

  console.log(`   Producto de prueba: ${cobaya.sku} — ${cobaya.nombre}`);
  console.log(`   (no publicado, sin wcId: nada de esto llega a la tienda)\n`);

  const previo = { ...cobaya };
  const imagenPrevia = cobaya.imagenes[0];
  const marca = `VERIF-${Date.now()}`;
  let propuestaId = "";

  try {
    const propuesta = await prisma.seoPropuesta.create({
      data: {
        productoId: cobaya.id,
        loteId: marca,
        estado: "PROPUESTO",
        seoTitulo: `${marca} titulo`,
        seoDescripcion: `${marca} descripcion`,
        seoKeywords: ["verificacion", "no-usar"],
        seoTexto: `${marca} texto de venta`,
        // El slug propuesto NO se aplica: así se comprueba que la
        // casilla manda y que un slug malo no puede colarse.
        slug: `${marca}-slug-que-no-debe-aplicarse`.toLowerCase(),
        aplicaSlug: false,
        imagenes: imagenPrevia ? [{ id: imagenPrevia.id, altText: `${marca} alt`, titulo: `${marca} titulo img` }] : [],
        modelo: "verificacion",
      },
    });
    propuestaId = propuesta.id;

    const r = await aprobarPropuesta(propuesta.id, "script-verificacion");
    console.log(`   Resultado: ${r.detalle}`);
    console.log(`   Sync: ${r.sync}\n`);

    comprobar("la aprobación devuelve ok", r.ok);
    comprobar(
      "NO se sincroniza un producto sin publicar",
      !!r.sync && /no está publicado/i.test(r.sync),
      r.sync,
    );

    const despues = await prisma.producto.findUnique({
      where: { id: cobaya.id },
      select: { seoTitulo: true, seoDescripcion: true, seoKeywords: true, seoTexto: true, slug: true },
    });
    comprobar("el meta título quedó escrito", despues?.seoTitulo === `${marca} titulo`, despues?.seoTitulo ?? "vacío");
    comprobar("la meta descripción quedó escrita", despues?.seoDescripcion === `${marca} descripcion`);
    comprobar("el texto de venta quedó escrito", despues?.seoTexto === `${marca} texto de venta`);
    comprobar("las palabras clave quedaron", (despues?.seoKeywords ?? []).includes("verificacion"));
    comprobar(
      "el slug NO cambió (la casilla estaba apagada)",
      despues?.slug === previo.slug,
      `sigue en "${despues?.slug}"`,
    );

    if (imagenPrevia) {
      const img = await prisma.acfImagen.findUnique({ where: { id: imagenPrevia.id }, select: { altText: true } });
      comprobar("el alt de la imagen se aplicó", img?.altText === `${marca} alt`, img?.altText ?? "vacío");
    }

    const estado = await prisma.seoPropuesta.findUnique({ where: { id: propuesta.id }, select: { estado: true, revisadoEn: true } });
    comprobar("la propuesta quedó APROBADA con fecha", estado?.estado === "APROBADO" && !!estado.revisadoEn);

    // Aprobar dos veces no puede volver a escribir ni a publicar.
    const otra = await aprobarPropuesta(propuesta.id, "script-verificacion");
    comprobar("aprobar dos veces se rechaza", !otra.ok, otra.detalle);

    const rech = await rechazarPropuesta(propuesta.id, "script-verificacion");
    comprobar("rechazar lo ya aplicado se rechaza", !rech.ok, rech.detalle);
  } finally {
    // Dejar la base como estaba, pase lo que pase.
    await prisma.producto.update({
      where: { id: previo.id },
      data: {
        seoTitulo: previo.seoTitulo,
        seoDescripcion: previo.seoDescripcion,
        seoKeywords: previo.seoKeywords,
        seoTexto: previo.seoTexto,
        slug: previo.slug,
      },
    }).catch(e => console.error("   ⚠️ NO se pudo restaurar el producto:", (e as Error).message));

    if (imagenPrevia) {
      await prisma.acfImagen.update({
        where: { id: imagenPrevia.id },
        data: { altText: imagenPrevia.altText, titulo: imagenPrevia.titulo },
      }).catch(() => undefined);
    }
    if (propuestaId) {
      await prisma.seoPropuesta.delete({ where: { id: propuestaId } }).catch(() => undefined);
    }
    console.log("\n   Base restaurada: producto, imagen y propuesta de prueba borrados.");
    await prisma.$disconnect();
  }

  resumen();
}

function resumen() {
  console.log(fallos === 0 ? "\n✅ Todo lo comprobable pasó.\n" : `\n❌ ${fallos} comprobación(es) fallaron.\n`);
  console.log("NO comprobado aquí: la llamada a Claude (la API key está cifrada con");
  console.log("la clave de producción). Ese tramo se ejercita al lanzar el primer lote.\n");
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
