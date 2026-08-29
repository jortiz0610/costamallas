// ============================================================
// Lo que pasa cuando una cotización se aprueba.
//
// Vive aquí y no dentro de la route handler porque ahora hay DOS puertas
// a la misma decisión: el asesor cambiando el estado desde el portal, y
// el cliente pulsando "Aprobar" en la oferta pública. Si cada una
// hiciera su versión, tarde o temprano una crearía el pedido y la otra
// no, o una avisaría al coordinador de la instalación y la otra se
// olvidaría.
//
// Es idempotente a propósito: llamarla dos veces no crea dos pedidos.
// Guardar dos veces con el estado en APROBADA hacía justamente eso, y el
// mismo negocio aparecía dos veces en el pipeline y en la plata del
// embudo.
// ============================================================

import { prisma } from "@/lib/prisma";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";
import { avisarInstalacionNueva } from "@/lib/instalaciones";
import { recalcularCliente } from "@/lib/estados-cliente-server";

export interface ResultadoAprobacion {
  /** El pedido que se creó, o null si ya existía. */
  pedidoNumero: string | null;
  yaTeniaPedido: boolean;
  /** Qué pasó con el aviso al coordinador de instalación. */
  avisoInstalacion?: string;
}

/**
 * Crea el pedido de una cotización recién aprobada y avisa a producción.
 *
 * NO cambia el estado de la cotización: eso lo hace quien llama, porque
 * cada puerta tiene sus propias validaciones antes de llegar aquí.
 *
 * `usuarioId` es nulo cuando aprueba el CLIENTE desde el enlace público:
 * ahí no hay sesión, y el log lo dice.
 */
export async function crearPedidoDeAprobacion(
  cotizacionId: string,
  usuarioId: string | null,
): Promise<ResultadoAprobacion> {
  const yaTiene = (await prisma.pedido.count({ where: { cotizacionId } })) > 0;
  if (yaTiene) return { pedidoNumero: null, yaTeniaPedido: true };

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    include: { items: true },
  });
  if (!cotizacion) return { pedidoNumero: null, yaTeniaPedido: false };

  // Consecutivo atómico compartido: aquí también estaba el `count + 1`
  // que repetía número si se borraba un pedido.
  const numero = await siguienteNumeroSeguro("PED");
  const pedido = await prisma.pedido.create({
    data: {
      numero,
      cotizacionId,
      clienteId: cotizacion.clienteId,
      vendedorId: cotizacion.vendedorId,
      estado: "NUEVO",
      origen: "COTIZACION",
      origenRef: cotizacion.numero,
      // La marca se hereda. Si no, el ensayo se cuela por la puerta de
      // atrás en cuanto alguien aprueba la oferta de prueba.
      esPrueba: cotizacion.esPrueba,
      tieneInstalacion: cotizacion.tieneInstalacion,
      total: cotizacion.total,
      items: {
        create: cotizacion.items.map(item => ({
          productoId: item.productoId,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          unidad: item.unidad,
          orden: item.orden,
        })),
      },
    },
  });

  let avisoInstalacion: string | undefined;

  // Venta cerrada con instalación: se crea la obra y se le avisa al
  // coordinador. Antes se enteraba cuando el cliente llamaba
  // preguntando cuándo van.
  //
  // Si el aviso falla NO se tumba la aprobación: el negocio ya se cerró y
  // perder eso por un correo sería absurdo. Queda en el log.
  if (cotizacion.tieneInstalacion) {
    const r = await avisarInstalacionNueva(pedido.id);
    avisoInstalacion = r.detalle;
    await prisma.log.create({
      data: {
        usuarioId,
        accion: "INSTALACION_AVISO_COORDINADOR",
        detalle: `${pedido.numero}: ${r.detalle}`,
        resultado: r.ok ? "OK" : "ERROR",
      },
    }).catch(() => undefined);
  }

  // Aprobar mueve al cliente a "cliente activo".
  await recalcularCliente(cotizacion.clienteId);

  return { pedidoNumero: pedido.numero, yaTeniaPedido: false, avisoInstalacion };
}
