// ============================================================
// La orden de producción de malla ciclón.
//
//   npx tsx scripts/probar-orden-produccion.ts
//
// Dos partes: el cuadre de kilos (lógica pura) y el ciclo completo contra
// PRODUCCIÓN —abrir, llenar, firmar operario, firmar supervisor— con una
// orden que crea y borra.
//
// Lo que más importa comprobar: que no se pueda firmar con los kilos
// descuadrados, y que el supervisor no pueda firmar antes que el
// operario. Sin esas dos, el formato deja de servir para lo que existe.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
for (const a of [".env.local", ".env"]) {
  if (!existsSync(a)) continue;
  for (const l of readFileSync(a, "utf8").split("\n")) {
    const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env["__" + m[1]]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env["__" + m[1]] = "1";
  }
}

import { cuadrarMateriaPrima, porcentajeDesperdicio } from "../src/lib/orden-produccion";

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

const FIRMA = "data:image/png;base64,iVBORw0KGgo=";

async function main() {
  console.log("\n═══ 1. Los kilos ═══\n");

  const bien = cuadrarMateriaPrima([
    { n: 1, kgRecibida: 100, kgUtilizada: 85, kgDesperdicio: 5, kgDevuelta: 10 },
  ]);
  comprobar("100 = 85 + 5 + 10 cuadra", bien.cuadra);
  comprobar("y suma bien el desperdicio", bien.totalDesperdicio === 5);
  comprobar("el porcentaje de desperdicio sale", porcentajeDesperdicio(bien) === 5,
    String(porcentajeDesperdicio(bien)));

  const mal = cuadrarMateriaPrima([
    { n: 1, kgRecibida: 100, kgUtilizada: 80, kgDesperdicio: 5, kgDevuelta: 10 },
  ]);
  comprobar("faltando 5 kg NO cuadra", !mal.cuadra);
  comprobar("y dice cuántos faltan", mal.problemas[0]?.diferencia === 5, String(mal.problemas[0]?.diferencia));

  const sobra = cuadrarMateriaPrima([
    { n: 2, kgRecibida: 50, kgUtilizada: 45, kgDesperdicio: 10, kgDevuelta: 0 },
  ]);
  comprobar("declarar MÁS de lo que entró tampoco cuadra", !sobra.cuadra);
  comprobar("y lo dice en negativo", (sobra.problemas[0]?.diferencia ?? 0) < 0,
    String(sobra.problemas[0]?.diferencia));

  // La báscula del taller no da el gramo. Exigirlo enseña a inventar un
  // número que cuadre, que es peor que una diferencia de 300 g.
  const casi = cuadrarMateriaPrima([
    { n: 1, kgRecibida: 100, kgUtilizada: 85.3, kgDesperdicio: 5, kgDevuelta: 9.4 },
  ]);
  comprobar("una diferencia de 300 g se tolera", casi.cuadra,
    JSON.stringify(casi.problemas));

  const lejos = cuadrarMateriaPrima([
    { n: 1, kgRecibida: 100, kgUtilizada: 85, kgDesperdicio: 5, kgDevuelta: 9 },
  ]);
  comprobar("pero una de 1 kg no", !lejos.cuadra);

  comprobar("las filas en blanco no son un error",
    cuadrarMateriaPrima([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }]).cuadra);
  comprobar("una tabla vacía cuadra", cuadrarMateriaPrima([]).cuadra);
  comprobar("sin material recibido no hay porcentaje",
    porcentajeDesperdicio(cuadrarMateriaPrima([])) === null);

  console.log("\n═══ 2. El ciclo completo ═══\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { crearOrden, firmar } = await import("../src/lib/orden-produccion");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`  (servidor: ${host})\n`);

  const antes = (await prisma.configuracion.findFirst({
    where: { clave: "consecutivo_orden_produccion" },
  }))?.valor ?? "?";

  let opId: string | null = null;
  try {
    const op = await crearOrden({});
    opId = op.id;
    comprobar("se abre con su número", op.numero.startsWith("OP-"), op.numero);

    const traida = await prisma.ordenProduccion.findUnique({
      where: { id: op.id },
      select: { especificacion: true, materiaPrima: true, productoTerminado: true, interrupciones: true, estado: true },
    });
    const esp = traida?.especificacion as { fila: string }[];
    comprobar("trae las tres presentaciones A, B y C",
      esp.length === 3 && esp[0].fila === "A" && esp[2].fila === "C", JSON.stringify(esp));
    comprobar("y los cuatro renglones de materia prima",
      (traida?.materiaPrima as unknown[]).length === 4);
    comprobar("y los diez de producto terminado",
      (traida?.productoTerminado as unknown[]).length === 10);
    comprobar("nace ABIERTA", traida?.estado === "ABIERTA", traida?.estado ?? "");

    // ── Firmar con los kilos mal ──
    await prisma.ordenProduccion.update({
      where: { id: op.id },
      data: {
        materiaPrima: [
          { n: 1, kgRecibida: 100, kgUtilizada: 80, kgDesperdicio: 5, kgDevuelta: 10 },
        ] as never,
      },
    });
    const conKilosMal = await firmar(op.id, "OPERARIO", { imagen: FIRMA, nombre: "Pedro" });
    comprobar("NO se puede firmar con los kilos descuadrados", !conKilosMal.ok, conKilosMal.error ?? "");
    comprobar("y el error dice cuántos faltan",
      /5/.test(conKilosMal.error ?? ""), conKilosMal.error ?? "");

    // ── El supervisor no puede adelantarse ──
    await prisma.ordenProduccion.update({
      where: { id: op.id },
      data: {
        materiaPrima: [
          { n: 1, kgRecibida: 100, kgUtilizada: 85, kgDesperdicio: 5, kgDevuelta: 10 },
        ] as never,
      },
    });
    const antesDeTiempo = await firmar(op.id, "SUPERVISOR", { imagen: FIRMA, nombre: "Ana" });
    comprobar("el supervisor NO puede firmar antes que el operario",
      !antesDeTiempo.ok, antesDeTiempo.error ?? "");

    // ── PNC sin tratamiento ──
    await prisma.ordenProduccion.update({
      where: { id: op.id },
      data: { generaPnc: true, pncTratamiento: null },
    });
    const sinTratamiento = await firmar(op.id, "OPERARIO", { imagen: FIRMA, nombre: "Pedro" });
    comprobar("marcar producto no conforme sin decir qué se hizo no cierra",
      !sinTratamiento.ok, sinTratamiento.error ?? "");

    await prisma.ordenProduccion.update({
      where: { id: op.id },
      data: { pncTratamiento: "REPARACION" },
    });

    // ── Las firmas, en orden ──
    const sinTrazo = await firmar(op.id, "OPERARIO", { imagen: "", nombre: "Pedro" });
    comprobar("sin trazo no firma", !sinTrazo.ok);
    const sinNombre = await firmar(op.id, "OPERARIO", { imagen: FIRMA, nombre: "" });
    comprobar("sin nombre tampoco", !sinNombre.ok);

    const fOperario = await firmar(op.id, "OPERARIO", { imagen: FIRMA, nombre: "Pedro Ruiz" });
    comprobar("el operario firma", fOperario.ok, fOperario.error ?? "");

    const dosVeces = await firmar(op.id, "OPERARIO", { imagen: FIRMA, nombre: "Otro" });
    comprobar("y no puede firmar dos veces", !dosVeces.ok);

    const enProceso = await prisma.ordenProduccion.findUnique({
      where: { id: op.id }, select: { estado: true },
    });
    comprobar("queda EN_PROCESO, esperando la revisión",
      enProceso?.estado === "EN_PROCESO", enProceso?.estado ?? "");

    const fSuper = await firmar(op.id, "SUPERVISOR", { imagen: FIRMA, nombre: "Ana Gómez" });
    comprobar("el supervisor firma", fSuper.ok, fSuper.error ?? "");

    const cerrada = await prisma.ordenProduccion.findUnique({
      where: { id: op.id },
      select: { estado: true, firmaOperarioEn: true, firmaSupervisorEn: true },
    });
    comprobar("las dos firmas la cierran", cerrada?.estado === "TERMINADA", cerrada?.estado ?? "");
    comprobar("con sus dos sellos de fecha",
      Boolean(cerrada?.firmaOperarioEn && cerrada?.firmaSupervisorEn));

    const despues = (await prisma.configuracion.findFirst({
      where: { clave: "consecutivo_orden_produccion" },
    }))?.valor ?? "?";
    comprobar("gasta su PROPIO consecutivo, no el de pedidos",
      despues !== antes, `${antes} → ${despues}`);
  } finally {
    if (opId) await prisma.ordenProduccion.delete({ where: { id: opId } }).catch(() => {});
    console.log("\n  (limpieza: orden de prueba borrada)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
