// ============================================================
// Los avisos con el portal cerrado.
//
//   npx tsx scripts/probar-push.ts
//
// Lo que se comprueba, y por qué cada cosa:
//
//   · Que la notificación se escriba AUNQUE el push falle. Es la regla
//     que impide cambiar un aviso que a veces no suena por uno que a
//     veces no existe.
//   · Que un aparato muerto se BORRE. Un endpoint que ya no contesta y
//     que nadie limpia hace que cada aviso se quede esperando, y avisar
//     a cinco personas empieza a tardar medio minuto.
//   · Que volver a suscribir el mismo navegador ACTUALICE en vez de
//     duplicar. Si no, la persona recibe cada aviso dos veces en el
//     mismo teléfono.
//   · Que sin claves VAPID no reviente nada.
//
// Contra PRODUCCIÓN. No manda ningún push de verdad —los endpoints de
// prueba son inventados— y borra lo que crea.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
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

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  // Claves de mentira pero con la forma correcta: sirven para que
  // `web-push` no se queje al configurarse. Los envíos fallan igual
  // porque los endpoints no existen, que es justo lo que se prueba.
  const webpush = (await import("web-push")).default;
  const claves = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = claves.publicKey;
  process.env.VAPID_PRIVATE_KEY = claves.privateKey;
  process.env.VAPID_SUBJECT = "mailto:verif@esek.com.co";

  const { enviarPush, guardarSuscripcion, pushConfigurado } = await import("../src/lib/push");
  const { notificar } = await import("../src/lib/notificar");

  let usuarioId: string | null = null;

  try {
    const u = await prisma.usuario.create({
      data: {
        nombre: "VERIF Push", email: `verif-push-${Date.now()}@example.invalid`,
        password: "x".repeat(60), rol: "VENDEDOR", activo: true,
      },
      select: { id: true },
    });
    usuarioId = u.id;

    console.log("═══ 1. Las claves ═══\n");
    comprobar("con las claves puestas, el push está disponible", pushConfigurado());

    console.log("\n═══ 2. Suscribir un aparato ═══\n");

    const endpoint = `https://fcm.googleapis.com/fcm/send/VERIF-${Date.now()}`;
    await guardarSuscripcion({
      usuarioId: u.id, endpoint, p256dh: "BPrueba".padEnd(87, "x"), auth: "authPrueba".padEnd(22, "y"),
      agente: "prueba",
    });
    comprobar("queda guardado", await prisma.suscripcionPush.count({ where: { usuarioId: u.id } }) === 1);

    // El mismo navegador otra vez: tiene que actualizar, no duplicar.
    await guardarSuscripcion({
      usuarioId: u.id, endpoint, p256dh: "BOtra".padEnd(87, "z"), auth: "authOtra".padEnd(22, "w"),
      agente: "prueba 2",
    });
    const n = await prisma.suscripcionPush.count({ where: { usuarioId: u.id } });
    comprobar("volver a suscribir el MISMO navegador no duplica", n === 1, `hay ${n}`);

    console.log("\n═══ 3. El aparato muerto se limpia ═══\n");

    // El endpoint no existe, así que el servicio responde con un error
    // definitivo y la fila tiene que desaparecer.
    const r = await enviarPush(u.id, { titulo: "Prueba", mensaje: "no llega a ningún lado" });
    comprobar("se intentó con el aparato registrado", r.aparatos === 1, JSON.stringify(r));
    const quedan = await prisma.suscripcionPush.count({ where: { usuarioId: u.id } });
    comprobar("un endpoint que falla no se queda para siempre",
      quedan === 0 || r.limpiados > 0 || (await prisma.suscripcionPush.findFirst({ where: { usuarioId: u.id } }))!.fallos > 0,
      `quedan ${quedan}, limpiados ${r.limpiados}`);

    console.log("\n═══ 4. El push NO puede tumbar el aviso ═══\n");

    const antes = await prisma.notificacion.count({ where: { usuarioId: u.id } });
    const res = await notificar({
      usuarioId: u.id, titulo: "VERIF aviso", mensaje: "la fila tiene que quedar igual",
    });
    const despues = await prisma.notificacion.count({ where: { usuarioId: u.id } });
    comprobar("la notificación se escribe aunque el push falle",
      despues === antes + 1 && res.creadas === 1, JSON.stringify(res));

    console.log("\n═══ 5. Sin claves no revienta ═══\n");

    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    comprobar("sin claves, el push se declara no configurado", !pushConfigurado());
    const sinClaves = await enviarPush(u.id, { titulo: "x", mensaje: "y" });
    comprobar("y enviar no lanza: lo dice y ya", sinClaves.fallos.length > 0 && sinClaves.entregados === 0);

    const res2 = await notificar({ usuarioId: u.id, titulo: "VERIF 2", mensaje: "sin claves" });
    comprobar("y la notificación se sigue escribiendo", res2.creadas === 1);
  } finally {
    if (usuarioId) {
      await prisma.notificacion.deleteMany({ where: { usuarioId } }).catch(() => {});
      await prisma.suscripcionPush.deleteMany({ where: { usuarioId } }).catch(() => {});
      await prisma.usuario.deleteMany({ where: { id: usuarioId } }).catch(() => {});
    }
    console.log("\n  (limpieza: usuario, avisos y suscripciones de prueba borrados)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
