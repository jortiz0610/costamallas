// ============================================================
// Marketing — Framework de conexiones OAuth (Google/Meta/TikTok Ads)
// Las credenciales y tokens se guardan cifrados en la tabla Configuracion.
// ============================================================

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

export type Plataforma = "google" | "meta" | "tiktok";

export const PLATAFORMAS: Record<Plataforma, {
  nombre: string; color: string;
  authUrl: string; tokenUrl: string; scope: string;
  docs: string;
}> = {
  google: {
    nombre: "Google Ads", color: "#4285F4",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/adwords",
    docs: "https://developers.google.com/google-ads/api/docs/oauth/cloud-project",
  },
  meta: {
    nombre: "Meta Ads", color: "#1877F2",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    scope: "ads_read,ads_management,business_management",
    docs: "https://developers.facebook.com/docs/marketing-api/get-started",
  },
  tiktok: {
    nombre: "TikTok Ads", color: "#111827",
    authUrl: "https://business-api.tiktok.com/portal/auth",
    tokenUrl: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    scope: "ads.read",
    docs: "https://business-api.tiktok.com/portal/docs",
  },
};

const K = (p: Plataforma, campo: string) => `mkt_oauth_${p}_${campo}`;

export interface ConexionAds {
  plataforma: Plataforma;
  clientId: string;
  hasSecret: boolean;
  accountId: string;
  conectado: boolean;
}

async function getConf(clave: string): Promise<{ valor: string; encrypted: boolean } | null> {
  const r = await prisma.configuracion.findUnique({ where: { clave } });
  return r ? { valor: r.valor, encrypted: r.encrypted } : null;
}
async function setConf(clave: string, valor: string, encrypted = false, descripcion?: string) {
  const v = encrypted ? encrypt(valor) : valor;
  await prisma.configuracion.upsert({
    where: { clave },
    create: { clave, valor: v, encrypted, descripcion },
    update: { valor: v, encrypted },
  });
}

export async function getCredenciales(p: Plataforma) {
  const clientId = (await getConf(K(p, "client_id")))?.valor ?? "";
  const secretRow = await getConf(K(p, "secret"));
  const accountId = (await getConf(K(p, "account_id")))?.valor ?? "";
  const tokenRow = await getConf(K(p, "token"));
  return {
    clientId,
    secret: secretRow ? (secretRow.encrypted ? decrypt(secretRow.valor) : secretRow.valor) : "",
    accountId,
    token: tokenRow ? (tokenRow.encrypted ? decrypt(tokenRow.valor) : tokenRow.valor) : "",
  };
}

export async function guardarCredenciales(p: Plataforma, data: { clientId?: string; secret?: string; accountId?: string }) {
  if (data.clientId !== undefined) await setConf(K(p, "client_id"), data.clientId, false, `${p} client id`);
  if (data.secret) await setConf(K(p, "secret"), data.secret, true, `${p} secret`);
  if (data.accountId !== undefined) await setConf(K(p, "account_id"), data.accountId, false, `${p} account id`);
}

export async function guardarToken(p: Plataforma, token: string) {
  await setConf(K(p, "token"), token, true, `${p} access token`);
}

export async function estadoConexiones(): Promise<ConexionAds[]> {
  const out: ConexionAds[] = [];
  for (const p of Object.keys(PLATAFORMAS) as Plataforma[]) {
    const c = await getCredenciales(p);
    out.push({ plataforma: p, clientId: c.clientId, hasSecret: !!c.secret, accountId: c.accountId, conectado: !!c.token });
  }
  return out;
}

export function buildAuthUrl(p: Plataforma, clientId: string, redirectUri: string, state: string): string {
  const cfg = PLATAFORMAS[p];
  if (p === "tiktok") {
    return `${cfg.authUrl}?app_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  }
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code",
    scope: cfg.scope, state,
    ...(p === "google" ? { access_type: "offline", prompt: "consent" } : {}),
  });
  return `${cfg.authUrl}?${params.toString()}`;
}
