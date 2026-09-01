// ============================================================
// La limpieza de la casa, una vez al día.
//
// Tres tablas crecen solas y nadie las mira nunca:
//
//   · `refresh_tokens`. Hoy hay 72 y **56 están vencidos**. Un token
//     vencido no sirve para entrar —eso lo impide la fecha— pero
//     guardarlos para siempre es acumular credenciales muertas sin
//     ningún motivo. Si mañana alguien saca una copia de la base, la
//     lista de sesiones de todo el año está ahí.
//   · `notificaciones` ya leídas. La campana tiene 82 y **75 sin leer**:
//     el problema no es el espacio, es que una campana con 75 números
//     rojos deja de significar nada. Borrar las viejas ya leídas es lo
//     mínimo; que dejen de generarse tantas es otra conversación.
//   · `logs`. Son la auditoría, así que se conservan MUCHO más tiempo
//     que lo demás: un año. Lo que se va es lo de antes de eso.
//
// No es una tarea de espacio —la base entera cabe en un correo— es de
// higiene: cuanto menos ruido guarde el portal, más fácil es ver lo que
// sí importa.
//
// Todo tiene `dry` porque se dispara desde la corrida diaria, y esa
// corrida se prueba en seco antes de dejarla suelta.
// ============================================================

import { prisma } from "@/lib/prisma";

const DIA = 86_400_000;

/** Cuánto se guarda cada cosa. En días. */
export const RETENCION = {
  /** Un token vencido no vale para nada al segundo siguiente. */
  tokensVencidos: 0,
  /** Una notificación leída de hace un mes ya cumplió su trabajo. */
  notificacionesLeidas: 30,
  /** La auditoría se conserva un año: es a lo que se recurre cuando hay
   *  que explicar qué pasó, y eso se pregunta meses después. */
  logs: 365,
  /** El historial de sincronizaciones con la tienda. */
  syncWoo: 90,
};

export interface ResumenLimpieza {
  tokensVencidos: number;
  notificacionesLeidas: number;
  logs: number;
  syncWoo: number;
  total: number;
}

export async function limpiar(opciones: { dry?: boolean } = {}): Promise<ResumenLimpieza> {
  const dry = opciones.dry ?? false;
  const antesDe = (dias: number) => new Date(Date.now() - dias * DIA);

  const donde = {
    tokens: { expiresAt: { lt: new Date() } },
    notificaciones: { leida: true, createdAt: { lt: antesDe(RETENCION.notificacionesLeidas) } },
    logs: { createdAt: { lt: antesDe(RETENCION.logs) } },
    // Esta tabla no tiene createdAt: se sella con startedAt.
    sync: { startedAt: { lt: antesDe(RETENCION.syncWoo) } },
  };

  const [tokensVencidos, notificacionesLeidas, logs, syncWoo] = await Promise.all([
    prisma.refreshToken.count({ where: donde.tokens }),
    prisma.notificacion.count({ where: donde.notificaciones }),
    prisma.log.count({ where: donde.logs }),
    prisma.wooCommerceSync.count({ where: donde.sync }),
  ]);

  if (!dry) {
    // En serie y no en paralelo: son cuatro borrados pequeños y contra
    // el pooler de Supabase cuatro conexiones a la vez para esto no
    // compensa el riesgo de quedarse sin cupo.
    await prisma.refreshToken.deleteMany({ where: donde.tokens });
    await prisma.notificacion.deleteMany({ where: donde.notificaciones });
    await prisma.log.deleteMany({ where: donde.logs });
    await prisma.wooCommerceSync.deleteMany({ where: donde.sync });
  }

  return {
    tokensVencidos,
    notificacionesLeidas,
    logs,
    syncWoo,
    total: tokensVencidos + notificacionesLeidas + logs + syncWoo,
  };
}
