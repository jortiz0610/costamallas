import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

async function set(clave: string, valor: string, encrypted = false) {
  const v = encrypted ? encrypt(valor) : valor;
  await prisma.configuracion.upsert({ where: { clave }, create: { clave, valor: v, encrypted }, update: { valor: v, encrypted } });
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["SUPERADMIN", "ADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const rows = await prisma.configuracion.findMany({ where: { clave: { in: ["ai_provider", "ai_api_key", "ai_model"] } } });
  const map = Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  return NextResponse.json({ success: true, data: {
    proveedor: map["ai_provider"] ?? "openai",
    modelo: map["ai_model"] ?? "",
    configurada: !!rows.find(r => r.clave === "ai_api_key")?.valor,
  }});
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["SUPERADMIN", "ADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { proveedor, apiKey, modelo } = await req.json();
  if (proveedor) await set("ai_provider", proveedor);
  if (modelo !== undefined) await set("ai_model", modelo);
  if (apiKey) await set("ai_api_key", apiKey, true);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["SUPERADMIN", "ADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  await prisma.configuracion.deleteMany({ where: { clave: "ai_api_key" } });
  return NextResponse.json({ success: true });
}
