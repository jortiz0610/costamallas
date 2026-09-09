// ============================================================
// El cierre automático de los chats de la web.
//
//   npx tsx scripts/probar-cierre-chats.ts
//
// Lo que importa comprobar, en orden de lo que dolería:
//
//   · Que NO se cierre un chat al que nadie contestó. Cerrarlo taparía
//     a una persona desatendida y encima le mandaría la "copia" de una
//     conversación en la que la empresa no dijo nada.
//   · Que solo toque el canal WEB. Cerrarle a alguien una conversación
//     viva de WhatsApp es quitarle trabajo de la bandeja.
//   · Que el silencio se mida por el ÚLTIMO MENSAJE y no por `updatedAt`,
//     que se toca al marcar leída o al asignar.
//   · Que en 0 se apague del todo.
//
// Contra PRODUCCIÓN, en seco salvo lo que se mira en la base, y borra
// todo lo que crea.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";
for (const a of [".env.local", ".env"]) {
  if (!existsSync(a)) continue;
  for (const l of readFileSync(a, "utf8").split("\n")) {
    const m = l.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env[m[1]]) continue;   // el entorno manda
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
  const { cerrarChatsDormidos } = await import("../src/lib/nexus/cierre-automatico");
  const { getConfigAgenteWeb, setConfigAgenteWeb } = await import("../src/lib/agente-web/config");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`\n  (servidor: ${host})\n`);

  const cfgOriginal = await getConfigAgenteWeb();
  const ahora = new Date();
  const viejo = new Date(ahora.getTime() - 100 * 3_600_000);   // hace 100 h
  const reciente = new Date(ahora.getTime() - 1 * 3_600_000);  // hace 1 h

  const creadas: string[] = [];
  let conexionId: string | null = null;

  const crearChat = async (
    canal: string, ultimoMensaje: Date, contestado: boolean, remitente: string,
  ) => {
    const c = await prisma.nexusConversacion.create({
      data: {
        conexionId: conexionId!,
        canal, remitente, emailRemit: "verif-chat@example.invalid",
        estado: "ABIERTA",
        primeraRespuestaEn: contestado ? ultimoMensaje : null,
        mensajes: { create: { origen: "contacto", contenido: "hola", createdAt: ultimoMensaje } },
      },
      select: { id: true },
    });
    creadas.push(c.id);
    return c.id;
  };

  try {
    const conexion = await prisma.nexusConexion.create({
      data: { canal: "WEB", nombre: "VERIF cierre", activo: false, config: {} },
      select: { id: true },
    });
    conexionId = conexion.id;

    await setConfigAgenteWeb({ horasParaCerrar: 48 });

    console.log("═══ 1. El chat olvidado ═══\n");

    const olvidado = await crearChat("WEB", viejo, true, "VERIF olvidado");
    const r1 = await cerrarChatsDormidos({ dry: true, ahora });
    comprobar("un chat contestado y en silencio entra",
      r1.cerradas.some(c => c.includes("VERIF olvidado")), JSON.stringify(r1).slice(0, 200));

    console.log("\n═══ 2. Lo que NO se puede cerrar ═══\n");

    const sinContestar = await crearChat("WEB", viejo, false, "VERIF nadie contesto");
    const r2 = await cerrarChatsDormidos({ dry: true, ahora });
    comprobar("un chat que NADIE contestó no se cierra",
      !r2.cerradas.some(c => c.includes("nadie contesto")),
      "se estaría tapando a una persona desatendida");

    const whatsapp = await crearChat("WHATSAPP", viejo, true, "VERIF whatsapp");
    const r3 = await cerrarChatsDormidos({ dry: true, ahora });
    comprobar("un chat de WhatsApp no se toca",
      !r3.cerradas.some(c => c.includes("whatsapp")));

    const vivo = await crearChat("WEB", reciente, true, "VERIF vivo");
    const r4 = await cerrarChatsDormidos({ dry: true, ahora });
    comprobar("un chat con actividad de hace una hora no se cierra",
      !r4.cerradas.some(c => c.includes("VERIF vivo")));

    console.log("\n═══ 3. El silencio se mide por el último mensaje ═══\n");

    // Se toca la fila —como al marcarla leída— sin que llegue ningún
    // mensaje. Tiene que seguir contando como dormida.
    await prisma.nexusConversacion.update({ where: { id: olvidado }, data: { leida: true } });
    const r5 = await cerrarChatsDormidos({ dry: true, ahora });
    comprobar("marcarla leída NO la revive",
      r5.cerradas.some(c => c.includes("VERIF olvidado")),
      "se está midiendo por updatedAt en vez de por el último mensaje");

    console.log("\n═══ 4. El interruptor ═══\n");

    await setConfigAgenteWeb({ horasParaCerrar: 0 });
    const r6 = await cerrarChatsDormidos({ dry: true, ahora });
    comprobar("en 0 no se cierra nada", r6.cerradas.length === 0 && r6.horas === 0,
      JSON.stringify(r6).slice(0, 120));

    void sinContestar; void whatsapp; void vivo;
  } finally {
    await setConfigAgenteWeb({ horasParaCerrar: cfgOriginal.horasParaCerrar });
    for (const id of creadas) {
      await prisma.nexusMensaje.deleteMany({ where: { conversacionId: id } }).catch(() => {});
      await prisma.nexusConversacion.deleteMany({ where: { id } }).catch(() => {});
    }
    if (conexionId) await prisma.nexusConexion.deleteMany({ where: { id: conexionId } }).catch(() => {});
    console.log(`\n  (limpieza: ${creadas.length} chats y la conexión de prueba borrados;`);
    console.log(`   el plazo vuelve a ${cfgOriginal.horasParaCerrar} h)`);
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
