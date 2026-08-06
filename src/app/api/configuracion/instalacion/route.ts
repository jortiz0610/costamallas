// ============================================================
// GET  /api/configuracion/instalacion   quién coordina las obras
// POST /api/configuracion/instalacion
//
// Es a quien se le avisa cuando se cierra una venta con instalación.
// Devuelve también la lista de usuarios activos para poder elegirlo sin
// escribir un correo a mano (y que no se desactualice cuando la persona
// cambie de correo).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { getConfigInstalacion, setConfigInstalacion } from "@/lib/instalaciones";
import { correoConfigurado } from "@/lib/correo";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const [cfg, usuarios] = await Promise.all([
    getConfigInstalacion(),
    prisma.usuario.findMany({
      where: { activo: true, rol: { not: "CLIENTE" } },
      select: { id: true, nombre: true, email: true, rol: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: cfg,
    usuarios,
    listo: { correo: await correoConfigurado() },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();

  if (b.coordinadorEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.coordinadorEmail))) {
    return NextResponse.json({ success: false, error: "El correo del coordinador no es válido." }, { status: 400 });
  }

  await setConfigInstalacion({
    coordinadorId: b.coordinadorId,
    coordinadorEmail: b.coordinadorEmail,
    avisarAlCerrar: typeof b.avisarAlCerrar === "boolean" ? b.avisarAlCerrar : undefined,
  });

  return NextResponse.json({ success: true, data: await getConfigInstalacion() });
}
