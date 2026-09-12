// ============================================================
// Borrar cotizaciones, y qué pasa con el número.
//
//   npx tsx scripts/probar-borrar-cotizacion.ts
//
// Esto toca el consecutivo de un documento CONTABLE —el de COT viene de
// SIIGO y va por el 12.100— así que lo que se comprueba es justo lo que
// costaría dinero si estuviera mal:
//
//   · Que borrar el ÚLTIMO devuelva el número al contador.
//   · Que borrar uno del MEDIO no lo devuelva: reutilizarlo dejaría dos
//     cotizaciones con el mismo consecutivo.
//   · Que en los dos casos el número quede LIBRE y el original se
//     conserve para que el administrador lo vea.
//   · Que una oferta APROBADA no se pueda borrar: ya generó pedido.
//   · Que restaurar recupere el número si nadie lo tomó.
//
// Contra PRODUCCIÓN, con ofertas de prueba, y borra todo lo que crea —
// incluido dejar el contador como estaba.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
for (const a of [".env.local", ".env"]) {
  if (!existsSync(a)) continue;
  for (const l of readFileSync(a, "utf8").split("\n")) {
    const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env[m[1]]) continue;
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
  const { borrarCotizacion, restaurarCotizacion } = await import("../src/lib/borrar-cotizacion");
  const { claveConsecutivo } = await import("../src/lib/consecutivos");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  const CLAVE = claveConsecutivo("COT");
  const contador = async () =>
    Number((await prisma.configuracion.findUnique({ where: { clave: CLAVE } }))?.valor ?? 0);

  const contadorInicial = await contador();
  console.log(`  contador de cotizaciones al empezar: ${contadorInicial}\n`);

  const creadas: string[] = [];
  let clienteId: string | null = null;
  let usuarioId: string | null = null;

  const crear = async (numero: string, estado = "BORRADOR") => {
    const c = await prisma.cotizacion.create({
      data: { numero, clienteId: clienteId!, vendedorId: usuarioId, estado, total: 1000, esPrueba: true },
      select: { id: true },
    });
    creadas.push(c.id);
    return c.id;
  };

  try {
    const u = await prisma.usuario.create({
      data: {
        nombre: "VERIF Borrado", email: `verif-borrado-${Date.now()}@example.invalid`,
        password: "x".repeat(60), rol: "ADMIN", activo: true,
      },
      select: { id: true },
    });
    usuarioId = u.id;

    const cl = await prisma.cliente.create({
      data: { nombre: "VERIF Borrado", tipo: "persona", estado: "PROSPECTO", esPrueba: true },
      select: { id: true },
    });
    clienteId = cl.id;

    // Numeración propia de la prueba: no toca la de COT ni la de PRUEBA.
    const base = `ZVERIF-${Date.now()}`;

    console.log("═══ 1. Borrar el del medio ═══\n");

    const delMedio = await crear(`${base}-1`);
    await crear(`${base}-9`);   // uno POSTERIOR, vivo

    const r1 = await borrarCotizacion(delMedio, u.id, "prueba automatica");
    comprobar("se borra", r1.ok, r1.error ?? "");
    comprobar("y NO devuelve el número (hay ofertas posteriores)", r1.numeroDevuelto === false);

    const m = await prisma.cotizacion.findUnique({
      where: { id: delMedio },
      select: { numero: true, numeroOriginal: true, borradaEn: true, borradaMotivo: true },
    });
    comprobar("el número queda LIBRE", m?.numero !== `${base}-1`, m?.numero ?? "");
    comprobar("y el original se conserva para verlo", m?.numeroOriginal === `${base}-1`, m?.numeroOriginal ?? "");
    comprobar("queda marcada con fecha", Boolean(m?.borradaEn));
    comprobar("y con el motivo", m?.borradaMotivo === "prueba automatica");

    console.log("\n═══ 2. Desaparece de los listados ═══\n");

    const vivas = await prisma.cotizacion.count({ where: { clienteId: cl.id, borradaEn: null } });
    comprobar("solo queda la viva", vivas === 1, `hay ${vivas}`);

    console.log("\n═══ 3. Borrar el ÚLTIMO devuelve el número ═══\n");

    // Se simula una oferta REAL (no de prueba) que sea la última.
    const antes = await contador();
    const ultima = await prisma.cotizacion.create({
      data: {
        numero: `ZZZZ-ULTIMA-${Date.now()}`, clienteId: cl.id, vendedorId: u.id,
        estado: "BORRADOR", total: 1000, esPrueba: false,
      },
      select: { id: true },
    });
    creadas.push(ultima.id);

    const r2 = await borrarCotizacion(ultima.id, u.id);
    comprobar("se borra", r2.ok, r2.error ?? "");
    comprobar("y SÍ devuelve el número al contador", r2.numeroDevuelto === true);
    const despues = await contador();
    comprobar("el contador bajó en uno", despues === antes - 1, `${antes} → ${despues}`);

    // Se deja el contador como estaba.
    await prisma.configuracion.update({ where: { clave: CLAVE }, data: { valor: String(antes) } });

    console.log("\n═══ 4. Lo que NO se puede borrar ═══\n");

    const aprobada = await crear(`${base}-APROBADA`, "APROBADA");
    const r3 = await borrarCotizacion(aprobada, u.id);
    comprobar("una oferta APROBADA se niega", !r3.ok, r3.error ?? "");
    comprobar("y dice por qué", /pedido/i.test(r3.error ?? ""), r3.error ?? "");

    const r4 = await borrarCotizacion(delMedio, u.id);
    comprobar("no se borra dos veces", !r4.ok, r4.error ?? "");

    console.log("\n═══ 5. Restaurar ═══\n");

    const r5 = await restaurarCotizacion(delMedio, u.id);
    comprobar("se restaura", r5.ok, r5.error ?? "");
    comprobar("y recupera SU número, porque nadie lo tomó",
      r5.numero === `${base}-1` && r5.numeroCambiado !== true, r5.numero ?? "");

    const rest = await prisma.cotizacion.findUnique({
      where: { id: delMedio }, select: { borradaEn: true, numero: true },
    });
    comprobar("vuelve a estar viva", rest?.borradaEn === null && rest?.numero === `${base}-1`);
  } finally {
    for (const id of creadas) {
      await prisma.itemCotizacion.deleteMany({ where: { cotizacionId: id } }).catch(() => {});
      await prisma.cotizacion.deleteMany({ where: { id } }).catch(() => {});
    }
    if (clienteId) {
      await prisma.cotizacion.deleteMany({ where: { clienteId } }).catch(() => {});
      await prisma.cliente.deleteMany({ where: { id: clienteId } }).catch(() => {});
    }
    if (usuarioId) await prisma.usuario.deleteMany({ where: { id: usuarioId } }).catch(() => {});
    const fin = await contador();
    console.log(`\n  (limpieza hecha · contador: ${contadorInicial} → ${fin}${fin === contadorInicial ? " ✓ igual" : " ⚠ CAMBIÓ"})`);
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
