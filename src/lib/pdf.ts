// ============================================================
// Fabricar un PDF de verdad.
//
// POR QUÉ HACE FALTA, si ya había un botón de "Imprimir / PDF"
// -----------------------------------------------------------
// Ese botón llama a `window.print()`, y `window.print()` NO es una
// descarga:
//
//   · En el navegador que trae WhatsApp por dentro —que es donde el
//     cliente abre el enlace, porque el enlace se lo mandamos por
//     WhatsApp— no hace absolutamente nada. Se pulsa y no pasa nada.
//   · En Chrome de Android abre la vista de impresión y hay que saber
//     buscar "Guardar como PDF".
//   · En Safari de iPhone abre la hoja de impresión, y guardar el
//     archivo es otro rodeo más.
//
// Un archivo servido con `Content-Disposition: attachment` lo entiende
// cualquier navegador, incluidos los de dentro de las aplicaciones: sale
// el diálogo de guardar o el archivo se va a Descargas, y desde ahí se
// reenvía. Eso es lo que se pedía.
//
// CÓMO
// ----
// Chromium sin ventana abre la página de imprimir del propio portal y la
// convierte en papel. Se apunta a 127.0.0.1 y no al dominio público a
// propósito: la petición no sale de la máquina, así que no depende del
// DNS, ni de Caddy, ni del certificado, y no se puede usar esto para
// hacer que el servidor visite una dirección de fuera.
// ============================================================

import type { Browser } from "puppeteer-core";

/**
 * Dónde está Chromium dentro del contenedor.
 *
 * Se instala con `apk add chromium` en el Dockerfile. En una máquina de
 * desarrollo puede no existir: entonces esto falla con un mensaje que
 * dice qué pasa, en vez de un error de Puppeteer que no se entiende.
 */
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium-browser";

/**
 * El navegador se reaprovecha entre descargas.
 *
 * Arrancar Chromium cuesta un par de segundos y bastante memoria. Con
 * dos núcleos, abrirlo y cerrarlo en cada descarga haría que la primera
 * persona que pulse esperara de más y que dos descargas a la vez se
 * pisaran. Se abre una vez y se le van pidiendo pestañas.
 */
let navegador: Browser | null = null;

async function abrirNavegador(): Promise<Browser> {
  if (navegador?.connected) return navegador;

  const { launch } = await import("puppeteer-core");
  navegador = await launch({
    executablePath: CHROMIUM,
    headless: true,
    args: [
      // Dentro de un contenedor no hay espacio de nombres de usuario que
      // aislar, y el sandbox de Chromium no arranca sin privilegios que
      // no queremos dar. El aislamiento aquí lo pone el contenedor.
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // /dev/shm en Docker son 64 MB por defecto y Chromium lo llena
      // renderizando; sin esto se cae en páginas con imágenes.
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--hide-scrollbars",
    ],
  });

  // Si se muere solo, que la próxima llamada lo vuelva a abrir en vez de
  // quedarse intentando usar un navegador que ya no está.
  navegador.on("disconnected", () => { navegador = null; });

  return navegador;
}

export interface OpcionesPdf {
  /** Ruta del propio portal, empezando por "/". */
  ruta: string;
  /** Segundos máximos antes de rendirse. */
  esperaMax?: number;
}

/**
 * Convierte una página del portal en un PDF A4.
 *
 * Devuelve el archivo, o lanza. Quien llama decide qué contarle al
 * usuario: aquí no se inventa un PDF vacío, porque un PDF en blanco que
 * se descarga sin avisar es peor que un error claro.
 */
export async function pdfDeRuta({ ruta, esperaMax = 30 }: OpcionesPdf): Promise<Buffer> {
  const puerto = process.env.PORT ?? "3000";
  const url = `http://127.0.0.1:${puerto}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;

  const nav = await abrirNavegador();
  const pagina = await nav.newPage();

  try {
    // A4 a escala 1: el documento ya está maquetado a 210 mm.
    await pagina.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

    const respuesta = await pagina.goto(url, {
      // Se espera a que no queden peticiones: el documento lleva las
      // fotos de los productos, y sin esperarlas el PDF sale con huecos.
      waitUntil: "networkidle0",
      timeout: esperaMax * 1000,
    });

    // Un 404 aquí significa que la cotización no existe, es un borrador o
    // está borrada. Se distingue para no devolver un PDF con la página
    // de "no encontrado" dentro.
    if (!respuesta || !respuesta.ok()) {
      throw new Error(`La cotización no está disponible (${respuesta?.status() ?? "sin respuesta"})`);
    }

    // `print` y no `screen`: es lo que activa las reglas de @media print
    // del portal, que son las que dejan solo `.print-area`.
    await pagina.emulateMediaType("print");

    const pdf = await pagina.pdf({
      format: "a4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "8mm", right: "8mm", bottom: "10mm", left: "8mm" },
    });

    return Buffer.from(pdf);
  } finally {
    // La pestaña SIEMPRE se cierra. Una pestaña olvidada por descarga es
    // una fuga de memoria que tumba el contenedor a los pocos días.
    await pagina.close().catch(() => undefined);
  }
}

/** Para el diagnóstico: ¿está Chromium donde decimos que está? */
export async function hayChromium(): Promise<{ ok: boolean; ruta: string; error?: string }> {
  try {
    const { access } = await import("node:fs/promises");
    await access(CHROMIUM);
    return { ok: true, ruta: CHROMIUM };
  } catch (e) {
    return { ok: false, ruta: CHROMIUM, error: String(e) };
  }
}
