// ============================================================
// POST /api/public/cotizacion/[token]/aprobar
//
// El cliente aprueba su propia oferta desde el enlace que se le mandó.
// Sin sesión: la autorización ES el token, que es aleatorio de 16 bytes
// y no se puede adivinar cambiando un número en la URL.
//
// No hay botón de rechazar, a propósito. Un "no" se dice hablando: si el
// cliente pulsa rechazar, el asesor pierde la conversación que habría
// tenido y la oferta muere sin que nadie sepa por qué. Lo que sí hay es
// el botón de escribir por WhatsApp.
//
// Qué NO se deja aprobar aquí:
//   · Una oferta que no está ENVIADA (un borrador no se le ha mandado a
//     nadie; una aprobada ya lo está; una rechazada es historia).
//   · Una vencida. Ahí el cliente ve el botón de pedir una nueva.
//   · Una que espera visto bueno interno por descuento o anticipo: el
//     precio que está viendo todavía no es un compromiso de la empresa.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crearPedidoDeAprobacion } from "@/lib/aprobar-cotizacion";

const DIA = 86_400_000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { publicId: token },
    select: {
      id: true, numero: true, estado: true, createdAt: true,
      validezDias: true, prorrogaDias: true, aprobacionEstado: true,
      clienteId: true, vendedorId: true,
    },
  });

  if (!cotizacion) {
    return NextResponse.json({ success: false, error: "No encontramos esta cotización." }, { status: 404 });
  }

  if (cotizacion.estado === "APROBADA") {
    // No es un error: el cliente pulsó dos veces o volvió al enlace.
    return NextResponse.json({
      success: true,
      yaEstaba: true,
      mensaje: "Esta cotización ya estaba aprobada. Nos comunicamos contigo muy pronto.",
    });
  }

  if (cotizacion.estado !== "ENVIADA") {
    return NextResponse.json(
      { success: false, error: "Esta cotización ya no se puede aprobar en línea. Escríbenos y lo resolvemos." },
      { status: 400 },
    );
  }

  const vence = cotizacion.createdAt.getTime() + (cotizacion.validezDias + cotizacion.prorrogaDias) * DIA;
  if (vence < Date.now()) {
    return NextResponse.json(
      { success: false, error: "Esta cotización venció. Escríbenos y te preparamos una nueva con los precios de hoy." },
      { status: 400 },
    );
  }

  if (cotizacion.aprobacionEstado === "PENDIENTE") {
    return NextResponse.json(
      { success: false, error: "Esta oferta está en revisión interna. Tu asesor te confirma en breve." },
      { status: 400 },
    );
  }

  await prisma.cotizacion.update({
    where: { id: cotizacion.id },
    data: { estado: "APROBADA" },
  });

  // `usuarioId` en null: aquí no hay sesión, y el log tiene que poder
  // distinguir "la aprobó el cliente" de "la aprobó el asesor".
  const r = await crearPedidoDeAprobacion(cotizacion.id, null);

  await prisma.log.create({
    data: {
      usuarioId: null,
      accion: "COTIZACION_APROBADA_POR_CLIENTE",
      detalle: `${cotizacion.numero}${r.pedidoNumero ? ` → ${r.pedidoNumero}` : ""}`,
      resultado: "OK",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    },
  }).catch(() => undefined);

  // Avisar al asesor. Si no hay a quién, no se cae: el pedido ya existe.
  if (cotizacion.vendedorId) {
    await prisma.notificacion.create({
      data: {
        tipo: "SISTEMA",
        titulo: `¡${cotizacion.numero} aprobada por el cliente!`,
        mensaje: r.pedidoNumero
          ? `Se creó el pedido ${r.pedidoNumero}. Revísalo y confírmale al cliente.`
          : "Ya tenía pedido; no se creó otro.",
        data: { cotizacionId: cotizacion.id, pedido: r.pedidoNumero },
        // Va SOLO al asesor de la oferta. Contárselo a los siete usuarios
        // no le sirve a nadie y entierra los avisos que sí importan.
        usuarioId: cotizacion.vendedorId,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    success: true,
    mensaje: "¡Listo! Recibimos tu aprobación. Tu asesor se comunica contigo muy pronto.",
  });
}
