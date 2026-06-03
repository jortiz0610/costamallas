import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCredenciales, buildAuthUrl, PLATAFORMAS, type Plataforma } from "@/lib/marketing-oauth";

type P = { params: Promise<{ plataforma: string }> };

// GET → inicia el flujo OAuth redirigiendo a la plataforma
export async function GET(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { plataforma } = await params;
  if (!(plataforma in PLATAFORMAS))
    return NextResponse.json({ success: false, error: "Plataforma inválida" }, { status: 400 });

  const p = plataforma as Plataforma;
  const creds = await getCredenciales(p);
  if (!creds.clientId)
    return NextResponse.json({ success: false, error: "Primero guarda el Client ID y Secret de esta plataforma." }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const redirectUri = `${appUrl}/api/marketing/oauth/callback`;
  const url = buildAuthUrl(p, creds.clientId, redirectUri, p);

  return NextResponse.redirect(url);
}
