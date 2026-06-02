// ============================================================
// COSTAMALLAS ERP — Cliente FTP para subir imágenes
// Destino: catalogo.costamallas.com (Hostinger)
// ============================================================

import * as ftp from "basic-ftp";
import { Readable } from "stream";

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
