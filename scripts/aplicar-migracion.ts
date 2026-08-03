// ============================================================
// Aplica un archivo .sql sentencia por sentencia.
//
//   npx tsx scripts/aplicar-migracion.ts prisma/migrations/<carpeta>/migration.sql
//
// Dos cosas que costaron un rato y por eso están aquí:
//   1. `prisma db execute` se queda colgado contra el pooler de Supabase.
//   2. Prisma en un script suelto carga `.env`, NO `.env.local`. En `.env`
//      está el host directo, que resuelve solo por IPv6 y desde muchas
//      redes no responde. Aquí se fuerza el valor de `.env.local`, que es
//      el pooler y es lo que usa la app.
//
// El SQL debe ser idempotente (IF NOT EXISTS): se puede correr dos veces.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

// Ojo: esto tiene que pasar ANTES de instanciar PrismaClient.
for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    // El primer archivo que la define gana (.env.local manda).
    if (process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error("Falta la ruta del .sql");
    process.exit(1);
  }

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`Servidor: ${host}\n`);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const limpio = readFileSync(ruta, "utf8")
    .split("\n")
    .filter(l => !l.trim().startsWith("--"))
    .join("\n");

  // Partir por ';' a secas rompe los bloques DO $$ ... $$, que llevan
  // punto y coma adentro: se caían con "unterminated dollar-quoted
  // string". Se lleva la cuenta de si vamos dentro de un $$.
  const sentencias: string[] = [];
  let actual = "";
  let dentroDeBloque = false;
  for (const trozo of limpio.split(/(\$\$)/)) {
    if (trozo === "$$") {
      dentroDeBloque = !dentroDeBloque;
      actual += trozo;
      continue;
    }
    if (dentroDeBloque) {
      actual += trozo;
      continue;
    }
    const partes = trozo.split(";");
    for (let i = 0; i < partes.length; i++) {
      actual += partes[i];
      if (i < partes.length - 1) {
        if (actual.trim()) sentencias.push(actual.trim());
        actual = "";
      }
    }
  }
  if (actual.trim()) sentencias.push(actual.trim());

  console.log(`${sentencias.length} sentencias en ${ruta}\n`);

  let ok = 0;
  try {
    for (const [i, sql] of sentencias.entries()) {
      const resumen = sql.replace(/\s+/g, " ").slice(0, 70);
      try {
        await prisma.$executeRawUnsafe(sql);
        ok++;
        console.log(`  [${i + 1}/${sentencias.length}] OK    ${resumen}`);
      } catch (e) {
        const msg = (e as Error).message.trim().split("\n").filter(Boolean).slice(0, 3).join(" | ");
        console.error(`  [${i + 1}/${sentencias.length}] FALLO ${resumen}`);
        console.error(`        ${msg}`);
        if (/P1001|ECONNREFUSED|timeout|ENOTFOUND|Can't reach/i.test(msg)) {
          console.error("\n        Es la conexión, no el SQL. Se detiene.");
          break;
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${ok}/${sentencias.length} aplicadas.`);
}

main().catch(e => { console.error(e); process.exit(1); });
