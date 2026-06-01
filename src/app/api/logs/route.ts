import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);
  const accion = req.nextUrl.searchParams.get("accion") ?? undefined;
  const skip = (page - 1) * limit;

  const where = accion ? { accion: { contains: accion, mode: "insensitive" as const } } : {};

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { usuario: { select: { nombre: true, email: true } } },
    }),
    prisma.log.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
