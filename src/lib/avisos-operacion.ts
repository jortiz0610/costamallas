// ============================================================
// Los dos correos de operación que nadie disparaba.
//
// Las plantillas «Visita técnica agendada», «Instalación agendada» y
// «Encuesta de satisfacción» llevaban meses escritas en
// lib/correo-plantillas.ts, con su texto revisado, y **sin una sola
// línea de código que las llamara**. El resultado práctico:
//
//   · Al cliente le agendaban una visita y se enteraba por WhatsApp, si
//     el asesor se acordaba. Cuando no, el técnico llegaba a una casa
//     donde no había nadie.
//   · La encuesta de satisfacción no se mandaba nunca. Hay una pantalla
//     entera para leer las respuestas y un formato de la empresa detrás,
//     y estaba midiendo el vacío.
//
// LAS TRES REGLAS QUE SIGUEN LOS DOS
//
//   1. **Horario hábil.** Un correo automático a las 3 de la mañana
//      dice más de quien lo manda que del mensaje. Se usa `esHabil()`
//      de lib/horario-habil.ts, igual que el seguimiento.
//   2. **Un sello por correo enviado**, no un estado. La pregunta no es
//      "en qué punto está la obra" sino "¿ya salió ESTE correo?".
//   3. **No se mira hacia atrás sin límite.** Es lo que evita el
//      desastre del primer día: sin esto, la primera corrida tras
//      desplegar mandaría una encuesta a cada cliente de los últimos
//      meses, todos a la vez. Ver `DIAS_HACIA_ATRAS`.
// ============================================================

import { prisma } from "@/lib/prisma";
import { esHabil, cuandoSaldra, describirCuando } from "@/lib/horario-habil";

/**
 * Cuántos días hacia atrás se consideran "pendientes".
 *
 * Esto NO es una optimización: es el seguro contra el primer arranque.
 * Los sellos nacen nulos, así que sin este límite todas las obras
 * cerradas de la historia parecerían pendientes de encuesta y saldrían
 * de golpe. Con tres días, lo que se perdió se queda perdido y solo se
 * atiende lo reciente, que es lo correcto: una encuesta de una obra de
 * hace dos meses no la contesta nadie y además queda raro.
 */
export const DIAS_HACIA_ATRAS = 3;

/** Cuántas horas después de firmar la entrega se pregunta. */
export const HORAS_PARA_ENCUESTA = 24;

export interface ResumenAviso {
  revisados: number;
  enviados: string[];
  /** Por qué se saltó cada una. Sale en la respuesta de la corrida. */
  omitidos: string[];
}

const vacio = (): ResumenAviso => ({ revisados: 0, enviados: [], omitidos: [] });

// ─────────────────────────────────────────────
// 1 · «Su visita queda para el martes a las 10»
// ─────────────────────────────────────────────

/**
 * Le confirma al cliente la fecha y la hora de su visita o instalación.
 *
 * Sale cuando alguien le pone fecha, no cuando se crea el trabajo: una
 * visita sin hora no es una cita y avisar de ella solo confunde.
 */
export async function avisarAgendados(
  opciones?: { dry?: boolean; ahora?: Date },
): Promise<ResumenAviso> {
  const ahora = opciones?.ahora ?? new Date();
  const r = vacio();

  const desde = new Date(ahora.getTime() - DIAS_HACIA_ATRAS * 86_400_000);

  const trabajos = await prisma.instalacion.findMany({
    where: {
      estado: "AGENDADA",
      avisoAgendadaEn: null,
      esPrueba: false,
      fechaAgendada: { not: null },
      // Solo lo agendado hace poco. Ver DIAS_HACIA_ATRAS.
      updatedAt: { gte: desde },
    },
    select: {
      id: true, tipo: true, fechaAgendada: true, direccion: true, ciudad: true,
      cliente: { select: { nombre: true, empresa: true, email: true } },
      vendedorId: true,
      pedido: {
        select: {
          numero: true, direccionEntrega: true,
          cliente: { select: { nombre: true, empresa: true, email: true } },
          vendedor: { select: { nombre: true, telefono: true } },
        },
      },
    },
    take: 50,
  });

  r.revisados = trabajos.length;
  if (!trabajos.length) return r;

  const { armarCorreo } = await import("@/lib/correo-plantillas-server");
  const { enviarCorreo } = await import("@/lib/correo");

  for (const t of trabajos) {
    const cli = t.cliente ?? t.pedido?.cliente ?? null;
    const quien = cli?.empresa || cli?.nombre || "el cliente";
    const cuando = t.fechaAgendada!;

    // La cita ya pasó: avisar ahora sería peor que callarse. Se sella
    // para no volver a mirarla en cada corrida.
    if (cuando < ahora) {
      r.omitidos.push(`${quien}: la fecha ya pasó`);
      if (!opciones?.dry) {
        await prisma.instalacion.update({
          where: { id: t.id }, data: { avisoAgendadaEn: ahora },
        }).catch(() => undefined);
      }
      continue;
    }

    if (!cli?.email) {
      r.omitidos.push(`${quien}: sin correo en el CRM`);
      continue;
    }

    // El horario manda. Si no toca, se deja para la próxima corrida y
    // se dice CUÁNDO va a salir: es la frase que evita el "¿por qué no
    // ha llegado?".
    if (!esHabil(ahora)) {
      r.omitidos.push(`${quien}: sale ${describirCuando(cuandoSaldra(ahora))}`);
      continue;
    }

    const esVisita = t.tipo === "VISITA";
    const donde = [t.direccion || t.pedido?.direccionEntrega, t.ciudad].filter(Boolean).join(", ");

    const correo = await armarCorreo(
      esVisita ? "visita_agendada" : "instalacion_agendada",
      {
        cliente: quien,
        contacto: cli.nombre,
        fecha: cuando.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }),
        hora: cuando.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }),
        direccion: donde || "la dirección acordada",
        asesor: t.pedido?.vendedor?.nombre ?? "",
        asesorTelefono: t.pedido?.vendedor?.telefono ?? "",
      },
    );

    if (opciones?.dry) {
      r.enviados.push(`${quien} (ensayo)`);
      continue;
    }

    try {
      await enviarCorreo({
        para: cli.email, asunto: correo.asunto, html: correo.html, texto: correo.texto,
      });
      // El sello va DESPUÉS del envío y solo si salió: si se pusiera
      // antes, un SMTP caído dejaría al cliente sin aviso y al portal
      // convencido de habérselo mandado.
      await prisma.instalacion.update({
        where: { id: t.id }, data: { avisoAgendadaEn: new Date() },
      });
      r.enviados.push(quien);
    } catch (e) {
      r.omitidos.push(`${quien}: ${(e as Error).message}`);
    }
  }

  return r;
}

// ─────────────────────────────────────────────
// 2 · La encuesta, 24 horas después de entregar
// ─────────────────────────────────────────────

/**
 * Manda la encuesta de satisfacción de las obras entregadas ayer.
 *
 * A las 24 horas y no al cerrar: preguntarle a alguien qué tal quedó
 * mientras el técnico todavía está recogiendo es preguntar por educación,
 * no por saber. Al día siguiente ya vio la obra con calma.
 */
export async function mandarEncuestasPendientes(
  opciones?: { dry?: boolean; ahora?: Date },
): Promise<ResumenAviso> {
  const ahora = opciones?.ahora ?? new Date();
  const r = vacio();

  const cumplidas = new Date(ahora.getTime() - HORAS_PARA_ENCUESTA * 3_600_000);
  const desde = new Date(ahora.getTime() - DIAS_HACIA_ATRAS * 86_400_000);

  const obras = await prisma.instalacion.findMany({
    where: {
      tipo: "INSTALACION",
      encuestaEnviadaEn: null,
      esPrueba: false,
      // Firmada hace más de 24 h, pero no hace más de tres días.
      firmadoEn: { lte: cumplidas, gte: desde },
      pedidoId: { not: null },
    },
    select: {
      id: true,
      pedido: { select: { numero: true, cliente: { select: { nombre: true, empresa: true, email: true } } } },
    },
    take: 30,
  });

  r.revisados = obras.length;
  if (!obras.length) return r;

  // El horario también vale aquí: la encuesta cumple sus 24 horas a la
  // hora que se firmó, que puede ser un sábado a las siete de la tarde.
  if (!esHabil(ahora)) {
    r.omitidos.push(`${obras.length} encuesta(s): salen ${describirCuando(cuandoSaldra(ahora))}`);
    return r;
  }

  const { enviarEncuesta } = await import("@/lib/postventa");

  for (const o of obras) {
    const quien = o.pedido?.cliente.empresa || o.pedido?.cliente.nombre || "cliente";

    if (opciones?.dry) {
      r.enviados.push(`${quien} (ensayo)`);
      continue;
    }

    const res = await enviarEncuesta(o.id);
    if (res.ok) {
      await prisma.instalacion.update({
        where: { id: o.id }, data: { encuestaEnviadaEn: new Date() },
      }).catch(() => undefined);
      r.enviados.push(`${quien} → ${res.destino}`);
    } else {
      // "Ya contestó" y "no tiene correo" NO son fallos que haya que
      // reintentar cada quince minutos: se sellan y se dejan en paz.
      const definitivo = /ya contestó|no tiene correo/i.test(res.error ?? "");
      if (definitivo) {
        await prisma.instalacion.update({
          where: { id: o.id }, data: { encuestaEnviadaEn: new Date() },
        }).catch(() => undefined);
      }
      r.omitidos.push(`${quien}: ${res.error}`);
    }
  }

  return r;
}
