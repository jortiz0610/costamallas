// ============================================================
// GET    /api/produccion/ordenes/[id] — la orden completa
// PATCH  — guardar lo que se va llenando
// POST   — firmar (operario o supervisor)
// DELETE — anular
//
// Guarda a trozos, como la pantalla de campo: el taller no es sitio para
// perder media hora de anotaciones por un botón al final.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso, peticionPuede } from "@/lib/permisos-server";
import {
  firmar, cuadrarMateriaPrima, porcentajeDesperdicio, type FilaMateriaPrima,
} from "@/lib/orden-produccion";

type P = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.ordenes_produccion");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  const op = await prisma.ordenProduccion.findUnique({
    where: { id },
    include: {
      operario: { select: { id: true, nombre: true } },
      supervisor: { select: { nombre: true } },
      pedido: { select: { numero: true } },
      producto: { select: { nombre: true, sku: true } },
    },
  });
  if (!op) return NextResponse.json({ success: false, error: "No existe" }, { status: 404 });

  // El cuadre viaja con la orden: la pantalla lo pinta mientras se
  // escribe, no cuando se intenta firmar. Enterarse de que los kilos no
  // cuadran al final es enterarse cuando ya se guardó el papel.
  const cuadre = cuadrarMateriaPrima((op.materiaPrima ?? []) as unknown as FilaMateriaPrima[]);

  return NextResponse.json({
    success: true,
    data: {
      ...op,
      cuadre,
      desperdicioPct: porcentajeDesperdicio(cuadre),
      puedeSupervisar: await peticionPuede(req, "erp.ordenes_produccion.supervisar"),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.ordenes_produccion");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  const actual = await prisma.ordenProduccion.findUnique({
    where: { id },
    select: { firmaSupervisorEn: true, estado: true },
  });
  if (!actual) return NextResponse.json({ success: false, error: "No existe" }, { status: 404 });

  // Una orden firmada por el supervisor es un documento cerrado del
  // sistema de gestión. Corregirla en silencio después de firmada es
  // exactamente lo que una auditoría no puede encontrar.
  if (actual.firmaSupervisorEn) {
    return NextResponse.json(
      { success: false, error: "Esta orden ya la cerró el supervisor. No se puede modificar." },
      { status: 400 },
    );
  }

  const b = await req.json().catch(() => ({}));
  const op = await prisma.ordenProduccion.update({
    where: { id },
    data: {
      ...(b.especificacion !== undefined && { especificacion: b.especificacion }),
      ...(b.materiaPrima !== undefined && { materiaPrima: b.materiaPrima }),
      ...(b.productoTerminado !== undefined && { productoTerminado: b.productoTerminado }),
      ...(b.interrupciones !== undefined && { interrupciones: b.interrupciones }),
      ...(b.generaPnc !== undefined && { generaPnc: Boolean(b.generaPnc) }),
      ...(b.atributoNc !== undefined && { atributoNc: b.atributoNc || null }),
      ...(b.pncKg !== undefined && { pncKg: b.pncKg === null ? null : Number(b.pncKg) }),
      ...(b.pncTratamiento !== undefined && { pncTratamiento: b.pncTratamiento || null }),
      ...(b.inspeccion !== undefined && { inspeccion: b.inspeccion || null }),
      ...(b.observaciones !== undefined && { observaciones: b.observaciones || null }),
      ...(b.fechaPrevista !== undefined && {
        fechaPrevista: b.fechaPrevista ? new Date(b.fechaPrevista) : null,
      }),
    },
    select: { id: true, estado: true, materiaPrima: true },
  });

  const cuadre = cuadrarMateriaPrima((op.materiaPrima ?? []) as unknown as FilaMateriaPrima[]);
  return NextResponse.json({ success: true, data: { ...op, cuadre } });
}

export async function POST(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.ordenes_produccion");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const quien = b.quien === "SUPERVISOR" ? "SUPERVISOR" : "OPERARIO";

  // Firmar como supervisor exige su permiso. Sin esto, un operario
  // firmaría las dos casillas y la revisión dejaría de existir.
  if (quien === "SUPERVISOR") {
    const no = await exigirPermiso(req, "erp.ordenes_produccion.supervisar");
    if (no) return no;
  }

  const r = await firmar(
    id, quien,
    { imagen: String(b.firmaImagen ?? ""), nombre: String(b.firmaNombre ?? "") },
    user.sub,
  );
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  // Anular es una decisión de supervisión, no del taller.
  const sinPermiso = await exigirPermiso(req, "erp.ordenes_produccion.supervisar");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  // Se ANULA, no se borra: el consecutivo tiene que quedar completo para
  // que una auditoría pueda seguir la numeración sin huecos.
  await prisma.ordenProduccion.update({ where: { id }, data: { estado: "ANULADA" } });

  return NextResponse.json({ success: true });
}
