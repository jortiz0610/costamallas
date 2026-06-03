import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const checks: Record<string, { ok: boolean; latencyMs?: number; mensaje?: string }> = {};

  // 1. Base de datos
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (e) {
    checks.database = { ok: false, mensaje: String(e) };
  }

  // 2. Conteo de logs recientes (indicador de actividad)
  let logsRecientes = 0;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    logsRecientes = await prisma.log.count({ where: { createdAt: { gte: since } } });
  } catch {}

  // 3. Errores pendientes
  let erroresPendientes = 0;
  try {
    erroresPendientes = await prisma.errorValidacion.count({ where: { estadoCorreccion: "PENDIENTE" } });
  } catch {}

  // 4. Caídas recientes (logs con resultado ERROR en últimas 24h)
  let caidas: { createdAt: Date; accion: string; detalle: string | null }[] = [];
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    caidas = await prisma.log.findMany({
      where: { resultado: "ERROR", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { createdAt: true, accion: true, detalle: true },
    });
  } catch {}

  // 5. Último usuario activo
  let ultimoAcceso: { nombre: string; ultimoAcceso: Date | null } | null = null;
  try {
    ultimoAcceso = await prisma.usuario.findFirst({
      where: { ultimoAcceso: { not: null } },
      orderBy: { ultimoAcceso: "desc" },
      select: { nombre: true, ultimoAcceso: true },
    });
  } catch {}

  // 6. Productos sin stock (indicador crítico)
  let sinStock = 0;
  try {
    sinStock = await prisma.producto.count({ where: { stock: { lte: 0 }, publicado: true } });
  } catch {}

  // Uptime estimado desde env var o fecha de deploy
  const uptime = process.uptime ? Math.floor(process.uptime()) : 0;

  return NextResponse.json({
    success: true,
    data: {
      checks,
      logsRecientes,
      erroresPendientes,
      sinStock,
      caidas,
      ultimoAcceso,
      uptime,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
    },
  });
}
