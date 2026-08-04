// ============================================================
// POST /api/crm/cotizaciones/[id]/aprobacion
//
// El visto bueno de un administrador a una oferta que se salió de la
// política comercial (descuento por encima del tope o anticipo por
// debajo del mínimo).
//
// Queda quién, cuándo y con qué nota, tanto en la cotización como en el
// log de auditoría. Una excepción que no deja rastro no sirve para
// revisarla después ni para saber quién autorizó qué.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";

type P = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  // Es el único punto donde importa el rol: un asesor no puede
  // autorizarse a sí mismo el descuento que acaba de poner.
  if (!esAdmin(user.rol)) {
    return NextResponse.json(
      { success: false, error: "Solo un administrador puede aprobar condiciones fuera de la política." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const aprobar = body.aprobar !== false;
  const nota = String(body.nota ?? "").trim();

  const cot = await prisma.cotizacion.findUnique({
    where: { id },
    select: { numero: true, aprobacionEstado: true, aprobacionMotivo: true, descuentoPct: true, anticipoPct: true },
  });
  if (!cot) return NextResponse.json({ success: false, error: "La cotización no existe" }, { status: 404 });
  if (cot.aprobacionEstado === "NO_REQUIERE") {
    return NextResponse.json(
      { success: false, error: "Esta oferta está dentro de la política: no hay nada que aprobar." },
      { status: 400 },
    );
  }

  const quien = await prisma.usuario.findUnique({ where: { id: user.sub }, select: { nombre: true } });

  await prisma.cotizacion.update({
    where: { id },
    data: {
      aprobacionEstado: aprobar ? "APROBADA" : "RECHAZADA",
      aprobadaPorId: user.sub,
      aprobadaPorNombre: quien?.nombre ?? user.email,
      aprobadaEn: new Date(),
      aprobacionNota: nota || null,
    },
  });

  await prisma.log.create({
    data: {
      usuarioId: user.sub,
      accion: aprobar ? "COTIZACION_DESCUENTO_APROBADO" : "COTIZACION_DESCUENTO_RECHAZADO",
      detalle:
        `${cot.numero} · ${cot.aprobacionMotivo ?? ""}` +
        `${nota ? ` · Nota: ${nota}` : ""}`,
      resultado: "OK",
      metadata: {
        descuentoPct: Number(cot.descuentoPct),
        anticipoPct: cot.anticipoPct == null ? null : Number(cot.anticipoPct),
      },
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    mensaje: aprobar
      ? "Condiciones aprobadas: ya se puede enviar la oferta."
      : "Condiciones rechazadas: hay que ajustar el descuento o el anticipo.",
  });
}
