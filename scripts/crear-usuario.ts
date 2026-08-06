// ============================================================
// Alta de un usuario del portal desde la línea de comandos.
//
//   npx tsx scripts/crear-usuario.ts "Nombre Apellido" correo@x.com VENDEDOR "3001234567"
//
// La contraseña NO se pide ni se elige aquí: se genera una aleatoria y se
// imprime UNA sola vez en pantalla. No queda en el historial de comandos,
// ni en el repositorio, ni en un chat. Quien la reciba debe cambiarla al
// entrar.
//
// Alternativa recomendada si hay sesión a mano: crearlos desde el portal
// (Usuarios → Nuevo), que hace exactamente esto mismo. Este script existe
// para cuando hay que dar de alta a varias personas de una vez o no se
// quiere entrar al portal.
//
// Es idempotente por correo: si el usuario ya existe NO lo pisa ni le
// cambia la contraseña — avisa y sale. Volver a correrlo por error no
// puede dejar a nadie fuera de su cuenta.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

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

const ROLES = [
  "SUPERADMIN", "ADMIN", "USUARIO", "VENDEDOR",
  "PRODUCCION", "BODEGA", "SOLO_LECTURA",
] as const;

/**
 * Contraseña temporal legible pero no adivinable: 18 caracteres en
 * base64url. Se descartan los que se confunden al dictarla por teléfono.
 */
function contrasenaTemporal(): string {
  const crudo = randomBytes(24).toString("base64url").replace(/[Il1O0]/g, "");
  return crudo.slice(0, 18);
}

async function main() {
  const [nombre, email, rol = "VENDEDOR", telefono] = process.argv.slice(2);

  if (!nombre || !email) {
    console.error(
      'Uso: npx tsx scripts/crear-usuario.ts "Nombre Apellido" correo@x.com [ROL] [telefono]\n' +
      `Roles: ${ROLES.join(", ")}`,
    );
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`"${email}" no parece un correo válido.`);
    process.exit(1);
  }
  if (!ROLES.includes(rol as (typeof ROLES)[number])) {
    console.error(`Rol desconocido: "${rol}". Los válidos son: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");
  const bcrypt = (await import("bcryptjs")).default;

  const existe = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nombre: true, rol: true, activo: true },
  });
  if (existe) {
    console.log(
      `Ya existe un usuario con ese correo: ${existe.nombre} (${existe.rol}, ` +
      `${existe.activo ? "activo" : "inactivo"}).\n` +
      "No se toca nada. Si hay que cambiarle el rol o el teléfono, se hace desde Usuarios en el portal.",
    );
    await prisma.$disconnect();
    return;
  }

  const password = contrasenaTemporal();
  const creado = await prisma.usuario.create({
    data: {
      nombre,
      email,
      password: await bcrypt.hash(password, 12),
      rol: rol as never,
      activo: true,
      telefono: telefono || null,
    },
    select: { id: true, nombre: true, email: true, rol: true, telefono: true },
  });

  console.log(`\nCreado: ${creado.nombre} · ${creado.email} · ${creado.rol}`);
  console.log(`Teléfono: ${creado.telefono ?? "SIN CARGAR"}`);
  console.log(`\n  Contraseña temporal:  ${password}`);
  console.log("\nEntrégasela por un medio directo y que la cambie al entrar.");
  console.log("No vuelve a mostrarse: aquí solo queda el hash.");

  if (!creado.telefono) {
    console.log(
      "\n⚠️  Sin teléfono, el botón de WhatsApp de sus cotizaciones apunta al número\n" +
      "    general y se pierde el hilo con quien venía atendiendo al cliente.\n" +
      "    Se carga desde Usuarios en el portal.",
    );
  }
  if (rol === "VENDEDOR") {
    console.log(
      "\nOjo: al existir un VENDEDOR, Nexus empieza a repartirle conversaciones\n" +
      "por turno desde el primer mensaje que entre.",
    );
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
