import { NextRequest, NextResponse } from "next/server";
import { getCredenciales, guardarToken, PLATAFORMAS, type Plataforma } from "@/lib/marketing-oauth";

// Callback de OAuth: intercambia el code por un access token y lo guarda.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") as Plataforma | null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const back = (ok: boolean, msg: string) => NextResponse.redirect(`${appUrl}/configuracion?tab=marketing&oauth=${ok ? "ok" : "error"}&msg=${encodeURIComponent(msg)}`);

  if (!code || !state || !(state in PLATAFORMAS)) return back(false, "Faltan parámetros del callback");

  const p = state;
  const cfg = PLATAFORMAS[p];
  const creds = await getCredenciales(p);
  const redirectUri = `${appUrl}/api/marketing/oauth/callback`;

  try {
    let token = "";
    if (p === "google") {
      const res = await fetch(cfg.tokenUrl, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: creds.clientId, client_secret: creds.secret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      const j = await res.json();
      token = j.refresh_token || j.access_token || "";
    } else if (p === "meta") {
      const res = await fetch(`${cfg.tokenUrl}?` + new URLSearchParams({ client_id: creds.clientId, client_secret: creds.secret, redirect_uri: redirectUri, code }), { method: "GET" });
      const j = await res.json();
      token = j.access_token || "";
    } else if (p === "tiktok") {
      const res = await fetch(cfg.tokenUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: creds.clientId, secret: creds.secret, auth_code: code }),
      });
      const j = await res.json();
      token = j?.data?.access_token || "";
    }

    if (!token) return back(false, "No se obtuvo el token. Revisa las credenciales de la app.");
    await guardarToken(p, token);
    return back(true, `${cfg.nombre} conectado`);
  } catch (e) {
    return back(false, (e as Error).message);
  }
}
