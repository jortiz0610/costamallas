// ============================================================
// El camino de vuelta del chat de la web.
//
//   npx tsx scripts/probar-respuesta-web.ts
//
// Comprueba las dos mitades de lo mismo:
//
//   1. Responder desde Nexus una conversación del chat web SALE, y sale
//      AL CHAT. Antes caía en el envío por webhook y devolvía "El canal
//      WEB no tiene URL de salida configurada".
//   2. El correo ya no se manda por cada respuesta, sino UNA vez, al
//      cerrar, con toda la conversación.
//
// Manda un correo DE VERDAD, al buzón de la propia empresa, y después
// borra las conversaciones de prueba que crea.
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
  const { enviarCopiaConversacion } = await import("../src/lib/nexus/copia-chat");
  const { randomBytes } = await import("node:crypto");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  const conexion = await prisma.nexusConexion.findFirst({ where: { canal: "WEB" } });
  if (!conexion) { console.log("  ✗ No hay conexión WEB. Nada que probar."); process.exit(1); }
  console.log(`  Conexión: ${conexion.nombre} (activa: ${conexion.activo})\n`);

  const puede = await canalPuedeEnviar(conexion.id);
  comprobar("el canal se declara capaz de responder", puede.puede, puede.motivo ?? "");

  const cfg = await prisma.configuracion.findFirst({ where: { clave: "empresa_email" } });
  const destino = (cfg?.valor ?? "").trim();
  if (!destino) { console.log("  ✗ No hay empresa_email configurado."); process.exit(1); }
  console.log(`\n  La copia de prueba va a: ${destino}\n`);

  const creadas: string[] = [];
  const nueva = async (datos: Record<string, unknown>) => {
    const c = await prisma.nexusConversacion.create({
      data: { conexionId: conexion.id, canal: "WEB", estado: "ABIERTA", ...datos } as never,
      select: { id: true, tokenWeb: true },
    });
    creadas.push(c.id);
    return c;
  };

  try {
    console.log("═══ 1. Responder va al chat ═══\n");

    const conv = await nueva({
      remitente: "VERIF Prueba de respuesta",
      emailRemit: destino,
      tokenWeb: "VERIF" + randomBytes(18).toString("base64url"),
    });

    // Lo que escribió el visitante, para que haya conversación.
    await prisma.nexusMensaje.create({
      data: { conversacionId: conv.id, origen: "contacto", contenido: "¿Cuánto vale la malla para un balcón de 3 metros?" },
    });
    await prisma.nexusMensaje.create({
      data: { conversacionId: conv.id, origen: "agente-ia", contenido: "Depende del alto. ¿Es para gatos o para niños?" },
    });

    const r = await enviarPorCanal(conv.id, "Buenas, soy Skarlyn. Para 3 metros le sirve el kit estándar.");
    comprobar("responder una conversación del chat web SALE", r.ok, r.error ?? "");
    comprobar("y sale por el chat, no por correo", r.refExterna === "chat-web", r.refExterna ?? "");

    // Así lo ve el navegador del visitante.
    await prisma.nexusMensaje.create({
      data: {
        conversacionId: conv.id, origen: "agente",
        contenido: "Buenas, soy Skarlyn. Para 3 metros le sirve el kit estándar.",
        estadoEnvio: "ENVIADO",
      },
    });

    const visibles = await prisma.nexusMensaje.findMany({
      where: { conversacionId: conv.id, origen: "agente" },
      select: { contenido: true },
    });
    comprobar("el visitante puede verla desde su chat", visibles.length === 1, String(visibles.length));

    console.log("\n═══ 2. La copia, solo al cerrar ═══\n");

    const c1 = await enviarCopiaConversacion(conv.id);
    comprobar("al cerrar se manda la copia", c1.ok && !c1.omitida, c1.motivo ?? "");

    const c2 = await enviarCopiaConversacion(conv.id);
    comprobar("y NO se manda dos veces", c2.omitida === true, c2.motivo ?? "");

    console.log("");

    // Un monólogo no merece copia.
    const sola = await nueva({ remitente: "VERIF Sin respuesta", emailRemit: destino });
    await prisma.nexusMensaje.create({
      data: { conversacionId: sola.id, origen: "contacto", contenido: "hola" },
    });
    const c3 = await enviarCopiaConversacion(sola.id);
    comprobar("un chat donde nadie contestó no genera copia", c3.omitida === true, c3.motivo ?? "");

    // Sin correo no hay a dónde mandarla, y eso no es un fallo.
    const anon = await nueva({ remitente: "VERIF Sin correo" });
    const c4 = await enviarCopiaConversacion(anon.id);
    comprobar("sin correo se omite en vez de reventar", c4.ok && c4.omitida === true, c4.motivo ?? "");

    const r2 = await enviarPorCanal(anon.id, "hola");
    comprobar("y aun sin correo se le puede responder en el chat", r2.ok, r2.error ?? "");
    comprobar("ya NO habla de URL de salida",
      !/URL de salida/i.test(r2.error ?? ""), r2.error ?? "");
  } finally {
    for (const id of creadas) {
      await prisma.nexusMensaje.deleteMany({ where: { conversacionId: id } }).catch(() => {});
      await prisma.nexusConversacion.delete({ where: { id } }).catch(() => {});
    }
    console.log("\n  (limpieza: conversaciones de prueba borradas)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
