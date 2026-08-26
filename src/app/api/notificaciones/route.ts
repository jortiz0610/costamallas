// ============================================================
// Las notificaciones del portal.
//
// Hasta el aviso de tiempo de respuesta, TODAS eran globales: las veía
// todo el mundo. Ahora una notificación puede ir dirigida a alguien
// (`usuarioId`), porque decirle a los siete usuarios que a un asesor se
// le pasó una conversación no sirve de nada.
//
// `usuarioId = null` sigue significando "para todos", que es lo que son
// todas las que ya existían: nada cambia para ellas.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  // Las globales y las suyas. Nunca las dirigidas a otra persona.
  const mias = { OR: [{ usuarioId: null }, { usuarioId: user.sub }] };

  const notificaciones = await prisma.notificacion.findMany({
    where: mias,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const noLeidas = await prisma.notificacion.count({ where: { ...mias, leida: false } });

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

  // Se marca solo lo que esa persona puede ver: "marcar todas" no puede
  // dar por leído el aviso que le llegó a otro.
  const mias = { OR: [{ usuarioId: null }, { usuarioId: user.sub }] };

  if (marcarTodas) {
    await prisma.notificacion.updateMany({
      where: { ...mias, leida: false },
      data: { leida: true, leidaAt: new Date() },
    });
  } else if (ids?.length) {
    await prisma.notificacion.updateMany({
      where: { ...mias, id: { in: ids } },
      data: { leida: true, leidaAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
