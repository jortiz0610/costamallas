// ============================================================
// GET  /api/produccion/ordenes — las órdenes de producción
// POST /api/produccion/ordenes — abrir una
//
// El operario ve LAS SUYAS y las que no tienen dueño todavía. Quien
// supervisa las ve todas. No es una restricción de seguridad —son
// documentos internos— sino de utilidad: un taller con cuatro operarios
// y treinta órdenes al mes convierte "ver todas" en no ver ninguna.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso, peticionPuede } from "@/lib/permisos-server";
import { crearOrden } from "@/lib/orden-produccion";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.ordenes_produccion");
  if (sinPermiso) return sinPermiso;

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") ?? "";
  const conPruebas = searchParams.get("pruebas") === "1";
  const supervisa = await peticionPuede(req, "erp.ordenes_produccion.supervisar");

  const ordenes = await prisma.ordenProduccion.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(conPruebas ? {} : { esPrueba: false }),
      ...(supervisa ? {} : { OR: [{ operarioId: user.sub }, { operarioId: null }] }),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true, numero: true, estado: true, esPrueba: true,
      fechaExpedicion: true, fechaPrevista: true,
      firmaOperarioEn: true, firmaSupervisorEn: true,
      operario: { select: { id: true, nombre: true } },
      supervisor: { select: { nombre: true } },
      // El número del pedido, no su plata: el operario no ve precios.
      pedido: { select: { numero: true } },
      producto: { select: { nombre: true, sku: true } },
    },
  });

  return NextResponse.json({ success: true, data: ordenes, supervisa });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.ordenes_produccion");
  if (sinPermiso) return sinPermiso;

  const body = await req.json().catch(() => ({}));

  const fecha = body.fechaPrevista ? new Date(body.fechaPrevista) : null;
  if (fecha && Number.isNaN(fecha.getTime())) {
    return NextResponse.json({ success: false, error: "La fecha prevista no es válida." }, { status: 400 });
  }

  const op = await crearOrden({
    pedidoId: body.pedidoId || null,
    productoId: body.productoId || null,
    // Quien la abre se la queda, salvo que se asigne a otro. Sin dueño,
    // una orden se queda en la lista de todos y no la llena nadie.
    operarioId: body.operarioId || user.sub,
    fechaPrevista: fecha,
  });

  return NextResponse.json({ success: true, data: op });
}
