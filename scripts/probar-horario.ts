// ============================================================
// El horario de atención.
//
//   npx tsx scripts/probar-horario.ts
//
// Solo lógica: no toca la base ni manda nada. Comprueba lo que de verdad
// importa —que un correo previsto para la madrugada del domingo salga el
// lunes a las 8— y los bordes, que es donde estas cosas fallan.
// ============================================================

import { esHabil, proximoHabil, toca, HORARIO } from "../src/lib/horario-habil";

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

/** Una fecha escrita en hora de BOGOTÁ. Bogotá es UTC-5 todo el año. */
const bog = (iso: string) => new Date(`${iso}-05:00`);

const legible = (d: Date) =>
  d.toLocaleString("es-CO", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });

function main() {
  console.log("\n═══ 1. Cuándo estamos abiertos ═══\n");

  // 2026-09-01 es martes.
  comprobar("martes 9:00 sí", esHabil(bog("2026-09-01T09:00:00")));
  comprobar("martes 12:00 sí", esHabil(bog("2026-09-01T12:00:00")));
  comprobar("martes 13:00 NO (almuerzo)", !esHabil(bog("2026-09-01T13:00:00")));
  comprobar("martes 14:00 sí", esHabil(bog("2026-09-01T14:00:00")));
  comprobar("martes 17:30 NO", !esHabil(bog("2026-09-01T17:30:00")));
  comprobar("martes 7:30 NO", !esHabil(bog("2026-09-01T07:30:00")));

  // Viernes cierra a las 4, no a las 5. Es el borde que más se olvida.
  comprobar("viernes 16:30 NO (cierran a las 4)", !esHabil(bog("2026-09-04T16:30:00")));
  comprobar("y el jueves a esa hora SÍ", esHabil(bog("2026-09-03T16:30:00")));

  comprobar("sábado 10:00 sí", esHabil(bog("2026-09-05T10:00:00")));
  comprobar("sábado 8:00 NO (abren a las 9)", !esHabil(bog("2026-09-05T08:00:00")));
  comprobar("sábado 12:30 NO", !esHabil(bog("2026-09-05T12:30:00")));
  comprobar("domingo nunca", !esHabil(bog("2026-09-06T10:00:00")));

  console.log("\n═══ 2. Los bordes exactos ═══\n");

  comprobar("las 8:00 en punto ya es hábil", esHabil(bog("2026-09-01T08:00:00")));
  comprobar("las 12:30 en punto ya NO", !esHabil(bog("2026-09-01T12:30:00")));
  comprobar("las 17:00 en punto ya NO", !esHabil(bog("2026-09-01T17:00:00")));

  console.log("\n═══ 3. A dónde se corre lo que cae fuera ═══\n");

  const madrugadaDomingo = proximoHabil(bog("2026-09-06T02:00:00"));
  comprobar("un correo del domingo 2am sale el lunes a las 8",
    legible(madrugadaDomingo).includes("08:00"), legible(madrugadaDomingo));

  const sabadoNoche = proximoHabil(bog("2026-09-05T23:00:00"));
  comprobar("uno del sábado 11pm también", legible(sabadoNoche).includes("08:00"), legible(sabadoNoche));

  const almuerzo = proximoHabil(bog("2026-09-01T13:00:00"));
  comprobar("uno del almuerzo espera a la 1:30, no al día siguiente",
    legible(almuerzo).includes("13:30"), legible(almuerzo));

  const antesDeAbrir = proximoHabil(bog("2026-09-01T06:00:00"));
  comprobar("uno de las 6am sale ese mismo día a las 8",
    legible(antesDeAbrir).includes("08:00"), legible(antesDeAbrir));

  const viernesTarde = proximoHabil(bog("2026-09-04T18:00:00"));
  comprobar("uno del viernes 6pm espera al SÁBADO 9am",
    legible(viernesTarde).includes("09:00"), legible(viernesTarde));

  const enHorario = bog("2026-09-01T10:00:00");
  comprobar("lo que ya está a tiempo NO se retrasa",
    proximoHabil(enHorario).getTime() === enHorario.getTime());

  console.log("\n═══ 4. La pregunta que hace la corrida diaria ═══\n");

  // "Esto tocaba el sábado de madrugada, ¿lo mando?"
  const tocabaSabado = bog("2026-09-05T02:00:00");
  comprobar("el sábado de madrugada: NO", !toca(tocabaSabado, bog("2026-09-05T02:30:00")));
  comprobar("el sábado a las 10: SÍ", toca(tocabaSabado, bog("2026-09-05T10:00:00")));
  comprobar("el domingo: NO", !toca(tocabaSabado, bog("2026-09-06T10:00:00")));
  comprobar("el lunes a las 8: SÍ", toca(tocabaSabado, bog("2026-09-07T08:00:00")));
  comprobar("algo previsto para mañana no sale hoy",
    !toca(bog("2026-09-02T10:00:00"), bog("2026-09-01T10:00:00")));

  console.log("\n═══ 5. El horario cuadra con la cartelera ═══\n");

  comprobar("domingo cerrado", HORARIO[0].length === 0);
  comprobar("lunes a jueves, dos tramos",
    [1, 2, 3, 4].every(d => HORARIO[d].length === 2));
  comprobar("viernes cierra a las 16:00", HORARIO[5][1].hasta === 16 * 60);
  comprobar("lunes cierra a las 17:00", HORARIO[1][1].hasta === 17 * 60);
  comprobar("sábado 9:00 a 12:00",
    HORARIO[6][0].desde === 9 * 60 && HORARIO[6][0].hasta === 12 * 60);

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main();
