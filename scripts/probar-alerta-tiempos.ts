// ============================================================
// Comprueba que el aviso por incumplir el compromiso de respuesta sale.
//
//   npx tsx scripts/probar-alerta-tiempos.ts
//
// Hay 0 conversaciones en la base, así que el aviso no se puede ver
// esperando a que pase. Este script fabrica el caso: crea una conexión y
// dos conversaciones de mentira —una vencida y otra recién entrada—,
// corre la alerta de verdad y comprueba qué hizo con cada una.
//
// ⚠️ ESCRIBE EN LA BASE DE PRODUCCIÓN y lo borra todo al terminar,
// incluso si algo falla (el `finally` limpia). Lo que crea lleva el
// prefijo VERIF- para poder reconocerlo si algún día quedara suelto.
//
// El correo NO sale: el SMTP no está configurado, y la alerta lo
// detecta antes de intentar nada. Eso también se comprueba aquí, porque
// es justo lo que hay que saber hoy: la notificación del portal SÍ
// queda, el correo no.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

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

let fallos = 0;
function comprobar(titulo: string, ok: boolean, detalle = "") {
  console.log(`  ${ok ? "✔" : "✘"} ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

const MARCA = `VERIF-${Date.now()}`;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { alertarSinRespuesta } = await import("../src/lib/nexus/alertas");
  const { getConfigTiempos, minutosHabiles } = await import("../src/lib/nexus/tiempos");

  const cfg = await getConfigTiempos();
  console.log(
    `\nCompromiso: ${cfg.compromisoMin} min · horario ${cfg.horaInicio}:00–${cfg.horaFin}:00 · ` +
    `días ${cfg.dias.join(",")}\n`,
  );

  const admins = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { id: true, nombre: true, email: true },
  });
  const asesor = await prisma.usuario.findFirst({
    where: { activo: true, rol: "VENDEDOR" },
    select: { id: true, nombre: true, email: true },
  });
  console.log(`Administradores activos: ${admins.length} · asesor de prueba: ${asesor?.nombre ?? "ninguno"}\n`);

  let conexionId = "";
  const creadas: string[] = [];

  try {
    const conexion = await prisma.nexusConexion.create({
      data: { canal: "WEB", nombre: `${MARCA} conexión de prueba`, activo: false },
    });
    conexionId = conexion.id;

    // Para que la conversación esté vencida con seguridad hay que
    // retroceder en tiempo HÁBIL, no a reloj corrido: si se resta un día
    // y cae domingo, el reloj hábil marca 0 y la prueba diría que el
    // aviso no salió cuando en realidad no tenía que salir.
    let vieja = new Date(Date.now() - 24 * 60 * 60_000);
    for (let i = 0; i < 14 && minutosHabiles(vieja, new Date(), cfg) <= cfg.compromisoMin; i++) {
      vieja = new Date(vieja.getTime() - 24 * 60 * 60_000);
    }
    const habiles = minutosHabiles(vieja, new Date(), cfg);
    console.log(`Conversación "vencida" fechada el ${vieja.toISOString().slice(0, 16)} → ${habiles} min hábiles\n`);

    const vencida = await prisma.nexusConversacion.create({
      data: {
        conexionId, canal: "WEB", remitente: `${MARCA} cliente que espera`,
        asunto: "Cotización de malla para balcón", estado: "ABIERTA",
        createdAt: vieja, asignadoId: asesor?.id ?? null, etiquetas: ["prueba"],
      },
    });
    creadas.push(vencida.id);

    // Recién entrada: NO debe avisarse. Es la comprobación que evita que
    // el sistema empiece a mandar avisos por todo.
    const reciente = await prisma.nexusConversacion.create({
      data: {
        conexionId, canal: "WEB", remitente: `${MARCA} cliente recién llegado`,
        estado: "ABIERTA", asignadoId: asesor?.id ?? null,
      },
    });
    creadas.push(reciente.id);

    // Ya respondida: tampoco. Cubre el caso de que el filtro se rompa.
    const respondida = await prisma.nexusConversacion.create({
      data: {
        conexionId, canal: "WEB", remitente: `${MARCA} ya atendido`,
        estado: "ABIERTA", createdAt: vieja, primeraRespuestaEn: new Date(),
      },
    });
    creadas.push(respondida.id);

    // ── Primero en seco ──
    console.log("1. CORRIDA EN SECO (?dry=1: no escribe ni manda nada)\n");
    const seco = await alertarSinRespuesta({ dry: true });
    const enSeco = seco.acciones.filter(a => creadas.includes(a.conversacionId));
    comprobar("la corrida en seco detecta la vencida", enSeco.some(a => a.conversacionId === vencida.id));
    comprobar("la corrida en seco NO toca la reciente", !enSeco.some(a => a.conversacionId === reciente.id));
    comprobar("la corrida en seco NO toca la respondida", !enSeco.some(a => a.conversacionId === respondida.id));

    const selloSeco = await prisma.nexusConversacion.findUnique({
      where: { id: vencida.id }, select: { alertaTiempoEn: true },
    });
    comprobar("en seco NO se pone el sello", selloSeco?.alertaTiempoEn === null);

    const notifSeco = await prisma.notificacion.count({ where: { titulo: { contains: MARCA } } });
    comprobar("en seco NO se crean notificaciones", notifSeco === 0, `${notifSeco} creadas`);

    // ── Ahora de verdad ──
    console.log("\n2. CORRIDA REAL\n");
    const real = await alertarSinRespuesta({ dry: false });
    const accion = real.acciones.find(a => a.conversacionId === vencida.id);

    console.log(`   revisadas=${real.revisadas} vencidas=${real.vencidas} avisadas=${real.avisadas}`);
    console.log(`   correo configurado: ${real.correoConfigurado ? "sí" : "NO"}`);
    if (accion) {
      console.log(`   → ${accion.remitente}: ${accion.esperandoMin} min · asignado a ${accion.asignado ?? "nadie"}`);
      console.log(`     notificados en el portal: ${accion.notificados.length} · correo: ${accion.correo}`);
      if (accion.detalle) console.log(`     detalle: ${accion.detalle}`);
    }
    console.log("");

    comprobar("la vencida se avisa", !!accion);
    comprobar("la reciente sigue sin avisarse", !real.acciones.some(a => a.conversacionId === reciente.id));
    comprobar(
      "se avisa al asesor asignado",
      !asesor || (accion?.notificados ?? []).includes(asesor.id),
      asesor ? asesor.nombre : "no hay VENDEDOR activo, se omite",
    );
    comprobar(
      "se avisa a todos los administradores",
      admins.every(a => (accion?.notificados ?? []).includes(a.id)),
      `${admins.length} admin(es)`,
    );
    comprobar(
      "no se avisa dos veces a la misma persona",
      new Set(accion?.notificados ?? []).size === (accion?.notificados ?? []).length,
    );
    comprobar(
      "el correo se salta porque el SMTP no está cargado",
      accion?.correo === "sin-configurar",
      `estado del correo: ${accion?.correo}`,
    );

    const notifs = await prisma.notificacion.findMany({
      where: { titulo: { contains: MARCA } },
      select: { id: true, usuarioId: true, tipo: true, mensaje: true, data: true },
    });
    comprobar(
      "hay una notificación por destinatario",
      notifs.length === (accion?.notificados.length ?? 0),
      `${notifs.length} notificaciones`,
    );
    comprobar("cada una va dirigida a alguien", notifs.every(n => !!n.usuarioId));
    comprobar(
      "el mensaje dice cuánto lleva esperando y el compromiso",
      notifs.every(n => /min hábil|tiempo HÁBIL/i.test(n.mensaje) && n.mensaje.includes(String(cfg.compromisoMin))),
    );
    comprobar(
      "el aviso enlaza la conversación",
      notifs.every(n => (n.data as { conversacionId?: string })?.conversacionId === vencida.id),
    );

    const sello = await prisma.nexusConversacion.findUnique({
      where: { id: vencida.id }, select: { alertaTiempoEn: true },
    });
    comprobar("queda el sello del aviso", !!sello?.alertaTiempoEn);

    // ── Y no se repite ──
    console.log("\n3. SEGUNDA CORRIDA (el mismo día siguiente, sin que nadie conteste)\n");
    const otra = await alertarSinRespuesta({ dry: false });
    comprobar(
      "NO se vuelve a avisar de la misma",
      !otra.acciones.some(a => a.conversacionId === vencida.id),
    );
    comprobar("pero se sigue contando como pendiente avisada", otra.yaAvisadas >= 1, `${otra.yaAvisadas}`);

    const notifs2 = await prisma.notificacion.count({ where: { titulo: { contains: MARCA } } });
    comprobar("no se duplicaron las notificaciones", notifs2 === notifs.length, `${notifs2} en total`);
  } finally {
    console.log("\nLimpiando…");
    await prisma.notificacion.deleteMany({ where: { titulo: { contains: MARCA } } }).catch(() => undefined);
    // Borrar la conexión arrastra sus conversaciones y mensajes (cascade).
    if (conexionId) {
      await prisma.nexusConexion.delete({ where: { id: conexionId } })
        .catch(e => console.error("  ⚠️ NO se pudo borrar la conexión de prueba:", (e as Error).message));
    }
    const restos = await prisma.nexusConversacion.count({ where: { remitente: { contains: MARCA } } });
    const restosNotif = await prisma.notificacion.count({ where: { titulo: { contains: MARCA } } });
    comprobar("no quedan conversaciones de prueba", restos === 0, `${restos}`);
    comprobar("no quedan notificaciones de prueba", restosNotif === 0, `${restosNotif}`);
    await prisma.$disconnect();
  }

  console.log(fallos === 0 ? "\n✅ Todas las comprobaciones pasaron.\n" : `\n❌ ${fallos} fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
