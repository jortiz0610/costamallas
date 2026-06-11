// PUT    /api/usuarios/[id] — actualizar usuario
// DELETE /api/usuarios/[id] — desactivar usuario

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  nombre: z.string().min(2).optional(),
  rol: z.enum(["SUPERADMIN","ADMIN","USUARIO","VENDEDOR","PRODUCCION","BODEGA","SOLO_LECTURA"]).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["SUPERADMIN", "ADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });

  // Reglas de jerarquía: los admins no pueden tocar al superadmin ni asignar el rol SUPERADMIN
  const objetivo = await prisma.usuario.findUnique({ where: { id }, select: { rol: true } });
  if (user.rol !== "SUPERADMIN") {
    if (objetivo?.rol === "SUPERADMIN") return NextResponse.json({ success: false, error: "No puedes editar a un superadministrador" }, { status: 403 });
    if (parsed.data.rol === "SUPERADMIN") return NextResponse.json({ success: false, error: "Solo el superadministrador puede asignar ese rol" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.nombre) data.nombre = parsed.data.nombre;
  if (parsed.data.rol) data.rol = parsed.data.rol;
  if (parsed.data.activo !== undefined) data.activo = parsed.data.activo;
  if (parsed.data.password) data.password = await bcrypt.hash(parsed.data.password, 12);

  const updated = await prisma.usuario.update({
    where: { id },
    data: data as never,
    select: { id: true, nombre: true, email: true, rol: true, activo: true },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["SUPERADMIN", "ADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  if (user.sub === id) return NextResponse.json({ success: false, error: "No puedes desactivarte a ti mismo" }, { status: 400 });

  const objetivo = await prisma.usuario.findUnique({ where: { id }, select: { rol: true } });
  if (objetivo?.rol === "SUPERADMIN" && user.rol !== "SUPERADMIN") {
    return NextResponse.json({ success: false, error: "No puedes desactivar a un superadministrador" }, { status: 403 });
  }

  await prisma.usuario.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ success: true });
}
