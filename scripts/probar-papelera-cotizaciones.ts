// ============================================================
// La papelera de cotizaciones, de punta a punta.
//
//   npx tsx scripts/probar-papelera-cotizaciones.ts
//
// Lo que se comprueba NO es el borrado —eso ya lo cubre
// probar-borrar-cotizacion.ts— sino lo que la pantalla nueva necesita y
// hasta ahora nunca se había ejecutado:
//
//   · Que la consulta con `borradaPor` funcione DE VERDAD contra la
//     base. Pasaba el typecheck desde el primer día, pero una relación
//     que no existe en la tabla solo se cae al ejecutarla.
//   · Que la papelera devuelva los campos que la pantalla pinta:
//     numeroOriginal, borradaEn, borradaMotivo y el nombre de quién.
//   · Que una oferta VIVA no se cuele en la papelera, y que una BORRADA
//     no se cuele en la lista normal. Es el fallo que haría que un
//     asesor viera ofertas muertas en su embudo.
//
// Contra PRODUCCIÓN, con una oferta de prueba, y borra todo lo que crea.
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

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  let clienteId: string | null = null;
  let usuarioId: string | null = null;
  const creadas: string[] = [];

  try {
    const u = await prisma.usuario.create({
      data: {
        nombre: "VERIF Papelera", email: `verif-papelera-${Date.now()}@example.invalid`,
        password: "x".repeat(60), rol: "ADMIN", activo: true,
      },
      select: { id: true, nombre: true },
    });
    usuarioId = u.id;

    const cl = await prisma.cliente.create({
      data: { nombre: "VERIF Papelera", tipo: "persona", estado: "PROSPECTO", esPrueba: true },
      select: { id: true },
    });
    clienteId = cl.id;

    const base = `ZPAPEL-${Date.now()}`;
    const crear = async (numero: string) => {
      const c = await prisma.cotizacion.create({
        data: { numero, clienteId: cl.id, vendedorId: u.id, estado: "BORRADOR", total: 5000, esPrueba: true },
        select: { id: true },
      });
      creadas.push(c.id);
      return c.id;
    };

    const aBorrar = await crear(`${base}-BORRADA`);
    const viva    = await crear(`${base}-VIVA`);

    const MOTIVO = "el cliente pidió rehacerla";
    const r = await borrarCotizacion(aBorrar, u.id, MOTIVO);
    comprobar("la oferta se borra", r.ok, r.error ?? "");

    console.log("\n═══ 1. La consulta de la papelera corre contra la base ═══\n");

    // ESTA es la consulta que hace /api/crm/cotizaciones?borradas=1.
    // Si `borradaPor` no existiera como relación, aquí se cae.
    let papelera: Array<Record<string, unknown>> = [];
    try {
      papelera = await prisma.cotizacion.findMany({
        where: { borradaEn: { not: null }, clienteId: cl.id },
        include: {
          cliente: { select: { nombre: true, empresa: true } },
          vendedor: { select: { nombre: true } },
          _count: { select: { items: true } },
          borradaPor: { select: { nombre: true } },
        },
        orderBy: { createdAt: "desc" },
      }) as unknown as Array<Record<string, unknown>>;
      comprobar("la consulta con `borradaPor` no revienta", true);
    } catch (e) {
      comprobar("la consulta con `borradaPor` no revienta", false, String(e).slice(0, 160));
    }

    console.log("\n═══ 2. Trae lo que la pantalla pinta ═══\n");

    const fila = papelera.find(f => f.id === aBorrar);
    comprobar("la borrada aparece en la papelera", Boolean(fila));
    comprobar("con el número que TENÍA", fila?.numeroOriginal === `${base}-BORRADA`, String(fila?.numeroOriginal));
    comprobar("con la fecha de borrado", Boolean(fila?.borradaEn));
    comprobar("con el motivo escrito", fila?.borradaMotivo === MOTIVO, String(fila?.borradaMotivo));
    comprobar("y con el NOMBRE de quien borró",
      (fila?.borradaPor as { nombre?: string } | null)?.nombre === u.nombre,
      JSON.stringify(fila?.borradaPor));

    console.log("\n═══ 3. Cada una en su sitio ═══\n");

    comprobar("la viva NO está en la papelera", !papelera.some(f => f.id === viva));

    const listaNormal = await prisma.cotizacion.findMany({
      where: { borradaEn: null, clienteId: cl.id },
      select: { id: true },
    });
    comprobar("la borrada NO está en la lista normal", !listaNormal.some(f => f.id === aBorrar));
    comprobar("la viva SÍ está en la lista normal", listaNormal.some(f => f.id === viva));

    console.log("\n═══ 4. Restaurar desde la papelera ═══\n");

    const res = await restaurarCotizacion(aBorrar, u.id);
    comprobar("se restaura", res.ok, res.error ?? "");
    comprobar("y recupera su número", res.numero === `${base}-BORRADA`, res.numero ?? "");

    const papeleraDespues = await prisma.cotizacion.count({
      where: { borradaEn: { not: null }, clienteId: cl.id },
    });
    comprobar("la papelera queda vacía", papeleraDespues === 0, `quedan ${papeleraDespues}`);
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
    console.log("\n  (limpieza hecha)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
