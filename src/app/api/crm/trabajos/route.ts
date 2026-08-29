// ============================================================
// GET /api/crm/trabajos — la bandeja del coordinador de producción
//
// Junta las dos cosas que el vendedor le pide desde una cotización:
// la visita técnica previa y los documentos de SG-SST. Una sola pantalla
// porque son el mismo trabajo: lo que hay que resolver ANTES de que la
// oferta se pueda cerrar.
//
// La visita se crea sola la primera vez que se consulta una cotización
// marcada con `requiereVisita`. Se hace aquí y no al guardar la
// cotización porque así también aparecen las que se marcaron antes de
// que este módulo existiera.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import { avisoDeAlmacenamiento } from "@/lib/almacenamiento-documentos";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.trabajos");
  if (sinPermiso) return sinPermiso;

  // Cotizaciones que pidieron algo a producción. Las de prueba entran:
  // el coordinador tiene que poder ensayar su parte también, y van
  // marcadas.
  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      OR: [{ requiereVisita: true }, { requiereSgsst: true }],
      // Una oferta rechazada o vencida ya no da trabajo a nadie.
      estado: { in: ["BORRADOR", "ENVIADA", "APROBADA"] },
    },
    select: {
      id: true, numero: true, estado: true, esPrueba: true,
      requiereVisita: true, requiereSgsst: true,
      ciudadInstalacion: true, direccionInstalacion: true,
      createdAt: true,
      cliente: { select: { id: true, nombre: true, empresa: true, telefono: true, whatsapp: true, ciudad: true, direccion: true } },
      vendedor: { select: { id: true, nombre: true, telefono: true } },
      visita: true,
      sgsst: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Crear la visita que falte. Un `createMany` con skipDuplicates no
  // sirve: hace falta el id de vuelta para devolverlo en la respuesta.
  const conVisita = await Promise.all(
    cotizaciones.map(async c => {
      if (!c.requiereVisita || c.visita) return c;
      const visita = await prisma.visitaTecnica.create({
        data: {
          cotizacionId: c.id,
          estado: "SOLICITADA",
          solicitadaPorId: c.vendedor?.id ?? null,
          // Se arranca con lo que ya se sabe: dónde se instala y a quién
          // llamar. El coordinador lo corrige si hace falta.
          ciudad: c.ciudadInstalacion ?? c.cliente.ciudad,
          direccion: c.direccionInstalacion ?? c.cliente.direccion,
          contacto: c.cliente.nombre,
          telefono: c.cliente.whatsapp ?? c.cliente.telefono,
        },
      }).catch(() => null);
      return { ...c, visita };
    }),
  );

  return NextResponse.json({
    success: true,
    data: conVisita,
    // Que la pantalla pueda decir la verdad sobre los archivos sin tener
    // que saber cómo funciona el almacenamiento.
    avisoAlmacenamiento: avisoDeAlmacenamiento(),
  });
}
