// ============================================================
// Genera el juego de iconos de la PWA a partir del logo de Costamallas.
//
//   npx tsx scripts/generar-iconos-pwa.ts
//
// Se corre una sola vez (o cuando cambie el logo). Los PNG resultantes
// se versionan en public/icons/ — no se generan en cada build.
//
// Usa `sharp`, que ya viene con Next.js.
// ============================================================

import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

// Amarillo corporativo de Costamallas, muestreado del logo oficial.
const AMARILLO = "#f9df1e";
const SALIDA = resolve(__dirname, "../public/icons");

/**
 * El logo oficial es horizontal (1000×200) e incluye el texto
 * "costamallas" y el eslogan. A 192 px ese texto se vuelve ilegible, así
 * que el icono usa solo el monograma **CM** del extremo izquierdo,
 * recortado y centrado sobre el amarillo de marca.
 *
 * Medido sobre Logo-Costamallas-Horizontal_nuevi.png (1000×200): el
 * glifo CM ocupa x=74..383 y la palabra "costamallas" empieza en x=403.
 * Si cambia el logo hay que volver a medir estos valores.
 */
const RECORTE_MONOGRAMA = { left: 68, top: 0, width: 322, height: 200 };

/** Candidatos de logo, en orden de preferencia. */
const LOGOS = [
  "../../../logos/Logo-Costamallas-Horizontal_nuevi.png",
  "../../../logos/Logo-Costamallas-Horizontal.png",
  "../../../logos/CM - full Color.png",
];

function rutaLogo(): string {
  for (const l of LOGOS) {
    const r = resolve(__dirname, l);
    if (existsSync(r)) return r;
  }
  throw new Error("No encontré el logo de Costamallas en la carpeta logos/.");
}

/**
 * Recorta el monograma CM del logo y le quita el margen sobrante.
 *
 * Ojo: `extract` y `trim` NO pueden ir en la misma cadena de sharp —
 * internamente trim corre primero, encoge la imagen y luego extract
 * falla con "bad extract area". Hay que pasar por un buffer intermedio.
 */
async function monograma(logo: string): Promise<Buffer> {
  const recortado = await sharp(logo).extract(RECORTE_MONOGRAMA).png().toBuffer();
  // `trim` deja el glifo pegado al borde para poder centrarlo con precisión.
  return sharp(recortado).trim({ threshold: 20 }).png().toBuffer();
}

/**
 * Un icono cuadrado: amarillo de marca + monograma centrado.
 * `ocupacion` es la fracción del lado que ocupa el glifo. Los iconos
 * "maskable" llevan más aire porque Android los recorta a un círculo.
 */
async function icono(marca: Buffer, lado: number, ocupacion: number, destino: string) {
  const glifo = await sharp(marca)
    .resize({
      width: Math.round(lado * ocupacion),
      height: Math.round(lado * ocupacion),
      fit: "inside",
    })
    .png()
    .toBuffer();

  await sharp({ create: { width: lado, height: lado, channels: 4, background: AMARILLO } })
    .composite([{ input: glifo, gravity: "center" }])
    .png()
    .toFile(resolve(SALIDA, destino));

  console.log(`  ✓ ${destino}  (${lado}×${lado})`);
}

async function main() {
  const logo = rutaLogo();
  mkdirSync(SALIDA, { recursive: true });
  console.log(`Logo fuente: ${logo}\n`);

  const marca = await monograma(logo);

  // Iconos normales (el sistema los muestra completos).
  await icono(marca, 192, 0.66, "icon-192.png");
  await icono(marca, 512, 0.66, "icon-512.png");

  // Maskable: el contenido va en el 52% central para que el recorte
  // circular de Android no muerda el glifo.
  await icono(marca, 192, 0.52, "icon-192-maskable.png");
  await icono(marca, 512, 0.52, "icon-512-maskable.png");

  // iOS aplica su propia máscara de esquinas redondeadas.
  await icono(marca, 180, 0.62, "apple-touch-icon.png");

  // Favicon.
  await icono(marca, 32, 0.8, "favicon-32.png");
  await icono(marca, 16, 0.86, "favicon-16.png");

  console.log("\n✅ Iconos generados en public/icons/");
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exitCode = 1;
});
