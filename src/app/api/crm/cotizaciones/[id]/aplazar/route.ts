// ============================================================
// POST /api/crm/cotizaciones/[id]/aplazar — estirar el vencimiento
//
// Una oferta vencida no se puede editar (es historia) pero sí se puede
// aplazar: es el caso real de "el cliente pidió unos días más". Antes la
// única salida era rehacerla entera, lo que quemaba un consecutivo y
// perdía el historial de seguimiento.
//
// El límite del vendedor lo decidió gerencia: hasta 15 días más, máximo
// dos veces. Pasado eso, lo hace un administrador — que no tiene tope,
// porque a esas alturas el descuento y el plazo ya se están negociando
// y quien negocia es quien firma.
//
// La prórroga se guarda APARTE de `validezDias` para que el documento
// siga diciendo la validez que se le ofreció al cliente y quede claro
// cuánto se estiró después.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { recalcularCliente } from "@/lib/estados-cliente-server";
// Los topes viven en la politica comercial: una route.ts de Next no
// puede exportar constantes (solo los handlers), y ademas ahi es donde
// se busca cualquier limite comercial.
import { DIAS_MAX_VENDEDOR, PRORROGAS_MAX_VENDEDOR } from "@/lib/politica-comercial";

const DIA = 86_400_000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dias = Number(body?.dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    return NextResponse.json({ success: false, error: "Los días tienen que ser un entero entre 1 y 365." }, { status: 400 });
  }

  const cot = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true, numero: true, estado: true, createdAt: true,
      validezDias: true, prorrogaDias: true, prorrogas: true, clienteId: true,
    },
  });
  if (!cot) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });

  // Solo tiene sentido en las que están vivas o acaban de morir. Una
  // aprobada ya se cerró y una rechazada no vuelve por aplazarla.
  const APLAZABLES = new Set(["ENVIADA", "VENCIDA"]);
  if (!APLAZABLES.has(cot.estado)) {
    return NextResponse.json(
      { success: false, error: `Una cotización en estado ${cot.estado} no se aplaza.` },
      { status: 400 },
    );
  }

  const admin = esAdmin(user.rol);
  if (!admin) {
    if (cot.prorrogas >= PRORROGAS_MAX_VENDEDOR) {
      return NextResponse.json(
        {
          success: false,
          error: `Esta oferta ya se aplazó ${cot.prorrogas} veces. A partir de aquí lo tiene que hacer un administrador.`,
        },
        { status: 403 },
      );
    }
    if (dias > DIAS_MAX_VENDEDOR) {
      return NextResponse.json(
        {
          success: false,
          error: `Puedes aplazarla hasta ${DIAS_MAX_VENDEDOR} días. Para más, pídeselo a un administrador.`,
        },
        { status: 403 },
      );
    }
  }

  const prorrogaDias = cot.prorrogaDias + dias;
  const nuevoVence = new Date(cot.createdAt.getTime() + (cot.validezDias + prorrogaDias) * DIA);

  // Si estaba vencida y la nueva fecha ya pasó, aplazar no la revive: se
  // avisa en vez de dejarla en ENVIADA con fecha pasada, que es peor.
  if (nuevoVence.getTime() < Date.now()) {
    return NextResponse.json(
      {
        success: false,
        error: `Con ${dias} días más seguiría vencida (quedaría al ${nuevoVence.toLocaleDateString("es-CO")}). Ponle más días.`,
      },
      { status: 400 },
    );
  }

  const actualizada = await prisma.cotizacion.update({
    where: { id },
    data: {
      prorrogaDias,
      prorrogas: cot.prorrogas + 1,
      prorrogadaEn: new Date(),
      prorrogadaPorId: user.sub,
      // Vuelve a estar viva: si no, seguiría marcada como VENCIDA hasta
      // la corrida de mañana y el cliente vería un enlace caducado.
      estado: "ENVIADA",
    },
    select: { numero: true, prorrogaDias: true, prorrogas: true },
  });

  await prisma.log.create({
    data: {
      usuarioId: user.sub,
      accion: "COTIZACION_APLAZADA",
      detalle: `${cot.numero}: +${dias} días (${actualizada.prorrogas}ª vez, ${prorrogaDias} en total)`,
      resultado: `vence ${nuevoVence.toISOString().slice(0, 10)}`,
    },
  }).catch(() => undefined);

  // Vuelve a estar viva, así que el cliente puede volver a "interesado".
  await recalcularCliente(cot.clienteId);

  return NextResponse.json({
    success: true,
    data: {
      ...actualizada,
      venceEl: nuevoVence.toISOString(),
      restantesVendedor: admin ? null : PRORROGAS_MAX_VENDEDOR - actualizada.prorrogas,
    },
  });
}
