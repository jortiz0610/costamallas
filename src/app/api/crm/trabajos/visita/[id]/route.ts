// ============================================================
// PUT /api/crm/trabajos/visita/[id] — el coordinador llena la visita
//
// Un solo endpoint para todo el ciclo: agendar, llenar el formulario,
// adjuntar la requisición y devolvérsela al vendedor. Va todo junto
// porque en la práctica el coordinador guarda varias veces la misma
// visita a lo largo de dos días, y partirlo en cuatro rutas solo
// obligaría a la pantalla a adivinar cuál llamar.
//
// **La devolución al vendedor** (`devolver: true`) es el momento que
// importa: la oportunidad vuelve a "pendiente cotización" y el vendedor
// tiene que enterarse. Por eso deja notificación, y por eso el pipeline
// la pinta en color llamativo.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";

const ESTADOS = new Set(["SOLICITADA", "AGENDADA", "REALIZADA", "CANCELADA"]);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.trabajos");
  if (sinPermiso) return sinPermiso;

  const body = await req.json().catch(() => ({}));
  const {
    estado, fechaAgendada, fechaRealizada, direccion, ciudad, contacto,
    telefono, datos, fotos, requisicion, observaciones, devolver,
  } = body ?? {};

  if (estado && !ESTADOS.has(estado)) {
    return NextResponse.json({ success: false, error: `Estado no válido: ${estado}` }, { status: 400 });
  }

  const visita = await prisma.visitaTecnica.findUnique({
    where: { id },
    select: {
      id: true, estado: true, devueltaEn: true,
      cotizacion: { select: { id: true, numero: true, vendedorId: true } },
    },
  });
  if (!visita) return NextResponse.json({ success: false, error: "Visita no encontrada" }, { status: 404 });

  // Devolverla implica haberla hecho: no se le puede mandar al vendedor
  // una visita que nadie fue a hacer.
  const estadoFinal = devolver ? "REALIZADA" : estado;

  const actualizada = await prisma.visitaTecnica.update({
    where: { id },
    data: {
      ...(estadoFinal && { estado: estadoFinal }),
      ...(fechaAgendada !== undefined && { fechaAgendada: fechaAgendada ? new Date(fechaAgendada) : null }),
      ...(fechaRealizada !== undefined && { fechaRealizada: fechaRealizada ? new Date(fechaRealizada) : null }),
      ...(direccion !== undefined && { direccion }),
      ...(ciudad !== undefined && { ciudad }),
      ...(contacto !== undefined && { contacto }),
      ...(telefono !== undefined && { telefono }),
      ...(datos !== undefined && { datos }),
      ...(fotos !== undefined && { fotos }),
      ...(requisicion !== undefined && { requisicion }),
      ...(observaciones !== undefined && { observaciones }),
      // Quien la toca primero se la queda: evita que dos coordinadores
      // vayan a la misma dirección el mismo día.
      coordinadorId: user.sub,
      ...(devolver && !visita.devueltaEn
        ? { devueltaEn: new Date(), fechaRealizada: fechaRealizada ? new Date(fechaRealizada) : new Date() }
        : {}),
    },
  });

  // El aviso al vendedor: es el punto del que se queja todo el mundo
  // cuando falta. Sin esto, la visita se queda hecha en el portal y el
  // vendedor se entera cuando el cliente llama a preguntar.
  if (devolver && !visita.devueltaEn && visita.cotizacion.vendedorId) {
    await prisma.notificacion.create({
      data: {
        tipo: "SISTEMA",
        titulo: `Visita técnica lista: ${visita.cotizacion.numero}`,
        mensaje:
          "Producción ya entregó la visita con sus medidas y la requisición de materiales. " +
          "La oportunidad volvió a pendiente de cotizar.",
        data: { cotizacionId: visita.cotizacion.id, visitaId: id },
        usuarioId: visita.cotizacion.vendedorId,
      },
    }).catch(() => undefined);

    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "VISITA_TECNICA_DEVUELTA",
        detalle: `${visita.cotizacion.numero}`,
        resultado: "OK",
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, data: actualizada });
}
