import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const conexiones = await prisma.nexusConexion.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ success: true, data: conexiones });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["ADMIN", "SUPERADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { canal, nombre, descripcion, config } = body;
  if (!canal || !nombre) return NextResponse.json({ success: false, error: "Canal y nombre requeridos" }, { status: 400 });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "https://localhost:3000";
  const webhookUrl = `${baseUrl}/api/nexus/webhook/${canal}`;

  const conexion = await prisma.nexusConexion.create({
    data: { canal, nombre, descripcion, config: config ?? {}, webhookUrl },
  });

  return NextResponse.json({ success: true, data: conexion });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { id, activo, config, nombre, asignadoId } = body;
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });

  const updated = await prisma.nexusConexion.update({
    where: { id },
    data: {
      ...(activo !== undefined && { activo }),
      ...(config && { config }),
      ...(nombre && { nombre }),
      ...(asignadoId !== undefined && { asignadoId: asignadoId || null }),
    },
  });
  return NextResponse.json({ success: true, data: updated });
}
