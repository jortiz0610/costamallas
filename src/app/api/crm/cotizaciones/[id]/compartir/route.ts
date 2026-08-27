// ============================================================
// POST /api/crm/cotizaciones/[id]/compartir
//
// Deja el enlace público listo para pegarlo en WhatsApp, y marca la
// cotización como ENVIADA.
//
// Por qué hace falta, si ya existe /enviar
// ---------------------------------------
// El enlace público NO abre mientras la cotización es BORRADOR: la
// página hace notFound(), y con razón — un borrador puede estar a medio
// armar y con precios que todavía no son la oferta.
//
// El único camino para salir de BORRADOR era `/enviar`, que exige DOS
// cosas que hoy no siempre hay: credenciales SMTP (sin cargar) y el
// correo del cliente en el CRM. Resultado: el asesor copiaba el enlace
// del botón "Enlace", lo mandaba por WhatsApp —que es como se trabaja
// aquí— y el cliente veía un 404. Las 9 cotizaciones con enlace estaban
// en BORRADOR, o sea que TODOS los enlaces compartidos hasta hoy
// estaban muertos.
//
// Compartir el enlace ES entregar la oferta. Así que hace exactamente lo
// mismo que enviar por correo, menos el correo: fija el token, pasa a
// ENVIADA y sella `enviadaEn`, que es lo que arranca el reloj de los
// tres toques del seguimiento.
//
// ⚠️ Los mismos frenos que /enviar: una oferta fuera de la política
// comercial no se comparte sin visto bueno. Si no, "compartir enlace"
// se convertiría en la puerta de atrás para saltarse el tope de
// descuento.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const cot = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true, numero: true, estado: true, publicId: true, enviadaEn: true,
      aprobacionEstado: true, aprobacionMotivo: true,
      _count: { select: { items: true } },
    },
  });
  if (!cot) return NextResponse.json({ success: false, error: "La cotización no existe" }, { status: 404 });

  // Una oferta sin renglones no es una oferta. Se para aquí porque el
  // cliente vería un documento en blanco con el logo de la empresa.
  if (cot._count.items === 0) {
    return NextResponse.json(
      { success: false, error: "Esta cotización no tiene ningún ítem: agrégalos antes de compartirla." },
      { status: 400 },
    );
  }

  // Mismos frenos que /enviar: compartir el enlace ya es prometerle el
  // precio al cliente, y desdecirse después cuesta más que la venta.
  if (cot.aprobacionEstado === "PENDIENTE") {
    return NextResponse.json(
      {
        success: false,
        error: `Esta oferta necesita el visto bueno de un administrador antes de compartirse. ${cot.aprobacionMotivo ?? ""}`.trim(),
      },
      { status: 400 },
    );
  }
  if (cot.aprobacionEstado === "RECHAZADA") {
    return NextResponse.json(
      { success: false, error: "Un administrador rechazó estas condiciones. Ajusta el descuento o el anticipo antes de compartirla." },
      { status: 400 },
    );
  }

  // Una cotización vieja puede no tener token todavía (las tres
  // primeras de la base son de antes de que existiera el enlace).
  const publicId = cot.publicId ?? randomBytes(16).toString("base64url");
  const eraBorrador = cot.estado === "BORRADOR";

  const actualizada = await prisma.cotizacion.update({
    where: { id },
    data: {
      publicId,
      estado: eraBorrador ? "ENVIADA" : cot.estado,
      // La fecha de entrega al cliente se sella UNA vez: es el origen
      // del reloj del seguimiento. Volver a copiar el enlace la semana
      // que viene no puede reiniciar los tres toques.
      ...(cot.enviadaEn ? {} : { enviadaEn: new Date() }),
      errorEnvio: null,
    },
    select: { estado: true, enviadaEn: true },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  const enlace = `${base}/cotizacion/${publicId}`;

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: "COTIZACION_COMPARTIDA",
        detalle: `${cot.numero} · enlace`,
        resultado: eraBorrador ? "BORRADOR → ENVIADA" : `se mantiene en ${cot.estado}`,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    success: true,
    enlace,
    estado: actualizada.estado,
    enviadaEn: actualizada.enviadaEn,
    // Para que la pantalla pueda decir qué cambió, en vez de copiar en
    // silencio y dejar al asesor sin saber que la oferta ya salió.
    cambioDeEstado: eraBorrador,
  });
}
