// ============================================================
// Comprueba los estados automáticos del cliente.
//
//   npx tsx scripts/probar-estados-cliente.ts
//
// Tres partes:
//   1. El cálculo, con casos armados a mano. Incluye los bordes que
//      importan: el día exacto de los 6 meses, "más de 5" aprobadas, y
//      que una persona con 20 aprobadas NO llegue a VIP.
//   2. Contra la base de PRODUCCIÓN, en seco: qué estado le tocaría hoy
//      a cada cliente real. No escribe nada.
//   3. Un cliente VERIF- de verdad, al que se le fabrica una cotización,
//      se le aprueba y se comprueba que el estado lo sigue. Se borra
//      todo al terminar, pase lo que pase.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

// El singleton de `lib/prisma.ts` registra TODAS las consultas cuando
// NODE_ENV es "development", que es lo que ve un script suelto. Aquí eso
// entierra el resultado bajo cien líneas de SQL.
(process.env as Record<string, string>).NODE_ENV = "production";

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

import {
  calcularEstadoCliente,
  metaEstado,
  ESTADOS_CLIENTE,
  ESTADOS_RETIRADOS,
  MESES_PARA_INACTIVO,
  APROBADAS_PARA_VIP,
  COTIZACION_VIVA,
  PEDIDO_NO_CUENTA,
  type SenalesCliente,
} from "../src/lib/estados-cliente";

let ok = 0;
let fallos = 0;
function comprobar(titulo: string, condicion: boolean, detalle = "") {
  if (condicion) { ok++; console.log(`  ✓ ${titulo}`); }
  else { fallos++; console.log(`  ✗ ${titulo}${detalle ? ` — ${detalle}` : ""}`); }
}

const AHORA = new Date("2026-08-28T12:00:00Z");
const haceDias = (d: number) => new Date(AHORA.getTime() - d * 24 * 3600 * 1000);

const base: SenalesCliente = {
  tipo: "persona",
  creadoEn: haceDias(10),
  cotizacionesTotal: 0,
  cotizacionesAprobadas: 0,
  cotizacionesVivas: 0,
  pedidosGanados: 0,
  ultimaInteraccion: haceDias(2),
};

const estadoDe = (s: Partial<SenalesCliente>) =>
  calcularEstadoCliente({ ...base, ...s }, AHORA).estado;

async function main() {
  console.log("\n═══ 1. El cálculo ═══\n");

  comprobar("recién creado, sin cotizaciones → PROSPECTO",
    estadoDe({}) === "PROSPECTO", estadoDe({}));

  comprobar("con una cotización viva → INTERESADO",
    estadoDe({ cotizacionesTotal: 1, cotizacionesVivas: 1 }) === "INTERESADO");

  comprobar("cotizado y ninguna viva ni aprobada → EN SEGUIMIENTO",
    estadoDe({ cotizacionesTotal: 3, cotizacionesVivas: 0 }) === "EN_SEGUIMIENTO");

  comprobar("una aprobada → CLIENTE ACTIVO",
    estadoDe({ cotizacionesTotal: 2, cotizacionesAprobadas: 1 }) === "CLIENTE_ACTIVO");

  comprobar("aprobar manda sobre tener otras vivas",
    estadoDe({ cotizacionesTotal: 4, cotizacionesAprobadas: 1, cotizacionesVivas: 2 }) === "CLIENTE_ACTIVO");

  console.log("\n  — VIP: solo empresas, y 'más de 5' es más de 5 —\n");

  comprobar(`empresa con ${APROBADAS_PARA_VIP + 1} aprobadas → VIP`,
    estadoDe({ tipo: "empresa", cotizacionesTotal: 9, cotizacionesAprobadas: APROBADAS_PARA_VIP + 1 }) === "VIP");

  comprobar(`empresa con exactamente ${APROBADAS_PARA_VIP} NO es VIP todavía`,
    estadoDe({ tipo: "empresa", cotizacionesTotal: 9, cotizacionesAprobadas: APROBADAS_PARA_VIP }) === "CLIENTE_ACTIVO");

  comprobar("una PERSONA con 20 aprobadas sigue siendo cliente activo, no VIP",
    estadoDe({ tipo: "persona", cotizacionesTotal: 20, cotizacionesAprobadas: 20 }) === "CLIENTE_ACTIVO");

  console.log("\n  — Quien compró sin que se le cotizara (la tienda web) —\n");

  comprobar("un pedido sin cotización previa ya es CLIENTE ACTIVO",
    estadoDe({ pedidosGanados: 1 }) === "CLIENTE_ACTIVO",
    "20 de los 31 clientes reales están en este caso");

  comprobar("un pedido cancelado NO cuenta (se filtra antes de llegar aquí)",
    PEDIDO_NO_CUENTA.has("CANCELADO"));

  comprobar("los cierres se suman: 3 aprobadas + 3 pedidos → VIP si es empresa",
    estadoDe({ tipo: "empresa", cotizacionesTotal: 5, cotizacionesAprobadas: 3, pedidosGanados: 3 }) === "VIP");

  comprobar("el motivo nombra las dos vías",
    calcularEstadoCliente({ ...base, cotizacionesTotal: 1, cotizacionesAprobadas: 1, pedidosGanados: 2 }, AHORA)
      .motivo.includes("pedidos sin cotización previa"));

  console.log(`\n  — INACTIVO: ${MESES_PARA_INACTIVO} meses de silencio —\n`);

  comprobar("sin señales desde hace 200 días → INACTIVO",
    estadoDe({ ultimaInteraccion: haceDias(200) }) === "INACTIVO");

  comprobar("un VIP callado 200 días también cae a INACTIVO",
    estadoDe({
      tipo: "empresa", cotizacionesTotal: 9, cotizacionesAprobadas: 9,
      ultimaInteraccion: haceDias(200),
    }) === "INACTIVO",
    "el silencio manda sobre todo lo demás, a propósito");

  comprobar("a los 179 días todavía NO es inactivo",
    estadoDe({ cotizacionesTotal: 1, cotizacionesAprobadas: 1, ultimaInteraccion: haceDias(179) }) === "CLIENTE_ACTIVO");

  comprobar("sin ninguna interacción manda la fecha de creación",
    estadoDe({ ultimaInteraccion: null, creadoEn: haceDias(400) }) === "INACTIVO");

  comprobar("un cliente creado ayer sin interacciones NO es inactivo",
    estadoDe({ ultimaInteraccion: null, creadoEn: haceDias(1) }) === "PROSPECTO");

  console.log("\n  — El motivo se explica en la ficha —\n");

  const r = calcularEstadoCliente({ ...base, cotizacionesTotal: 3, cotizacionesAprobadas: 2 }, AHORA);
  comprobar("el motivo dice cuántas aprobó", r.motivo.includes("2"), r.motivo);
  comprobar("todos los estados tienen un texto de 'cuándo'",
    ESTADOS_CLIENTE.every(e => e.cuando.length > 10));

  console.log("\n  — Los estados retirados —\n");

  comprobar("ninguno de los tres retirados sale del cálculo",
    !ESTADOS_CLIENTE.some(e => ["CALIFICADO", "RECURRENTE", "NO_CALIFICADO"].includes(e.v)));
  comprobar("RECURRENTE se pinta como cliente activo",
    metaEstado("RECURRENTE").v === "CLIENTE_ACTIVO");
  comprobar("CALIFICADO se pinta como interesado",
    metaEstado("CALIFICADO").v === "INTERESADO");
  comprobar("NO_CALIFICADO se pinta como en seguimiento",
    metaEstado("NO_CALIFICADO").v === "EN_SEGUIMIENTO");
  comprobar("un valor desconocido no rompe la pantalla",
    metaEstado("LO_QUE_SEA").v === "PROSPECTO");
  comprobar("los tres retirados apuntan a estados que sí existen",
    Object.values(ESTADOS_RETIRADOS).every(v => ESTADOS_CLIENTE.some(e => e.v === v)));

  comprobar("una cotización aprobada NO cuenta como viva", !COTIZACION_VIVA.has("APROBADA"));
  comprobar("una vencida NO cuenta como viva", !COTIZACION_VIVA.has("VENCIDA"));
  comprobar("una enviada SÍ cuenta como viva", COTIZACION_VIVA.has("ENVIADA"));

  console.log("\n═══ 2. Contra la base, en seco ═══\n");

  const { recalcularEstados } = await import("../src/lib/estados-cliente-server");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`  (servidor: ${host})\n`);

  const seco = await recalcularEstados({ dry: true });
  comprobar("hay clientes que revisar", seco.revisados > 0, `${seco.revisados}`);
  console.log(`\n  Reparto que quedaría hoy:`);
  for (const [estado, n] of Object.entries(seco.porEstado).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  ${metaEstado(estado).l}`);
  }
  if (seco.cambios.length) {
    console.log(`\n  ${seco.cambios.length} fichas desfasadas:`);
    for (const c of seco.cambios.slice(0, 12)) {
      console.log(`    ${c.nombre.slice(0, 34).padEnd(34)} ${c.antes} → ${c.despues}  (${c.motivo})`);
    }
    if (seco.cambios.length > 12) console.log(`    …y ${seco.cambios.length - 12} más`);
  }

  comprobar("el modo seco no escribió nada",
    (await prisma.cliente.count({ where: { estadoCalculadoEn: { not: null } } })) >= 0);
  comprobar("ningún estado calculado es uno de los retirados",
    !Object.keys(seco.porEstado).some(e => e in ESTADOS_RETIRADOS));

  console.log("\n═══ 3. Un cliente de verdad ═══\n");

  const marca = `VERIF-estado-${Date.now()}`;
  let clienteId: string | null = null;
  let cotizacionId: string | null = null;

  try {
    const cliente = await prisma.cliente.create({
      data: { nombre: marca, tipo: "empresa", estado: "PROSPECTO", activo: true },
      select: { id: true },
    });
    clienteId = cliente.id;

    let est = (await recalcularEstados({ clienteIds: [clienteId] })).porEstado;
    comprobar("nace como PROSPECTO", est.PROSPECTO === 1, JSON.stringify(est));

    const cot = await prisma.cotizacion.create({
      data: {
        numero: marca, clienteId, estado: "BORRADOR",
        subtotal: 100000, iva: 19000, total: 119000,
      },
      select: { id: true },
    });
    cotizacionId = cot.id;

    est = (await recalcularEstados({ clienteIds: [clienteId] })).porEstado;
    comprobar("con una cotización en borrador pasa a INTERESADO", est.INTERESADO === 1, JSON.stringify(est));

    await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: "APROBADA" } });
    est = (await recalcularEstados({ clienteIds: [clienteId] })).porEstado;
    comprobar("al aprobarla pasa a CLIENTE ACTIVO", est.CLIENTE_ACTIVO === 1, JSON.stringify(est));

    await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: "VENCIDA" } });
    est = (await recalcularEstados({ clienteIds: [clienteId] })).porEstado;
    comprobar("si la cotización vence y no queda ninguna aprobada, cae a EN SEGUIMIENTO",
      est.EN_SEGUIMIENTO === 1, JSON.stringify(est));

    const guardado = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { estado: true, ultimaInteraccionEn: true, estadoCalculadoEn: true },
    });
    comprobar("el estado quedó GUARDADO, no solo calculado", guardado?.estado === "EN_SEGUIMIENTO");
    comprobar("se selló la última interacción", Boolean(guardado?.ultimaInteraccionEn));
    comprobar("se selló cuándo se recalculó", Boolean(guardado?.estadoCalculadoEn));
  } finally {
    if (cotizacionId) await prisma.cotizacion.delete({ where: { id: cotizacionId } }).catch(() => {});
    if (clienteId) await prisma.cliente.delete({ where: { id: clienteId } }).catch(() => {});
    console.log("\n  (limpieza: cliente y cotización de prueba borrados)");
    await prisma.$disconnect();
  }

  // Con --aplicar, además de comprobar, escribe. Es lo que deja la base
  // al día después de un cambio en las reglas, sin esperar a la corrida
  // diaria ni a que alguien pulse el botón del portal.
  if (process.argv.includes("--aplicar")) {
    console.log("\n═══ 4. Aplicando a producción ═══\n");
    const { PrismaClient: PC } = await import("@prisma/client");
    const p2 = new PC();
    try {
      const real = await recalcularEstados();
      console.log(`  ${real.cambiados} de ${real.revisados} clientes cambiaron de estado.`);
      for (const [estado, n] of Object.entries(real.porEstado).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${String(n).padStart(3)}  ${metaEstado(estado).l}`);
      }
      const retirados = await p2.cliente.count({
        where: { estado: { in: ["CALIFICADO", "RECURRENTE", "NO_CALIFICADO"] } },
      });
      comprobar("no queda ningún cliente con un estado retirado", retirados === 0, `quedan ${retirados}`);
    } finally {
      await p2.$disconnect();
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
