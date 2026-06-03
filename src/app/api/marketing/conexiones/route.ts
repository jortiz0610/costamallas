import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { estadoConexiones, guardarCredenciales, type Plataforma } from "@/lib/marketing-oauth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, data: await estadoConexiones() });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { plataforma, clientId, secret, accountId } = await req.json();
  if (!["google", "meta", "tiktok"].includes(plataforma))
    return NextResponse.json({ success: false, error: "Plataforma inválida" }, { status: 400 });

  await guardarCredenciales(plataforma as Plataforma, { clientId, secret, accountId });
  return NextResponse.json({ success: true });
}
