// ============================================================
// Comprobación del reloj hábil del informe de tiempos de Nexus.
//
//   npx tsx scripts/probar-tiempos.ts
//
// NO toca la base de datos ni gasta nada: es lógica pura. Existe porque
// "cuántos minutos hábiles pasaron entre dos instantes" es de esas cosas
// que parecen triviales y se rompen justo con el mensaje que entra un
// viernes a las 16:50 — que es el caso que hace que nadie se crea el
// informe.
//
// Si tocas `minutosHabiles`, corre esto antes de publicar.
// ============================================================

import { minutosHabiles, enHorario, mediana, TIEMPOS_DEFAULTS } from "../src/lib/nexus/tiempos";

const cfg = TIEMPOS_DEFAULTS; // 8-17, L-S, 60 min

/** Un instante dado en hora LOCAL de Colombia (UTC-5). */
const co = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h + 5, min));

const nombreDia = (d: Date) =>
  ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][new Date(d.getTime() - 5 * 3600_000).getUTCDay()];

const casos: { que: string; a: Date; b: Date; esperado: number }[] = [
  { que: "media hora dentro de la jornada", a: co(2026, 8, 3, 10, 0), b: co(2026, 8, 3, 10, 30), esperado: 30 },
  { que: "entra de noche, se responde al abrir", a: co(2026, 8, 3, 20, 0), b: co(2026, 8, 4, 8, 15), esperado: 15 },
  { que: "entra antes de abrir", a: co(2026, 8, 4, 6, 0), b: co(2026, 8, 4, 9, 0), esperado: 60 },
  { que: "jornada completa", a: co(2026, 8, 4, 8, 0), b: co(2026, 8, 4, 17, 0), esperado: 540 },
  { que: "domingo (no hábil) hasta el lunes", a: co(2026, 8, 9, 10, 0), b: co(2026, 8, 10, 9, 0), esperado: 60 },
  { que: "viernes tarde hasta el lunes (sábado sí cuenta)", a: co(2026, 8, 7, 16, 30), b: co(2026, 8, 10, 8, 30), esperado: 600 },
  { que: "respuesta anterior a la entrada", a: co(2026, 8, 4, 10, 0), b: co(2026, 8, 4, 9, 0), esperado: 0 },
];

let fallos = 0;
console.log(`Horario: ${cfg.horaInicio}:00-${cfg.horaFin}:00 · días ${cfg.dias.join(",")} · meta ${cfg.compromisoMin} min\n`);
for (const c of casos) {
  const r = minutosHabiles(c.a, c.b, cfg);
  const ok = r === c.esperado;
  if (!ok) fallos++;
  console.log(
    `${ok ? "OK  " : "FALLA"} ${String(r).padStart(4)} (esperado ${String(c.esperado).padStart(4)})  ` +
    `${nombreDia(c.a)} → ${nombreDia(c.b)}  ${c.que}`,
  );
}

console.log("\nenHorario:");
for (const [d, esperado] of [
  [co(2026, 8, 3, 10, 0), true],
  [co(2026, 8, 3, 20, 0), false],
  [co(2026, 8, 9, 10, 0), false], // domingo
  [co(2026, 8, 8, 10, 0), true],  // sábado
] as [Date, boolean][]) {
  const r = enHorario(d, cfg);
  const ok = r === esperado;
  if (!ok) fallos++;
  console.log(`  ${ok ? "OK  " : "FALLA"} ${nombreDia(d)} ${(d.getUTCHours() - 5 + 24) % 24}:00 → ${r}`);
}

console.log("\nmediana:");
for (const [v, esperado] of [
  [[10], 10], [[10, 20], 15], [[5, 10, 100], 10], [[], 0],
] as [number[], number][]) {
  const r = mediana(v);
  const ok = r === esperado;
  if (!ok) fallos++;
  console.log(`  ${ok ? "OK  " : "FALLA"} [${v.join(",")}] → ${r}`);
}

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobación(es) fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
