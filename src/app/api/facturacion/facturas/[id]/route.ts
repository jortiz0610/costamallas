import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const factura = await prisma.factura.findUnique({
    where: { id },
    include: { cliente: true, items: { orderBy: { orden: "asc" } }, pagos: { orderBy: { fecha: "desc" } } },
  });
  if (!factura) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ success: true, data: factura });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { estado, notas, fechaVence } = await req.json();
  const factura = await prisma.factura.update({
    where: { id },
    data: {
      ...(estado && { estado }),
      ...(notas !== undefined && { notas }),
      ...(fechaVence !== undefined && { fechaVence: fechaVence ? new Date(fechaVence) : null }),
    },
  });
  return NextResponse.json({ success: true, data: factura });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  // Anular en lugar de borrar (las facturas no se eliminan)
  await prisma.factura.update({ where: { id }, data: { estado: "ANULADA" } });
  return NextResponse.json({ success: true });
}
