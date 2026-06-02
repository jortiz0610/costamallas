import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite, isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const tipo = req.nextUrl.searchParams.get("tipo");
  const catalogos = await prisma.catalogo.findMany({
    where: { ...(tipo ? { tipo: tipo as never } : {}), activo: true },
    orderBy: [{ tipo: "asc" }, { orden: "asc" }, { label: "asc" }],
  });

  return NextResponse.json({ success: true, data: catalogos });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { tipo, valor, label, orden } = await req.json();
  if (!tipo || !valor || !label) return NextResponse.json({ success: false, error: "tipo, valor y label son requeridos" }, { status: 400 });

  try {
    const catalogo = await prisma.catalogo.create({
      data: { tipo, valor, label, orden: orden ?? 0 },
    });
    return NextResponse.json({ success: true, data: catalogo });
  } catch {
    return NextResponse.json({ success: false, error: "Ya existe un item con ese valor" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { id, label, orden, activo } = await req.json();
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const updated = await prisma.catalogo.update({
    where: { id },
    data: {
      ...(label !== undefined && { label }),
      ...(orden !== undefined && { orden }),
      ...(activo !== undefined && { activo }),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: "Solo Admin" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  await prisma.catalogo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
