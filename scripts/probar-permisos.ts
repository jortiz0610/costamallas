// ============================================================
// Comprueba el sistema de permisos por submódulo y por usuario.
//
//   npx tsx scripts/probar-permisos.ts
//
// Dos partes:
//   1. Lógica pura (sin base de datos): el juego por defecto de cada rol
//      y el efecto de las excepciones. Es lo que decide qué ve cada uno.
//   2. Contra la base de PRODUCCIÓN: crea excepciones con el prefijo
//      VERIF- sobre un usuario de prueba que crea y borra él mismo.
//      Limpia al terminar aunque algo falle.
//
// Lo que se busca destapar: que la tabla y el cálculo digan lo mismo, y
// que quitar un permiso a una persona no le quite nada a su rol.
// ============================================================

import { readFileSync, existsSync } from "node:fs";

for (const archivo of [".env.local", ".env"]) {
  if (!existsSync(archivo)) continue;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)\s*$/);
    if (!m) continue;
    if (process.env[`__${m[1]}_FIJADA`]) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    process.env[`__${m[1]}_FIJADA`] = "1";
  }
}

import {
  PERMISOS,
  PERMISOS_POR_CLAVE,
  PERMISOS_POR_ROL,
  TODAS_LAS_CLAVES,
  permisosEfectivos,
  modulosVisibles,
  puedeVerModulo,
  permisoDeRuta,
  RUTAS_PROTEGIDAS,
} from "../src/lib/permisos";

let ok = 0;
let fallos = 0;

function comprobar(titulo: string, condicion: boolean, detalle = "") {
  if (condicion) {
    ok++;
    console.log(`  ✓ ${titulo}`);
  } else {
    fallos++;
    console.log(`  ✗ ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  }
}

async function main() {
  console.log("\n═══ 1. El catálogo ═══\n");

  const claves = PERMISOS.map(p => p.clave);
  comprobar("no hay claves repetidas", new Set(claves).size === claves.length);
  comprobar("todas las claves llevan módulo, etiqueta y ayuda",
    PERMISOS.every(p => p.modulo && p.label && p.ayuda));
  comprobar("el índice por clave cubre el catálogo completo",
    claves.every(c => PERMISOS_POR_CLAVE[c]?.clave === c));
  comprobar("cada clave empieza por el prefijo de su módulo",
    PERMISOS.every(p => {
      const pre = { ERP: "erp.", CRM: "crm.", NEXUS: "nexus.", MARKETING: "mkt.", SISTEMA: "sistema." }[p.modulo];
      return p.clave.startsWith(pre);
    }));

  console.log("\n═══ 2. El juego por defecto de cada rol ═══\n");

  comprobar("todos los roles existen en PERMISOS_POR_ROL",
    ["SUPERADMIN", "ADMIN", "USUARIO", "VENDEDOR", "PRODUCCION", "BODEGA", "SOLO_LECTURA", "CLIENTE"]
      .every(r => Array.isArray(PERMISOS_POR_ROL[r])));
  comprobar("ningún rol trae una clave que no exista",
    Object.values(PERMISOS_POR_ROL).every(l => l.every(c => PERMISOS_POR_CLAVE[c])));
  comprobar("el superadmin lo tiene todo",
    PERMISOS_POR_ROL.SUPERADMIN.length === TODAS_LAS_CLAVES.length);
  comprobar("el cliente no tiene nada", PERMISOS_POR_ROL.CLIENTE.length === 0);

  const vend = new Set(PERMISOS_POR_ROL.VENDEDOR);
  console.log("\n  — Lo que debe ver el vendedor —");
  for (const c of ["erp.dashboard", "erp.productos", "erp.imagenes", "erp.stock",
                   "crm.resumen", "crm.clientes", "crm.cotizaciones", "crm.pedidos",
                   "crm.pipeline", "crm.instalaciones", "nexus.inbox"]) {
    comprobar(`vendedor SÍ ve ${c}`, vend.has(c));
  }
  console.log("\n  — Lo que NO debe ver —");
  for (const c of ["erp.catalogos", "erp.compras", "erp.facturacion", "erp.cartera",
                   "erp.woocommerce", "erp.errores", "erp.seo",
                   "erp.productos.editar", "erp.productos.ia",
                   "crm.embudo", "crm.postventa",
                   "nexus.plantillas", "nexus.flujos", "nexus.tiempos", "nexus.conexiones",
                   "mkt.dashboard", "mkt.campanas", "mkt.atribucion", "mkt.retorno",
                   "mkt.reportes", "mkt.conexiones",
                   "sistema.usuarios", "sistema.reportes", "sistema.seguridad", "sistema.configuracion"]) {
    comprobar(`vendedor NO ve ${c}`, !vend.has(c));
  }

  console.log("\n  — Módulos que le quedan al vendedor —");
  const modsVendedor = modulosVisibles(PERMISOS_POR_ROL.VENDEDOR);
  comprobar("ve ERP, CRM y NEXUS y nada más",
    modsVendedor.join(",") === "ERP,CRM,NEXUS", modsVendedor.join(","));
  comprobar("puedeVerModulo(VENDEDOR, 'ERP') es true (antes era false)",
    puedeVerModulo("VENDEDOR", "ERP"));
  comprobar("puedeVerModulo(VENDEDOR, 'MARKETING') sigue siendo false",
    !puedeVerModulo("VENDEDOR", "MARKETING"));
  comprobar("puedeVerModulo(VENDEDOR, 'SISTEMA') es false",
    !puedeVerModulo("VENDEDOR", "SISTEMA"));

  console.log("\n  — El administrador —");
  const adm = new Set(PERMISOS_POR_ROL.ADMIN);
  comprobar("el admin NO tiene las conexiones externas ni el SEO con IA",
    !adm.has("nexus.conexiones") && !adm.has("mkt.conexiones") && !adm.has("erp.seo"));
  comprobar("el admin tampoco tiene el ensayo general",
    !adm.has("sistema.ensayo"),
    "crea datos y manda correos de verdad: es del superadministrador");
  comprobar("el admin sí tiene el resto", adm.size === TODAS_LAS_CLAVES.length - 4);

  console.log("\n  — Solo lectura —");
  const sl = new Set(PERMISOS_POR_ROL.SOLO_LECTURA);
  comprobar("no tiene ninguna ACCIÓN",
    PERMISOS.filter(p => p.tipo === "accion").every(p => !sl.has(p.clave)));
  comprobar("no entra a Sistema", !modulosVisibles(PERMISOS_POR_ROL.SOLO_LECTURA).includes("SISTEMA"));

  console.log("\n═══ 3. Las excepciones por persona ═══\n");

  const base = permisosEfectivos("VENDEDOR");
  comprobar("sin excepciones, el resultado es el juego del rol",
    base.size === PERMISOS_POR_ROL.VENDEDOR.length);

  const conExtra = permisosEfectivos("VENDEDOR", { "erp.productos.editar": true });
  comprobar("conceder añade el permiso", conExtra.has("erp.productos.editar"));
  comprobar("conceder no toca nada más", conExtra.size === base.size + 1);
  comprobar("conceder a UNA persona no cambia el rol",
    !new Set(PERMISOS_POR_ROL.VENDEDOR).has("erp.productos.editar"));

  const conMenos = permisosEfectivos("VENDEDOR", { "crm.pedidos": false });
  comprobar("retirar quita el permiso", !conMenos.has("crm.pedidos"));
  comprobar("retirar no toca nada más", conMenos.size === base.size - 1);

  comprobar("una clave que ya no existe se ignora",
    permisosEfectivos("VENDEDOR", { "erp.inventado": true }).size === base.size);

  comprobar("al superadmin no se le puede quitar nada",
    permisosEfectivos("SUPERADMIN", { "sistema.usuarios": false }).has("sistema.usuarios"));

  const sinNada = permisosEfectivos("VENDEDOR",
    Object.fromEntries(PERMISOS_POR_ROL.VENDEDOR.map(c => [c, false])));
  comprobar("se le puede dejar sin nada", sinNada.size === 0);
  comprobar("sin nada, no ve ningún módulo", modulosVisibles(sinNada).length === 0);

  console.log("\n═══ 4. Las rutas ═══\n");

  // Una ruta puede admitir VARIOS permisos separados por "|" (basta con
  // tener uno): es el caso del pipeline, que es una pantalla con dos
  // pestañas. Hay que comprobar cada parte, no la cadena entera.
  comprobar("toda ruta protegida apunta a claves que existen",
    Object.values(RUTAS_PROTEGIDAS).every(c => c.split("|").every(k => PERMISOS_POR_CLAVE[k.trim()])));
  comprobar("gana la coincidencia más larga: /facturacion/cartera → cartera",
    permisoDeRuta("/facturacion/cartera") === "erp.cartera");
  comprobar("/facturacion → facturación", permisoDeRuta("/facturacion") === "erp.facturacion");
  comprobar("/facturacion/nueva → facturación", permisoDeRuta("/facturacion/nueva") === "erp.facturacion");
  comprobar("/productos/seo → seo", permisoDeRuta("/productos/seo") === "erp.seo");
  comprobar("/productos/abc123 → productos", permisoDeRuta("/productos/abc123") === "erp.productos");
  comprobar("'/' solo empareja consigo misma", permisoDeRuta("/") === "erp.dashboard");
  comprobar("una ruta desconocida no exige permiso", permisoDeRuta("/algo-que-no-existe") === null);

  console.log("\n  — Lo que el vendedor NO puede abrir escribiendo la URL —");
  for (const ruta of ["/crm/embudo", "/postventa", "/nexus/plantillas", "/nexus/flujos",
                      "/nexus/tiempos", "/categorias", "/compras", "/facturacion",
                      "/facturacion/cartera", "/woocommerce", "/marketing", "/usuarios",
                      "/configuracion", "/productos/seo"]) {
    const clave = permisoDeRuta(ruta);
    comprobar(`${ruta} le queda cerrado`, Boolean(clave) && !vend.has(clave!), `clave=${clave}`);
  }

  console.log("\n═══ 5. Contra la base de datos ═══\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const marca = `VERIF-permisos-${Date.now()}`;
  let usuarioId: string | null = null;

  try {
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    console.log(`  (servidor: ${host})\n`);

    const creado = await prisma.usuario.create({
      data: {
        nombre: marca,
        email: `${marca}@verificacion.local`,
        password: "no-sirve-para-entrar",
        rol: "VENDEDOR",
        activo: false, // que no pueda iniciar sesión ni por accidente
      },
      select: { id: true, rol: true },
    });
    usuarioId = creado.id;
    comprobar("se pudo crear el usuario de prueba", Boolean(usuarioId));

    const leer = async () => {
      const filas = await prisma.permisoUsuario.findMany({
        where: { usuarioId: usuarioId! },
        select: { clave: true, permitido: true },
      });
      return Object.fromEntries(filas.map(f => [f.clave, f.permitido]));
    };

    comprobar("nace sin excepciones", Object.keys(await leer()).length === 0);

    await prisma.permisoUsuario.create({
      data: { usuarioId, clave: "erp.productos.editar", permitido: true, nota: marca },
    });
    let exc = await leer();
    comprobar("la excepción se guarda", exc["erp.productos.editar"] === true);
    comprobar("y se refleja en el cálculo",
      permisosEfectivos("VENDEDOR", exc).has("erp.productos.editar"));

    await prisma.permisoUsuario.create({
      data: { usuarioId, clave: "crm.cotizaciones", permitido: false, nota: marca },
    });
    exc = await leer();
    comprobar("se puede retirar algo que el rol sí trae",
      !permisosEfectivos("VENDEDOR", exc).has("crm.cotizaciones"));

    let choco = false;
    try {
      await prisma.permisoUsuario.create({
        data: { usuarioId, clave: "erp.productos.editar", permitido: false },
      });
    } catch {
      choco = true;
    }
    comprobar("no se puede guardar dos veces el mismo permiso (único por usuario+clave)", choco);

    // Y lo importante: nada de esto cambió lo que ve el resto.
    comprobar("el rol VENDEDOR sigue igual para todos los demás",
      !permisosEfectivos("VENDEDOR").has("erp.productos.editar") &&
      permisosEfectivos("VENDEDOR").has("crm.cotizaciones"));

    // Borrar el usuario debe llevarse sus permisos (ON DELETE CASCADE).
    await prisma.usuario.delete({ where: { id: usuarioId } });
    const huerfanos = await prisma.permisoUsuario.count({ where: { usuarioId } });
    comprobar("borrar el usuario se lleva sus permisos", huerfanos === 0);
    usuarioId = null;
  } finally {
    // Limpieza, pase lo que pase.
    if (usuarioId) {
      await prisma.permisoUsuario.deleteMany({ where: { usuarioId } }).catch(() => {});
      await prisma.usuario.delete({ where: { id: usuarioId } }).catch(() => {});
      console.log("\n  (limpieza: usuario de prueba borrado)");
    }
    await prisma.$disconnect();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`${ok} comprobaciones OK, ${fallos} fallos`);
  process.exit(fallos > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
