import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(_req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      vendedor: { select: { nombre: true, email: true } },
      cotizaciones: {
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, numero: true, estado: true, total: true, createdAt: true },
      },
      pedidos: {
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, numero: true, estado: true, total: true, createdAt: true },
      },
    },
  });

  if (!cliente) return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, data: cliente });
}

export async function PUT(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { nombre, empresa, email, telefono, ciudad, direccion, nit, tipo, notas, activo } = body;

  const updated = await prisma.cliente.update({
    where: { id },
    data: { nombre, empresa, email, telefono, ciudad, direccion, nit, tipo, notas,
      ...(activo !== undefined && { activo }) },
  });

  return NextResponse.json({ success: true, data: updated });
}
