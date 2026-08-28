// ============================================================
// Comprueba "ver el portal como…", empezando por lo peligroso.
//
//   npx tsx scripts/probar-rol-prueba.ts
//
// Esta función pone un rol encima del real leyendo una COOKIE. Si esa
// cookie se respetara sin mirar quién la manda, cualquiera con las
// herramientas del navegador abiertas se ascendería a ADMIN escribiendo
// una línea. Así que lo primero que se prueba aquí no es que funcione:
// es que NO funcione para quien no debe.
//
// Lo segundo es que de verdad no se guarde nada. Eso lo impone el
// middleware rechazando todo lo que no sea GET, y aquí se comprueba la
// tabla de decisiones — incluidas las rutas de escape, sin las cuales
// quien entra al modo prueba se quedaría atrapado dentro.
//
// Lógica pura: no toca la base ni la red. Firma tokens con el
// JWT_SECRET local, que para esto da igual cuál sea.
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

async function main() {
  const { NextRequest } = await import("next/server");
  const { signAccessToken, getUserFromRequest } = await import("../src/lib/auth");
  const {
    COOKIE_ROL_PRUEBA, esRolProbable, esLectura, esEscape, ROLES_PROBABLES,
  } = await import("../src/lib/rol-prueba");

  /** Una petición con su sesión y, si se pide, la cookie de rol de prueba. */
  const pedir = async (rolReal: string, cookieRol?: string, metodo = "GET") => {
    const token = await signAccessToken({
      sub: "u1", email: "x@y.z", nombre: "Prueba", rol: rolReal as never,
    });
    const cookies = [`cm_token=${token}`];
    if (cookieRol !== undefined) cookies.push(`${COOKIE_ROL_PRUEBA}=${cookieRol}`);
    return new NextRequest("https://portal.costamallas.com/productos", {
      method: metodo,
      headers: { cookie: cookies.join("; ") },
    });
  };

  // ── 1. Lo peligroso ──────────────────────────────────────
  console.log("\n1. LA COOKIE NO PUEDE ASCENDER A NADIE\n");

  for (const rol of ["VENDEDOR", "ADMIN", "BODEGA", "SOLO_LECTURA", "USUARIO"]) {
    const u = await getUserFromRequest(await pedir(rol, "ADMIN"));
    comprobar(
      `un ${rol.padEnd(12)} con la cookie puesta en ADMIN sigue siendo ${rol}`,
      u?.rol === rol && !u?.rolPrueba,
      `quedó como ${u?.rol}`,
    );
  }
  {
    const u = await getUserFromRequest(await pedir("ADMIN", "SUPERADMIN"));
    comprobar(
      "un ADMIN no se puede hacer SUPERADMIN con la cookie",
      u?.rol === "ADMIN",
      `quedó como ${u?.rol}`,
    );
  }

  // ── 2. Para el superadministrador sí ─────────────────────
  console.log("\n2. EL SUPERADMINISTRADOR SÍ SE CAMBIA EL ROL\n");
  {
    const u = await getUserFromRequest(await pedir("SUPERADMIN", "VENDEDOR"));
    comprobar("ve el portal como VENDEDOR", u?.rol === "VENDEDOR", `rol=${u?.rol}`);
    comprobar("queda marcado como prueba", u?.rolPrueba === true);
    comprobar("se conserva quién es de verdad", u?.rolReal === "SUPERADMIN");
    comprobar("sigue siendo el mismo usuario", u?.sub === "u1");
  }
  {
    const u = await getUserFromRequest(await pedir("SUPERADMIN"));
    comprobar("sin cookie, sigue siendo SUPERADMIN", u?.rol === "SUPERADMIN" && !u?.rolPrueba);
  }
  {
    const u = await getUserFromRequest(await pedir("SUPERADMIN", "SUPERADMIN"));
    comprobar(
      "probarse SUPERADMIN se ignora",
      u?.rol === "SUPERADMIN" && !u?.rolPrueba,
      "no enseña nada y dejaría el portal en solo lectura sin motivo",
    );
  }
  {
    const u = await getUserFromRequest(await pedir("SUPERADMIN", "DIOS"));
    comprobar("un rol inventado se ignora", u?.rol === "SUPERADMIN" && !u?.rolPrueba);
  }
  {
    const u = await getUserFromRequest(await pedir("SUPERADMIN", ""));
    comprobar("una cookie vacía se ignora", u?.rol === "SUPERADMIN" && !u?.rolPrueba);
  }

  // ── 3. Qué roles se ofrecen ──────────────────────────────
  console.log("\n3. LOS ROLES QUE SE OFRECEN\n");
  comprobar("hay roles para probar", ROLES_PROBABLES.length >= 6, `${ROLES_PROBABLES.length}`);
  comprobar(
    "SUPERADMIN no está en la lista",
    !ROLES_PROBABLES.some(r => r.rol === "SUPERADMIN"),
  );
  comprobar("todos los ofrecidos son válidos", ROLES_PROBABLES.every(r => esRolProbable(r.rol)));
  comprobar("cada uno explica qué ve", ROLES_PROBABLES.every(r => r.descripcion.length > 15));

  // ── 4. Que NO se guarde nada ─────────────────────────────
  console.log("\n4. NADA SE GUARDA EN MODO PRUEBA\n");

  /** La decisión que toma el middleware. */
  const bloquea = (rolPrueba: boolean, metodo: string, ruta: string) =>
    rolPrueba && !esLectura(metodo) && !esEscape(ruta);

  const casos: [string, string, boolean, string][] = [
    ["GET", "/api/productos", false, "navegar es leer"],
    ["HEAD", "/api/productos", false, ""],
    ["OPTIONS", "/api/productos", false, ""],
    ["POST", "/api/crm/cotizaciones", true, "crear una cotización"],
    ["PUT", "/api/crm/cotizaciones/x", true, "editarla"],
    ["PATCH", "/api/notificaciones", true, "marcar leídas"],
    ["DELETE", "/api/productos/x", true, "borrar"],
    ["POST", "/api/ai/seo/lote", true, "y gastar plata, menos todavía"],
    ["POST", "/api/configuracion/empresa", true, ""],
  ];
  for (const [metodo, ruta, esperado, nota] of casos) {
    comprobar(
      `${metodo.padEnd(7)} ${ruta.padEnd(28)} ${esperado ? "BLOQUEADO" : "pasa"}`,
      bloquea(true, metodo, ruta) === esperado,
      nota,
    );
  }

  console.log("");
  comprobar(
    "sin modo prueba, todo sigue funcionando igual",
    casos.every(([metodo, ruta]) => bloquea(false, metodo, ruta) === false),
    "esta función no puede cambiarle nada a quien no la usa",
  );

  // ── 5. Poder salir ───────────────────────────────────────
  console.log("\n5. SE PUEDE SALIR DEL MODO PRUEBA\n");
  for (const ruta of ["/api/auth/rol-prueba", "/api/auth/logout", "/api/auth/refresh"]) {
    comprobar(
      `${ruta.padEnd(24)} sigue aceptando POST`,
      !bloquea(true, "POST", ruta),
      "sin esto, quien entra se queda atrapado dentro",
    );
  }
  comprobar(
    "pero /api/auth/me-cualquier-cosa NO es un escape gratis",
    bloquea(true, "POST", "/api/auth/usuarios"),
    "el escape es por ruta exacta, no por prefijo /api/auth",
  );

  console.log(fallos === 0 ? "\n✅ Todas las comprobaciones pasaron.\n" : `\n❌ ${fallos} fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
