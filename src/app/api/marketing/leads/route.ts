import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const row = await prisma.configuracion.findUnique({ where: { clave: "marketing_leads" } });
  let leads: unknown[] = [];
  try { leads = row ? JSON.parse(row.valor) : []; } catch { leads = []; }
  return NextResponse.json({ success: true, data: leads });
}
