// ============================================================
// Recalcular el estado de los clientes contra la base.
//
// El cálculo en sí está en `estados-cliente.ts` y es puro. Aquí solo se
// reúnen las señales y se guarda el resultado.
//
// Se GUARDA (no se calcula al vuelo en cada consulta) porque el estado
// ordena y filtra la lista de clientes, alimenta el embudo y se exporta.
// Calcularlo en cada pantalla significaría cinco consultas por cliente
// cada vez que alguien abre el CRM.
//
// Cuándo se recalcula:
//   · Al crear o cambiar de estado una cotización (el cliente de esa
//     oferta, y solo ese).
//   · En la corrida diaria, todos. Es lo único que puede descubrir que
//     alguien lleva seis meses callado: el silencio no dispara eventos.
//   · A mano, con el botón de la pantalla de clientes.
// ============================================================

import { prisma } from "@/lib/prisma";
import {
  calcularEstadoCliente,
  COTIZACION_VIVA,
  PEDIDO_NO_CUENTA,
  type EstadoCliente,
} from "@/lib/estados-cliente";

export interface CambioDeEstado {
  clienteId: string;
  nombre: string;
  antes: string;
  despues: EstadoCliente;
  motivo: string;
}

export interface ResumenRecalculo {
  revisados: number;
  cambiados: number;
  cambios: CambioDeEstado[];
  /** Cuántos quedaron en cada estado, para poder mirarlo de un vistazo. */
  porEstado: Record<string, number>;
}

/**
 * Recalcula y guarda. Sin `clienteIds` recorre todos los clientes activos.
 *
 * `dry` calcula y devuelve el resultado SIN escribir. Es lo que usa la
 * corrida diaria en modo prueba y el script de verificación.
 */
export async function recalcularEstados(opciones?: {
  clienteIds?: string[];
  dry?: boolean;
  ahora?: Date;
}): Promise<ResumenRecalculo> {
  const { clienteIds, dry = false, ahora = new Date() } = opciones ?? {};

  const clientes = await prisma.cliente.findMany({
    where: clienteIds ? { id: { in: clienteIds } } : { activo: true },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      estado: true,
      createdAt: true,
      cotizaciones: {
        select: { estado: true, createdAt: true, updatedAt: true },
      },
      pedidos: { select: { createdAt: true, updatedAt: true, estado: true, cotizacionId: true } },
      // El chat cuenta como interacción: un cliente que escribe por
      // WhatsApp está tan vivo como uno que pide una cotización, y
      // dejarlo fuera lo mandaría a "inactivo" estando en conversación.
      conversaciones: { select: { updatedAt: true } },
    },
  });

  const cambios: CambioDeEstado[] = [];
  const porEstado: Record<string, number> = {};

  for (const c of clientes) {
    const fechas: Date[] = [
      ...c.cotizaciones.map(q => q.updatedAt),
      ...c.cotizaciones.map(q => q.createdAt),
      ...c.pedidos.map(p => p.updatedAt),
      ...c.conversaciones.map(v => v.updatedAt),
    ];
    const ultimaInteraccion = fechas.length
      ? new Date(Math.max(...fechas.map(f => f.getTime())))
      : null;

    const resultado = calcularEstadoCliente({
      tipo: c.tipo,
      creadoEn: c.createdAt,
      cotizacionesTotal: c.cotizaciones.length,
      cotizacionesAprobadas: c.cotizaciones.filter(q => q.estado === "APROBADA").length,
      cotizacionesVivas: c.cotizaciones.filter(q => COTIZACION_VIVA.has(q.estado)).length,
      // Solo los que NO vienen de una cotización: una cotización
      // aprobada crea su pedido sola, y contarlo aquí sería contar dos
      // veces el mismo negocio.
      pedidosGanados: c.pedidos.filter(
        p => !p.cotizacionId && !PEDIDO_NO_CUENTA.has(p.estado),
      ).length,
      ultimaInteraccion,
    }, ahora);

    porEstado[resultado.estado] = (porEstado[resultado.estado] ?? 0) + 1;

    if (resultado.estado !== c.estado) {
      cambios.push({
        clienteId: c.id,
        nombre: c.nombre,
        antes: c.estado,
        despues: resultado.estado,
        motivo: resultado.motivo,
      });
    }

    if (!dry) {
      await prisma.cliente.update({
        where: { id: c.id },
        data: {
          estado: resultado.estado,
          ultimaInteraccionEn: resultado.ultimaInteraccion,
          estadoCalculadoEn: ahora,
        },
      });
    }
  }

  return {
    revisados: clientes.length,
    cambiados: cambios.length,
    cambios,
    porEstado,
  };
}

/**
 * Atajo para un solo cliente, pensado para llamarse después de tocar una
 * cotización. Nunca revienta la operación que lo llamó: si esto falla,
 * lo peor que pasa es que el estado se corrija esta noche.
 */
export async function recalcularCliente(clienteId: string): Promise<void> {
  try {
    await recalcularEstados({ clienteIds: [clienteId] });
  } catch (e) {
    console.error("[estados-cliente] no se pudo recalcular", clienteId, e);
  }
}
