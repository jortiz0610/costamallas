// ============================================================
// Los dos avisos que recibe el EQUIPO.
//
//   npx tsx scripts/probar-avisos-internos.ts
//
// Comprueba lo que decide si estos correos molestan o sirven:
//
//   · Que le lleguen al asesor de LA OFERTA, no a todo el mundo.
//   · Que a un asesor dado de baja no se le siga escribiendo.
//   · Que la falta de asesor o de correo NO sea un fallo: la oferta se
//     aprueba igual, y el pedido ya existe.
//   · Que ya no exista ninguna plantilla huérfana en el catálogo.
//
// Contra PRODUCCIÓN, y borra lo que crea.
//
// NO comprueba que el SMTP entregue —de eso se encarga
// scripts/probar-visitas.ts— sino a QUIÉN apunta cada aviso, que es lo
// que se puede equivocar sin que nadie lo note: un correo que sale bien
// pero al asesor equivocado se ve exactamente igual que uno correcto.
// Por eso el asesor de prueba lleva una dirección no entregable.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
for (const a of [".env.local", ".env"]) {
  if (!existsSync(a)) continue;
  for (const l of readFileSync(a, "utf8").split("\n")) {
    const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env[m[1]]) continue;   // el entorno manda
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { avisarCotizacionAprobada, avisarVisitaLista } = await import("../src/lib/avisos-internos");
  const { PLANTILLAS } = await import("../src/lib/correo-plantillas");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  const cfg = await prisma.configuracion.findFirst({ where: { clave: "empresa_email" } });
  const buzon = (cfg?.valor ?? "").trim();
  console.log(`  Los correos de prueba van a: ${buzon || "(sin configurar)"}\n`);

  console.log("═══ 1. Ninguna plantilla queda sin dueño ═══\n");

  // Se recorre el código buscando cada clave. Una plantilla que nadie
  // llama es texto que alguien escribió y que ningún cliente lee.
  const { execSync } = await import("node:child_process");
  const huerfanas: string[] = [];
  for (const p of PLANTILLAS) {
    const usos = execSync(
      `grep -rl "\\"${p.clave}\\"" src --include=*.ts | grep -v correo-plantillas | wc -l`,
      { encoding: "utf8" },
    ).trim();
    if (usos === "0") huerfanas.push(p.clave);
  }
  comprobar(`las ${PLANTILLAS.length} plantillas tienen quien las dispare`,
    huerfanas.length === 0, `sin disparador: ${huerfanas.join(", ")}`);

  const creados: string[] = [];
  let clienteId: string | null = null;
  let usuarioId: string | null = null;

  try {
    // Correo unico y NO entregable a proposito: aqui se comprueba a
    // quien APUNTA el aviso, no que el SMTP funcione — eso ya lo prueba
    // scripts/probar-visitas.ts. Reusar el buzon de la empresa chocaba
    // con el usuario que ya existe con esa direccion.
    const dir = `verif-asesor-${Date.now()}@example.invalid`;
    const usuario = await prisma.usuario.create({
      data: {
        nombre: "VERIF Asesor", email: dir,
        password: "x".repeat(60), rol: "VENDEDOR", activo: true,
      },
      select: { id: true },
    });
    usuarioId = usuario.id;

    const cliente = await prisma.cliente.create({
      data: { nombre: "VERIF Interno", tipo: "persona", estado: "PROSPECTO", esPrueba: true },
      select: { id: true },
    });
    clienteId = cliente.id;

    const cot = await prisma.cotizacion.create({
      data: {
        numero: `VERIF-INT-${Date.now()}`, clienteId: cliente.id,
        vendedorId: usuario.id, total: 1234567, esPrueba: true,
      },
      select: { id: true },
    });
    creados.push(cot.id);

    console.log("\n═══ 2. El cliente aprobó ═══\n");

    const r1 = await avisarCotizacionAprobada(cot.id, "PED-VERIF", "https://portal.costamallas.com");
    comprobar("el aviso apunta al asesor DE LA OFERTA", r1.para === dir, r1.para ?? JSON.stringify(r1));
    comprobar("y no se omite: hay a quien escribirle", r1.omitido !== true, JSON.stringify(r1));

    console.log("\n═══ 3. Producción entregó la visita ═══\n");

    const r2 = await avisarVisitaLista(cot.id, "https://portal.costamallas.com");
    comprobar("el de visita lista tambien apunta al asesor", r2.para === dir, r2.para ?? JSON.stringify(r2));

    console.log("\n═══ 4. Lo que NO puede tumbar nada ═══\n");

    await prisma.usuario.update({ where: { id: usuario.id }, data: { activo: false } });
    const r3 = await avisarCotizacionAprobada(cot.id, "PED-VERIF", "https://portal.costamallas.com");
    comprobar("a un asesor dado de baja no se le escribe",
      r3.ok === true && r3.omitido === true, JSON.stringify(r3));

    const sinAsesor = await prisma.cotizacion.create({
      data: {
        numero: `VERIF-SIN-${Date.now()}`, clienteId: cliente.id,
        vendedorId: null, total: 1000, esPrueba: true,
      },
      select: { id: true },
    });
    creados.push(sinAsesor.id);
    const r4 = await avisarCotizacionAprobada(sinAsesor.id, "PED-X", "https://portal.costamallas.com");
    comprobar("una oferta sin asesor NO es un fallo",
      r4.ok === true && r4.omitido === true, JSON.stringify(r4));

    const r5 = await avisarCotizacionAprobada("no-existe", "PED-X", "https://portal.costamallas.com");
    comprobar("una cotización inventada se reporta, no revienta", r5.ok === false);
  } finally {
    for (const id of creados) {
      await prisma.cotizacion.deleteMany({ where: { id } }).catch(() => {});
    }
    if (clienteId) await prisma.cliente.deleteMany({ where: { id: clienteId } }).catch(() => {});
    if (usuarioId) await prisma.usuario.deleteMany({ where: { id: usuarioId } }).catch(() => {});
    console.log("\n  (limpieza: cotizaciones, cliente y usuario de prueba borrados)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
