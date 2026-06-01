// ============================================================
// GET /api/auth/me
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: user.sub },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, ultimoAcceso: true },
  });

  if (!usuario || !usuario.activo) {
    return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: usuario });
}
