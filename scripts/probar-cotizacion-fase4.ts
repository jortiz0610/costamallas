// ============================================================
// Comprueba lo nuevo de la cotización: miniaturas, prórroga,
// cotizaciones de prueba y productos sin descuento.
//
//   npx tsx scripts/probar-cotizacion-fase4.ts
//
// Fabrica un cliente, un producto con foto y varias cotizaciones VERIF-
// contra la base de PRODUCCIÓN, y lo borra todo al terminar aunque algo
// falle. Nada de lo que crea entra en informes: las de prueba están
// marcadas y las demás se borran.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

(process.env as Record<string, string>).NODE_ENV = "production";

for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

// Ojo: NADA de `import` estático de src/lib aquí. El hoisting de ESM los
// evalúa ANTES de la línea que fija NODE_ENV, así que lib/prisma.ts se
// instancia en modo desarrollo y registra todas las consultas.

let ok = 0;
let fallos = 0;
function comprobar(titulo: string, condicion: boolean, detalle = "") {
  if (condicion) { ok++; console.log(`  ✓ ${titulo}`); }
  else { fallos++; console.log(`  ✗ ${titulo}${detalle ? ` — ${detalle}` : ""}`); }
}

const DIA = 86_400_000;
const marca = `VERIF-f4-${Date.now()}`;

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { completarFotos, fotosPrincipales } = await import("../src/lib/cotizacion-imagenes");
  const { borrarPruebas, siguienteNumeroPrueba, PREFIJO_PRUEBA, esNumeroDePrueba, SIN_PRUEBAS } =
    await import("../src/lib/cotizaciones-prueba");
  const { DIAS_MAX_VENDEDOR, PRORROGAS_MAX_VENDEDOR } = await import("../src/lib/politica-comercial");

  const creados = { cliente: "", producto: "", cotizaciones: [] as string[] };

  try {
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    console.log(`\nServidor: ${host}`);

    console.log("\n═══ 1. Constantes y ayudantes ═══\n");
    comprobar("el tope del vendedor para aplazar es 15 días", DIAS_MAX_VENDEDOR === 15);
    comprobar("puede aplazar 2 veces", PRORROGAS_MAX_VENDEDOR === 2);
    comprobar("un número de prueba se reconoce", esNumeroDePrueba(`${PREFIJO_PRUEBA}-001`));
    comprobar("un número real NO se confunde con uno de prueba", !esNumeroDePrueba("COT-12075"));
    comprobar("el filtro de informes excluye las pruebas", SIN_PRUEBAS.esPrueba === false);

    console.log("\n═══ 2. Preparar el terreno ═══\n");

    const cliente = await prisma.cliente.create({
      data: { nombre: marca, tipo: "empresa", estado: "PROSPECTO", activo: true },
      select: { id: true },
    });
    creados.cliente = cliente.id;

    const producto = await prisma.producto.create({
      data: {
        sku: marca, nombre: marca, slug: marca.toLowerCase(),
        precioNormal: 50000, stock: 10, publicado: false, intEstado: "BORRADOR",
        // El que nos interesa: no admite descuento por línea.
        sinDescuento: true,
        categorias: [], etiquetas: [], seoKeywords: [],
        acfAplicaciones: [], acfColores: [], acfNormas: [], acfCertificaciones: [],
      },
      select: { id: true, sinDescuento: true },
    });
    creados.producto = producto.id;
    comprobar("el producto se puede marcar como 'sin descuento'", producto.sinDescuento === true);

    await prisma.acfImagen.create({
      data: {
        productoId: producto.id,
        urlImagen: "https://costamallas.com/wp-content/uploads/verif.jpg",
        esPrincipal: true, posicion: 0,
      },
    });

    console.log("\n═══ 3. Las miniaturas ═══\n");

    const mapa = await fotosPrincipales([producto.id]);
    comprobar("se encuentra la foto principal del producto",
      mapa.get(producto.id) === "https://costamallas.com/wp-content/uploads/verif.jpg");

    const rellenados = await completarFotos([
      { productoId: producto.id, imagenUrl: null },
      { productoId: producto.id, imagenUrl: "https://otra.jpg" },
      { productoId: null, imagenUrl: null },
    ]);
    comprobar("al ítem sin foto se le pone la del catálogo", Boolean(rellenados[0].imagenUrl));
    comprobar("un ítem que YA tenía foto no se toca", rellenados[1].imagenUrl === "https://otra.jpg");
    comprobar("un ítem sin producto (instalación) se queda sin foto", rellenados[2].imagenUrl === null);

    const productoSinFoto = await prisma.producto.findFirst({
      where: { imagenes: { none: {} }, intEstado: { not: "ARCHIVADO" } },
      select: { id: true, sku: true },
    });
    if (productoSinFoto) {
      const r = await completarFotos([{ productoId: productoSinFoto.id, imagenUrl: null }]);
      comprobar("un producto SIN fotos sigue sin foto (no se inventa nada)", r[0].imagenUrl === null,
        `probado con ${productoSinFoto.sku}`);
    }

    console.log("\n═══ 4. Aplazar el vencimiento ═══\n");

    const hace40 = new Date(Date.now() - 40 * DIA);
    const vencida = await prisma.cotizacion.create({
      data: {
        numero: `${marca}-VENC`, clienteId: cliente.id, estado: "VENCIDA",
        createdAt: hace40, validezDias: 30, subtotal: 100000, iva: 19000, total: 119000,
      },
      select: { id: true, createdAt: true, validezDias: true, prorrogaDias: true, prorrogas: true },
    });
    creados.cotizaciones.push(vencida.id);

    const venceCon = (v: number, p: number) => vencida.createdAt.getTime() + (v + p) * DIA;
    comprobar("sin prórroga, ya venció", venceCon(vencida.validezDias, 0) < Date.now());
    comprobar("con 5 días más seguiría vencida (llevaba 40 y la validez era 30)",
      venceCon(vencida.validezDias, 5) < Date.now());
    comprobar("con 15 días más revive", venceCon(vencida.validezDias, 15) > Date.now());

    const aplazada = await prisma.cotizacion.update({
      where: { id: vencida.id },
      data: { prorrogaDias: 30, prorrogas: 2, prorrogadaEn: new Date(), estado: "ENVIADA" },
      select: { estado: true, prorrogaDias: true, prorrogas: true, validezDias: true },
    });
    comprobar("la validez del documento NO cambia", aplazada.validezDias === 30,
      "el cliente vio 30 días y eso es lo que dice la oferta");
    comprobar("la prórroga se guarda aparte", aplazada.prorrogaDias === 30);
    comprobar("vuelve a estar ENVIADA", aplazada.estado === "ENVIADA");
    comprobar("un vendedor ya no podría aplazarla más", aplazada.prorrogas >= PRORROGAS_MAX_VENDEDOR);

    // Y que la corrida diaria respete la prórroga.
    const { marcarVencidos } = await import("../src/lib/vencimientos");
    const seco = await marcarVencidos({ dry: true });
    comprobar("la corrida diaria NO la vuelve a vencer",
      !seco.cotizaciones.vencidas.includes(`${marca}-VENC`),
      `vencería: ${seco.cotizaciones.vencidas.join(", ") || "ninguna"}`);

    console.log("\n═══ 5. Cotizaciones de prueba ═══\n");

    const n1 = await siguienteNumeroPrueba();
    const n2 = await siguienteNumeroPrueba();
    comprobar("la numeración de prueba lleva su prefijo", esNumeroDePrueba(n1), n1);
    comprobar("y avanza", n1 !== n2, `${n1} → ${n2}`);
    comprobar("no toca el consecutivo de COT", !n1.startsWith("COT"));

    const prueba = await prisma.cotizacion.create({
      data: {
        numero: n1, clienteId: cliente.id, estado: "BORRADOR", esPrueba: true,
        subtotal: 1000, iva: 190, total: 1190,
      },
      select: { id: true, esPrueba: true },
    });
    creados.cotizaciones.push(prueba.id);
    comprobar("la cotización queda marcada como prueba", prueba.esPrueba === true);

    const pedidoPrueba = await prisma.pedido.create({
      data: {
        numero: `${marca}-PED`, cotizacionId: prueba.id, clienteId: cliente.id,
        estado: "NUEVO", origen: "COTIZACION", total: 1190,
        // La marca se hereda.
        esPrueba: true,
      },
      select: { id: true, esPrueba: true },
    });
    comprobar("el pedido hereda la marca", pedidoPrueba.esPrueba === true);

    // Lo que de verdad importa: que no aparezca donde se cuenta plata.
    const enEmbudo = await prisma.cotizacion.count({
      where: { ...SIN_PRUEBAS, id: prueba.id },
    });
    comprobar("NO aparece en las consultas que filtran pruebas", enEmbudo === 0);
    const sinFiltro = await prisma.cotizacion.count({ where: { id: prueba.id } });
    comprobar("pero sí existe y se ve en la lista de cotizaciones", sinFiltro === 1);

    const cuenta = await borrarPruebas({ dry: true });
    comprobar("el borrado en bloque la encuentra", cuenta.numeros.includes(n1),
      `encontró ${cuenta.cotizaciones}`);
    comprobar("y encuentra su pedido", cuenta.pedidos >= 1);
    comprobar("el modo seco no borró nada",
      (await prisma.cotizacion.count({ where: { id: prueba.id } })) === 1);

    const borradas = await borrarPruebas();
    comprobar("borrar en bloque se lleva la cotización",
      (await prisma.cotizacion.count({ where: { id: prueba.id } })) === 0,
      `borró ${borradas.cotizaciones}`);
    comprobar("y su pedido", (await prisma.pedido.count({ where: { id: pedidoPrueba.id } })) === 0);
    comprobar("la cotización REAL de prueba (la VENC) sigue ahí",
      (await prisma.cotizacion.count({ where: { id: vencida.id } })) === 1,
      "no se llevó por delante lo que no estaba marcado");
  } finally {
    console.log("\n  (limpieza)");
    await prisma.pedido.deleteMany({ where: { numero: { startsWith: marca } } }).catch(() => {});
    await prisma.cotizacion.deleteMany({ where: { numero: { startsWith: marca } } }).catch(() => {});
    await prisma.cotizacion.deleteMany({ where: { clienteId: creados.cliente } }).catch(() => {});
    if (creados.producto) {
      await prisma.acfImagen.deleteMany({ where: { productoId: creados.producto } }).catch(() => {});
      await prisma.producto.delete({ where: { id: creados.producto } }).catch(() => {});
    }
    if (creados.cliente) await prisma.cliente.delete({ where: { id: creados.cliente } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
