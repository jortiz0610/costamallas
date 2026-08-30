// ============================================================
// Comprueba lo que faltaba de la Fase 7 de Nexus.
//
//   npx tsx scripts/probar-nexus-fase7.ts
//
// Cuatro partes:
//   1. Comandos y menciones: qué abre el menú y qué no. Lógica pura.
//   2. Canales: la normalización y la unión de WordPress con correo.
//   3. Temas y preferencias.
//   4. El cupo diario de IA, contra la base de PRODUCCIÓN. Usa un
//      usuario VERIF- que crea y borra, y limpia sus filas de uso.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
(process.env as Record<string, string>).NODE_ENV = "production";

for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m || process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

import {
  COMANDOS, MENCION_IA, leerEntrada, sugerir, sinMencion,
  CUPO_IA_POR_DEFECTO, claveUsoIA,
} from "../src/lib/nexus/comandos";
import {
  normalizarCanal, TEMAS, TEMA_POR_CLAVE, PREFS_POR_DEFECTO, CANALES_CONOCIDOS,
} from "../src/lib/nexus-preferencias";

let ok = 0, fallos = 0;
function comprobar(t: string, c: boolean, d = "") {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
}

async function main() {
  console.log("\n═══ 1. Comandos y @mallita ═══\n");

  comprobar("no hay comandos repetidos",
    new Set(COMANDOS.map(c => c.nombre)).size === COMANDOS.length);
  comprobar("todos tienen descripción", COMANDOS.every(c => c.descripcion.length > 5));

  const e1 = leerEntrada("/plan");
  comprobar("una barra al principio abre comando", e1.esComando && e1.nombre === "plan");

  const e2 = leerEntrada("mide 2/4 de pulgada");
  comprobar("una barra EN MITAD de la frase no abre nada", !e2.esComando,
    "es el caso de '2/4 de pulgada', que se escribe todo el día aquí");

  const e3 = leerEntrada("/producto malla eslabonada");
  comprobar("el argumento se separa bien",
    e3.esComando && e3.nombre === "producto" && e3.argumento === "malla eslabonada");

  comprobar("el nombre del comando no distingue mayúsculas",
    leerEntrada("/IA").nombre === "ia");

  const e4 = leerEntrada(`${MENCION_IA} dile que el lunes lo llamamos`);
  comprobar("@mallita se detecta", e4.llamaALaIA);
  comprobar("y se detecta en medio de la frase",
    leerEntrada(`hola ${MENCION_IA} ayúdame`).llamaALaIA);
  comprobar("mayúsculas también", leerEntrada("@Mallita ayuda").llamaALaIA);
  comprobar("la instrucción queda limpia",
    sinMencion(`${MENCION_IA} dile que el lunes lo llamamos`) === "dile que el lunes lo llamamos");
  comprobar("quitar la mención también funciona en medio",
    sinMencion(`dile ${MENCION_IA} que ya salió`) === "dile que ya salió");

  console.log("\n  — Qué comandos ve cada chat —\n");
  const conClientes = sugerir("", true).map(c => c.nombre);
  const soloEquipo = sugerir("", false).map(c => c.nombre);
  comprobar("en el chat con clientes salen todos", conClientes.length === COMANDOS.length);
  comprobar("en el chat del equipo NO sale /cliente", !soloEquipo.includes("cliente"),
    "no hay a quién guardar en el CRM");
  comprobar("ni /plantilla ni /cotizacion",
    !soloEquipo.includes("plantilla") && !soloEquipo.includes("cotizacion"));
  comprobar("pero /producto sí", soloEquipo.includes("producto"));
  comprobar("escribir /c filtra", sugerir("c", true).every(c => c.nombre.startsWith("c")));

  console.log("\n═══ 2. Los canales ═══\n");

  comprobar("el formulario de WordPress se atiende como correo",
    normalizarCanal("wordpress_form") === "EMAIL");
  comprobar("y con el nombre en mayúsculas también",
    normalizarCanal("WORDPRESS_FORM") === "EMAIL");
  comprobar("'mail' y 'correo' también llegan a EMAIL",
    normalizarCanal("mail") === "EMAIL" && normalizarCanal("Correo") === "EMAIL");
  comprobar("el CHAT EN VIVO de la web NO se une a correo",
    normalizarCanal("WEB") === "WEB",
    "ahí hay alguien esperando delante de la pantalla");
  comprobar("las minúsculas del mapa viejo se normalizan",
    normalizarCanal("whatsapp") === "WHATSAPP" && normalizarCanal("email") === "EMAIL");
  comprobar("un canal vacío no revienta", normalizarCanal(null) === "WEB");
  comprobar("normalizar dos veces da lo mismo",
    normalizarCanal(normalizarCanal("wordpress_form")) === "EMAIL");
  comprobar("todo canal conocido tiene color y etiqueta",
    CANALES_CONOCIDOS.every(c => PREFS_POR_DEFECTO.colores[c] && PREFS_POR_DEFECTO.etiquetas[c]));
  comprobar("la etiqueta de correo dice que incluye la web",
    /web/i.test(PREFS_POR_DEFECTO.etiquetas.EMAIL), PREFS_POR_DEFECTO.etiquetas.EMAIL);

  console.log("\n═══ 3. Los temas ═══\n");

  comprobar("hay exactamente tres", TEMAS.length === 3, String(TEMAS.length));
  comprobar("todos traen fondo y las dos burbujas",
    TEMAS.every(t => t.fondo && t.mia && t.suya && t.textoSuya));
  comprobar("ninguna burbuja es del mismo color que su fondo",
    TEMAS.every(t => t.fondo !== t.suya && t.fondo !== t.mia),
    "si coincidieran, la burbuja desaparecería");
  comprobar("el índice por clave cubre los tres",
    TEMAS.every(t => TEMA_POR_CLAVE[t.v]?.v === t.v));
  comprobar("el tema de fábrica existe", Boolean(TEMA_POR_CLAVE[PREFS_POR_DEFECTO.tema]));

  console.log("\n═══ 4. El cupo diario de IA ═══\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`  (servidor: ${host})\n`);

  const { estadoCupo, apuntarUso, cupoDiario, setCupoDiario } = await import("../src/lib/nexus/cupo-ia");

  const marca = `VERIF-cupo-${Date.now()}`;
  let usuarioId: string | null = null;
  const clavesCreadas: string[] = [];
  let cupoOriginal: number | null = null;

  try {
    cupoOriginal = await cupoDiario();
    comprobar("hay un cupo diario configurado o de fábrica", cupoOriginal >= 0, String(cupoOriginal));
    comprobar("el de fábrica es razonable", CUPO_IA_POR_DEFECTO > 0 && CUPO_IA_POR_DEFECTO <= 200);

    const u = await prisma.usuario.create({
      data: { nombre: marca, email: `${marca}@verificacion.local`, password: "no-sirve", rol: "VENDEDOR", activo: false },
      select: { id: true },
    });
    usuarioId = u.id;
    clavesCreadas.push(claveUsoIA(usuarioId));

    let est = await estadoCupo(usuarioId);
    comprobar("una persona nueva arranca en cero", est.usado === 0);
    comprobar("y no está agotada", !est.agotado);

    await apuntarUso(usuarioId);
    est = await estadoCupo(usuarioId);
    comprobar("usar una vez suma uno", est.usado === 1, String(est.usado));
    comprobar("y quedan una menos", est.quedan === est.tope - 1);

    // Bajar el tope a 2 y agotarlo.
    await setCupoDiario(2);
    await apuntarUso(usuarioId);
    est = await estadoCupo(usuarioId);
    comprobar("con el tope en 2 y dos usos, queda agotado", est.agotado, JSON.stringify(est));
    comprobar("nunca quedan menos de cero", est.quedan === 0);

    // Un tope en 0 apaga la IA para todos.
    await setCupoDiario(0);
    est = await estadoCupo(usuarioId);
    comprobar("el tope en 0 apaga el asistente", est.agotado && est.tope === 0);

    // El contador es POR PERSONA y POR DÍA.
    const clavehoy = claveUsoIA(usuarioId);
    const claveayer = claveUsoIA(usuarioId, new Date(Date.now() - 86_400_000));
    comprobar("la clave lleva la fecha, así que el contador se recicla solo",
      clavehoy !== claveayer);
    comprobar("y lleva el id de la persona", clavehoy.includes(usuarioId));

    const otro = await prisma.usuario.create({
      data: { nombre: `${marca}-2`, email: `${marca}-2@verificacion.local`, password: "no-sirve", rol: "VENDEDOR", activo: false },
      select: { id: true },
    });
    clavesCreadas.push(claveUsoIA(otro.id));
    await setCupoDiario(5);
    const estOtro = await estadoCupo(otro.id);
    comprobar("gastar el cupo de uno NO afecta al otro", estOtro.usado === 0 && !estOtro.agotado,
      "un tope global se lo come el primero que llegue");
    await prisma.usuario.delete({ where: { id: otro.id } }).catch(() => {});
  } finally {
    if (cupoOriginal !== null) await setCupoDiario(cupoOriginal).catch(() => {});
    for (const c of clavesCreadas) {
      await prisma.configuracion.deleteMany({ where: { clave: c } }).catch(() => {});
    }
    if (usuarioId) await prisma.usuario.delete({ where: { id: usuarioId } }).catch(() => {});
    console.log("\n  (limpieza: usuarios, contadores y cupo devueltos a como estaban)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
