// ============================================================
// Rescate de las imágenes que se subieron por FTP y nadie sirve.
//
// La cuenta FTP escribe en
//   …/public_html/catalogo
// pero `catalogo.costamallas.com` sirve otra cosa, así que todo lo que
// pasó por ahí devuelve 404. El archivo SÍ está en disco —se comprobó,
// con su tamaño exacto— pero la dirección que el portal guardó no abre.
//
// Eso ya no vuelve a pasar: desde que WordPress está conectado, las
// subidas nuevas van a la biblioteca del sitio. Lo que queda es lo que
// se subió antes, y no se puede arreglar desde el hosting sin tocar el
// hosting. Aquí se rescata: se baja del FTP, se sube a WordPress y se
// corrige la dirección guardada.
//
// ⚠️ Esto tiene que correr EN PRODUCCIÓN. Las credenciales de WordPress
// están cifradas en `configuracion` con la ENCRYPTION_KEY de producción,
// que no es la de local: desde un PC no se pueden descifrar.
//
// Una imagen rota además tumba la sincronización del producto ENTERO
// con WooCommerce, así que arreglarla desatasca más de lo que parece.
// ============================================================

import { prisma } from "@/lib/prisma";
import { downloadImageFTP, rutaFTPDeUrl, urlBaseFTP } from "@/lib/ftp";
import { uploadToWordPressMedia, isWordPressConfigured } from "@/lib/wordpress";
import { sincronizarProducto } from "@/lib/sync-tienda";

export interface ImagenRescatada {
  id: string;
  sku: string;
  producto: string;
  publicado: boolean;
  esPrincipal: boolean;
  urlVieja: string;
  urlNueva?: string;
  estadoHttp: number;
  resultado: "rescatada" | "servia-bien" | "no-esta-en-ftp" | "fallo-wordpress" | "solo-diagnostico";
  detalle?: string;
  bytes?: number;
}

export interface ResultadoRescate {
  dryRun: boolean;
  baseFTP: string;
  wordpressConfigurado: boolean;
  revisadas: number;
  rescatadas: number;
  yaServian: number;
  perdidas: number;
  fallidas: number;
  imagenes: ImagenRescatada[];
  sincronizados: { sku: string; estado: string; detalle?: string }[];
}

/** HEAD con tope de tiempo. Un servidor que no contesta cuenta como rota. */
async function estadoHttp(url: string): Promise<number> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 12_000);
    const r = await fetch(url, { method: "HEAD", signal: c.signal });
    clearTimeout(t);
    return r.status;
  } catch {
    return 0;
  }
}

const MIMES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", avif: "image/avif",
};

export async function rescatarImagenesFTP(opciones: { dry?: boolean } = {}): Promise<ResultadoRescate> {
  const dry = opciones.dry ?? false;
  const base = urlBaseFTP();
  const hayWP = await isWordPressConfigured();

  const candidatas = await prisma.acfImagen.findMany({
    where: { urlImagen: { startsWith: base } },
    select: {
      id: true, urlImagen: true, esPrincipal: true, altText: true, titulo: true,
      producto: { select: { id: true, sku: true, nombre: true, publicado: true } },
    },
    orderBy: [{ esPrincipal: "desc" }],
  });

  const imagenes: ImagenRescatada[] = [];
  const productosTocados = new Set<string>();

  for (const img of candidatas) {
    const fila: ImagenRescatada = {
      id: img.id,
      sku: img.producto.sku,
      producto: img.producto.nombre,
      publicado: img.producto.publicado,
      esPrincipal: img.esPrincipal,
      urlVieja: img.urlImagen,
      estadoHttp: await estadoHttp(img.urlImagen),
      resultado: "solo-diagnostico",
    };

    // Si el hosting se arregló, no hay nada que rescatar. Mover una
    // imagen que ya funciona solo cambiaría su dirección por gusto.
    if (fila.estadoHttp === 200 || fila.estadoHttp === 206) {
      fila.resultado = "servia-bien";
      imagenes.push(fila);
      continue;
    }

    const ruta = rutaFTPDeUrl(img.urlImagen);
    if (!ruta) {
      fila.resultado = "no-esta-en-ftp";
      fila.detalle = "La dirección no corresponde a la carpeta del FTP.";
      imagenes.push(fila);
      continue;
    }

    const bytes = await downloadImageFTP(ruta);
    if (!bytes || !bytes.length) {
      // El archivo se perdió de verdad. No se borra el registro aquí: si
      // alguien tiene el original, con la referencia se sabe cuál era; sin
      // ella no se sabe ni qué falta.
      fila.resultado = "no-esta-en-ftp";
      fila.detalle = `No está en el FTP (${ruta}). La foto se perdió: hay que volver a subirla desde el portal.`;
      imagenes.push(fila);
      continue;
    }
    fila.bytes = bytes.length;

    if (dry) {
      fila.resultado = "solo-diagnostico";
      fila.detalle = `Se puede rescatar: ${(bytes.length / 1024).toFixed(0)} KB en el FTP.`;
      imagenes.push(fila);
      continue;
    }

    if (!hayWP) {
      fila.resultado = "fallo-wordpress";
      fila.detalle = "WordPress no está configurado, así que no hay dónde subirla.";
      imagenes.push(fila);
      continue;
    }

    const nombre = img.urlImagen.split("/").pop() ?? `imagen-${img.id}.jpg`;
    const ext = nombre.split(".").pop()?.toLowerCase() ?? "jpg";

    try {
      const subida = await uploadToWordPressMedia(bytes, nombre, MIMES[ext] ?? "image/jpeg");
      await prisma.acfImagen.update({
        where: { id: img.id },
        data: { urlImagen: subida.url, urlValida: true },
      });
      fila.urlNueva = subida.url;
      fila.resultado = "rescatada";
      productosTocados.add(img.producto.id);
    } catch (e) {
      fila.resultado = "fallo-wordpress";
      fila.detalle = (e as Error).message;
    }
    imagenes.push(fila);
  }

  // Con la imagen arreglada, el producto por fin puede sincronizarse: una
  // sola imagen en 404 tumbaba el sync del producto entero.
  const sincronizados: ResultadoRescate["sincronizados"] = [];
  if (!dry) {
    for (const productoId of productosTocados) {
      const p = await prisma.producto.findUnique({ where: { id: productoId }, select: { sku: true } });
      const r = await sincronizarProducto(productoId);
      sincronizados.push({ sku: p?.sku ?? productoId, estado: r.estado, detalle: r.aviso ?? r.error });
    }
  }

  return {
    dryRun: dry,
    baseFTP: base,
    wordpressConfigurado: hayWP,
    revisadas: imagenes.length,
    rescatadas: imagenes.filter(i => i.resultado === "rescatada").length,
    yaServian: imagenes.filter(i => i.resultado === "servia-bien").length,
    perdidas: imagenes.filter(i => i.resultado === "no-esta-en-ftp").length,
    fallidas: imagenes.filter(i => i.resultado === "fallo-wordpress").length,
    imagenes,
    sincronizados,
  };
}
