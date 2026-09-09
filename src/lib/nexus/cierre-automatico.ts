// ============================================================
// Cerrar solos los chats de la web que quedaron abiertos.
//
// POR QUÉ EXISTE — y no es limpieza de bandeja
// --------------------------------------------
// Al cliente le llega la conversación completa por correo **cuando se
// cierra el chat**. Es la decisión de gerencia y está bien pensada:
// durante la charla el cliente ve las respuestas en la propia ventana,
// y mandarle un correo por cada frase le llenaría el buzón.
//
// Pero deja un agujero que nadie ve desde dentro: **un chat que nadie
// cierra nunca manda la copia**. El asesor contesta, resuelve, y deja
// la conversación abierta en su bandeja porque no cuesta nada dejarla
// ahí. El cliente se queda sin su registro escrito de las medidas y los
// precios que le dieron — que es justo lo que vuelve a mirar cuando
// decide comprar, tres días después.
//
// Así que esto NO es "ordenar la bandeja": es el disparador que hace
// que la copia salga siempre. Cerrar es el efecto secundario.
//
// LO QUE NO HACE
// --------------
//   · **Solo toca el canal WEB.** Un chat de WhatsApp no tiene copia
//     que mandar —el cliente ya la tiene en su propio teléfono— y
//     cerrárselo solo sería quitarle una conversación viva de la
//     bandeja a alguien.
//   · **No cierra lo que nadie ha contestado.** Si un chat lleva dos
//     días abierto y sin una sola respuesta humana, el problema no es
//     que esté abierto: es que a esa persona no la atendió nadie.
//     Cerrarlo lo taparía, y encima le mandaría una "copia" de una
//     conversación en la que la empresa no dijo nada.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getConfigAgenteWeb } from "@/lib/agente-web/config";
import { enviarCopiaConversacion } from "@/lib/nexus/copia-chat";

export interface ResumenCierre {
  /** Cuántas horas de silencio se están exigiendo. 0 = apagado. */
  horas: number;
  revisadas: number;
  cerradas: string[];
  /** Cerradas pero sin copia (sin correo, o el envío falló). */
  sinCopia: string[];
  omitidas: string[];
}

export async function cerrarChatsDormidos(
  opciones?: { dry?: boolean; ahora?: Date },
): Promise<ResumenCierre> {
  const ahora = opciones?.ahora ?? new Date();
  const cfg = await getConfigAgenteWeb();
  const r: ResumenCierre = {
    horas: cfg.horasParaCerrar, revisadas: 0, cerradas: [], sinCopia: [], omitidas: [],
  };

  if (!cfg.horasParaCerrar) return r;

  const limite = new Date(ahora.getTime() - cfg.horasParaCerrar * 3_600_000);

  const conversaciones = await prisma.nexusConversacion.findMany({
    where: {
      canal: "WEB",
      estado: { notIn: ["CERRADA", "ARCHIVADA"] },
      // Alguien de la empresa contestó: si no, esto no es un chat
      // olvidado, es una persona desatendida. Ver la cabecera.
      primeraRespuestaEn: { not: null },
    },
    select: {
      id: true, remitente: true, emailRemit: true,
      mensajes: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 100,
  });

  for (const c of conversaciones) {
    // El silencio se mide por el ÚLTIMO MENSAJE, no por `updatedAt`: la
    // fila se toca al marcarla leída, al asignarla o al etiquetarla, y
    // ninguna de esas cosas es que la conversación siga viva.
    const ultimo = c.mensajes[0]?.createdAt;
    if (!ultimo || ultimo > limite) continue;

    r.revisadas++;
    const quien = c.remitente || "visitante";

    if (opciones?.dry) {
      r.cerradas.push(`${quien} (ensayo)`);
      continue;
    }

    // La copia va ANTES de cerrar, y el cierre no depende de que salga.
    // Al revés —cerrar y luego intentar la copia— dejaría chats
    // cerrados sin copia si el correo falla, y ya no habría forma de
    // saber cuáles fueron.
    const copia = await enviarCopiaConversacion(c.id).catch(() => ({ ok: false, motivo: "falló el envío" }));

    await prisma.nexusConversacion.update({
      where: { id: c.id },
      data: { estado: "CERRADA" },
    });

    if (copia.ok) r.cerradas.push(quien);
    else {
      r.cerradas.push(quien);
      r.sinCopia.push(`${quien}: ${("motivo" in copia && copia.motivo) || "sin correo"}`);
    }
  }

  return r;
}
