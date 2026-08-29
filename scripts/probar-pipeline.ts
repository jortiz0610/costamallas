// ============================================================
// Comprueba el tablero comercial: en qué columna cae cada oferta.
//
//   npx tsx scripts/probar-pipeline.ts
//
// La etapa NO se guarda en una columna: se calcula de los hechos que ya
// existen. Eso significa que se puede comprobar entera sin tocar la base,
// que es lo que hace la primera parte. La segunda pasa el cálculo por las
// cotizaciones REALES de producción para ver dónde caerían.
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

async function main() {
  const { etapaDe, ETAPAS, ETAPA_POR_CLAVE, PEDIDO_TERMINADO, PEDIDO_MUERTO } =
    await import("../src/lib/pipeline");

  console.log("\n═══ 1. Las etapas ═══\n");

  const esperadas = ["ENVIADA", "RECORDADA", "PARA_LLAMAR", "POR_VENCER", "VENCIDAS", "EN_PRODUCCION", "COMPLETADOS"];
  comprobar("son las siete que decidió gerencia, en su orden",
    ETAPAS.map(e => e.v).join(",") === esperadas.join(","),
    ETAPAS.map(e => e.v).join(","));
  comprobar("todas dicen qué significan", ETAPAS.every(e => e.descripcion.length > 10));
  comprobar("todas dicen quién actúa", ETAPAS.every(e => e.actua.length > 0));
  comprobar("la única donde actúa el vendedor es 'Para llamar'",
    ETAPAS.filter(e => e.actua === "El vendedor").map(e => e.v).join(",") === "PARA_LLAMAR");
  comprobar("solo 'Vencidas' nace plegada",
    ETAPAS.filter(e => e.ocultaPorDefecto).map(e => e.v).join(",") === "VENCIDAS");
  comprobar("el índice por clave cubre las siete",
    esperadas.every(v => ETAPA_POR_CLAVE[v]));

  console.log("\n═══ 2. Dónde cae cada oferta ═══\n");

  comprobar("un BORRADOR no pinta nada en el tablero",
    etapaDe({ estado: "BORRADOR", toques: {} }) === null,
    "nadie lo ha visto");
  comprobar("una RECHAZADA tampoco",
    etapaDe({ estado: "RECHAZADA", toques: {} }) === null);

  comprobar("recién enviada, sin toques → Enviada",
    etapaDe({ estado: "ENVIADA", toques: {} }) === "ENVIADA");
  comprobar("con el toque 1 enviado → Recordada",
    etapaDe({ estado: "ENVIADA", toques: { 1: "ENVIADO" } }) === "RECORDADA");
  comprobar("con la tarea del toque 2 PENDIENTE → Para llamar",
    etapaDe({ estado: "ENVIADA", toques: { 1: "ENVIADO", 2: "PENDIENTE" } }) === "PARA_LLAMAR",
    "es la única etapa donde el vendedor tiene que actuar");
  comprobar("cuando el vendedor marca la llamada, sale de 'Para llamar'",
    etapaDe({ estado: "ENVIADA", toques: { 1: "ENVIADO", 2: "HECHO" } }) === "RECORDADA");
  comprobar("con el toque 3 enviado → Por vencer",
    etapaDe({ estado: "ENVIADA", toques: { 1: "ENVIADO", 2: "HECHO", 3: "ENVIADO" } }) === "POR_VENCER");
  comprobar("el toque 3 manda aunque el 2 siga pendiente",
    etapaDe({ estado: "ENVIADA", toques: { 2: "PENDIENTE", 3: "ENVIADO" } }) === "POR_VENCER");

  comprobar("una VENCIDA va a Vencidas",
    etapaDe({ estado: "VENCIDA", toques: { 1: "ENVIADO", 3: "ENVIADO" } }) === "VENCIDAS");

  console.log("\n  — Lo aprobado —\n");

  comprobar("aprobada sin pedido todavía → En producción",
    etapaDe({ estado: "APROBADA", toques: {} }) === "EN_PRODUCCION");
  comprobar("aprobada con pedido NUEVO → En producción",
    etapaDe({ estado: "APROBADA", toques: {}, estadoPedido: "NUEVO" }) === "EN_PRODUCCION");
  comprobar("con el pedido ENTREGADO → Completados",
    etapaDe({ estado: "APROBADA", toques: {}, estadoPedido: "ENTREGADO" }) === "COMPLETADOS");
  comprobar("con el pedido INSTALADO → Completados",
    etapaDe({ estado: "APROBADA", toques: {}, estadoPedido: "INSTALADO" }) === "COMPLETADOS");
  comprobar("con el pedido CANCELADO no pinta nada",
    etapaDe({ estado: "APROBADA", toques: {}, estadoPedido: "CANCELADO" }) === null,
    "un negocio cancelado no es ni producción ni completado");
  comprobar("aprobar manda sobre los toques del seguimiento",
    etapaDe({ estado: "APROBADA", toques: { 1: "ENVIADO", 3: "ENVIADO" }, estadoPedido: "NUEVO" }) === "EN_PRODUCCION");

  comprobar("los estados terminados incluyen ENTREGADO e INSTALADO",
    PEDIDO_TERMINADO.has("ENTREGADO") && PEDIDO_TERMINADO.has("INSTALADO"));
  comprobar("CANCELADO cuenta como muerto", PEDIDO_MUERTO.has("CANCELADO"));

  console.log("\n═══ 3. Contra las cotizaciones reales ═══\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    console.log(`  (servidor: ${host})\n`);

    const cotizaciones = await prisma.cotizacion.findMany({
      where: { esPrueba: false },
      select: {
        numero: true, estado: true,
        seguimientos: { select: { toque: true, estado: true } },
        pedidos: { select: { estado: true }, take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    const reparto: Record<string, number> = {};
    let fuera = 0;
    for (const c of cotizaciones) {
      const toques: Record<number, string> = {};
      for (const s of c.seguimientos) toques[s.toque] = s.estado;
      const e = etapaDe({ estado: c.estado, toques, estadoPedido: c.pedidos[0]?.estado });
      if (!e) { fuera++; continue; }
      reparto[e] = (reparto[e] ?? 0) + 1;
    }

    comprobar("hay cotizaciones que repartir", cotizaciones.length > 0, `${cotizaciones.length}`);
    console.log("\n  Cómo quedaría el tablero hoy:");
    for (const e of ETAPAS) {
      console.log(`    ${String(reparto[e.v] ?? 0).padStart(3)}  ${e.l}`);
    }
    console.log(`    ${String(fuera).padStart(3)}  (fuera del tablero: borradores y rechazadas)`);

    comprobar("ninguna cae en una etapa que no existe",
      Object.keys(reparto).every(k => ETAPA_POR_CLAVE[k]));
    comprobar("la suma cuadra con el total",
      Object.values(reparto).reduce((a, b) => a + b, 0) + fuera === cotizaciones.length);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
