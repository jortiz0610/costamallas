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
      _count: { select: { cotizaciones: true, pedidos: true } },
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
  const { nombre, empresa, cargo, email, telefono, whatsapp, ciudad, departamento,
          direccion, nit, paginaWeb, tipo, notas, activo, estado } = body;

  const updated = await prisma.cliente.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(empresa !== undefined && { empresa }),
      ...(cargo !== undefined && { cargo }),
      ...(email !== undefined && { email }),
      ...(telefono !== undefined && { telefono }),
      ...(whatsapp !== undefined && { whatsapp }),
      ...(ciudad !== undefined && { ciudad }),
      ...(departamento !== undefined && { departamento }),
      ...(direccion !== undefined && { direccion }),
      ...(nit !== undefined && { nit }),
      ...(paginaWeb !== undefined && { paginaWeb }),
      ...(tipo !== undefined && { tipo }),
      ...(notas !== undefined && { notas }),
      ...(activo !== undefined && { activo }),
      ...(estado !== undefined && { estado }),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
