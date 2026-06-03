import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const busqueda = req.nextUrl.searchParams.get("busqueda") ?? "";
  const soloActivos = req.nextUrl.searchParams.get("activos") !== "false";

  const clientes = await prisma.cliente.findMany({
    where: {
      activo: soloActivos ? true : undefined,
      ...(busqueda ? {
        OR: [
          { nombre: { contains: busqueda, mode: "insensitive" } },
          { empresa: { contains: busqueda, mode: "insensitive" } },
          { email: { contains: busqueda, mode: "insensitive" } },
          { nit: { contains: busqueda, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: {
      vendedor: { select: { nombre: true } },
      _count: { select: { cotizaciones: true, pedidos: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data: clientes });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { nombre, empresa, cargo, email, telefono, whatsapp, ciudad, departamento,
          direccion, nit, paginaWeb, tipo, notas, estado } = body;

  if (!nombre?.trim()) return NextResponse.json({ success: false, error: "Nombre requerido" }, { status: 400 });

  const cliente = await prisma.cliente.create({
    data: {
      nombre, empresa, cargo, email, telefono, whatsapp, ciudad, departamento,
      direccion, nit, paginaWeb,
      tipo: tipo ?? "persona", notas,
      estado: estado ?? "PROSPECTO",
      vendedorId: user.sub,
    },
  });

  return NextResponse.json({ success: true, data: cliente }, { status: 201 });
}
