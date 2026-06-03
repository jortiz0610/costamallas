import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const busqueda = req.nextUrl.searchParams.get("busqueda") ?? "";

  const proveedores = await prisma.proveedor.findMany({
    where: {
      activo: true,
      ...(busqueda ? {
        OR: [
          { nombre: { contains: busqueda, mode: "insensitive" } },
          { contacto: { contains: busqueda, mode: "insensitive" } },
          { email: { contains: busqueda, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: { _count: { select: { ordenes: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data: proveedores });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const { nombre, contacto, email, telefono, nit, direccion, ciudad, categorias, notas, leadTimeDias } = body;
  if (!nombre?.trim()) return NextResponse.json({ success: false, error: "Nombre requerido" }, { status: 400 });

  const proveedor = await prisma.proveedor.create({
    data: {
      nombre: nombre.trim(), contacto, email, telefono, nit, direccion, ciudad,
      categorias: Array.isArray(categorias) ? categorias : [],
      notas, leadTimeDias: leadTimeDias ? parseInt(String(leadTimeDias)) : null,
    },
  });

  return NextResponse.json({ success: true, data: proveedor }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { id, ...rest } = await req.json();
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  const proveedor = await prisma.proveedor.update({ where: { id }, data: rest });
  return NextResponse.json({ success: true, data: proveedor });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  await prisma.proveedor.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ success: true });
}
