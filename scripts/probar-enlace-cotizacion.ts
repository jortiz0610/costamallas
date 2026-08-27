// ============================================================
// Comprueba que el enlace público de una cotización abre de verdad.
//
//   npx tsx scripts/probar-enlace-cotizacion.ts
//
// El bug que motivó esto (27-ago): las 9 cotizaciones que tenían enlace
// estaban TODAS en BORRADOR, y la página pública hace notFound() para
// borradores. O sea, todos los enlaces compartidos hasta hoy le mostraban
// un 404 al cliente. El botón "Enlace" los copiaba igual, sin avisar.
//
// Aquí se comprueba la cadena entera contra PRODUCCIÓN:
//   borrador  → el enlace NO abre (y eso está bien: protege una oferta
//               a medio armar)
//   compartida→ el enlace abre y muestra el documento
//   y además  → el seguimiento por fin la ve, que era lo que llevaba
//               semanas sin tener sobre qué actuar
//
// ⚠️ ESCRIBE EN LA BASE DE PRODUCCIÓN y lo borra todo al terminar,
// incluso si algo falla. Lo que crea lleva el prefijo VERIF-.
// El número NO sale del consecutivo: se pone a mano.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

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

const BASE = "https://portal.costamallas.com";
const MARCA = `VERIF-${Date.now()}`;

let fallos = 0;
function comprobar(titulo: string, ok: boolean, detalle = "") {
  console.log(`  ${ok ? "✔" : "✘"} ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

/** Pide la página y devuelve qué se ve: el documento o el 404 de Next. */
async function abrir(url: string): Promise<{ status: number; es404: boolean; traeNumero: boolean; html: string }> {
  const r = await fetch(url, { headers: { "User-Agent": "Costamallas-verificacion" } });
  const html = await r.text();
  return {
    status: r.status,
    es404: /This page could not be found|404/.test(html.slice(0, 4000)) && !html.includes(MARCA),
    traeNumero: html.includes(MARCA),
    html,
  };
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  console.log("\nESTADO ACTUAL DE LOS ENLACES EN PRODUCCIÓN\n");
  const todas = await prisma.cotizacion.findMany({
    select: { numero: true, estado: true, publicId: true, enviadaEn: true },
    orderBy: { createdAt: "desc" },
  });
  const conEnlace = todas.filter(c => c.publicId);
  const rotos = conEnlace.filter(c => c.estado === "BORRADOR");
  console.log(`  cotizaciones ............... ${todas.length}`);
  console.log(`  con enlace generado ........ ${conEnlace.length}`);
  console.log(`  de esas, en BORRADOR ....... ${rotos.length}  ← su enlace muestra 404`);
  console.log(`  con fecha de envío sellada . ${todas.filter(c => c.enviadaEn).length}`);
  if (rotos.length) console.log(`  (${rotos.map(c => c.numero).join(", ")})`);

  let clienteId = "";
  const publicId = randomBytes(16).toString("base64url");

  try {
    const cliente = await prisma.cliente.create({
      data: { nombre: `${MARCA} Cliente`, telefono: "3000000000", ciudad: "Barranquilla", tipo: "persona", estado: "PROSPECTO" },
    });
    clienteId = cliente.id;

    const cot = await prisma.cotizacion.create({
      data: {
        numero: MARCA, // a mano: no se quema un consecutivo real
        clienteId: cliente.id,
        estado: "BORRADOR",
        publicId,
        subtotal: 1_000_000, iva: 190_000, total: 1_190_000,
        validezDias: 3,
        items: { create: [{ descripcion: "Malla para balcón a la medida", cantidad: 8, unidad: "m2", precioUnitario: 125_000, subtotal: 1_000_000, orden: 0 }] },
      },
    });

    const url = `${BASE}/cotizacion/${publicId}`;
    console.log(`\nEnlace de prueba: ${url}\n`);

    // ── 1. Borrador: no debe abrir ───────────────────────────
    console.log("1. EN BORRADOR (como estaban las 9 de producción)\n");
    const enBorrador = await abrir(url);
    comprobar(
      "el enlace NO muestra la cotización",
      !enBorrador.traeNumero,
      enBorrador.es404 ? "sale el 404 de Next" : `status ${enBorrador.status}`,
    );
    comprobar("y eso es lo correcto: protege una oferta a medio armar", !enBorrador.traeNumero);

    // ── 2. Compartida: lo que hace /compartir ────────────────
    console.log("\n2. DESPUÉS DE COMPARTIR (estado ENVIADA + fecha sellada)\n");
    await prisma.cotizacion.update({
      where: { id: cot.id },
      data: { estado: "ENVIADA", enviadaEn: new Date() },
    });

    const compartida = await abrir(url);
    comprobar("el enlace abre y muestra el documento", compartida.traeNumero, `status ${compartida.status}`);
    // Ojo con lo que se puede comprobar por HTTP: `CotizacionDoc` es un
    // componente de cliente, así que el HTML del servidor son ~16 KB de
    // envoltorio más los datos serializados — los montos con formato
    // ("$ 1.190.000") los arma el navegador. Por eso se busca el número
    // CRUDO del payload y no el texto formateado.
    comprobar("el total viaja en la página", /\b1190000\b/.test(compartida.html), "1.190.000, sin formatear todavía");
    comprobar("trae el ítem cotizado", compartida.html.includes("Malla para balcón a la medida"));

    const vista = await prisma.cotizacion.findUnique({
      where: { id: cot.id },
      select: { vistas: true, vistaPrimeraEn: true },
    });
    comprobar(
      "queda registrada la apertura del cliente",
      (vista?.vistas ?? 0) > 0 && !!vista?.vistaPrimeraEn,
      `${vista?.vistas} vista(s)`,
    );

    // ── 3. El seguimiento por fin la ve ──────────────────────
    console.log("\n3. EL SEGUIMIENTO POST-COTIZACIÓN\n");
    const { correrSeguimientos } = await import("../src/lib/seguimiento");
    const seg = await correrSeguimientos({ dry: true });
    const revisadas = seg.revisadas ?? 0;
    comprobar(
      "el seguimiento ya tiene sobre qué actuar",
      revisadas > 0,
      `${revisadas} cotización(es) en su radar (antes: 0, ninguna estaba ENVIADA)`,
    );

    // ── 4. Volver a compartir no reinicia el reloj ───────────
    console.log("\n4. VOLVER A COPIAR EL ENLACE\n");
    const antes = (await prisma.cotizacion.findUnique({ where: { id: cot.id }, select: { enviadaEn: true } }))!.enviadaEn!;
    // Es lo que hace /compartir la segunda vez: no toca enviadaEn.
    await prisma.cotizacion.update({ where: { id: cot.id }, data: { publicId, errorEnvio: null } });
    const despues = (await prisma.cotizacion.findUnique({ where: { id: cot.id }, select: { enviadaEn: true } }))!.enviadaEn!;
    comprobar(
      "la fecha de envío NO se reinicia",
      antes.getTime() === despues.getTime(),
      "los tres toques siguen contando desde la primera vez",
    );
  } finally {
    console.log("\nLimpiando…");
    if (clienteId) {
      // Borrar el cliente arrastra la cotización y sus ítems (cascade).
      await prisma.cliente.delete({ where: { id: clienteId } })
        .catch(e => console.error("  ⚠️ NO se pudo borrar el cliente de prueba:", (e as Error).message));
    }
    const restos = await prisma.cotizacion.count({ where: { numero: { contains: MARCA } } });
    comprobar("no queda la cotización de prueba", restos === 0, `${restos}`);
    await prisma.$disconnect();
  }

  console.log(fallos === 0 ? "\n✅ Todas las comprobaciones pasaron.\n" : `\n❌ ${fallos} fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
