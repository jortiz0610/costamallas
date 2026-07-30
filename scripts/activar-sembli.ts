// ============================================================
// Activa Sembli: carga la API key de Claude en la tabla `configuracion`,
// cifrada con AES-256-GCM (igual que el resto de credenciales).
//
// Uso:
//   npx tsx scripts/activar-sembli.ts                      → busca accesoclaude.txt
//   npx tsx scripts/activar-sembli.ts ruta/al/archivo.txt  → ruta explícita
//
// El archivo puede ser la key sola, o tener formato `CLAVE=valor`
// (se toma la primera cadena que empiece por `sk-ant-`).
//
// ⚠️ Este script NUNCA imprime la key. Solo confirma longitud y prefijo.
// ⚠️ El archivo accesoclaude.txt NO debe quedar dentro del repo. Al
//    terminar, el script recuerda borrarlo.
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

/** Sitios donde buscamos el archivo si no se pasa ruta. */
const RUTAS_CANDIDATAS = [
  "accesoclaude.txt",
  "../accesoclaude.txt",
  "../../accesoclaude.txt", // …/Costamallas/accesoclaude.txt
  "../../../accesoclaude.txt",
];

function localizarArchivo(rutaDada?: string): string {
  if (rutaDada) {
    const r = resolve(rutaDada);
    if (!existsSync(r)) throw new Error(`No encontré el archivo: ${r}`);
    return r;
  }
  for (const candidata of RUTAS_CANDIDATAS) {
    const r = resolve(__dirname, "..", candidata);
    if (existsSync(r)) return r;
  }
  throw new Error(
    "No encontré accesoclaude.txt. Ponlo en la carpeta Costamallas/ o pasa la ruta:\n" +
      "  npx tsx scripts/activar-sembli.ts C:/ruta/accesoclaude.txt",
  );
}

function extraerClave(contenido: string): string {
  // Busca la primera cadena tipo sk-ant-… en cualquier parte del archivo.
  const encontrada = contenido.match(/sk-ant-[A-Za-z0-9_\-]{20,}/);
  if (!encontrada) {
    throw new Error(
      "El archivo no contiene una API key de Anthropic válida (debe empezar por 'sk-ant-').",
    );
  }
  return encontrada[0];
}

async function guardar(clave: string, valor: string, cifrar: boolean, descripcion: string) {
  const datos = {
    valor: cifrar ? encrypt(valor) : valor,
    encrypted: cifrar,
    descripcion,
  };
  await prisma.configuracion.upsert({
    where: { clave },
    update: datos,
    create: { clave, ...datos },
  });
}

async function main() {
  const ruta = localizarArchivo(process.argv[2]);
  const clave = extraerClave(readFileSync(ruta, "utf8"));

  if (!process.env.ENCRYPTION_KEY) {
    throw new Error(
      "Falta ENCRYPTION_KEY en el entorno. Sin ella no puedo cifrar la credencial.\n" +
        "Debe ser la MISMA que tiene Vercel, o el portal no podrá descifrarla.",
    );
  }

  await guardar("ai_provider", "anthropic", false, "Proveedor de IA del agente Sembli");
  await guardar("ai_api_key", clave, true, "API key de Anthropic (Claude) — cifrada");
  await guardar(
    "ai_model",
    "claude-haiku-4-5",
    false,
    "Modelo del chat de Sembli. Las tareas pesadas (SEO, ficha PDF) usan Sonnet 5 automáticamente.",
  );

  console.log("✅ Sembli activado.");
  console.log(`   Archivo leído : ${ruta}`);
  console.log(`   Key detectada : ${clave.slice(0, 10)}…  (${clave.length} caracteres)`);
  console.log("   Guardada en   : configuracion.ai_api_key (cifrada AES-256-GCM)");
  console.log("   Modelo chat   : claude-haiku-4-5   (económico, alto volumen)");
  console.log("   Modelo pesado : claude-sonnet-5    (SEO y lectura de fichas PDF)");
  console.log("");
  console.log("⚠️  Borra ahora el archivo accesoclaude.txt: la credencial ya quedó en la base de datos.");
}

main()
  .catch((e) => {
    console.error(`❌ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
