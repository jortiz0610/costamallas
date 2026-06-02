// GET  /api/usuarios — listar usuarios
// POST /api/usuarios — crear usuario

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  rol: z.enum(["SUPERADMIN","ADMIN","USUARIO","VENDEDOR","PRODUCCION","BODEGA","SOLO_LECTURA"]),
  activo: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!["SUPERADMIN","ADMIN"].includes(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, email: true, rol: true, activo: true, ultimoAcceso: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: usuarios });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (user.rol !== "SUPERADMIN") return NextResponse.json({ success: false, error: "Solo SuperAdmin puede crear usuarios" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });

  const { nombre, email, password, rol, activo } = parsed.data;

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) return NextResponse.json({ success: false, error: "Ya existe un usuario con ese email" }, { status: 409 });

  const hashedPwd = await bcrypt.hash(password, 12);
  const nuevo = await prisma.usuario.create({
    data: { nombre, email, password: hashedPwd, rol: rol as never, activo },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
  });

  return NextResponse.json({ success: true, data: nuevo }, { status: 201 });
}
