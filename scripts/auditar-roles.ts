// ============================================================
// Auditoría de roles, rutas y permisos.
//
//   npx tsx scripts/auditar-roles.ts
//
// No comprueba nada: DESCRIBE. Responde tres preguntas que a ojo se
// contestan mal:
//
//   1. ¿Qué ve exactamente cada rol, pantalla por pantalla?
//   2. ¿Hay pantallas que NADIE puede abrir, o que puede abrir
//      cualquiera porque se olvidó protegerlas?
//   3. ¿Hay permisos en el catálogo que no llevan a ninguna parte?
//
// Es de solo lectura. No toca la base ni escribe archivos.
// ============================================================

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  PERMISOS, PERMISOS_POR_ROL, PERMISOS_POR_CLAVE,
  ROLES_ASIGNABLES, ROLES_RETIRADOS,
  RUTAS_PROTEGIDAS, permisoDeRuta, permisosEfectivos, modulosVisibles,
} from "../src/lib/permisos";

const RAIZ = "src/app/(dashboard)";

/** Todas las páginas del portal, como ruta navegable. */
function paginas(dir = RAIZ, prefijo = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      // Los grupos entre paréntesis no aparecen en la URL.
      const seg = e.startsWith("(") ? "" : `/${e}`;
      out.push(...paginas(p, prefijo + seg));
    } else if (e === "page.tsx") {
      out.push(prefijo || "/");
    }
  }
  return out;
}

/** Una ruta con [id] se navega con un valor cualquiera. */
const concreta = (r: string) => r.replace(/\[[^\]]+\]/g, "xxxx");

function titulo(t: string) {
  console.log(`\n${"═".repeat(64)}\n${t}\n${"═".repeat(64)}`);
}

async function main() {
  const rutas = paginas().sort();

  titulo("1 · QUÉ VE CADA ROL");

  for (const rol of [...ROLES_ASIGNABLES]) {
    const efectivos = permisosEfectivos(rol);
    const mods = modulosVisibles(efectivos);
    const vistas = PERMISOS.filter(p => p.tipo === "vista" && efectivos.has(p.clave));
    const acciones = PERMISOS.filter(p => p.tipo === "accion" && efectivos.has(p.clave));

    console.log(`\n── ${rol} ──`);
    console.log(`   módulos: ${mods.join(" · ") || "NINGUNO"}`);
    console.log(`   ${vistas.length} pantallas · ${acciones.length} acciones`);
    for (const m of mods) {
      const suyas = vistas.filter(v => v.modulo === m).map(v => v.label);
      console.log(`     ${m.padEnd(10)} ${suyas.join(", ")}`);
    }
    if (acciones.length) {
      console.log(`     acciones   ${acciones.map(a => a.label).join(", ")}`);
    }

    // Lo que puede ABRIR de verdad, contando las rutas sin proteger.
    const abre = rutas.filter(r => {
      const clave = permisoDeRuta(concreta(r));
      if (!clave) return true; // sin permiso declarado = la ve cualquiera
      return clave.split("|").some(k => efectivos.has(k.trim()));
    });
    console.log(`   puede abrir ${abre.length} de ${rutas.length} páginas`);
  }

  titulo("2 · PÁGINAS SIN PERMISO DECLARADO (las abre cualquiera)");

  const sinProteger = rutas.filter(r => !permisoDeRuta(concreta(r)));
  if (!sinProteger.length) console.log("\n  (ninguna: todas las páginas exigen algo)");
  for (const r of sinProteger) console.log(`  ⚠️  ${r}`);

  titulo("3 · PÁGINAS QUE NADIE PUEDE ABRIR (salvo el superadmin)");

  const nadie = rutas.filter(r => {
    const clave = permisoDeRuta(concreta(r));
    if (!clave) return false;
    return !ROLES_ASIGNABLES.filter(x => x !== "SUPERADMIN").some(rol => {
      const ef = permisosEfectivos(rol);
      return clave.split("|").some(k => ef.has(k.trim()));
    });
  });
  if (!nadie.length) console.log("\n  (ninguna)");
  for (const r of nadie) console.log(`  ⚠️  ${r}  →  ${permisoDeRuta(concreta(r))}`);

  titulo("4 · PERMISOS DEL CATÁLOGO QUE NO LLEVAN A NINGUNA PANTALLA");

  const clavesUsadas = new Set(
    Object.values(RUTAS_PROTEGIDAS).flatMap(v => v.split("|").map(s => s.trim())),
  );
  const huerfanos = PERMISOS.filter(p => p.tipo === "vista" && !clavesUsadas.has(p.clave));
  if (!huerfanos.length) console.log("\n  (ninguno)");
  for (const p of huerfanos) console.log(`  ⚠️  ${p.clave}  (${p.label})`);

  titulo("5 · PANTALLAS QUE SOLO VE UN ROL");

  for (const r of rutas) {
    const clave = permisoDeRuta(concreta(r));
    if (!clave) continue;
    const quienes = ROLES_ASIGNABLES.filter(rol => {
      const ef = permisosEfectivos(rol);
      return clave.split("|").some(k => ef.has(k.trim()));
    });
    if (quienes.length === 1) console.log(`  ${r.padEnd(34)} solo ${quienes[0]}`);
  }

  titulo("6 · LOS ROLES RETIRADOS, ¿LOS USA ALGUIEN?");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const rol of ROLES_RETIRADOS) {
      const usuarios = await prisma.usuario.findMany({
        where: { rol: rol as never },
        select: { nombre: true, email: true, activo: true, ultimoAcceso: true },
      });
      if (!usuarios.length) { console.log(`  ${rol}: nadie ✅`); continue; }
      console.log(`  ${rol}: ${usuarios.length} persona(s)`);
      for (const u of usuarios) {
        const ult = u.ultimoAcceso ? u.ultimoAcceso.toISOString().slice(0, 10) : "NUNCA entró";
        console.log(`     · ${u.nombre} <${u.email}> activo=${u.activo} · último acceso ${ult}`);
      }
    }

    titulo("7 · EL EQUIPO, HOY");

    const equipo = await prisma.usuario.findMany({
      where: { activo: true },
      select: { nombre: true, email: true, rol: true, ultimoAcceso: true, telefono: true },
      orderBy: { rol: "asc" },
    });
    for (const u of equipo) {
      const ult = u.ultimoAcceso ? u.ultimoAcceso.toISOString().slice(0, 10) : "NUNCA";
      const tel = u.telefono ? "" : "  ⚠️ sin teléfono (no sale en la cotización)";
      console.log(`  ${u.rol.padEnd(12)} ${u.nombre.padEnd(24)} último acceso ${ult}${tel}`);
    }

    const permisosSueltos = await prisma.permisoUsuario.findMany({
      select: { clave: true, permitido: true, nota: true, usuario: { select: { nombre: true } } },
    });
    console.log(`\n  Permisos ajustados a mano: ${permisosSueltos.length}`);
    for (const p of permisosSueltos) {
      console.log(`     ${p.usuario.nombre}: ${p.permitido ? "+" : "−"}${p.clave}${p.nota ? ` (${p.nota})` : ""}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n");
}

main().catch(e => { console.error(e); process.exit(1); });
