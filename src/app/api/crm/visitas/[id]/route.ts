// ============================================================
// GET /api/crm/visitas/[id] — una visita con el formato entero
//
// Existe para una cosa concreta: que el cotizador se pueda abrir CON la
// visita delante. Hasta ahora el asesor recibía el formato por correo y
// copiaba las medidas a mano, que es exactamente donde se pierden.
//
// Devuelve además `resumen`, el formato ya armado como texto. Se arma
// AQUÍ y no en la pantalla para que sea uno solo: el mismo texto que
// prueba `scripts/probar-visitas.ts`.
//
// Sigue sin haber precios de la visita: no tiene. Los pone el asesor.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import { resumenParaCotizar, type ProductoRecomendado } from "@/lib/visitas";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.instalaciones");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;

  const v = await prisma.instalacion.findUnique({
    where: { id },
    select: {
      id: true, tipo: true, estado: true, esPrueba: true,
      fechaAgendada: true, fechaRealizada: true,
      direccion: true, ciudad: true, notas: true,
      medidas: true, condicionesSitio: true, recomendados: true,
      firmadoEn: true, firmaNombre: true, actaObservaciones: true,
      cotizacionId: true,
      cliente: {
        select: {
          id: true, nombre: true, empresa: true, email: true,
          telefono: true, ciudad: true, direccion: true, nit: true,
        },
      },
      tecnico: { select: { id: true, nombre: true } },
      cotizacion: { select: { id: true, numero: true, estado: true } },
    },
  });

  if (!v) return NextResponse.json({ success: false, error: "Esta visita no existe." }, { status: 404 });
  // Una instalación no se cotiza: va DESPUÉS de la venta. Devolverla por
  // esta ruta dejaría al cotizador prellenando una oferta de algo que ya
  // se vendió.
  if (v.tipo !== "VISITA") {
    return NextResponse.json({ success: false, error: "Ese trabajo es una instalación, no una visita." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...v,
      // `recomendados` es JSON en la base, así que Prisma lo tipa como
      // "cualquier cosa". Se limpia al guardarlo (lib/visitas.ts), pero
      // el tipo hay que afirmarlo aquí.
      recomendados: (Array.isArray(v.recomendados) ? v.recomendados : []) as unknown as ProductoRecomendado[],
      resumen: resumenParaCotizar(v),
    },
  });
}
