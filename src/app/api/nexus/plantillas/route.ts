import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const categoria = req.nextUrl.searchParams.get("categoria");

  const plantillas = await prisma.plantillaNexus.findMany({
    where: { activo: true, ...(categoria ? { categoria } : {}) },
    orderBy: [{ categoria: "asc" }, { vecesUsada: "desc" }],
    take: 200,
  });

  return NextResponse.json({ success: true, data: plantillas });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { nombre, categoria, canal, contenido, atajo } = body;
  if (!nombre?.trim() || !contenido?.trim())
    return NextResponse.json({ success: false, error: "Nombre y contenido requeridos" }, { status: 400 });

  const plantilla = await prisma.plantillaNexus.create({
    data: {
      nombre: nombre.trim(),
      categoria: categoria ?? "GENERAL",
      canal: canal ?? "todos",
      contenido: contenido.trim(),
      atajo: atajo || null,
    },
  });

  return NextResponse.json({ success: true, data: plantilla }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { id, incrementarUso, ...rest } = await req.json();
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const plantilla = await prisma.plantillaNexus.update({
    where: { id },
    data: incrementarUso ? { vecesUsada: { increment: 1 } } : rest,
  });
  return NextResponse.json({ success: true, data: plantilla });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  await prisma.plantillaNexus.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
