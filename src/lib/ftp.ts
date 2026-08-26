// ============================================================
// COSTAMALLAS ERP — Cliente FTP para subir imágenes
// Destino: catalogo.costamallas.com (Hostinger)
// ============================================================

import * as ftp from "basic-ftp";
import { Readable, Writable } from "stream";

export interface FTPConfig {
  host: string;
  user: string;
  password: string;
  basePath: string;
  baseUrl: string;
}

function getFTPConfig(): FTPConfig {
  return {
    host: process.env.FTP_HOST ?? "ftp.costamallas.com",
    user: process.env.FTP_USER ?? "",
    password: process.env.FTP_PASSWORD ?? "",
    basePath: process.env.FTP_BASE_PATH ?? "/home/u873653854/domains/costamallas.com/public_html/catalogo",
    baseUrl: process.env.FTP_BASE_URL ?? "https://catalogo.costamallas.com",
  };
}

export async function uploadImageFTP(
  buffer: Buffer,
  filename: string,
  subfolder = "productos"
): Promise<string> {
  const config = getFTPConfig();
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: false,
    });

    const remotePath = `${config.basePath}/${subfolder}`;

    // Crear carpeta si no existe
    await client.ensureDir(remotePath);

    // Subir archivo
    const stream = Readable.from(buffer);
    await client.uploadFrom(stream, `${remotePath}/${filename}`);

    return `${config.baseUrl}/${subfolder}/${filename}`;
  } finally {
    client.close();
  }
}

/**
 * ¿La URL que devuelve el FTP se puede abrir de verdad?
 *
 * Subir por FTP y que el archivo quede en disco NO significa que alguien
 * lo esté sirviendo. En Costamallas pasa exactamente eso: la cuenta FTP
 * escribe en `…/public_html/catalogo`, pero `catalogo.costamallas.com`
 * sirve otra cosa, así que todo lo que se sube da 404.
 *
 * Ese es el motivo real de que "la ficha técnica se sube pero no se ve en
 * la página", y de que se hayan perdido fotos sin que nadie se enterara:
 * el portal decía "subida" porque el FTP no se quejó.
 *
 * Devuelve null si todo bien, o el motivo si no se puede abrir.
 */
export async function verificarUrlPublica(url: string): Promise<string | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 10_000);
    const res = await fetch(url, { method: "HEAD", signal: c.signal });
    clearTimeout(t);

    if (res.ok) return null;

    // Un 404 con HTML es el síntoma clásico: no hay servidor de archivos
    // detrás, contesta el WordPress y devuelve su página de "no existe".
    const tipo = res.headers.get("content-type") ?? "";
    return res.status === 404 && tipo.includes("text/html")
      ? "El archivo se subió al servidor, pero esa dirección no lo sirve (responde la web, no el archivo). Hay que revisar a dónde apunta catalogo.costamallas.com en el hosting."
      : `El archivo se subió, pero la dirección pública responde ${res.status}.`;
  } catch {
    // Sin red o el host no responde: se informa, no se da por bueno.
    return "El archivo se subió, pero no se pudo comprobar que la dirección pública funcione.";
  }
}

/**
 * Baja un archivo del FTP a memoria.
 *
 * Existe para rescatar lo que se subió por esta vía antes de que se
 * supiera que `catalogo.costamallas.com` no sirve esa carpeta: el
 * archivo está en disco y se puede recuperar, aunque su URL dé 404.
 * Devuelve null si no está.
 */
export async function downloadImageFTP(rutaRemota: string): Promise<Buffer | null> {
  const config = getFTPConfig();
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: false,
    });

    const trozos: Buffer[] = [];
    const destino = new Writable({
      write(chunk, _enc, cb) { trozos.push(Buffer.from(chunk)); cb(); },
    });
    await client.downloadTo(destino, rutaRemota);
    return Buffer.concat(trozos);
  } catch {
    return null;
  } finally {
    client.close();
  }
}

/** Para poder decir en pantalla a qué host apunta lo que hay guardado. */
export function urlBaseFTP(): string {
  const b = getFTPConfig().baseUrl;
  return b.endsWith("/") ? b.slice(0, -1) : b;
}

/** La ruta en el FTP que corresponde a una URL pública del catálogo. */
export function rutaFTPDeUrl(url: string): string | null {
  const base = urlBaseFTP();
  if (!url.startsWith(base)) return null;
  return `${getFTPConfig().basePath}${url.slice(base.length)}`;
}

export async function deleteImageFTP(filename: string, subfolder = "productos"): Promise<void> {
  const config = getFTPConfig();
  const client = new ftp.Client();

  try {
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: false,
    });

    await client.remove(`${config.basePath}/${subfolder}/${filename}`);
  } catch {
    // Si no existe el archivo, ignorar el error
  } finally {
    client.close();
  }
}
