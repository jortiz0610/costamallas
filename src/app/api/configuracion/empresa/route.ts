import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const KEYS = ["empresa_nombre", "empresa_legal", "empresa_nit", "empresa_direccion",
               "empresa_telefono", "empresa_email", "empresa_color", "empresa_logo", "empresa_ico"];

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const rows = await prisma.configuracion.findMany({ where: { clave: { in: KEYS } } });
  const data: Record<string, string> = {};
  rows.forEach(r => { data[r.clave] = r.valor; });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["ADMIN", "SUPERADMIN"].includes(user.rol)) {
    return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const entries = Object.entries(body).filter(([k]) => KEYS.includes(k));

  await Promise.all(entries.map(([clave, valor]) =>
    prisma.configuracion.upsert({
      where: { clave },
      update: { valor: String(valor) },
      create: { clave, valor: String(valor) },
    })
  ));

  return NextResponse.json({ success: true });
}
