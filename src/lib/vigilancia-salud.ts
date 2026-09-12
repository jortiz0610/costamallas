// ============================================================
// Que el portal avise cuando algo suyo se rompe.
//
// EL PROBLEMA QUE RESUELVE
// ------------------------
// Ya existía todo lo necesario y aun así nadie se enteraba:
//
//   · `revisarSalud()` calcula el semáforo y acierta.
//   · `/sistema/salud` lo pinta bien.
//   · `notificar()` sabe mandar aviso interno y push al teléfono.
//
// Lo que faltaba era que alguien los presentara. La copia del respaldo
// fuera de la máquina llevaba CUATRO DÍAS fallando todas las noches; el
// portal lo sabía —lo decía en su pantalla de salud— pero esa pantalla
// hay que ir a abrirla, y nadie fue. Un sistema que solo se queja cuando
// le preguntan no está vigilado: está esperando a que alguien tenga la
// corazonada.
//
// LO QUE NO HACE: avisar todos los días de lo mismo.
//
// Un aviso que se repite cada mañana deja de leerse a la tercera, y
// entonces vuelve a no haber vigilancia — pero con ruido. Por eso se
// recuerda de qué se avisó y solo se vuelve a avisar cuando algo CAMBIA:
// aparece un problema nuevo, o empeora. Si sigue igual, se calla, y se
// insiste una vez por semana para que no se olvide del todo.
//
// Que un problema se ARREGLE también se avisa, una vez. Sin eso nadie
// sabe si lo que hizo sirvió.
// ============================================================

import { prisma } from "@/lib/prisma";
import { revisarSalud, type Nivel, type Comprobacion } from "@/lib/salud";
import { notificar } from "@/lib/notificar";

/** Dónde se recuerda de qué se avisó la última vez. */
const CLAVE = "vigilancia_salud";

/** Aunque no cambie nada, se recuerda una vez por semana. */
const DIAS_PARA_INSISTIR = 7;

/** Solo estos niveles molestan a nadie. Un servicio apagado a propósito
 *  —la IA, por ejemplo— no es una avería. */
const PREOCUPAN: Nivel[] = ["problema", "aviso"];

interface Memoria {
  /** Claves de las comprobaciones que estaban mal, y con qué nivel. */
  malas: Record<string, Nivel>;
  /** Cuándo se avisó por última vez. */
  avisadoEn: string;
}

async function leerMemoria(): Promise<Memoria> {
  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE } });
  if (!fila?.valor) return { malas: {}, avisadoEn: "" };
  try {
    const m = JSON.parse(fila.valor) as Memoria;
    return { malas: m.malas ?? {}, avisadoEn: m.avisadoEn ?? "" };
  } catch {
    // Un JSON corrupto no puede dejar el portal sin vigilancia: se
    // empieza de cero y el próximo aviso lo reconstruye.
    return { malas: {}, avisadoEn: "" };
  }
}

async function guardarMemoria(m: Memoria) {
  await prisma.configuracion.upsert({
    where: { clave: CLAVE },
    create: {
      clave: CLAVE,
      valor: JSON.stringify(m),
      descripcion: "De qué se avisó la última vez, para no repetir el mismo aviso cada día.",
    },
    update: { valor: JSON.stringify(m) },
  }).catch(() => undefined);
}

export interface ResultadoVigilancia {
  resumen: Nivel;
  /** Cuántas comprobaciones están mal ahora. */
  malas: number;
  /** Se mandó aviso, y por qué. */
  aviso: null | { motivo: "nuevo" | "empeora" | "recordatorio" | "resuelto"; a: number };
  /** Para el registro del cron. */
  detalle: string[];
}

/**
 * Revisa el portal y avisa a los administradores si hace falta.
 *
 * Se llama desde el cron diario. Devuelve qué hizo, para que quede en el
 * registro de la corrida aunque no haya mandado nada.
 */
export async function vigilarSalud(opciones?: { dry?: boolean }): Promise<ResultadoVigilancia> {
  const salud = await revisarSalud();

  const malasAhora: Record<string, Nivel> = {};
  const problemas: Comprobacion[] = [];
  for (const c of salud.comprobaciones) {
    if (!PREOCUPAN.includes(c.nivel)) continue;
    malasAhora[c.clave] = c.nivel;
    problemas.push(c);
  }

  const memoria = await leerMemoria();
  const antes = memoria.malas;

  // ¿Qué cambió?
  const nuevas = problemas.filter(c => !antes[c.clave]);
  const empeoradas = problemas.filter(
    c => antes[c.clave] && antes[c.clave] === "aviso" && c.nivel === "problema",
  );
  const arregladas = Object.keys(antes).filter(k => !malasAhora[k]);

  const diasDesdeAviso = memoria.avisadoEn
    ? (Date.now() - new Date(memoria.avisadoEn).getTime()) / 86400000
    : Infinity;
  const tocaRecordar = problemas.length > 0 && diasDesdeAviso >= DIAS_PARA_INSISTIR;

  const detalle = [
    `semáforo: ${salud.resumen}`,
    `con problema: ${problemas.length}`,
    ...(nuevas.length ? [`nuevas: ${nuevas.map(c => c.clave).join(", ")}`] : []),
    ...(arregladas.length ? [`arregladas: ${arregladas.join(", ")}`] : []),
  ];

  // ── ¿Hay que decir algo? ──
  let motivo: "nuevo" | "empeora" | "recordatorio" | "resuelto" | null = null;
  if (nuevas.length) motivo = "nuevo";
  else if (empeoradas.length) motivo = "empeora";
  else if (arregladas.length && problemas.length === 0) motivo = "resuelto";
  else if (tocaRecordar) motivo = "recordatorio";

  if (!motivo) {
    detalle.push("sin novedad: no se avisa");
    if (!opciones?.dry) await guardarMemoria({ malas: malasAhora, avisadoEn: memoria.avisadoEn });
    return { resumen: salud.resumen, malas: problemas.length, aviso: null, detalle };
  }

  // A quién. Esto es cosa de quien administra el portal, no del equipo
  // comercial: a un asesor no le sirve de nada saber que falla el SMTP.
  const admins = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { id: true },
  });

  if (!admins.length) {
    detalle.push("⚠ no hay ningún administrador activo a quien avisar");
    return { resumen: salud.resumen, malas: problemas.length, aviso: null, detalle };
  }

  const titulo = motivo === "resuelto"
    ? "El portal volvió a estar en orden"
    : problemas.length === 1
      ? `Revisar: ${problemas[0].titulo}`
      : `${problemas.length} cosas del portal necesitan revisión`;

  // El mensaje dice QUÉ pasa, no "hay un problema". Un aviso que obliga
  // a entrar para saber de qué habla se pospone.
  const mensaje = motivo === "resuelto"
    ? "Lo que estaba fallando ya está resuelto."
    : problemas.slice(0, 3).map(c => `· ${c.titulo}: ${c.detalle}`).join("\n")
      + (problemas.length > 3 ? `\n· y ${problemas.length - 3} más` : "");

  if (!opciones?.dry) {
    await notificar({
      usuarioId: admins.map(a => a.id),
      tipo: "SISTEMA",
      titulo,
      mensaje,
      url: "/sistema/salud",
      // La etiqueta hace que un aviso nuevo REEMPLACE al anterior en el
      // teléfono en vez de apilarse: cinco notificaciones de lo mismo
      // son cinco motivos para silenciar el portal.
      etiqueta: "salud-portal",
    }).catch(() => undefined);

    await guardarMemoria({ malas: malasAhora, avisadoEn: new Date().toISOString() });
  }

  detalle.push(`avisado (${motivo}) a ${admins.length} administrador(es)`);
  return {
    resumen: salud.resumen,
    malas: problemas.length,
    aviso: { motivo, a: admins.length },
    detalle,
  };
}
