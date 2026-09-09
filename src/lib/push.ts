// ============================================================
// Avisos que llegan con el portal CERRADO.
//
// POR QUÉ EXISTE
// --------------
// Las notificaciones del portal solo se veían con la pestaña abierta o
// en segundo plano. Eso deja fuera justo el caso que importa: el asesor
// que está en la calle y al que acaban de aprobarle una oferta, o el
// que lleva dos días sin abrir el portal mientras su visita técnica ya
// volvió de producción.
//
// Esto es push de verdad: el navegador queda suscrito y el aviso llega
// aunque nadie tenga nada abierto.
//
// CÓMO FUNCIONA, EN CORTO
//   · Cada NAVEGADOR se suscribe y guarda su `endpoint` en la base. La
//     misma persona tiene el teléfono y el computador: son dos filas.
//   · El servidor firma cada envío con la clave VAPID privada. La
//     pública la lleva el navegador al suscribirse; si no coinciden, el
//     servicio de push rechaza el aviso.
//   · El contenido va CIFRADO de extremo a extremo con las claves del
//     propio navegador. Ni Google ni Apple pueden leerlo.
//
// LO QUE HAY QUE VIGILAR: LOS APARATOS MUERTOS
// --------------------------------------------
// Una suscripción caduca sola —el usuario reinstala el navegador, borra
// los datos del sitio, cambia de teléfono— y el servicio de push
// responde 404 o 410. Si esas filas no se limpian, cada aviso se queda
// esperando a endpoints que nunca van a contestar, y avisar a cinco
// personas empieza a tardar medio minuto.
//
// Por eso 404 y 410 borran la fila EN EL ACTO, y cualquier otro fallo
// suma uno al contador: a los tres seguidos, fuera. Un fallo aislado
// —una caída del servicio de Google— no le quita el aviso a nadie.
// ============================================================

import { prisma } from "@/lib/prisma";

export interface AvisoPush {
  titulo: string;
  mensaje: string;
  /** A dónde lleva al pulsarlo. Ruta del portal, sin dominio. */
  url?: string;
  /** Agrupa avisos del mismo asunto: el nuevo reemplaza al anterior. */
  etiqueta?: string;
}

export interface ResultadoPush {
  /** Cuántos navegadores tenían suscripción. */
  aparatos: number;
  entregados: number;
  /** Suscripciones borradas por estar muertas. */
  limpiados: number;
  fallos: string[];
}

/** ¿Están puestas las claves? Sin ellas esto no existe, y hay que decirlo. */
export function pushConfigurado(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function clavePublicaPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Manda un aviso a todos los aparatos de una persona.
 *
 * No lanza nunca. La llaman los sitios que crean notificaciones, y que
 * falle un push no puede impedir que se apruebe una oferta ni que
 * producción entregue una visita.
 */
export async function enviarPush(
  usuarioId: string,
  aviso: AvisoPush,
): Promise<ResultadoPush> {
  const r: ResultadoPush = { aparatos: 0, entregados: 0, limpiados: 0, fallos: [] };
  if (!pushConfigurado()) {
    r.fallos.push("Faltan las claves VAPID.");
    return r;
  }

  const suscripciones = await prisma.suscripcionPush.findMany({
    where: { usuarioId },
    select: { id: true, endpoint: true, p256dh: true, auth: true, fallos: true },
  });
  r.aparatos = suscripciones.length;
  if (!suscripciones.length) return r;

  // Import dinámico: `web-push` trae criptografía de node y no tiene por
  // qué cargarse en cada petición del portal.
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    // El "subject" tiene que ser un mailto o una URL: es a quién avisa
    // el servicio de push si nuestros envíos dan problemas.
    process.env.VAPID_SUBJECT || "mailto:sistemas@esek.com.co",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const carga = JSON.stringify({
    titulo: aviso.titulo,
    mensaje: aviso.mensaje,
    url: aviso.url ?? "/",
    etiqueta: aviso.etiqueta,
  });

  await Promise.all(suscripciones.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        carga,
        // Si el aparato está apagado, el servicio guarda el aviso. Un día
        // es suficiente: un aviso de trabajo de hace tres días ya no es
        // un aviso, es ruido.
        { TTL: 86_400 },
      );
      r.entregados++;
      await prisma.suscripcionPush.update({
        where: { id: s.id },
        data: { ultimoUsoEn: new Date(), fallos: 0 },
      }).catch(() => undefined);
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode;

      // 404 y 410 son definitivos: ese navegador ya no existe. Borrar en
      // el acto es lo que impide que la lista se llene de fantasmas.
      if (codigo === 404 || codigo === 410) {
        await prisma.suscripcionPush.delete({ where: { id: s.id } }).catch(() => undefined);
        r.limpiados++;
        return;
      }

      const fallos = s.fallos + 1;
      if (fallos >= 3) {
        await prisma.suscripcionPush.delete({ where: { id: s.id } }).catch(() => undefined);
        r.limpiados++;
      } else {
        await prisma.suscripcionPush.update({
          where: { id: s.id }, data: { fallos },
        }).catch(() => undefined);
      }
      r.fallos.push(`${codigo ?? "?"}: ${(e as Error).message}`.slice(0, 120));
    }
  }));

  return r;
}

/** Guarda o actualiza la suscripción de un navegador. */
export async function guardarSuscripcion(datos: {
  usuarioId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  agente?: string | null;
}): Promise<void> {
  // `upsert` por endpoint: volver a suscribirse en el mismo navegador
  // tiene que actualizar la fila, no crear otra. Y si el aparato cambió
  // de dueño —un computador compartido—, el usuarioId se corrige.
  await prisma.suscripcionPush.upsert({
    where: { endpoint: datos.endpoint },
    create: {
      usuarioId: datos.usuarioId,
      endpoint: datos.endpoint,
      p256dh: datos.p256dh,
      auth: datos.auth,
      agente: datos.agente?.slice(0, 300) ?? null,
    },
    update: {
      usuarioId: datos.usuarioId,
      p256dh: datos.p256dh,
      auth: datos.auth,
      agente: datos.agente?.slice(0, 300) ?? null,
      fallos: 0,
    },
  });
}

export async function borrarSuscripcion(endpoint: string): Promise<void> {
  await prisma.suscripcionPush.deleteMany({ where: { endpoint } });
}
