// ============================================================
// Las cosas que el portal hace solo, sin que nadie las pida.
//
// Cinco tareas que salieron de mirar los datos reales, no de imaginar
// qué estaría bien. Cada una ataca un número concreto que se midió:
//
//   · 17 cotizaciones en borrador, algunas de hace semanas, que no
//     disparan NADA: el seguimiento arranca al enviar.
//   · 15 de 39 clientes sin asesor: no entran en el pipeline de nadie,
//     así que nadie los persigue.
//   · Clientes que llevan meses callados y pasan a inactivo sin que a
//     nadie le dé tiempo de reaccionar.
//   · Gerencia sin un resumen de la semana, teniendo los datos.
//   · Y la que descubre que las demás se cayeron.
//
// Todas aceptan `dry`: la corrida se prueba en seco antes de soltarla.
// Ninguna revienta la corrida si falla — se llaman desde el cron con su
// propio try, porque perder el vencimiento de cotizaciones por un
// recordatorio que no salió sería absurdo.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enviarCorreo, correoConfigurado } from "@/lib/correo";
import { urlPortal } from "@/lib/url-portal";
import { getMarca } from "@/lib/marca";

const DIA = 86_400_000;

// ─────────────────────────────────────────────
// 1 · El vigilante del reloj
// ─────────────────────────────────────────────

/** Dónde se apunta que la corrida pasó por aquí. */
export const CLAVE_LATIDO = "cron_ultimo_latido";

/**
 * Cuántas horas de silencio se toleran antes de dar la alarma.
 *
 * 26 y no 24: la corrida diaria se dispara a una hora fija y GitHub
 * Actions se retrasa cuando hay cola. Un margen de dos horas evita la
 * falsa alarma diaria, que es lo que hace que la gente desactive las
 * alarmas.
 */
export const HORAS_SIN_LATIDO = 26;

export async function apuntarLatido(): Promise<void> {
  const ahora = new Date().toISOString();
  await prisma.configuracion.upsert({
    where: { clave: CLAVE_LATIDO },
    create: { clave: CLAVE_LATIDO, valor: ahora, descripcion: "Última vez que corrió la automatización" },
    update: { valor: ahora },
  }).catch(() => { /* que no tumbe la corrida */ });
}

export interface EstadoReloj {
  ultimoLatido: string | null;
  horasSinCorrer: number | null;
  callado: boolean;
}

export async function estadoReloj(): Promise<EstadoReloj> {
  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE_LATIDO } });
  if (!fila?.valor) return { ultimoLatido: null, horasSinCorrer: null, callado: true };
  const t = new Date(fila.valor).getTime();
  if (Number.isNaN(t)) return { ultimoLatido: null, horasSinCorrer: null, callado: true };
  const horas = (Date.now() - t) / 3600_000;
  return {
    ultimoLatido: fila.valor,
    horasSinCorrer: Math.round(horas * 10) / 10,
    callado: horas > HORAS_SIN_LATIDO,
  };
}

// ─────────────────────────────────────────────
// 2 · Borradores parados
// ─────────────────────────────────────────────

/** A partir de cuántos días un borrador se considera olvidado. */
export const DIAS_BORRADOR_PARADO = 3;

export interface ResumenBorradores {
  revisados: number;
  avisados: { numero: string; cliente: string; dias: number; asesor: string }[];
}

/**
 * Una cotización en BORRADOR no dispara nada: el reloj del seguimiento
 * arranca al ENVIARLA. Así que un borrador olvidado es trabajo hecho que
 * no llegó a existir para el cliente — y no hay nada en el portal que lo
 * saque a la luz.
 *
 * Se avisa UNA vez por borrador (sello en `metadata`), no todos los días:
 * un recordatorio que se repite se convierte en ruido a la tercera vez.
 */
export async function avisarBorradoresParados(
  opciones: { dry?: boolean } = {},
): Promise<ResumenBorradores> {
  const dry = opciones.dry ?? false;
  const corte = new Date(Date.now() - DIAS_BORRADOR_PARADO * DIA);

  const borradores = await prisma.cotizacion.findMany({
    where: {
      estado: "BORRADOR",
      esPrueba: false,
      updatedAt: { lt: corte },
      vendedorId: { not: null },
    },
    select: {
      id: true, numero: true, updatedAt: true, total: true,
      cliente: { select: { nombre: true, empresa: true } },
      vendedor: { select: { id: true, nombre: true } },
      seguimientos: { select: { id: true }, take: 1 },
    },
  });

  // Los que ya recibieron su aviso llevan una notificación con su id.
  const yaAvisados = new Set(
    (await prisma.notificacion.findMany({
      where: { titulo: { startsWith: "Borrador parado" } },
      select: { data: true },
    })).map(n => (n.data as { cotizacionId?: string } | null)?.cotizacionId).filter(Boolean) as string[],
  );

  const avisados: ResumenBorradores["avisados"] = [];

  for (const c of borradores) {
    if (yaAvisados.has(c.id) || !c.vendedor) continue;
    const dias = Math.floor((Date.now() - c.updatedAt.getTime()) / DIA);
    avisados.push({
      numero: c.numero,
      cliente: c.cliente.empresa || c.cliente.nombre,
      dias,
      asesor: c.vendedor.nombre,
    });

    if (!dry) {
      await prisma.notificacion.create({
        data: {
          tipo: "SISTEMA",
          usuarioId: c.vendedor.id,
          titulo: `Borrador parado · ${c.numero}`,
          mensaje: `Lleva ${dias} días sin tocarse y el cliente no la ha visto: un borrador no se envía solo. Mándala o descártala.`,
          data: { cotizacionId: c.id },
        },
      }).catch(() => undefined);
    }
  }

  return { revisados: borradores.length, avisados };
}

// ─────────────────────────────────────────────
// 3 · Repartir los clientes sin asesor
// ─────────────────────────────────────────────

export interface ResumenReparto {
  sinAsesor: number;
  asignados: { cliente: string; asesor: string }[];
  motivo?: string;
}

/**
 * Un cliente sin asesor lo ve todo el mundo —eso es deliberado, si no
 * los que entran por la web serían invisibles— pero no está en el
 * pipeline de nadie, así que nadie lo persigue.
 *
 * Se reparten por TURNO entre los vendedores activos, empezando por el
 * que menos tiene. Repartir a partes iguales sin mirar la carga actual
 * es lo que hace que el que ya iba cargado acabe con el doble.
 */
export async function repartirClientesSinAsesor(
  opciones: { dry?: boolean; maxPorCorrida?: number } = {},
): Promise<ResumenReparto> {
  const dry = opciones.dry ?? false;
  // Un tope por corrida: si un día entran 200 leads de una campaña, no
  // conviene repartirlos todos de golpe sin que nadie lo mire.
  const tope = opciones.maxPorCorrida ?? 25;

  const vendedores = await prisma.usuario.findMany({
    where: { activo: true, rol: "VENDEDOR" },
    select: { id: true, nombre: true, _count: { select: { clientesAsignados: true } } },
  });

  if (!vendedores.length) {
    return { sinAsesor: 0, asignados: [], motivo: "No hay vendedores activos a quién asignar." };
  }

  const huerfanos = await prisma.cliente.findMany({
    where: { activo: true, vendedorId: null },
    select: { id: true, nombre: true, createdAt: true },
    orderBy: { createdAt: "asc" }, // los más viejos primero: llevan más esperando
    take: tope,
  });

  // Carga viva, para que dentro de la misma corrida el reparto siga
  // siendo equilibrado.
  const carga = new Map(vendedores.map(v => [v.id, v._count.clientesAsignados]));
  const asignados: ResumenReparto["asignados"] = [];

  for (const c of huerfanos) {
    const elegido = vendedores.reduce((menor, v) =>
      (carga.get(v.id) ?? 0) < (carga.get(menor.id) ?? 0) ? v : menor,
    );
    carga.set(elegido.id, (carga.get(elegido.id) ?? 0) + 1);
    asignados.push({ cliente: c.nombre, asesor: elegido.nombre });

    if (!dry) {
      await prisma.cliente.update({ where: { id: c.id }, data: { vendedorId: elegido.id } });
      await prisma.notificacion.create({
        data: {
          tipo: "SISTEMA",
          usuarioId: elegido.id,
          titulo: `Cliente nuevo asignado · ${c.nombre}`,
          mensaje: "Entró sin asesor y se te asignó por turno. Revísalo cuando puedas.",
          data: { clienteId: c.id },
        },
      }).catch(() => undefined);
    }
  }

  return {
    sinAsesor: await prisma.cliente.count({ where: { activo: true, vendedorId: null } }),
    asignados,
  };
}

// ─────────────────────────────────────────────
// 4 · Clientes que se están enfriando
// ─────────────────────────────────────────────

/** Un mes antes de que el cálculo los pase a INACTIVO (que son 6 meses). */
export const MESES_PARA_ENFRIARSE = 5;

export interface ResumenEnfriandose {
  encontrados: number;
  avisados: { cliente: string; asesor: string; dias: number }[];
}

/**
 * A los 6 meses de silencio el cliente pasa a INACTIVO solo. El problema
 * es que para entonces ya se perdió: nadie se enteró de que se estaba
 * yendo.
 *
 * Esto avisa un mes antes, que es cuando todavía se puede hacer algo.
 * Recuperar a alguien que ya compró es más barato que conseguir a
 * alguien nuevo.
 */
export async function avisarClientesEnfriandose(
  opciones: { dry?: boolean } = {},
): Promise<ResumenEnfriandose> {
  const dry = opciones.dry ?? false;

  const desde = new Date();
  desde.setMonth(desde.getMonth() - MESES_PARA_ENFRIARSE - 1);
  const hasta = new Date();
  hasta.setMonth(hasta.getMonth() - MESES_PARA_ENFRIARSE);

  const enfriandose = await prisma.cliente.findMany({
    where: {
      activo: true,
      // Solo los que ALGUNA VEZ compraron: a un prospecto que nunca
      // contestó no se le "recupera", se le deja en publicidad.
      estado: { in: ["CLIENTE_ACTIVO", "VIP"] },
      ultimaInteraccionEn: { gte: desde, lt: hasta },
      vendedorId: { not: null },
    },
    select: {
      id: true, nombre: true, empresa: true, ultimaInteraccionEn: true,
      vendedor: { select: { id: true, nombre: true } },
    },
  });

  const yaAvisados = new Set(
    (await prisma.notificacion.findMany({
      where: { titulo: { startsWith: "Se está enfriando" } },
      select: { data: true },
    })).map(n => (n.data as { clienteId?: string } | null)?.clienteId).filter(Boolean) as string[],
  );

  const avisados: ResumenEnfriandose["avisados"] = [];

  for (const c of enfriandose) {
    if (yaAvisados.has(c.id) || !c.vendedor) continue;
    const dias = c.ultimaInteraccionEn
      ? Math.floor((Date.now() - c.ultimaInteraccionEn.getTime()) / DIA)
      : 0;
    avisados.push({ cliente: c.empresa || c.nombre, asesor: c.vendedor.nombre, dias });

    if (!dry) {
      await prisma.notificacion.create({
        data: {
          tipo: "SISTEMA",
          usuarioId: c.vendedor.id,
          titulo: `Se está enfriando · ${c.empresa || c.nombre}`,
          mensaje: `Lleva ${dias} días sin ninguna señal. En un mes pasa a inactivo. Es más barato recuperarlo ahora que conseguir uno nuevo.`,
          data: { clienteId: c.id },
        },
      }).catch(() => undefined);
    }
  }

  return { encontrados: enfriandose.length, avisados };
}

// ─────────────────────────────────────────────
// 5 · El resumen semanal a gerencia
// ─────────────────────────────────────────────

export const CLAVE_ULTIMO_RESUMEN = "cron_ultimo_resumen_semanal";

export interface ResumenSemanal {
  enviado: boolean;
  motivo?: string;
  destinatarios?: string[];
  cifras?: Record<string, number>;
}

/**
 * Los datos de la semana ya existen; lo que falta es que alguien los
 * mire. Un correo el lunes por la mañana los pone delante sin que haya
 * que entrar al portal.
 *
 * Sale los LUNES. Se apunta la fecha del último envío para que la
 * corrida diaria de los otros seis días no lo repita.
 */
export async function resumenSemanal(
  opciones: { dry?: boolean; forzar?: boolean } = {},
): Promise<ResumenSemanal> {
  const dry = opciones.dry ?? false;
  const hoy = new Date();

  if (!opciones.forzar && hoy.getDay() !== 1) {
    return { enviado: false, motivo: "Solo sale los lunes." };
  }

  const marca = await prisma.configuracion.findUnique({ where: { clave: CLAVE_ULTIMO_RESUMEN } });
  const yaSalioHoy = marca?.valor?.slice(0, 10) === hoy.toISOString().slice(0, 10);
  if (yaSalioHoy && !opciones.forzar) {
    return { enviado: false, motivo: "Ya salió hoy." };
  }

  if (!(await correoConfigurado())) {
    return { enviado: false, motivo: "El correo no está configurado." };
  }

  const desde = new Date(Date.now() - 7 * DIA);

  const [creadas, enviadas, aprobadas, vencidas, clientesNuevos, pedidos, conversaciones] =
    await Promise.all([
      prisma.cotizacion.count({ where: { esPrueba: false, createdAt: { gte: desde } } }),
      prisma.cotizacion.count({ where: { esPrueba: false, enviadaEn: { gte: desde } } }),
      prisma.cotizacion.count({ where: { esPrueba: false, estado: "APROBADA", updatedAt: { gte: desde } } }),
      prisma.cotizacion.count({ where: { esPrueba: false, estado: "VENCIDA", updatedAt: { gte: desde } } }),
      prisma.cliente.count({ where: { createdAt: { gte: desde } } }),
      prisma.pedido.count({ where: { createdAt: { gte: desde } } }),
      prisma.nexusConversacion.count({ where: { createdAt: { gte: desde } } }),
    ]);

  const cerrado = await prisma.cotizacion.aggregate({
    where: { esPrueba: false, estado: "APROBADA", updatedAt: { gte: desde } },
    _sum: { total: true },
  });

  const cifras = {
    creadas, enviadas, aprobadas, vencidas,
    clientesNuevos, pedidos, conversaciones,
    cerradoCOP: Number(cerrado._sum.total ?? 0),
  };

  const admins = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: ["ADMIN", "SUPERADMIN"] }, email: { not: "" } },
    select: { email: true },
  });
  const destinatarios = admins.map(a => a.email).filter(Boolean);
  if (!destinatarios.length) {
    return { enviado: false, motivo: "No hay administradores con correo." };
  }

  if (dry) return { enviado: false, motivo: "Modo seco.", destinatarios, cifras };

  const cop = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const m = await getMarca();
  const base = urlPortal();

  const filas: [string, string][] = [
    ["Cotizaciones creadas", String(creadas)],
    ["Enviadas al cliente", String(enviadas)],
    ["Aprobadas", String(aprobadas)],
    ["Vencidas sin cerrar", String(vencidas)],
    ["Valor cerrado", cop(cifras.cerradoCOP)],
    ["Pedidos nuevos", String(pedidos)],
    ["Clientes nuevos", String(clientesNuevos)],
    ["Conversaciones nuevas", String(conversaciones)],
  ];

  const html = `
    <p style="margin:0 0 16px">Esto pasó en ${m.companyName} entre el ${desde.toLocaleDateString("es-CO")} y hoy.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
      ${filas.map(([k, v]) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#555">${k}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${v}</td>
        </tr>`).join("")}
    </table>
    ${vencidas > 0 ? `<p style="margin:16px 0 0;color:#b3261e"><strong>${vencidas} oferta(s) se vencieron sin cerrarse.</strong> Están en el pipeline, en la columna de vencidas, y se pueden aplazar.</p>` : ""}
    <p style="margin:20px 0 0"><a href="${base}/crm/embudo">Ver el embudo completo</a></p>
  `;

  const texto = filas.map(([k, v]) => `${k}: ${v}`).join("\n");

  await enviarCorreo({
    para: destinatarios,
    asunto: `${m.companyName} · resumen de la semana`,
    html,
    texto,
  });

  await prisma.configuracion.upsert({
    where: { clave: CLAVE_ULTIMO_RESUMEN },
    create: { clave: CLAVE_ULTIMO_RESUMEN, valor: new Date().toISOString(), descripcion: "Último resumen semanal enviado" },
    update: { valor: new Date().toISOString() },
  }).catch(() => undefined);

  return { enviado: true, destinatarios, cifras };
}
