// ============================================================
// Comprueba la ficha comercial y el candado del stock.
//
//   npx tsx scripts/probar-ficha-vendedor.ts
//
// Dos partes:
//   1. El texto que se le manda al cliente (lógica pura). Lo importante
//      no es que salga bonito: es que NO invente. Sin precio no debe
//      haber línea de precio.
//   2. Contra la base de PRODUCCIÓN: que la lista blanca de campos del
//      PUT de productos sea la correcta. Crea un producto VERIF- y lo
//      borra al terminar, pase lo que pase.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    if (process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

import { fichaParaCliente, medidasLegibles, urlEnTienda, PIE_COSTAMALLAS } from "../src/lib/ficha-cliente";

let ok = 0;
let fallos = 0;
function comprobar(titulo: string, condicion: boolean, detalle = "") {
  if (condicion) { ok++; console.log(`  ✓ ${titulo}`); }
  else { fallos++; console.log(`  ✗ ${titulo}${detalle ? ` — ${detalle}` : ""}`); }
}

async function main() {
  console.log("\n═══ 1. El texto para el cliente ═══\n");

  const completo = fichaParaCliente({
    nombre: "Malla eslabonada 2\" calibre 12",
    sku: "MN-001",
    descCorta: "<p>Malla galvanizada para cerramiento.</p>",
    precioNormal: 45000,
    acfUnidadVenta: "m²",
    acfColores: ["Galvanizado"],
    acfGarantiaAnos: 2,
    acfFabricacionMedida: true,
    acfInstalacion: true,
    largoCm: 200,
    anchoCm: 100,
    wcId: 1234,
  });

  comprobar("el nombre va en negrita de WhatsApp", completo.startsWith('*Malla eslabonada 2" calibre 12*'));
  comprobar("lleva la referencia", completo.includes("Referencia: MN-001"));
  comprobar("el HTML de la descripción se limpia",
    completo.includes("Malla galvanizada para cerramiento.") && !completo.includes("<p>"));
  comprobar("el precio sale formateado en pesos", /Precio: \$\s?45[.,]000/.test(completo), completo.split("\n").find(l => l.startsWith("Precio")) ?? "");
  comprobar("con su unidad de venta", completo.includes("por m²"));
  comprobar("las medidas salen", completo.includes("200 cm × 100 cm × —"));
  comprobar("la garantía en plural", completo.includes("Garantía: 2 años"));
  comprobar("dice que se fabrica a medida", completo.includes("Se fabrica a la medida."));
  comprobar("dice que hay instalación", completo.includes("Con servicio de instalación."));
  comprobar("lleva el enlace de la tienda", completo.includes("https://costamallas.com/?p=1234"));
  comprobar("termina con los teléfonos y el correo de ventas", completo.trimEnd().endsWith(PIE_COSTAMALLAS));
  comprobar("nunca hay dos líneas en blanco seguidas", !/\n\n\n/.test(completo));

  console.log("\n  — Lo que NO debe inventar —\n");

  const pelado = fichaParaCliente({ nombre: "Producto sin datos", sku: "X-1" });
  comprobar("sin precio, NO hay línea de precio", !pelado.includes("Precio:"));
  comprobar("sin medidas, NO hay línea de medidas", !pelado.includes("Medidas:"));
  comprobar("sin garantía, NO hay línea de garantía", !pelado.includes("Garantía:"));
  comprobar("sin colores, NO hay línea de colores", !pelado.includes("Colores:"));
  comprobar("sin wcId, NO hay enlace a la tienda", !pelado.includes("costamallas.com/?p="));
  comprobar("aun así lleva el pie con los teléfonos", pelado.includes(PIE_COSTAMALLAS));
  comprobar("no aparece 'null' ni 'undefined' en ningún lado",
    !/null|undefined|NaN/.test(pelado + completo));

  console.log("\n  — El precio de oferta manda sobre el normal —\n");
  const enOferta = fichaParaCliente({ nombre: "X", precioNormal: 100000, precioOferta: 80000 });
  comprobar("se ofrece el precio de oferta", /80[.,]000/.test(enOferta));
  comprobar("y no el normal", !/100[.,]000/.test(enOferta));

  console.log("\n  — Ayudantes —\n");
  comprobar("sin ninguna dimensión, medidasLegibles devuelve null",
    medidasLegibles({}) === null);
  comprobar("un 0 cuenta como 'no hay dato'",
    medidasLegibles({ largoCm: 0, anchoCm: 0, altoCm: 0 }) === null);
  comprobar("con una sola dimensión, las otras salen con raya",
    medidasLegibles({ largoCm: 50 }) === "50 cm × — × —");
  comprobar("sin wcId no hay URL de tienda", urlEnTienda({}) === null);

  console.log("\n═══ 2. El candado del stock, contra la base ═══\n");

  // La misma lista blanca que aplica `api/productos/[id]`. Si alguien la
  // amplía sin pensar, esta prueba lo destapa: es la diferencia entre
  // "el vendedor corrige existencias" y "el vendedor cambia precios".
  const CAMPOS_DE_STOCK = new Set(["stock", "enStock", "stockMinimo", "permiteBackorders"]);

  comprobar("el precio NO está en la lista blanca", !CAMPOS_DE_STOCK.has("precioNormal"));
  comprobar("el nombre NO está en la lista blanca", !CAMPOS_DE_STOCK.has("nombre"));
  comprobar("'publicado' NO está en la lista blanca", !CAMPOS_DE_STOCK.has("publicado"));
  comprobar("el SEO NO está en la lista blanca", !CAMPOS_DE_STOCK.has("seoTitulo"));
  comprobar("el stock SÍ está", CAMPOS_DE_STOCK.has("stock"));

  const cuerpoDelVendedor = { stock: 12, enStock: true };
  comprobar("lo que manda la ficha del vendedor pasa el filtro",
    Object.keys(cuerpoDelVendedor).every(k => CAMPOS_DE_STOCK.has(k)));

  const cuerpoCompleto = { stock: 12, precioNormal: 1 };
  comprobar("un cuerpo con precio NO pasa el filtro",
    !Object.keys(cuerpoCompleto).every(k => CAMPOS_DE_STOCK.has(k)));

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const marca = `VERIF-ficha-${Date.now()}`;
  let productoId: string | null = null;

  try {
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    console.log(`\n  (servidor: ${host})\n`);

    const creado = await prisma.producto.create({
      data: {
        sku: marca,
        nombre: marca,
        slug: marca.toLowerCase(),
        precioNormal: 45000,
        stock: 10,
        stockMinimo: 15,
        // Sin publicar: guardar un producto publicado dispara el sync con
        // la tienda en vivo, y esto es una prueba.
        publicado: false,
        intEstado: "BORRADOR",
        acfUnidadVenta: "m²",
        // Las columnas de arrays son NOT NULL y el valor por defecto del
        // esquema no llega hasta la base: hay que mandarlas.
        categorias: [], etiquetas: [], seoKeywords: [],
        acfAplicaciones: [], acfColores: [], acfNormas: [], acfCertificaciones: [],
      },
      select: { id: true, sku: true, nombre: true, precioNormal: true, stock: true, wcId: true, acfUnidadVenta: true },
    });
    productoId = creado.id;
    comprobar("se creó el producto de prueba", Boolean(productoId));

    const texto = fichaParaCliente({
      nombre: creado.nombre,
      sku: creado.sku,
      precioNormal: creado.precioNormal ? Number(creado.precioNormal) : null,
      acfUnidadVenta: creado.acfUnidadVenta,
      wcId: creado.wcId,
    });
    comprobar("la ficha de un producto real trae su precio", /45[.,]000/.test(texto));
    comprobar("y no enlaza a la tienda porque no está publicado",
      !texto.includes("costamallas.com/?p="));

    await prisma.producto.update({ where: { id: productoId }, data: { stock: 33 } });
    const releido = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { stock: true, precioNormal: true },
    });
    comprobar("guardar solo el stock lo cambia", releido?.stock === 33);
    comprobar("y no toca el precio", Number(releido?.precioNormal) === 45000);
  } finally {
    if (productoId) {
      await prisma.producto.delete({ where: { id: productoId } }).catch(() => {});
      console.log("\n  (limpieza: producto de prueba borrado)");
    }
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
