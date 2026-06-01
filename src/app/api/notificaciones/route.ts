import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const notificaciones = await prisma.notificacion.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const noLeidas = await prisma.notificacion.count({ where: { leida: false } });

  return NextResponse.json({
    success: true,
    data: notificaciones.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      leidaAt: n.leidaAt?.toISOString() ?? null,
    })),
    noLeidas,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ids, marcarTodas } = body as { ids?: string[]; marcarTodas?: boolean };

  if (marcarTodas) {
    await prisma.notificacion.updateMany({
      where: { leida: false },
      data: { leida: true, leidaAt: new Date() },
    });
  } else if (ids?.length) {
    await prisma.notificacion.updateMany({
      where: { id: { in: ids } },
      data: { leida: true, leidaAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
