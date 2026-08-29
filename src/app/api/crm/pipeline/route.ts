// ============================================================
// GET /api/crm/pipeline — el tablero comercial
//
// Devuelve las ofertas con lo justo para pintar el tablero y con su
// ETAPA ya calculada (ver `lib/pipeline.ts`). Se calcula en el servidor
// porque hace falta juntar tres cosas —la cotización, sus toques y su
// pedido— y hacerlo en el navegador significaría tres peticiones.
//
// Cada vendedor ve su propio pipeline: sin `crm.ver_todo`, el filtro por
// vendedor es el mismo que en el resto del CRM.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { filtroPorVendedor } from "@/lib/alcance-crm";
import { SIN_PRUEBAS } from "@/lib/cotizaciones-prueba";
import { etapaDe } from "@/lib/pipeline";

const DIA = 86_400_000;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  // ?pruebas=1 para poder ensayar el tablero completo sin ensuciar nada.
  const conPruebas = req.nextUrl.searchParams.get("pruebas") === "1";
  const suyas = await filtroPorVendedor(req);

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      ...suyas,
      ...(conPruebas ? {} : SIN_PRUEBAS),
      // Los borradores y las rechazadas no pintan nada en el tablero.
      estado: { in: ["ENVIADA", "VENCIDA", "APROBADA"] },
    },
    select: {
      id: true, numero: true, estado: true, total: true, esPrueba: true,
      createdAt: true, enviadaEn: true, validezDias: true, prorrogaDias: true,
      prorrogas: true, vistas: true, vistaPrimeraEn: true, updatedAt: true,
      requiereVisita: true, requiereSgsst: true,
      cliente: { select: { id: true, nombre: true, empresa: true, telefono: true, whatsapp: true } },
      vendedor: { select: { id: true, nombre: true } },
      seguimientos: { select: { toque: true, estado: true, programadoPara: true, tareaId: true } },
      pedidos: { select: { id: true, numero: true, estado: true }, take: 1, orderBy: { createdAt: "desc" } },
      // La vuelta de producción: cuando la visita está entregada, la
      // oportunidad tiene que gritar que le toca al vendedor.
      visita: { select: { id: true, estado: true, devueltaEn: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const ahora = Date.now();

  const tarjetas = cotizaciones
    .map(c => {
      const toques: Record<number, string> = {};
      for (const s of c.seguimientos) toques[s.toque] = s.estado;
      const pedido = c.pedidos[0] ?? null;

      const etapa = etapaDe({ estado: c.estado, toques, estadoPedido: pedido?.estado });
      if (!etapa) return null;

      const vence = c.createdAt.getTime() + (c.validezDias + c.prorrogaDias) * DIA;

      return {
        id: c.id,
        numero: c.numero,
        estado: c.estado,
        etapa,
        total: Number(c.total),
        esPrueba: c.esPrueba,
        cliente: c.cliente,
        vendedor: c.vendedor,
        creadaEn: c.createdAt.toISOString(),
        enviadaEn: c.enviadaEn?.toISOString() ?? null,
        actualizadaEn: c.updatedAt.toISOString(),
        venceEl: new Date(vence).toISOString(),
        diasParaVencer: Math.ceil((vence - ahora) / DIA),
        prorrogas: c.prorrogas,
        vistas: c.vistas,
        vistaPrimeraEn: c.vistaPrimeraEn?.toISOString() ?? null,
        pedido,
        requiereVisita: c.requiereVisita,
        requiereSgsst: c.requiereSgsst,
        /**
         * La visita volvió de producción y nadie ha vuelto a cotizar.
         * Es lo que se pinta en color llamativo: el vendedor tiene las
         * medidas en la mano y el negocio está esperándolo.
         */
        visitaLista: Boolean(c.visita?.devueltaEn) && c.estado !== "APROBADA",
        /** La tarea del toque 2, para poder marcarla desde el tablero. */
        tareaLlamada: c.seguimientos.find(s => s.toque === 2)?.tareaId ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ success: true, data: tarjetas });
}
