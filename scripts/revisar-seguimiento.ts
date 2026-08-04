// ============================================================
// Revisa el seguimiento post-cotización contra la base REAL.
//
//   npx tsx scripts/revisar-seguimiento.ts
//
// Es de SOLO LECTURA: corre el motor en modo simulacro (`dry`), que no
// manda correos ni escribe filas. Sirve para ver qué haría la corrida
// diaria sin entrar al portal, que sí escribiría en producción.
//
// Carga `.env.local` antes que `.env` por la misma razón que
// aplicar-migracion.ts: en `.env` está el host directo, que resuelve
// solo por IPv6 y desde muchas redes no responde.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

// Ojo: antes de instanciar PrismaClient.
for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    if (process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { correrSeguimientos, getConfigSeguimiento, venceEl } = await import("../src/lib/seguimiento");

  const cfg = await getConfigSeguimiento();
  console.log("── Configuración ──");
  console.log(`  activo: ${cfg.activo} · WhatsApp: ${cfg.porWhatsapp}`);
  console.log(`  toque 1: ${cfg.t1Horas} h · toque 2: ${cfg.t2Horas} h (plazo ${cfg.t2LimiteHoras} h) · toque 3: ${cfg.t3DiasAntes} d antes\n`);

  const enviadas = await prisma.cotizacion.findMany({
    where: { estado: "ENVIADA" },
    select: {
      numero: true, createdAt: true, validezDias: true, enviadaEn: true,
      seguimientoActivo: true, vistas: true,
      cliente: { select: { nombre: true, email: true } },
      seguimientos: { select: { toque: true, estado: true } },
    },
    orderBy: { enviadaEn: "desc" },
  });

  console.log(`── Cotizaciones ENVIADA: ${enviadas.length} ──`);
  for (const c of enviadas) {
    const vence = venceEl(c);
    const toques = c.seguimientos.map(s => `T${s.toque}:${s.estado}`).join(" ") || "sin toques";
    console.log(
      `  ${c.numero.padEnd(12)} ${c.cliente.nombre.slice(0, 22).padEnd(24)} ` +
      `${c.cliente.email ? "correo" : "SIN CORREO"} · vistas ${c.vistas} · ` +
      `vence ${vence.toLocaleDateString("es-CO")} · ${c.seguimientoActivo ? "activo" : "APAGADO"} · ${toques}`,
    );
  }

  console.log("\n── Qué haría la corrida de hoy (simulacro, no escribe) ──");
  const r = await correrSeguimientos({ dry: true });
  console.log(`  revisadas: ${r.revisadas} · correo configurado: ${r.configurado.correo}`);
  for (const a of r.acciones) console.log(`  · ${a.cotizacion} toque ${a.toque}: ${a.detalle}`);
  for (const o of r.omitidas) console.log(`  · ${o}`);
  if (!r.acciones.length && !r.omitidas.length) console.log("  (nada que hacer hoy)");

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
