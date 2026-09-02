// ============================================================
// POST /api/crm/trabajos/[id]/agendar — ponerle fecha y hora
//
// Es el paso que convierte un pedido aprobado en trabajo de campo. Antes
// de esto, producción no lo ve: un pedido sin fecha no es trabajo de
// nadie, y meterlo en la lista del técnico la vuelve inservible.
//
// Lo hace el ASESOR, que es quien habla con el cliente y sabe cuándo
// puede recibirlo.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import { agendar } from "@/lib/visitas";

type P = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.instalaciones");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const fecha = body.fecha ? new Date(body.fecha) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) {
    return NextResponse.json({ success: false, error: "Falta la fecha y la hora." }, { status: 400 });
  }
  // Agendar para ayer es siempre un dedazo en el selector de fecha, y se
  // nota tarde: el trabajo no aparece en la lista de "lo que viene".
  if (fecha.getTime() < Date.now() - 86_400_000) {
    return NextResponse.json(
      { success: false, error: "Esa fecha ya pasó. Revísala." },
      { status: 400 },
    );
  }

  const existe = await prisma.instalacion.findUnique({
    where: { id },
    select: { id: true, estado: true, firmadoEn: true },
  });
  if (!existe) return NextResponse.json({ success: false, error: "No existe" }, { status: 404 });
  if (existe.firmadoEn) {
    return NextResponse.json(
      { success: false, error: "Este trabajo ya está firmado. Reagendarlo no cambiaría nada." },
      { status: 400 },
    );
  }

  const r = await agendar(id, fecha, body.tecnicoId === undefined ? undefined : (body.tecnicoId || null));
  return NextResponse.json({ success: true, data: r });
}
