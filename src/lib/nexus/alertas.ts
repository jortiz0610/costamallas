// ============================================================
// NEXUS — el aviso cuando se incumple el compromiso de la hora.
//
// `/nexus/tiempos` ya medía el compromiso, pero medir no avisa: había
// que acordarse de abrir la pantalla. Una conversación que entra a las
// 9 y nadie contesta se quedaba ahí hasta que alguien la viera.
//
// Corre dentro de `/api/cron/diario`, NO como cron propio: el plan
// Hobby de Vercel permite dos y los dos cupos están usados. Un cron de
// más no falla suave, rompe el deploy entero.
//
// ⚠️ Consecuencia de correr una vez al día: el aviso llega en la corrida
// siguiente, no al minuto 61. Para el compromiso de una hora eso es
// tarde, y no se puede arreglar desde el código — hace falta el plan Pro
// o un disparador externo. Lo que sí resuelve hoy es que nadie se entere
// NUNCA. La pantalla lo dice con todas las letras para que no se lea
// como una alarma en tiempo real, que es como se pierde la confianza en
// un indicador.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enviarCorreo, correoConfigurado } from "@/lib/correo";
import { getMarca } from "@/lib/marca";
import { getConfigTiempos, minutosHabiles } from "@/lib/nexus/tiempos";

export interface AccionAlerta {
  conversacionId: string;
  remitente: string;
  canal: string;
  esperandoMin: number;
  asignado: string | null;
  /** A quién se le avisó dentro del portal. */
  notificados: string[];
  correo: "enviado" | "sin-configurar" | "sin-destinatarios" | "fallo";
  detalle?: string;
}

export interface ResultadoAlertas {
  revisadas: number;
  vencidas: number;
  avisadas: number;
  yaAvisadas: number;
  compromisoMin: number;
  acciones: AccionAlerta[];
  correoConfigurado: boolean;
}

/**
 * Busca conversaciones que pasaron del compromiso sin primera respuesta
 * y avisa al asesor asignado y a los administradores.
 *
 * Nunca lanza hacia arriba nada que no sea un error de base: la corrida
 * diaria hace más cosas y perder los vencimientos por un correo caído
 * sería el peor intercambio posible.
 */
export async function alertarSinRespuesta(opciones: { dry?: boolean } = {}): Promise<ResultadoAlertas> {
  const dry = opciones.dry ?? false;
  const cfg = await getConfigTiempos();
  const ahora = new Date();

  // Solo lo que sigue esperando: sin primera respuesta, sin cerrar y sin
  // aviso previo. El sello es lo que evita repetir el mismo aviso cada
  // día hasta que alguien conteste.
  const abiertas = await prisma.nexusConversacion.findMany({
    where: {
      primeraRespuestaEn: null,
      estado: { not: "CERRADA" },
      alertaTiempoEn: null,
    },
    select: {
      id: true, canal: true, remitente: true, asunto: true,
      asignadoId: true, createdAt: true, etiquetas: true,
    },
    orderBy: { createdAt: "asc" },
    // Tope de cordura: si algún día hay mil sin responder, el problema no
    // se arregla mandando mil correos en una corrida.
    take: 100,
  });

  // Las que ya tienen sello pero siguen sin respuesta: se cuentan para
  // poder decir "hay 5 esperando, a 3 ya se avisó" en vez de dar a
  // entender que solo hay 2.
  const yaAvisadas = await prisma.nexusConversacion.count({
    where: { primeraRespuestaEn: null, estado: { not: "CERRADA" }, alertaTiempoEn: { not: null } },
  });

  const vencidas = abiertas
    .map(c => ({ c, esperandoMin: minutosHabiles(c.createdAt, ahora, cfg) }))
    .filter(x => x.esperandoMin > cfg.compromisoMin);

  const hayCorreo = await correoConfigurado();
  const acciones: AccionAlerta[] = [];

  if (!vencidas.length) {
    return {
      revisadas: abiertas.length,
      vencidas: 0,
      avisadas: 0,
      yaAvisadas,
      compromisoMin: cfg.compromisoMin,
      acciones,
      correoConfigurado: hayCorreo,
    };
  }

  // Los administradores reciben todos los avisos: es su indicador. Se
  // leen una sola vez para todo el lote, no una por conversación.
  const admins = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { id: true, nombre: true, email: true },
  });

  const asesores = await prisma.usuario.findMany({
    where: { id: { in: [...new Set(vencidas.map(v => v.c.asignadoId).filter(Boolean))] as string[] } },
    select: { id: true, nombre: true, email: true, activo: true },
  });
  const porId = new Map(asesores.map(a => [a.id, a]));

  const marca = await getMarca();

  for (const { c, esperandoMin } of vencidas) {
    const asesor = c.asignadoId ? porId.get(c.asignadoId) : undefined;
    const horas = Math.floor(esperandoMin / 60);
    const mins = esperandoMin % 60;
    const cuanto = horas ? `${horas} h ${mins} min` : `${mins} min`;

    const titulo = `Sin responder hace ${cuanto}: ${c.remitente}`;
    const cuerpo =
      `Una conversación de ${c.canal} lleva ${cuanto} de tiempo HÁBIL sin primera respuesta.\n` +
      `El compromiso son ${cfg.compromisoMin} minutos.\n\n` +
      `De: ${c.remitente}\n` +
      (c.asunto ? `Asunto: ${c.asunto}\n` : "") +
      `Entró: ${c.createdAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}\n` +
      `Asignada a: ${asesor?.nombre ?? "nadie"}\n` +
      (c.etiquetas.length ? `Etiquetas: ${c.etiquetas.join(", ")}\n` : "") +
      `\nSe cuenta solo el tiempo dentro del horario de atención ` +
      `(${cfg.horaInicio}:00 a ${cfg.horaFin}:00), así que lo que entra de noche no ` +
      `empieza a correr hasta que abre.`;

    // Destinatarios del portal: el asesor asignado y los administradores.
    // Sin duplicar si el asesor además es admin.
    const destinatariosPortal = new Set<string>();
    if (asesor?.activo) destinatariosPortal.add(asesor.id);
    for (const a of admins) destinatariosPortal.add(a.id);

    const correos = new Set<string>();
    if (asesor?.activo && asesor.email) correos.add(asesor.email);
    for (const a of admins) if (a.email) correos.add(a.email);

    let correo: AccionAlerta["correo"] = "sin-configurar";
    let detalle: string | undefined;

    if (!dry) {
      // La notificación del portal se crea SIEMPRE: no depende de que
      // haya correo. Es lo único que hoy funciona de verdad, porque el
      // SMTP sigue sin cargarse.
      for (const usuarioId of destinatariosPortal) {
        await prisma.notificacion
          .create({
            data: {
              tipo: "NEXUS_MENSAJE",
              usuarioId,
              titulo,
              mensaje: cuerpo,
              data: { conversacionId: c.id, esperandoMin, compromisoMin: cfg.compromisoMin },
            },
          })
          .catch(() => undefined);
      }

      if (!correos.size) {
        correo = "sin-destinatarios";
      } else if (!hayCorreo) {
        correo = "sin-configurar";
      } else {
        try {
          await enviarCorreo({
            para: [...correos],
            asunto: `[${marca.companyName}] ${titulo}`,
            html: plantilla(marca.companyName, titulo, cuerpo),
            texto: cuerpo,
          });
          correo = "enviado";
        } catch (e) {
          correo = "fallo";
          detalle = (e as Error).message;
        }
      }

      // El sello se pone aunque el correo no salga: la notificación del
      // portal SÍ quedó, y repetirla mañana no aporta nada. Si mañana se
      // configura el SMTP, las nuevas sí saldrán por correo.
      await prisma.nexusConversacion
        .update({ where: { id: c.id }, data: { alertaTiempoEn: new Date() } })
        .catch(() => undefined);
    } else {
      correo = !correos.size ? "sin-destinatarios" : hayCorreo ? "enviado" : "sin-configurar";
    }

    acciones.push({
      conversacionId: c.id,
      remitente: c.remitente,
      canal: c.canal,
      esperandoMin,
      asignado: asesor?.nombre ?? null,
      notificados: [...destinatariosPortal],
      correo,
      detalle,
    });
  }

  return {
    revisadas: abiertas.length,
    vencidas: vencidas.length,
    avisadas: dry ? 0 : vencidas.length,
    yaAvisadas,
    compromisoMin: cfg.compromisoMin,
    acciones,
    correoConfigurado: hayCorreo,
  };
}

const plantilla = (empresa: string, titulo: string, cuerpo: string) =>
  `<!doctype html><html lang="es"><body style="margin:0;background:#e9ecef;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff">
    <div style="background:#11110f;padding:24px 28px">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffdd00">${empresa}</p>
      <h1 style="margin:8px 0 0;font-size:20px;line-height:1.2;color:#fff;font-weight:900">${titulo}</h1>
    </div>
    <div style="height:4px;background:#ffdd00"></div>
    <div style="padding:24px 28px">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#2b2d29;white-space:pre-line">${cuerpo}</p>
    </div>
    <div style="padding:14px 28px;background:#11110f;color:rgba(255,255,255,.45);font-size:11px">Aviso automático del portal</div>
  </div></body></html>`;
