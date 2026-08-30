// ============================================================
// Comprueba los cambios del 29-ago: roles nuevos, permisos por rol y
// el chat interno.
//
//   npx tsx scripts/probar-roles-chat.ts
//
// Tres partes:
//   1. Los roles: cuáles se asignan, cuáles se retiraron y qué ve cada
//      uno. Lógica pura.
//   2. Contra la base de PRODUCCIÓN, solo lectura: que el enum tenga
//      MARKETING y que nadie se haya quedado sin permisos.
//   3. El chat interno de verdad: dos usuarios VERIF-, un chat, mensajes,
//      contador de sin leer y el candado de "no eres miembro". Se borra
//      todo al terminar, pase lo que pase.
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
  PERMISOS_POR_ROL, PERMISOS_POR_CLAVE, ROLES_ASIGNABLES, ROLES_RETIRADOS,
  esRolRetirado, permisosEfectivos, modulosVisibles,
  permisoDeRuta, cumplePermisoDeRuta,
} from "../src/lib/permisos";

let ok = 0, fallos = 0;
function comprobar(t: string, c: boolean, d = "") {
  if (c) { ok++; console.log(`  ✓ ${t}`); }
  else { fallos++; console.log(`  ✗ ${t}${d ? ` — ${d}` : ""}`); }
}

async function main() {
  console.log("\n═══ 1. Los roles ═══\n");

  comprobar("los asignables son los cinco de hoy",
    ROLES_ASIGNABLES.join(",") === "SUPERADMIN,ADMIN,MARKETING,VENDEDOR,PRODUCCION",
    ROLES_ASIGNABLES.join(","));
  comprobar("bodega, usuario y solo lectura están retirados",
    ROLES_RETIRADOS.join(",") === "USUARIO,BODEGA,SOLO_LECTURA");
  comprobar("ningún retirado se puede asignar",
    !ROLES_ASIGNABLES.some(r => esRolRetirado(r)));
  comprobar("los retirados CONSERVAN sus permisos (hay gente con ellos puestos)",
    ROLES_RETIRADOS.every(r => (PERMISOS_POR_ROL[r] ?? []).length > 0));
  comprobar("todo rol asignable tiene permisos",
    ROLES_ASIGNABLES.every(r => (PERMISOS_POR_ROL[r] ?? []).length > 0));
  comprobar("ningún rol pide una clave que no exista",
    Object.values(PERMISOS_POR_ROL).every(l => l.every(c => PERMISOS_POR_CLAVE[c])));

  console.log("\n  — Marketing —\n");
  const mkt = new Set(PERMISOS_POR_ROL.MARKETING);
  for (const c of ["mkt.dashboard", "mkt.campanas", "mkt.atribucion", "mkt.retorno", "mkt.reportes", "crm.embudo", "crm.clientes", "nexus.interno"]) {
    comprobar(`marketing SÍ ve ${c}`, mkt.has(c));
  }
  for (const c of ["crm.cotizaciones", "crm.pedidos", "crm.pipeline", "erp.productos", "mkt.conexiones", "sistema.usuarios"]) {
    comprobar(`marketing NO ve ${c}`, !mkt.has(c));
  }

  console.log("\n  — Vendedor —\n");
  const vend = new Set(PERMISOS_POR_ROL.VENDEDOR);
  comprobar("NO ve el pipeline de producción", !vend.has("crm.pipeline_produccion"),
    "es configurable: se le puede activar a una persona");
  comprobar("SÍ ve el pipeline comercial", vend.has("crm.pipeline"));
  comprobar("SÍ tiene el chat del equipo", vend.has("nexus.interno"));
  comprobar("SÍ tiene el asistente de IA (venía usándolo)", vend.has("nexus.ia"));
  comprobar("NO ve postventa", !vend.has("crm.postventa"));
  comprobar("NO puede editar productos", !vend.has("erp.productos.editar"));

  console.log("\n  — Producción —\n");
  const prod = new Set(PERMISOS_POR_ROL.PRODUCCION);
  const erpVend = [...vend].filter(c => c.startsWith("erp."));
  const erpProd = [...prod].filter(c => c.startsWith("erp."));
  comprobar("en el ERP tiene exactamente lo mismo que el vendedor",
    erpVend.sort().join(",") === erpProd.sort().join(","),
    `vendedor=[${erpVend}] produccion=[${erpProd}]`);
  comprobar("SÍ ve el pipeline de producción", prod.has("crm.pipeline_produccion"));
  comprobar("NO ve el pipeline comercial", !prod.has("crm.pipeline"));
  comprobar("SÍ ve sus trabajos", prod.has("crm.trabajos"));
  comprobar("NO ve clientes", !prod.has("crm.clientes"));
  comprobar("NO ve cotizaciones", !prod.has("crm.cotizaciones"));
  comprobar("NO ve postventa", !prod.has("crm.postventa"));
  comprobar("en Nexus SOLO tiene el chat interno",
    prod.has("nexus.interno") && !prod.has("nexus.inbox"));
  comprobar("aun así el módulo Nexus le aparece en el menú",
    modulosVisibles(prod).includes("NEXUS"));

  console.log("\n  — La ruta del pipeline sirve para los dos —\n");
  const exigido = permisoDeRuta("/crm/pipeline");
  comprobar("la ruta pide uno de los dos permisos", exigido === "crm.pipeline|crm.pipeline_produccion", String(exigido));
  comprobar("un vendedor entra", cumplePermisoDeRuta(vend, exigido!));
  comprobar("producción entra", cumplePermisoDeRuta(prod, exigido!));
  comprobar("marketing NO entra", !cumplePermisoDeRuta(mkt, exigido!));
  comprobar("/nexus/interno pide el chat interno", permisoDeRuta("/nexus/interno") === "nexus.interno");

  console.log("\n  — El asistente de IA se puede apagar persona a persona —\n");
  comprobar("quitarle nexus.ia a un vendedor funciona",
    !permisosEfectivos("VENDEDOR", { "nexus.ia": false }).has("nexus.ia"));
  comprobar("y no le quita el inbox",
    permisosEfectivos("VENDEDOR", { "nexus.ia": false }).has("nexus.inbox"));
  comprobar("darle el pipeline de producción a un vendedor funciona",
    permisosEfectivos("VENDEDOR", { "crm.pipeline_produccion": true }).has("crm.pipeline_produccion"));

  console.log("\n═══ 2. Contra la base ═══\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
  console.log(`  (servidor: ${host})\n`);

  const marca = `VERIF-chat-${Date.now()}`;
  const creados: string[] = [];
  let chatId: string | null = null;

  try {
    const enums = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Rol'`,
    );
    const etiquetas = enums.map(e => e.enumlabel);
    comprobar("el enum Rol ya tiene MARKETING", etiquetas.includes("MARKETING"));
    comprobar("los retirados SIGUEN en el enum (borrarlos sería destructivo)",
      ROLES_RETIRADOS.every(r => etiquetas.includes(r)));

    const usuarios = await prisma.usuario.findMany({
      where: { activo: true },
      select: { nombre: true, rol: true },
    });
    const sinPermisos = usuarios.filter(u => permisosEfectivos(u.rol).size === 0 && u.rol !== "CLIENTE");
    comprobar("ningún usuario activo se quedó sin permisos",
      sinPermisos.length === 0,
      sinPermisos.map(u => `${u.nombre} (${u.rol})`).join(", "));

    const conRetirado = usuarios.filter(u => esRolRetirado(u.rol));
    if (conRetirado.length) {
      console.log(`\n  ⚠️ ${conRetirado.length} persona(s) siguen en un rol retirado:`);
      for (const u of conRetirado) console.log(`     ${u.nombre} — ${u.rol}`);
      console.log("     Siguen viendo lo mismo que antes. Gerencia decide a qué rol pasarlas (PENDIENTES §17).");
    }

    console.log("\n═══ 3. El chat interno ═══\n");

    const [a, b] = await Promise.all([
      prisma.usuario.create({
        data: { nombre: `${marca}-A`, email: `${marca}-a@verificacion.local`, password: "no-sirve", rol: "VENDEDOR", activo: false },
        select: { id: true },
      }),
      prisma.usuario.create({
        data: { nombre: `${marca}-B`, email: `${marca}-b@verificacion.local`, password: "no-sirve", rol: "PRODUCCION", activo: false },
        select: { id: true },
      }),
    ]);
    creados.push(a.id, b.id);
    comprobar("se crearon los dos usuarios de prueba", creados.length === 2);

    const chat = await prisma.chatInterno.create({
      data: { tipo: "DIRECTO", creadoPorId: a.id, miembros: { create: [{ usuarioId: a.id }, { usuarioId: b.id }] } },
      select: { id: true },
    });
    chatId = chat.id;
    comprobar("se creó el chat directo", Boolean(chatId));

    const m1 = await prisma.chatInternoMensaje.create({
      data: { chatId, autorId: a.id, contenido: "hola" },
      select: { id: true, createdAt: true },
    });
    await prisma.chatInterno.update({ where: { id: chatId }, data: { ultimoMensajeEn: m1.createdAt } });
    await prisma.chatInternoMiembro.update({
      where: { chatId_usuarioId: { chatId, usuarioId: a.id } },
      data: { ultimaLecturaEn: m1.createdAt },
    });

    const sinLeerB = await prisma.chatInternoMensaje.count({
      where: { chatId, autorId: { not: b.id } },
    });
    comprobar("para B hay 1 sin leer", sinLeerB === 1, String(sinLeerB));

    const sinLeerA = await prisma.chatInternoMensaje.count({
      where: {
        chatId, autorId: { not: a.id },
        createdAt: { gt: (await prisma.chatInternoMiembro.findUnique({
          where: { chatId_usuarioId: { chatId, usuarioId: a.id } }, select: { ultimaLecturaEn: true },
        }))!.ultimaLecturaEn! },
      },
    });
    comprobar("para A —que lo escribió— hay 0 sin leer", sinLeerA === 0, String(sinLeerA));

    // Lo incremental: `?desde=` no debe devolver el mensaje que ya se vio.
    const nuevos = await prisma.chatInternoMensaje.findMany({
      where: { chatId, createdAt: { gt: m1.createdAt } },
    });
    comprobar("pedir 'lo nuevo desde el último' devuelve vacío", nuevos.length === 0);

    const m2 = await prisma.chatInternoMensaje.create({
      data: { chatId, autorId: b.id, contenido: "qué tal" },
      select: { id: true, createdAt: true },
    });
    const nuevos2 = await prisma.chatInternoMensaje.findMany({ where: { chatId, createdAt: { gt: m1.createdAt } } });
    comprobar("y tras responder devuelve solo el mensaje nuevo",
      nuevos2.length === 1 && nuevos2[0].id === m2.id);

    // El candado: alguien que no es miembro.
    const intruso = await prisma.usuario.create({
      data: { nombre: `${marca}-C`, email: `${marca}-c@verificacion.local`, password: "no-sirve", rol: "VENDEDOR", activo: false },
      select: { id: true },
    });
    creados.push(intruso.id);
    const esMiembro = await prisma.chatInternoMiembro.findUnique({
      where: { chatId_usuarioId: { chatId, usuarioId: intruso.id } },
      select: { id: true },
    });
    comprobar("quien no está en el chat no figura como miembro", esMiembro === null);

    // Un chat directo no se duplica.
    const yaExiste = await prisma.chatInterno.findFirst({
      where: {
        tipo: "DIRECTO",
        AND: [{ miembros: { some: { usuarioId: a.id } } }, { miembros: { some: { usuarioId: b.id } } }],
      },
      select: { id: true },
    });
    comprobar("volver a abrir el chat entre los dos encuentra el mismo", yaExiste?.id === chatId);

    // Borrar el chat se lleva los mensajes (CASCADE).
    await prisma.chatInterno.delete({ where: { id: chatId } });
    const huerfanos = await prisma.chatInternoMensaje.count({ where: { chatId } });
    comprobar("borrar el chat se lleva sus mensajes", huerfanos === 0);
    chatId = null;
  } finally {
    if (chatId) await prisma.chatInterno.delete({ where: { id: chatId } }).catch(() => {});
    for (const id of creados) await prisma.usuario.delete({ where: { id } }).catch(() => {});
    console.log("\n  (limpieza: usuarios y chat de prueba borrados)");
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(52)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
