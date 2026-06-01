// ============================================================
// POST /api/auth/logout
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearAuthCookies, getUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (user) {
    // Revocar todos los refresh tokens del usuario
    await prisma.refreshToken.updateMany({
      where: { usuarioId: user.sub, revoked: false },
      data: { revoked: true },
    });

    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "AUTH_LOGOUT",
        resultado: "OK",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
      },
    });
  }

  await clearAuthCookies();

  return NextResponse.json({ success: true });
}
