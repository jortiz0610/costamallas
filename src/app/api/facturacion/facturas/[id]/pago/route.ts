import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { monto, metodo, referencia } = await req.json();
  const m = Number(monto);
  if (!m || m <= 0) return NextResponse.json({ success: false, error: "Monto inválido" }, { status: 400 });

  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) return NextResponse.json({ success: false, error: "Factura no encontrada" }, { status: 404 });

  await prisma.pagoFactura.create({ data: { facturaId: id, monto: m, metodo: metodo ?? "TRANSFERENCIA", referencia: referencia ?? null } });

  const nuevoSaldo = Math.max(0, Number(factura.saldoPendiente) - m);
  const estado = nuevoSaldo <= 0 ? "PAGADA" : factura.estado === "BORRADOR" ? "BORRADOR" : "PARCIAL";

  await prisma.factura.update({ where: { id }, data: { saldoPendiente: nuevoSaldo, estado } });

  return NextResponse.json({ success: true, data: { saldoPendiente: nuevoSaldo, estado } });
}
