// ============================================================
// Avisarle a alguien. Una sola puerta.
//
// Antes cada sitio hacía su `prisma.notificacion.create` a mano —doce
// sitios en nueve archivos— y eso tenía dos consecuencias feas:
//
//   · Ninguno mandaba push, así que el aviso solo existía dentro del
//     portal. Enganchar el push en doce sitios habría sido enganchar
//     once y olvidar uno, y ese uno sería el que importa.
//   · Cada uno decidía a su manera si escribir a una persona o a varias,
//     y qué poner en `data`.
//
// Ahora se pasa por aquí. La campanita del portal y el aviso del
// teléfono son la misma cosa dicha dos veces, y el que llegue con la app
// cerrada depende solo de si esa persona suscribió su navegador.
//
// ⚠️ El push NO puede tumbar la notificación. Si falla el envío —o si
// las claves VAPID ni siquiera están puestas— la fila ya está escrita y
// el aviso se ve igual al entrar al portal. Al revés sería cambiar un
// aviso que a veces no suena por uno que a veces no existe.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { TipoNotificacion } from "@prisma/client";
import { enviarPush } from "@/lib/push";

export interface Aviso {
  /** A quién. Uno o varios; si va vacío no se escribe nada. */
  usuarioId: string | string[] | null | undefined;
  /** SISTEMA por defecto. Es el que usan casi todos los avisos. */
  tipo?: TipoNotificacion;
  titulo: string;
  mensaje: string;
  /** Contexto para la pantalla. Va tal cual a la fila. */
  data?: Record<string, unknown>;
  /**
   * A dónde lleva el aviso al pulsarlo, dentro del portal.
   *
   * Importa más de lo que parece: un aviso del teléfono que abre la
   * portada obliga a buscar de qué hablaba. Uno que abre la cotización
   * exacta se resuelve sin pensar.
   */
  url?: string;
  /** Agrupa avisos del mismo asunto en el teléfono. */
  etiqueta?: string;
}

export interface ResultadoAviso {
  creadas: number;
  push: { aparatos: number; entregados: number; limpiados: number };
}

export async function notificar(aviso: Aviso): Promise<ResultadoAviso> {
  const ids = (Array.isArray(aviso.usuarioId) ? aviso.usuarioId : [aviso.usuarioId])
    .filter((x): x is string => Boolean(x));

  const r: ResultadoAviso = { creadas: 0, push: { aparatos: 0, entregados: 0, limpiados: 0 } };
  if (!ids.length) return r;

  for (const usuarioId of ids) {
    // La fila primero y por sí sola: es la que sobrevive a todo. Si el
    // push falla, el aviso sigue estando al entrar al portal.
    const creada = await prisma.notificacion.create({
      data: {
        tipo: aviso.tipo ?? "SISTEMA",
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        data: (aviso.data ?? {}) as never,
        usuarioId,
      },
    }).catch(() => null);
    if (creada) r.creadas++;

    const p = await enviarPush(usuarioId, {
      titulo: aviso.titulo,
      mensaje: aviso.mensaje,
      url: aviso.url,
      etiqueta: aviso.etiqueta,
    }).catch(() => null);

    if (p) {
      r.push.aparatos += p.aparatos;
      r.push.entregados += p.entregados;
      r.push.limpiados += p.limpiados;
    }
  }

  return r;
}
