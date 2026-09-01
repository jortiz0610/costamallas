// ============================================================
// GET  /api/crm/visitas — las visitas técnicas
// POST /api/crm/visitas — agendar una
//
// Vive aparte de /api/crm/instalaciones aunque compartan tabla: quien
// pide una visita (el asesor, antes de cotizar) y quien mira las
// instalaciones (producción, después de vender) no buscan lo mismo, y
// mezclarlas en un endpoint obligaba a filtrar en la pantalla.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import { agendarVisita } from "@/lib/visitas";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.instalaciones");
  if (sinPermiso) return sinPermiso;

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") ?? "";
  const clienteId = searchParams.get("cliente") ?? "";
  const conPruebas = searchParams.get("pruebas") === "1";

  const visitas = await prisma.instalacion.findMany({
    where: {
      tipo: "VISITA",
      ...(estado ? { estado } : {}),
      ...(clienteId ? { clienteId } : {}),
      ...(conPruebas ? {} : { esPrueba: false }),
    },
    orderBy: [{ fechaAgendada: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, estado: true, fechaAgendada: true, fechaRealizada: true,
      direccion: true, ciudad: true, notas: true, esPrueba: true,
      medidas: true, condicionesSitio: true, recomendados: true,
      firmadoEn: true, firmaNombre: true, cotizacionId: true,
      cliente: { select: { id: true, nombre: true, empresa: true, telefono: true, ciudad: true } },
      tecnico: { select: { id: true, nombre: true } },
      cotizacion: { select: { id: true, numero: true, estado: true } },
    },
  });

  return NextResponse.json({ success: true, data: visitas });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.instalaciones");
  if (sinPermiso) return sinPermiso;

  const body = await req.json().catch(() => ({}));
  const clienteId = String(body.clienteId ?? "").trim();
  if (!clienteId) {
    return NextResponse.json({ success: false, error: "Falta el cliente." }, { status: 400 });
  }

  const fecha = body.fecha ? new Date(body.fecha) : null;
  if (fecha && Number.isNaN(fecha.getTime())) {
    return NextResponse.json({ success: false, error: "La fecha no es válida." }, { status: 400 });
  }

  const visita = await agendarVisita({
    clienteId,
    vendedorId: user.sub,
    fecha,
    tecnicoId: body.tecnicoId || null,
    direccion: body.direccion || null,
    ciudad: body.ciudad || null,
    notas: body.notas || null,
  });

  return NextResponse.json({ success: true, data: visita });
}
