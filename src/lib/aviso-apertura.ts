// ============================================================
// "Tu cliente acaba de abrir la cotización".
//
// El portal ya registraba las aperturas —`vistas`, `vistaPrimeraEn`—
// pero el dato se quedaba en la base: había que entrar a la ficha para
// verlo. El asesor se enteraba de que el cliente había mirado su oferta
// cuando ya no servía de nada.
//
// El mejor momento para llamar es cuando el cliente la tiene en la
// pantalla. Este aviso existe para eso.
//
// Dos caminos y los dos importan:
//   · La NOTIFICACIÓN del portal funciona hoy. Va solo al asesor de la
//     oferta.
//   · El CORREO necesita el SMTP cargado. Si no está, no se finge: se
//     intenta, se traga el error y queda en el log. La notificación
//     salió igual.
//
// Solo la PRIMERA apertura. Un cliente que abre la oferta ocho veces
// mientras la lee no debe generar ocho avisos: a la tercera, el asesor
// deja de mirarlos.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enviarCorreo, correoConfigurado } from "@/lib/correo";
import { armarCorreo } from "@/lib/correo-plantillas-server";
import { formatCOP } from "@/lib/utils";

export async function avisarApertura(cotizacionId: string, urlPortal: string): Promise<void> {
  const cot = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: {
      id: true, numero: true, total: true, vistas: true, esPrueba: true,
      createdAt: true, validezDias: true, prorrogaDias: true,
      cliente: { select: { nombre: true, empresa: true } },
      vendedor: { select: { id: true, nombre: true, email: true } },
    },
  });
  // Sin asesor no hay a quién avisarle. Y las de prueba no molestan a nadie.
  if (!cot || !cot.vendedor || cot.esPrueba) return;

  const vence = new Date(
    cot.createdAt.getTime() + (cot.validezDias + cot.prorrogaDias) * 86_400_000,
  ).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  const datos = {
    cliente: cot.cliente.empresa || cot.cliente.nombre,
    contacto: cot.cliente.nombre,
    numero: cot.numero,
    total: formatCOP(Number(cot.total)),
    vence,
    enlace: `${urlPortal}/crm/cotizaciones/${cot.id}`,
    vistas: cot.vistas,
  };

  // 1. La notificación del portal. Esta sí llega hoy.
  await prisma.notificacion.create({
    data: {
      tipo: "SISTEMA",
      titulo: `${datos.cliente} abrió ${cot.numero}`,
      mensaje: `La tiene en la pantalla ahora mismo. Es el mejor momento para llamar. Vence el ${vence}.`,
      data: { cotizacionId: cot.id },
      usuarioId: cot.vendedor.id,
    },
  }).catch(() => undefined);

  // 2. El correo. Si no hay SMTP, se anota y ya: la notificación salió.
  if (!cot.vendedor.email) return;
  if (!(await correoConfigurado())) {
    await prisma.log.create({
      data: {
        accion: "AVISO_APERTURA_SIN_SMTP",
        detalle: `${cot.numero}: la notificación salió, el correo a ${cot.vendedor.email} no (falta SMTP)`,
        resultado: "OMITIDO",
      },
    }).catch(() => undefined);
    return;
  }

  try {
    const correo = await armarCorreo("aviso_cliente_abrio", datos, { urlBoton: datos.enlace });
    await enviarCorreo({
      para: cot.vendedor.email,
      asunto: correo.asunto,
      html: correo.html,
      texto: correo.texto,
    });
  } catch (e) {
    // Que no se caiga la página del cliente porque falló un aviso interno.
    await prisma.log.create({
      data: {
        accion: "AVISO_APERTURA_ERROR",
        detalle: `${cot.numero}: ${(e as Error).message}`,
        resultado: "ERROR",
      },
    }).catch(() => undefined);
  }
}
