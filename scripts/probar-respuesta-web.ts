// ============================================================
// ¿Se puede responder desde Nexus una conversación del chat de la web?
//
//   npx tsx scripts/probar-respuesta-web.ts
//
// Hasta hoy no: el envío caía en el webhook genérico y devolvía
// "El canal WEB no tiene URL de salida configurada". Esta prueba usa el
// MISMO camino que el botón de responder del inbox.
//
// Manda un correo DE VERDAD, al buzón de la propia empresa. Después
// borra la conversación de prueba que crea.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
for (const a of [".env.local", ".env"]) {
  if (!existsSync(a)) continue;
  for (const l of readFileSync(a, "utf8").split("\n")) {
    const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL|ENCRYPTION_KEY)\s*=\s*(.+)\s*$/);
    if (!m || process.env["__" + m[1]]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env["__" + m[1]] = "1";
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
  const { enviarPorCanal, canalPuedeEnviar } = await import("../src/lib/nexus/canales");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  const conexion = await prisma.nexusConexion.findFirst({ where: { canal: "WEB" } });
  if (!conexion) { console.log("  ✗ No hay conexión WEB. Nada que probar."); process.exit(1); }
  console.log(`  Conexión: ${conexion.nombre} (activa: ${conexion.activo})\n`);

  const puede = await canalPuedeEnviar(conexion.id);
  comprobar("el canal se declara capaz de responder", puede.puede, puede.motivo ?? "");

  // A dónde va el correo de prueba: al buzón de la propia empresa.
  const cfg = await prisma.configuracion.findFirst({ where: { clave: "empresa_email" } });
  const destino = (cfg?.valor ?? "").trim();
  if (!destino) { console.log("  ✗ No hay empresa_email configurado."); process.exit(1); }
  console.log(`\n  El correo de prueba va a: ${destino}\n`);

  let convId: string | null = null;
  try {
    // 1. Con correo: tiene que salir.
    const conv = await prisma.nexusConversacion.create({
      data: {
        conexionId: conexion.id,
        canal: "WEB",
        remitente: "VERIF Prueba de respuesta",
        emailRemit: destino,
        estado: "ABIERTA",
      },
      select: { id: true },
    });
    convId = conv.id;

    const r = await enviarPorCanal(
      conv.id,
      "Esto es una prueba técnica del portal. Si le llegó este correo, " +
      "responder desde Nexus una conversación del chat de la web ya funciona. " +
      "No hay que hacer nada: puede borrarlo.",
    );
    comprobar("responder una conversación del chat web SALE", r.ok, r.error ?? "");
    comprobar("y queda el id del correo para poder rastrearlo", Boolean(r.refExterna), r.refExterna ?? "");

    // 2. Sin correo: tiene que fallar diciendo qué hacer, no con plomería.
    const sinCorreo = await prisma.nexusConversacion.create({
      data: {
        conexionId: conexion.id, canal: "WEB",
        remitente: "VERIF Sin correo", estado: "ABIERTA",
      },
      select: { id: true },
    });
    const r2 = await enviarPorCanal(sinCorreo.id, "hola");
    comprobar("una conversación vieja sin correo no se envía", !r2.ok);
    comprobar("y el motivo le dice al asesor qué hacer",
      /WhatsApp|tel[ée]fono/i.test(r2.error ?? ""), r2.error ?? "");
    comprobar("ya NO habla de URL de salida",
      !/URL de salida/i.test(r2.error ?? ""), r2.error ?? "");
    await prisma.nexusMensaje.deleteMany({ where: { conversacionId: sinCorreo.id } });
    await prisma.nexusConversacion.delete({ where: { id: sinCorreo.id } });
  } finally {
    if (convId) {
      await prisma.nexusMensaje.deleteMany({ where: { conversacionId: convId } }).catch(() => {});
      await prisma.nexusConversacion.delete({ where: { id: convId } }).catch(() => {});
    }
    console.log("\n  (limpieza: conversaciones de prueba borradas)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
