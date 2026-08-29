// ============================================================
// Comprueba la bandeja de producción: visita técnica y SG-SST.
//
//   npx tsx scripts/probar-trabajos.ts
//
// Lo que se quiere destapar:
//   · Que el formato de la visita cubra lo que dice el archivo de la
//     empresa (cerca eléctrica y malla invisible) y que cada tipo de
//     trabajo vea solo lo suyo.
//   · Que los documentos de SG-SST se REGISTREN y que quede escrito que
//     NO se guardan. Si algún día alguien pone `almacenado: true` sin
//     que haya dónde guardar, esta prueba lo dice.
//   · Que borrar la cotización se lleve su visita y su gente.
//
// Crea y borra su propio cliente y su cotización VERIF-.
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

let ok = 0;
let fallos = 0;
function comprobar(titulo: string, condicion: boolean, detalle = "") {
  if (condicion) { ok++; console.log(`  ✓ ${titulo}`); }
  else { fallos++; console.log(`  ✗ ${titulo}${detalle ? ` — ${detalle}` : ""}`); }
}

const marca = `VERIF-trab-${Date.now()}`;

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const {
    SECCIONES_VISITA, seccionesDe, DOCUMENTOS_SGSST, ROLES_SGSST, etiquetaRolSgsst,
  } = await import("../src/lib/visita-tecnica");
  const {
    ALMACENAMIENTO_ACTIVO, avisoDeAlmacenamiento,
  } = await import("../src/lib/almacenamiento-documentos");

  let clienteId = "";
  let cotizacionId = "";

  try {
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    console.log(`\nServidor: ${host}`);

    console.log("\n═══ 1. El formato de la visita ═══\n");

    const claves = SECCIONES_VISITA.flatMap(s => s.campos.map(c => c.k));
    comprobar("no hay claves repetidas entre secciones", new Set(claves).size === claves.length);
    comprobar("todos los campos llevan etiqueta", SECCIONES_VISITA.every(s => s.campos.every(c => c.label)));

    console.log("\n  — Cerca eléctrica: lo que pide el archivo de la empresa —");
    const cerca = seccionesDe("cerca").flatMap(s => s.campos.map(c => c.k));
    for (const [k, que] of [
      ["muroAltura", "altura del muro"], ["muroMaterial", "material del muro"],
      ["metrosLineales", "metros lineales"], ["postes", "postes"],
      ["aisladores", "aisladores"], ["alambre", "alambre"], ["tapones", "tapones"],
      ["placas", "placas"], ["cable", "cable"], ["tubosEmt", "tubos EMT"],
      ["acabado", "acabado"], ["hayPuntoElectrico", "punto eléctrico"],
      ["distanciaPunto", "distancias"],
    ] as [string, string][]) {
      comprobar(`pregunta por ${que}`, cerca.includes(k));
    }

    console.log("\n  — Malla invisible —");
    const malla = seccionesDe("malla").flatMap(s => s.campos.map(c => c.k));
    for (const [k, que] of [
      ["balconAncho", "medidas del balcón"], ["ventanasMedidas", "medidas de las ventanas"],
      ["balconTieneVidrio", "si el balcón tiene vidrio"],
      ["balconMaterialSuperior", "material de la parte superior"],
    ] as [string, string][]) {
      comprobar(`pregunta por ${que}`, malla.includes(k));
    }

    comprobar("una visita de malla NO pregunta por aisladores", !malla.includes("aisladores"));
    comprobar("una visita de cerca NO pregunta por el balcón", !cerca.includes("balconAncho"));
    comprobar("las dos ven las secciones comunes",
      cerca.includes("tipoInmueble") && malla.includes("tipoInmueble"));
    comprobar("'ambos' lo enseña todo", seccionesDe("ambos").length === SECCIONES_VISITA.length);

    console.log("\n═══ 2. El almacenamiento de documentos ═══\n");

    comprobar("HOY el almacén NO guarda archivos", ALMACENAMIENTO_ACTIVO.guardaArchivos === false,
      "si esto falla, alguien activó un almacén: revisa que sea privado de verdad");
    comprobar("y dice por qué", Boolean(ALMACENAMIENTO_ACTIVO.motivo));
    comprobar("hay aviso para la pantalla", Boolean(avisoDeAlmacenamiento()));

    const r = await ALMACENAMIENTO_ACTIVO.guardar(
      { nombre: "cedula.pdf", tamano: 1234 },
      { cotizacionId: "x", personaId: "y", tipo: "cedula" },
    );
    comprobar("guardar devuelve almacenado=false", r.almacenado === false);
    comprobar("y el motivo viaja con el resultado", Boolean(r.motivo));

    comprobar("los documentos que se piden incluyen cédula, planilla y alturas",
      ["cedula", "planilla", "alturas"].every(k => DOCUMENTOS_SGSST.some(d => d.k === k)));
    comprobar("existen los roles de coordinador SST y de alturas",
      ["COORD_SST", "COORD_ALTURAS"].every(v => ROLES_SGSST.some(x => x.v === v)));
    comprobar("el rol se traduce a castellano", etiquetaRolSgsst("COORD_ALTURAS") === "Coordinador de alturas");

    console.log("\n═══ 3. Contra la base ═══\n");

    const cliente = await prisma.cliente.create({
      data: { nombre: marca, tipo: "empresa", estado: "PROSPECTO", activo: true },
      select: { id: true },
    });
    clienteId = cliente.id;

    const cot = await prisma.cotizacion.create({
      data: {
        numero: marca, clienteId, estado: "BORRADOR",
        subtotal: 100000, iva: 19000, total: 119000,
        requiereVisita: true, requiereSgsst: true,
        ciudadInstalacion: "Barranquilla", direccionInstalacion: "Cra 1 #2-3",
      },
      select: { id: true, requiereVisita: true, requiereSgsst: true },
    });
    cotizacionId = cot.id;
    comprobar("la cotización guarda las dos casillas",
      cot.requiereVisita === true && cot.requiereSgsst === true);

    const visita = await prisma.visitaTecnica.create({
      data: {
        cotizacionId, estado: "SOLICITADA",
        ciudad: "Barranquilla", direccion: "Cra 1 #2-3",
        datos: { muroAltura: "2.4", muroMaterial: "bloque", metrosLineales: "45" },
      },
      select: { id: true, estado: true, devueltaEn: true },
    });
    comprobar("la visita nace SOLICITADA y sin devolver",
      visita.estado === "SOLICITADA" && visita.devueltaEn === null);

    let choco = false;
    try {
      await prisma.visitaTecnica.create({ data: { cotizacionId } });
    } catch { choco = true; }
    comprobar("no se pueden crear DOS visitas de la misma cotización", choco,
      "dos visitas dejarían al coordinador sin saber cuál es la buena");

    const devuelta = await prisma.visitaTecnica.update({
      where: { id: visita.id },
      data: { estado: "REALIZADA", devueltaEn: new Date(), requisicion: { proyecto: marca, materiales: [{ cantidad: 45, detalle: "Malla", unidad: "m" }] } },
      select: { estado: true, devueltaEn: true, requisicion: true },
    });
    comprobar("se puede entregar al vendedor", devuelta.devueltaEn !== null);
    comprobar("la requisición se guarda con sus líneas",
      (devuelta.requisicion as { materiales?: unknown[] })?.materiales?.length === 1);

    const persona = await prisma.sgsstPersona.create({
      data: {
        cotizacionId, nombre: "Trabajador de prueba", cedula: "123", rol: "TRABAJADOR",
        requeridos: { cedula: true, planilla: true, alturas: false },
        documentos: [{
          tipo: "cedula", nombreArchivo: "cedula.pdf", tamano: 1234,
          subidoEn: new Date().toISOString(), subidoPorId: null,
          almacenado: false, motivo: ALMACENAMIENTO_ACTIVO.motivo,
        }],
      },
      select: { id: true, documentos: true, requeridos: true },
    });
    const docs = persona.documentos as { almacenado: boolean; motivo?: string }[];
    comprobar("el documento queda REGISTRADO", docs.length === 1);
    comprobar("marcado como NO almacenado", docs[0].almacenado === false);
    comprobar("con el motivo escrito en la fila", Boolean(docs[0].motivo));
    comprobar("las casillas opcionales se guardan tal cual",
      (persona.requeridos as Record<string, boolean>).alturas === false);

    await prisma.sgsstPersona.create({
      data: { cotizacionId, nombre: "Coordinador SST", rol: "COORD_SST", requeridos: {}, documentos: [] },
    });
    comprobar("caben varias personas por cotización",
      (await prisma.sgsstPersona.count({ where: { cotizacionId } })) === 2);

    // Y lo importante para no dejar basura: el borrado en cascada.
    await prisma.cotizacion.delete({ where: { id: cotizacionId } });
    cotizacionId = "";
    comprobar("borrar la cotización se lleva su visita",
      (await prisma.visitaTecnica.count({ where: { id: visita.id } })) === 0);
    comprobar("y se lleva a su gente",
      (await prisma.sgsstPersona.count({ where: { cotizacionId: cot.id } })) === 0);
  } finally {
    console.log("\n  (limpieza)");
    if (cotizacionId) await prisma.cotizacion.delete({ where: { id: cotizacionId } }).catch(() => {});
    if (clienteId) await prisma.cliente.delete({ where: { id: clienteId } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
