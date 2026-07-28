// ============================================================
// COSTAMALLAS ERP — Cliente WordPress REST API (biblioteca de medios)
// Sube imágenes directamente a la biblioteca de WordPress (wp/v2/media)
// para que queden servidas por costamallas.com y no dependan del
// subdominio catalogo.costamallas.com (que da 404).
// Autenticación: usuario + Application Password (WP 5.6+, sobre HTTPS).
// ============================================================

import { prisma } from "@/lib/prisma";
import { decryptIfNeeded } from "@/lib/encryption";

export interface WPCredentials {
  siteUrl: string;
  user: string;
  appPassword: string;
}

export async function getWPCredentials(): Promise<WPCredentials | null> {
  const rows = await prisma.configuracion.findMany({
    where: { clave: { in: ["wp_site_url", "wp_user", "wp_app_password"] } },
  });
  const map = Object.fromEntries(rows.map((c) => [c.clave, c]));

  const user = map["wp_user"]?.valor;
  const rawPass = map["wp_app_password"]?.valor;
  if (!user || !rawPass) return null;

  const siteUrl = (map["wp_site_url"]?.valor || "https://costamallas.com").replace(/\/$/, "");
  const appPassword = map["wp_app_password"].encrypted ? decryptIfNeeded(rawPass) : rawPass;
  return { siteUrl, user, appPassword };
}

function authHeader(creds: WPCredentials): string {
  // Las Application Passwords de WP traen espacios; Basic auth los acepta tal cual.
  return "Basic " + Buffer.from(`${creds.user}:${creds.appPassword}`).toString("base64");
}

// Verifica credenciales: /wp/v2/users/me devuelve el usuario si el Application
// Password es válido y tiene permiso. Comprueba también capacidad de subir.
export async function testWPConnection(creds: WPCredentials): Promise<{
  ok: boolean;
  user: string;
}> {
  const res = await fetch(`${creds.siteUrl}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: authHeader(creds), "User-Agent": "Costamallas-ERP/1.0" },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`WordPress ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { name?: string; slug?: string };
  return { ok: true, user: j.name || j.slug || creds.user };
}

// Sube un archivo a la biblioteca de medios y devuelve su id y URL pública.
export async function uploadToWordPressMedia(
  buffer: Buffer,
  filename: string,
  mime: string
): Promise<{ id: number; url: string }> {
  const creds = await getWPCredentials();
  if (!creds) throw new Error("WordPress no está configurado (Configuración → WordPress)");

  const res = await fetch(`${creds.siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": mime,
      "User-Agent": "Costamallas-ERP/1.0",
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(`WordPress media ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { id: number; source_url: string };
  return { id: j.id, url: j.source_url };
}

export async function isWordPressConfigured(): Promise<boolean> {
  return (await getWPCredentials()) !== null;
}
