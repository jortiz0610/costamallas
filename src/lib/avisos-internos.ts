// ============================================================
// Los avisos que recibe el EQUIPO, no el cliente.
//
// POR QUÉ EXISTE
// --------------
// Dos momentos del proceso dejaban solo una notificación dentro del
// portal: cuando el cliente aprueba su oferta, y cuando producción
// entrega la visita técnica. Son los dos momentos en que al asesor le
// toca mover algo, y en los dos se enteraba **solo si tenía el portal
// abierto**.
//
// Un asesor está en la calle. El cliente aprueba a las 4 de la tarde, y
// el asesor lo ve al día siguiente cuando abre el portal — o cuando el
// cliente llama a preguntar por qué nadie le ha confirmado. Las
// plantillas de esos dos correos llevaban meses escritas y sin nadie que
// las llamara.
//
// LO QUE NO HACE: esperar al horario hábil.
//
// Es deliberado y es la diferencia con los avisos al cliente. Esto no es
// publicidad que pueda esperar a mañana: es trabajo que acaba de
// aparecer. Un asesor que recibe a las 8 de la noche que le aprobaron
// una oferta lo agradece; uno que se entera 14 horas tarde, no. Y quien
// no quiera leerlo fuera de hora, no lo lee — es su propio correo.
//
// Ninguna de estas funciones lanza: un correo caído no puede tumbar la
// aprobación de una oferta ni impedir que producción entregue su visita.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface ResultadoAvisoInterno {
  ok: boolean;
  /** true = no había a quién escribirle, y eso no es un fallo. */
  omitido?: boolean;
  motivo?: string;
  para?: string;
}

/**
 * Manda una plantilla a un usuario del portal.
 *
 * Se busca el correo por id y no se recibe ya resuelto a propósito:
 * quien llama tiene el `vendedorId` a mano y no debería tener que
 * acordarse de traer también el correo en su `select`.
 */
async function aUsuario(
  usuarioId: string | null | undefined,
  plantilla: string,
  datos: Record<string, string | number | null | undefined>,
  urlBoton?: string,
): Promise<ResultadoAvisoInterno> {
  if (!usuarioId) return { ok: true, omitido: true, motivo: "La oferta no tiene asesor asignado." };

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { email: true, activo: true },
  });
  if (!usuario?.email) return { ok: true, omitido: true, motivo: "El asesor no tiene correo." };
  // A alguien que ya no trabaja aquí no se le sigue escribiendo.
  if (!usuario.activo) return { ok: true, omitido: true, motivo: "El asesor está inactivo." };

  try {
    const { armarCorreo } = await import("@/lib/correo-plantillas-server");
    const { enviarCorreo } = await import("@/lib/correo");
    const correo = await armarCorreo(plantilla, datos, { urlBoton });
    await enviarCorreo({
      para: usuario.email,
      asunto: correo.asunto,
      html: correo.html,
      texto: correo.texto,
    });
    return { ok: true, para: usuario.email };
  } catch (e) {
    // `para` va también cuando falla: saber a QUIÉN se intentó escribir
    // es la mitad de la respuesta cuando alguien pregunta por qué no le
    // llegó nada. Sin esto, el registro dice "falló" y no dice de quién.
    return { ok: false, para: usuario.email, motivo: (e as Error).message };
  }
}

/**
 * «Tu cliente aprobó la oferta y ya hay pedido».
 *
 * Es el aviso más urgente de todo el portal: hay un cliente que acaba de
 * decir que sí y está esperando que alguien le confirme.
 */
export async function avisarCotizacionAprobada(
  cotizacionId: string,
  numeroPedido: string,
  urlBase: string,
): Promise<ResultadoAvisoInterno> {
  const cot = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: {
      numero: true, total: true, vendedorId: true,
      cliente: { select: { nombre: true, empresa: true } },
    },
  });
  if (!cot) return { ok: false, motivo: "La cotización no existe." };

  const { formatCOP } = await import("@/lib/utils");

  return aUsuario(
    cot.vendedorId,
    "aviso_aprobada",
    {
      cliente: cot.cliente.empresa || cot.cliente.nombre,
      contacto: cot.cliente.nombre,
      numero: cot.numero,
      total: formatCOP(Number(cot.total)),
      pedido: numeroPedido,
    },
    `${urlBase.replace(/\/$/, "")}/crm/pedidos`,
  );
}

/**
 * «Producción ya entregó la visita: te toca cotizar».
 *
 * Sin esto, la visita se queda hecha en el portal y el vendedor se
 * entera cuando el cliente llama a preguntar por su oferta.
 */
export async function avisarVisitaLista(
  cotizacionId: string,
  urlBase: string,
): Promise<ResultadoAvisoInterno> {
  const cot = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: {
      numero: true, total: true, vendedorId: true,
      cliente: { select: { nombre: true, empresa: true } },
    },
  });
  if (!cot) return { ok: false, motivo: "La cotización no existe." };

  const { formatCOP } = await import("@/lib/utils");

  return aUsuario(
    cot.vendedorId,
    "aviso_visita_lista",
    {
      cliente: cot.cliente.empresa || cot.cliente.nombre,
      contacto: cot.cliente.nombre,
      numero: cot.numero,
      total: formatCOP(Number(cot.total)),
    },
    `${urlBase.replace(/\/$/, "")}/crm/trabajos`,
  );
}
