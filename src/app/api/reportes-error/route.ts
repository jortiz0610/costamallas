import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";

// Crear reporte: cualquier usuario autenticado
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const b = await req.json();
  const usuario = await prisma.usuario.findUnique({ where: { id: user.sub }, select: { nombre: true } });

  const reporte = await prisma.reporteError.create({
    data: {
      usuarioId: user.sub,
      usuarioNombre: usuario?.nombre ?? user.email,
      usuarioRol: user.rol,
      modulo: String(b.modulo ?? "").slice(0, 300),
      accion: b.accion ? String(b.accion).slice(0, 500) : null,
      descripcion: b.descripcion ? String(b.descripcion) : null,
      url: b.url ? String(b.url).slice(0, 500) : null,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  return NextResponse.json({ success: true, data: reporte }, { status: 201 });
}

// Listar: solo admin/superadmin
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const estado = req.nextUrl.searchParams.get("estado");
  const reportes = await prisma.reporteError.findMany({
    where: estado ? { estado } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const nuevos = await prisma.reporteError.count({ where: { estado: "NUEVO" } });
  return NextResponse.json({ success: true, data: reportes, nuevos });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { id, estado } = await req.json();
  const r = await prisma.reporteError.update({ where: { id }, data: { estado } });
  return NextResponse.json({ success: true, data: r });
}
