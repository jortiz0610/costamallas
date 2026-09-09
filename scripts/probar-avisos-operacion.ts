// ============================================================
// Los dos correos de operación que ahora salen solos.
//
//   npx tsx scripts/probar-avisos-operacion.ts
//
// Lo que se comprueba, que es lo que puede salir caro:
//
//   · Que NO se le escriba dos veces al mismo cliente.
//   · Que reagendar SÍ vuelva a avisar, con la fecha nueva.
//   · Que no se mire hacia atrás sin límite — el fallo que mandaría una
//     encuesta a todos los clientes de los últimos meses de golpe, la
//     primera vez que corra.
//   · Que las obras de capacitación no le escriban a nadie.
//   · Que fuera de horario no salga nada.
//
// Contra PRODUCCIÓN. Todo va con `dry: true` salvo lo que se comprueba
// en la base, y lo que crea lo borra.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";

// Lo que venga del entorno MANDA sobre los archivos .env.
//
// Los otros guiones de prueba leen `.env.local` sin mirar si la
// variable ya estaba puesta, y eso hace imposible apuntarlos a otra
// base desde la línea de comandos: pisan lo que les pasas. Aquí importa
// porque desde la migración la base viva está en el servidor y solo se
// llega por túnel o contra la copia — nunca con lo que diga `.env.local`,
// que apunta al entorno de desarrollo de hace meses.
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
  const { avisarAgendados, mandarEncuestasPendientes, DIAS_HACIA_ATRAS, HORAS_PARA_ENCUESTA } =
    await import("../src/lib/avisos-operacion");
  const { agendar } = await import("../src/lib/visitas");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  // Un martes a las 10 de la mañana: horario laboral seguro.
  const enHorario = new Date("2026-09-08T15:00:00.000Z");
  // Domingo de madrugada.
  const fueraDeHorario = new Date("2026-09-06T07:00:00.000Z");

  const creados: string[] = [];
  let clienteId: string | null = null;

  try {
    const cliente = await prisma.cliente.create({
      data: {
        nombre: "VERIF Avisos", tipo: "persona", estado: "PROSPECTO", esPrueba: true,
        email: "verif-avisos@example.invalid", direccion: "Calle 1 # 2-3", ciudad: "Cali",
      },
      select: { id: true },
    });
    clienteId = cliente.id;

    console.log("═══ 1. La visita agendada ═══\n");

    const manana = new Date(enHorario.getTime() + 86_400_000);
    const visita = await prisma.instalacion.create({
      data: {
        tipo: "VISITA", clienteId: cliente.id, estado: "AGENDADA",
        fechaAgendada: manana, direccion: "Calle 1 # 2-3", ciudad: "Cali",
        esPrueba: false,   // a propósito: se prueba el camino real
      },
      select: { id: true },
    });
    creados.push(visita.id);

    const r1 = await avisarAgendados({ dry: true, ahora: enHorario });
    comprobar("una visita agendada entra en la lista",
      r1.enviados.some(e => e.includes("VERIF Avisos")), JSON.stringify(r1).slice(0, 160));

    // Sellarla a mano equivale a "ya se le escribió".
    await prisma.instalacion.update({ where: { id: visita.id }, data: { avisoAgendadaEn: new Date() } });
    const r2 = await avisarAgendados({ dry: true, ahora: enHorario });
    comprobar("con el sello puesto NO se le vuelve a escribir",
      !r2.enviados.some(e => e.includes("VERIF Avisos")));

    console.log("\n═══ 2. Reagendar ═══\n");

    await agendar(visita.id, new Date(enHorario.getTime() + 3 * 86_400_000));
    const trasReagendar = await prisma.instalacion.findUnique({
      where: { id: visita.id }, select: { avisoAgendadaEn: true },
    });
    comprobar("cambiar la fecha BORRA el sello", trasReagendar?.avisoAgendadaEn === null);

    const r3 = await avisarAgendados({ dry: true, ahora: enHorario });
    comprobar("y por eso se le vuelve a avisar, con la fecha nueva",
      r3.enviados.some(e => e.includes("VERIF Avisos")));

    console.log("\n═══ 3. El horario ═══\n");

    const r4 = await avisarAgendados({ dry: true, ahora: fueraDeHorario });
    comprobar("un domingo de madrugada no sale nada",
      !r4.enviados.some(e => e.includes("VERIF Avisos")), JSON.stringify(r4.enviados).slice(0, 120));
    comprobar("y se dice cuándo saldrá",
      r4.omitidos.some(o => /sale/.test(o)) || r4.revisados === 0);

    console.log("\n═══ 4. La cita que ya pasó ═══\n");

    const pasada = await prisma.instalacion.create({
      data: {
        tipo: "VISITA", clienteId: cliente.id, estado: "AGENDADA",
        fechaAgendada: new Date(enHorario.getTime() - 86_400_000),
        esPrueba: false,
      },
      select: { id: true },
    });
    creados.push(pasada.id);
    const r5 = await avisarAgendados({ dry: true, ahora: enHorario });
    comprobar("no se avisa de una cita que ya pasó",
      r5.omitidos.some(o => /ya pasó/.test(o)), JSON.stringify(r5.omitidos).slice(0, 160));

    console.log("\n═══ 5. La encuesta ═══\n");

    // Firmada hace 30 h: ya cumplió las 24.
    const entregada = await prisma.instalacion.create({
      data: {
        tipo: "INSTALACION", clienteId: cliente.id, estado: "COMPLETADA",
        firmadoEn: new Date(enHorario.getTime() - 30 * 3_600_000),
        esPrueba: false,
      },
      select: { id: true },
    });
    creados.push(entregada.id);

    // Sin pedido no hay encuesta: la consulta exige pedidoId.
    const r6 = await mandarEncuestasPendientes({ dry: true, ahora: enHorario });
    comprobar("una obra sin pedido no entra", r6.revisados === 0 || !r6.enviados.length,
      JSON.stringify(r6).slice(0, 140));

    // Recién firmada: todavía no le toca.
    await prisma.instalacion.update({
      where: { id: entregada.id },
      data: { firmadoEn: new Date(enHorario.getTime() - 2 * 3_600_000) },
    });
    const r7 = await mandarEncuestasPendientes({ dry: true, ahora: enHorario });
    comprobar(`recién entregada no se pregunta (esperan ${HORAS_PARA_ENCUESTA} h)`, r7.revisados === 0);

    console.log("\n═══ 6. El seguro del primer arranque ═══\n");

    // Una obra firmada hace mucho: es lo que habría en la base el día
    // que esto se despliegue por primera vez.
    const vieja = await prisma.instalacion.create({
      data: {
        tipo: "INSTALACION", clienteId: cliente.id, estado: "COMPLETADA",
        firmadoEn: new Date(enHorario.getTime() - 60 * 86_400_000),
        esPrueba: false,
      },
      select: { id: true },
    });
    creados.push(vieja.id);
    const r8 = await mandarEncuestasPendientes({ dry: true, ahora: enHorario });
    comprobar(`una obra de hace 60 días NO se despierta (tope: ${DIAS_HACIA_ATRAS} días)`,
      r8.revisados === 0, `revisadas ${r8.revisados}`);

    console.log("\n═══ 7. Capacitación ═══\n");

    const prueba = await prisma.instalacion.create({
      data: {
        tipo: "VISITA", clienteId: cliente.id, estado: "AGENDADA",
        fechaAgendada: manana, esPrueba: true,
      },
      select: { id: true },
    });
    creados.push(prueba.id);
    const r9 = await avisarAgendados({ dry: true, ahora: enHorario });
    const ids9 = JSON.stringify(r9);
    comprobar("una obra de capacitación no le escribe a nadie", !ids9.includes(prueba.id));
  } finally {
    for (const id of creados) {
      await prisma.instalacion.deleteMany({ where: { id } }).catch(() => {});
    }
    if (clienteId) {
      await prisma.instalacion.deleteMany({ where: { clienteId } }).catch(() => {});
      await prisma.cliente.deleteMany({ where: { id: clienteId } }).catch(() => {});
    }
    console.log("\n  (limpieza: trabajos y cliente de prueba borrados)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
