// ============================================================
// Comprueba la encuesta de satisfacción.
//
//   npx tsx scripts/probar-encuesta.ts
//
// Dos partes: las preguntas (lógica pura) y el ciclo completo contra la
// base de PRODUCCIÓN con una encuesta VERIF- que crea y borra.
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

import {
  PREGUNTA_NPS, PREGUNTAS_SATISFACCION, PREGUNTA_RECOMPRA, TODAS_LAS_PREGUNTAS,
} from "../src/lib/encuesta-preguntas";

let ok = 0, fallos = 0;
const comprobar = (t: string, c: boolean, d = "") => {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
};

async function main() {
  console.log("\n═══ 1. Las preguntas ═══\n");

  comprobar("están las seis del formato de la empresa", PREGUNTAS_SATISFACCION.length === 6,
    String(PREGUNTAS_SATISFACCION.length));

  // Las seis del "Formato Valoración de cliente", por su campo.
  const esperados = ["calidad", "precio", "profesionalidad", "atencion", "puntualidad", "limpieza"];
  comprobar("y son exactamente esas seis",
    esperados.every(c => PREGUNTAS_SATISFACCION.some(p => p.campo === c)),
    PREGUNTAS_SATISFACCION.map(p => p.campo).join(", "));

  comprobar("el NPS es la primera", PREGUNTA_NPS.campo === "recomendaria");
  comprobar("y pregunta por recomendar", /recomendar/i.test(PREGUNTA_NPS.texto));
  comprobar("la recompra está", PREGUNTA_RECOMPRA.campo === "recompra");
  comprobar("son ocho escalas en total", TODAS_LAS_PREGUNTAS.length === 8);
  comprobar("ninguna repite campo",
    new Set(TODAS_LAS_PREGUNTAS.map(p => p.campo)).size === TODAS_LAS_PREGUNTAS.length);
  comprobar("todas dicen qué significan los extremos",
    TODAS_LAS_PREGUNTAS.every(p => p.bajo.length > 1 && p.alto.length > 1));

  console.log("\n═══ 2. Guardar y medir ═══\n");

  const { puntajeValido, guardarRespuesta, prepararEncuesta, resumenEncuestas } =
    await import("../src/lib/encuesta");

  comprobar("0 es un puntaje válido", puntajeValido(0));
  comprobar("10 también", puntajeValido(10));
  comprobar("11 no", !puntajeValido(11));
  comprobar("-1 no", !puntajeValido(-1));
  comprobar("un decimal no", !puntajeValido(7.5));
  comprobar("un texto no", !puntajeValido("9"));

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  const marca = `VERIF-encuesta-${Date.now()}`;
  let clienteId: string | null = null;
  let encuestaId: string | null = null;

  try {
    const antes = await resumenEncuestas();
    console.log(`  Estado de partida: ${antes.enviadas} enviadas, ${antes.respondidas} respondidas, NPS ${antes.nps ?? "—"}\n`);

    const cliente = await prisma.cliente.create({
      data: { nombre: marca, tipo: "persona", estado: "PROSPECTO", activo: false },
      select: { id: true },
    });
    clienteId = cliente.id;

    // Sin instalación: la encuesta puede existir suelta, y así la prueba
    // no toca ningún pedido de verdad.
    const { randomBytes } = await import("node:crypto");
    const token = "VERIF" + randomBytes(12).toString("base64url");
    const e = await prisma.encuestaSatisfaccion.create({
      data: { clienteId, token, enviadaEn: new Date() },
      select: { id: true, token: true },
    });
    encuestaId = e.id;
    comprobar("se crea con su token", e.token === token);

    let r = await guardarRespuesta(token, { calidad: 9 });
    comprobar("sin el NPS no se guarda", !r.ok, r.error ?? "");

    r = await guardarRespuesta(token, {
      recomendaria: 9, calidad: 10, precio: 7, profesionalidad: 9,
      atencion: 10, puntualidad: 6, limpieza: 8, recompra: 9,
      destacaria: "La puntualidad del equipo.",
      recomendaciones: "Avisar un día antes.",
    });
    comprobar("con el NPS sí", r.ok, r.error ?? "");

    const guardada = await prisma.encuestaSatisfaccion.findUnique({ where: { token } });
    comprobar("se guardaron los ocho puntajes",
      guardada?.recomendaria === 9 && guardada?.calidad === 10 && guardada?.precio === 7 &&
      guardada?.profesionalidad === 9 && guardada?.atencion === 10 &&
      guardada?.puntualidad === 6 && guardada?.limpieza === 8 && guardada?.recompra === 9);
    comprobar("y los dos textos", Boolean(guardada?.destacaria && guardada?.recomendaciones));
    comprobar("se selló cuándo respondió", Boolean(guardada?.respondidaEn));

    r = await guardarRespuesta(token, { recomendaria: 1 });
    comprobar("no se puede contestar dos veces", !r.ok, r.error ?? "");
    const sinCambiar = await prisma.encuestaSatisfaccion.findUnique({ where: { token } });
    comprobar("y el segundo intento NO pisó la respuesta buena", sinCambiar?.recomendaria === 9);

    r = await guardarRespuesta("token-que-no-existe", { recomendaria: 9 });
    comprobar("un token inventado no guarda nada", !r.ok);

    const despues = await resumenEncuestas();
    comprobar("la respuesta entra en el resumen", despues.respondidas === antes.respondidas + 1);
    comprobar("hay NPS", despues.nps !== null, String(despues.nps));
    comprobar("un 9 cuenta como promotor", despues.promotores === antes.promotores + 1);
    comprobar("los promedios salen", typeof despues.promedios.calidad === "number");
    comprobar("la tasa de respuesta es un porcentaje",
      despues.tasaRespuesta >= 0 && despues.tasaRespuesta <= 100, String(despues.tasaRespuesta));

    // Un puntaje fuera de rango se descarta en vez de guardarse mal.
    const token2 = "VERIF" + randomBytes(12).toString("base64url");
    await prisma.encuestaSatisfaccion.create({ data: { clienteId, token: token2 } });
    await guardarRespuesta(token2, { recomendaria: 10, calidad: 99 as number });
    const segunda = await prisma.encuestaSatisfaccion.findUnique({ where: { token: token2 } });
    comprobar("un puntaje fuera de rango se guarda como vacío, no como 99",
      segunda?.calidad === null, String(segunda?.calidad));
    await prisma.encuestaSatisfaccion.delete({ where: { token: token2 } }).catch(() => {});
  } finally {
    if (encuestaId) await prisma.encuestaSatisfaccion.deleteMany({ where: { id: encuestaId } }).catch(() => {});
    if (clienteId) {
      await prisma.encuestaSatisfaccion.deleteMany({ where: { clienteId } }).catch(() => {});
      await prisma.cliente.delete({ where: { id: clienteId } }).catch(() => {});
    }
    console.log("\n  (limpieza: encuesta y cliente de prueba borrados)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
