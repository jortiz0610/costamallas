// ============================================================
// Seguimiento post-cotización — los tres toques que pidió la gerencia.
//
// El sistema ya sabía cuándo se envió la oferta y cuándo la abrió el
// cliente. Lo que no había era qué pasa después: el seguimiento dependía
// de que el asesor se acordara, y por eso la tasa de cierre está en 10%.
//
//   Toque 1 · automático, 24 h después de enviar → confirmar que llegó.
//   Toque 2 · tarea del asesor, entre 48 y 72 h → lo hace una PERSONA.
//             Si no la marca, se le avisa a gerencia.
//   Toque 3 · automático, un día antes de vencer → cierre con la urgencia
//             real de la oferta (su propia vigencia), no una inventada.
//
// ⚠️ El cron de Vercel en plan Hobby corre UNA VEZ AL DÍA. Todo esto está
// diseñado para eso: cada toque se dispara cuando "ya pasó su hora", no
// en una ventana estrecha. Si el cron se salta un día, al siguiente se
// pone al corriente en vez de perder el toque.
//
// ⚠️ Lo que NO puede funcionar todavía:
//   · El correo necesita las credenciales SMTP cargadas desde el portal
//     EN PRODUCCIÓN. Sin ellas el toque queda PENDIENTE con el motivo, y
//     sale solo en la siguiente corrida. No se marca como enviado.
//   · WhatsApp necesita la cuenta aprobada por Meta. El texto queda
//     preparado y guardado; el envío se registra como fallido con el
//     motivo. No se simula.
// ============================================================

import { prisma } from "@/lib/prisma";
import { urlPortal } from "@/lib/url-portal";
import { enviarCorreo, correoConfigurado } from "@/lib/correo";
import { enviarWhatsAppDirecto } from "@/lib/nexus/canales";
import { getMarca } from "@/lib/marca";
import { formatCOP } from "@/lib/utils";
import {
  SEGUIMIENTO_DEFAULTS,
  aplicarMarcadores,
  type ConfigSeguimiento,
} from "@/lib/seguimiento-textos";

export { SEGUIMIENTO_DEFAULTS };
export type { ConfigSeguimiento };

const HORA = 3_600_000;
const DIA = 86_400_000;

const CLAVES: Record<keyof ConfigSeguimiento, string> = {
  activo: "seg_activo",
  t1Horas: "seg_t1_horas",
  t2Horas: "seg_t2_horas",
  t2LimiteHoras: "seg_t2_limite_horas",
  t3DiasAntes: "seg_t3_dias_antes",
  porWhatsapp: "seg_por_whatsapp",
  t1Asunto: "seg_t1_asunto",
  t1Cuerpo: "seg_t1_cuerpo",
  t1Whatsapp: "seg_t1_whatsapp",
  t2Titulo: "seg_t2_titulo",
  t2Guion: "seg_t2_guion",
  t3Asunto: "seg_t3_asunto",
  t3Cuerpo: "seg_t3_cuerpo",
  t3Whatsapp: "seg_t3_whatsapp",
};

export async function getConfigSeguimiento(): Promise<ConfigSeguimiento> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));

  const texto = (k: keyof ConfigSeguimiento) => {
    const v = map[CLAVES[k]];
    return v !== undefined && v !== "" ? v : (SEGUIMIENTO_DEFAULTS[k] as string);
  };
  const numero = (k: keyof ConfigSeguimiento) => {
    const v = Number(map[CLAVES[k]]);
    return Number.isFinite(v) && v > 0 ? v : (SEGUIMIENTO_DEFAULTS[k] as number);
  };
  const bool = (k: keyof ConfigSeguimiento) => {
    const v = map[CLAVES[k]];
    return v === undefined ? (SEGUIMIENTO_DEFAULTS[k] as boolean) : v === "true";
  };

  return {
    activo: bool("activo"),
    t1Horas: numero("t1Horas"),
    t2Horas: numero("t2Horas"),
    t2LimiteHoras: numero("t2LimiteHoras"),
    t3DiasAntes: numero("t3DiasAntes"),
    porWhatsapp: bool("porWhatsapp"),
    t1Asunto: texto("t1Asunto"),
    t1Cuerpo: texto("t1Cuerpo"),
    t1Whatsapp: texto("t1Whatsapp"),
    t2Titulo: texto("t2Titulo"),
    t2Guion: texto("t2Guion"),
    t3Asunto: texto("t3Asunto"),
    t3Cuerpo: texto("t3Cuerpo"),
    t3Whatsapp: texto("t3Whatsapp"),
  };
}

export async function setConfigSeguimiento(datos: Partial<ConfigSeguimiento>) {
  for (const [campo, valor] of Object.entries(datos)) {
    const clave = CLAVES[campo as keyof ConfigSeguimiento];
    if (!clave || valor === undefined) continue;
    const guardado = typeof valor === "string" ? valor : String(valor);
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: guardado, descripcion: "Seguimiento post-cotización" },
      update: { valor: guardado },
    });
  }
}

// ── Datos que necesita un toque ─────────────────────────────

type CotizacionSeg = Awaited<ReturnType<typeof cargarCotizacion>>;

async function cargarCotizacion(id: string) {
  return prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true, empresa: true, email: true, telefono: true, whatsapp: true } },
      vendedor: { select: { id: true, nombre: true, email: true, telefono: true } },
      seguimientos: true,
    },
  });
}

/** Cuándo vence la oferta. Misma cuenta que usa la cotización pública. */
export function venceEl(cot: { createdAt: Date; validezDias: number }): Date {
  return new Date(cot.createdAt.getTime() + cot.validezDias * DIA);
}

function marcadores(cot: NonNullable<CotizacionSeg>, base: string, nosotros: string) {
  const vence = venceEl(cot);
  const dias = Math.max(0, Math.ceil((vence.getTime() - Date.now()) / DIA));
  return {
    cliente: cot.cliente.nombre,
    empresa: cot.cliente.empresa || cot.cliente.nombre,
    numero: cot.numero,
    total: formatCOP(Number(cot.total)),
    enlace: cot.publicId ? `${base}/cotizacion/${cot.publicId}` : "",
    vence: vence.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }),
    diasRestantes: String(dias),
    asesor: cot.vendedor?.nombre ?? nosotros,
    telefonoAsesor: cot.vendedor?.telefono ?? "",
    nosotros,
  };
}

/**
 * La URL del portal. Es lo que va en el enlace de los tres correos.
 *
 * NO sale de `NEXT_PUBLIC_APP_URL`: esa variable apunta a la TIENDA
 * (costamallas.com), así que el enlace del seguimiento habría llevado al
 * cliente a un 404 de WordPress. Aquí no hay petición de la que sacar el
 * origen —esto corre en la corrida diaria—, así que se usa `PORTAL_URL`
 * o el dominio de producción.
 */
export function urlBase(): string {
  return urlPortal();
}

// ── Correo ──────────────────────────────────────────────────

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function armarHtml(opts: {
  titulo: string; cuerpo: string; enlace: string; empresa: string;
  firma: { nombre: string; contacto: string };
}): string {
  const parrafos = opts.cuerpo
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#2b2d29">${escapar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const boton = opts.enlace
    ? `<p style="margin:22px 0;text-align:center">
         <a href="${opts.enlace}" style="display:inline-block;background:${AMARILLO};color:${NEGRO};text-decoration:none;padding:14px 30px;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.03em">Ver la cotización</a>
       </p>`
    : "";

  return `<!doctype html><html lang="es"><body style="margin:0;background:#e9ecef;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff">
    <div style="background:${NEGRO};padding:24px 28px">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${AMARILLO}">${escapar(opts.empresa)}</p>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.15;color:#fff;text-transform:uppercase;font-weight:900">${escapar(opts.titulo)}</h1>
    </div>
    <div style="height:4px;background:${AMARILLO}"></div>
    <div style="padding:26px 28px">
      ${parrafos}
      ${boton}
      <div style="margin-top:22px;padding-left:14px;border-left:4px solid ${AMARILLO}">
        <p style="margin:0;font-size:13px;font-weight:800;color:#11110f">${escapar(opts.firma.nombre)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b6f6a">${escapar(opts.firma.contacto)}</p>
      </div>
    </div>
    <div style="padding:14px 28px;background:${NEGRO};color:rgba(255,255,255,.45);font-size:11px">${escapar(opts.empresa)}</div>
  </div></body></html>`;
}

// ── Ejecución de un toque ───────────────────────────────────

export interface ResultadoToque {
  toque: number;
  estado: "ENVIADO" | "PENDIENTE" | "ERROR" | "HECHO" | "OMITIDO";
  detalle: string;
}

/**
 * Manda el correo (y el WhatsApp si está habilitado) de un toque
 * automático, y deja el registro. Nunca lanza: el resultado se guarda.
 *
 * Si el correo no está configurado el toque queda PENDIENTE con el
 * motivo, NO como enviado: al día siguiente lo vuelve a intentar y sale
 * solo en cuanto se carguen las credenciales.
 */
async function ejecutarToqueAutomatico(
  cot: NonNullable<CotizacionSeg>,
  toque: 1 | 3,
  cfg: ConfigSeguimiento,
  programadoPara: Date,
): Promise<ResultadoToque> {
  const marca = await getMarca();
  const datos = marcadores(cot, urlBase(), marca.companyName);
  const asunto = aplicarMarcadores(toque === 1 ? cfg.t1Asunto : cfg.t3Asunto, datos);
  const cuerpo = aplicarMarcadores(toque === 1 ? cfg.t1Cuerpo : cfg.t3Cuerpo, datos);
  const textoWa = aplicarMarcadores(toque === 1 ? cfg.t1Whatsapp : cfg.t3Whatsapp, datos);
  const destino = cot.cliente.email?.trim() ?? "";

  const guardar = (estado: string, extra: Record<string, unknown> = {}) =>
    prisma.seguimientoCotizacion.upsert({
      where: { cotizacionId_toque: { cotizacionId: cot.id, toque } },
      create: {
        cotizacionId: cot.id, toque, canal: "EMAIL", estado,
        programadoPara, destino, mensaje: cuerpo, ...extra,
      },
      update: { estado, destino, mensaje: cuerpo, ...extra },
    });

  if (!destino) {
    const motivo = `${cot.cliente.nombre} no tiene correo registrado en el CRM.`;
    await guardar("ERROR", { error: motivo });
    return { toque, estado: "ERROR", detalle: motivo };
  }

  if (!(await correoConfigurado())) {
    const motivo = "El correo saliente no está configurado (Configuración → Correo).";
    // PENDIENTE, no ERROR: en cuanto se carguen las credenciales sale solo.
    await guardar("PENDIENTE", { error: motivo });
    return { toque, estado: "PENDIENTE", detalle: motivo };
  }

  try {
    await enviarCorreo({
      para: destino,
      responderA: cot.vendedor?.email || marca.email || undefined,
      asunto,
      html: armarHtml({
        titulo: asunto,
        cuerpo,
        enlace: datos.enlace,
        empresa: marca.companyName,
        firma: {
          nombre: cot.vendedor?.nombre ?? marca.companyName,
          contacto: [cot.vendedor?.telefono || marca.phone, cot.vendedor?.email || marca.email]
            .filter(Boolean).join(" · "),
        },
      }),
      texto: `${cuerpo}\n\n${datos.enlace}`,
    });
  } catch (e) {
    const motivo = (e as Error).message;
    await guardar("PENDIENTE", { error: motivo });
    return { toque, estado: "PENDIENTE", detalle: motivo };
  }

  // WhatsApp: se intenta solo si está habilitado. Mientras Meta no
  // apruebe la cuenta esto falla, y así queda escrito. El correo ya salió.
  let canal = "EMAIL";
  let notaWa: string | undefined;
  if (cfg.porWhatsapp) {
    const tel = cot.cliente.whatsapp || cot.cliente.telefono || "";
    const r = await enviarWhatsAppDirecto(tel, textoWa);
    if (r.ok) canal = "EMAIL+WHATSAPP";
    else notaWa = `WhatsApp no salió: ${r.error}`;
  }

  await guardar("ENVIADO", { canal, ejecutadoEn: new Date(), error: notaWa ?? null });
  return {
    toque,
    estado: "ENVIADO",
    detalle: `Correo a ${destino}${notaWa ? ` · ${notaWa}` : ""}`,
  };
}

/**
 * Toque 2: no lo manda el sistema, lo hace una persona. Lo único que
 * hace aquí es crear la tarea del asesor con el guion de la llamada.
 */
async function crearTareaToque2(
  cot: NonNullable<CotizacionSeg>,
  cfg: ConfigSeguimiento,
  programadoPara: Date,
  limite: Date,
): Promise<ResultadoToque> {
  const marca = await getMarca();
  const datos = marcadores(cot, urlBase(), marca.companyName);

  const tarea = await prisma.tarea.create({
    data: {
      titulo: aplicarMarcadores(cfg.t2Titulo, datos),
      descripcion: aplicarMarcadores(cfg.t2Guion, datos),
      tipo: "LLAMADA",
      prioridad: "ALTA",
      estado: "PENDIENTE",
      fechaVence: limite,
      clienteId: cot.cliente.id,
      asignadoId: cot.vendedorId,
    },
  });

  await prisma.seguimientoCotizacion.upsert({
    where: { cotizacionId_toque: { cotizacionId: cot.id, toque: 2 } },
    create: {
      cotizacionId: cot.id, toque: 2, canal: "TAREA", estado: "PENDIENTE",
      programadoPara, tareaId: tarea.id, destino: cot.vendedor?.nombre ?? null,
      mensaje: tarea.descripcion,
    },
    update: { tareaId: tarea.id },
  });

  return {
    toque: 2,
    estado: "PENDIENTE",
    detalle: `Tarea creada para ${cot.vendedor?.nombre ?? "sin asesor"} (vence ${limite.toLocaleDateString("es-CO")})`,
  };
}

/**
 * El asesor no marcó la llamada dentro del plazo. Se le avisa a los
 * administradores del portal: notificación adentro y correo si hay SMTP.
 *
 * La alerta se manda UNA vez (`alertaEnviadaEn`): un aviso que se repite
 * todos los días se vuelve ruido y se deja de leer.
 */
async function alertarGerencia(
  cot: NonNullable<CotizacionSeg>,
  seguimientoId: string,
  limite: Date,
): Promise<ResultadoToque> {
  const marca = await getMarca();
  const asesor = cot.vendedor?.nombre ?? "sin asesor asignado";
  const cliente = cot.cliente.empresa || cot.cliente.nombre;
  const titulo = `Seguimiento sin hacer: ${cot.numero}`;
  const mensaje =
    `${asesor} no ha registrado la llamada de seguimiento de la cotización ${cot.numero} ` +
    `(${cliente}, ${formatCOP(Number(cot.total))}). El plazo era el ${limite.toLocaleDateString("es-CO")}.`;

  await prisma.notificacion.create({
    data: { tipo: "SISTEMA", titulo, mensaje, data: { cotizacionId: cot.id, numero: cot.numero } },
  }).catch(() => undefined);

  const admins = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { email: true },
  });
  const destinos = admins.map(a => a.email).filter(Boolean);

  let detalle = `Notificación creada · ${destinos.length} administrador(es)`;
  if (destinos.length && (await correoConfigurado())) {
    try {
      await enviarCorreo({
        para: destinos,
        asunto: `[${marca.companyName}] ${titulo}`,
        html: armarHtml({
          titulo,
          cuerpo:
            `${mensaje}\n\n` +
            "Una oferta que nadie llama después de enviarla se pierde sola. " +
            "Esto no es un reclamo automático al asesor: es para que alguien decida qué hacer con este cliente.",
          enlace: `${urlBase()}/crm/cotizaciones/${cot.id}`,
          empresa: marca.companyName,
          firma: { nombre: marca.companyName, contacto: "Aviso automático del portal" },
        }),
        texto: mensaje,
      });
      detalle += " · correo enviado";
    } catch (e) {
      detalle += ` · el correo falló: ${(e as Error).message}`;
    }
  } else if (destinos.length) {
    detalle += " · sin correo (SMTP sin configurar)";
  }

  await prisma.seguimientoCotizacion.update({
    where: { id: seguimientoId },
    data: { alertaEnviadaEn: new Date(), error: `Sin marcar al ${limite.toLocaleDateString("es-CO")}` },
  });

  return { toque: 2, estado: "ERROR", detalle };
}

// ── El motor que corre el cron ──────────────────────────────

export interface ResumenCorrida {
  revisadas: number;
  acciones: { cotizacion: string; toque: number; estado: string; detalle: string }[];
  omitidas: string[];
  configurado: { correo: boolean; whatsapp: boolean };
}

/**
 * Recorre las cotizaciones enviadas y dispara lo que ya toca.
 *
 * `dry` informa qué haría sin mandar ni escribir nada: es la forma de
 * mirar el estado sin tocar la base de producción.
 */
export async function correrSeguimientos(opts: { dry?: boolean; soloCotizacionId?: string } = {}): Promise<ResumenCorrida> {
  const cfg = await getConfigSeguimiento();
  const ahora = Date.now();
  const acciones: ResumenCorrida["acciones"] = [];
  const omitidas: string[] = [];

  if (!cfg.activo && !opts.soloCotizacionId) {
    return {
      revisadas: 0, acciones: [],
      omitidas: ["El seguimiento automático está apagado en Configuración."],
      configurado: { correo: await correoConfigurado(), whatsapp: cfg.porWhatsapp },
    };
  }

  const candidatas = await prisma.cotizacion.findMany({
    where: {
      ...(opts.soloCotizacionId ? { id: opts.soloCotizacionId } : {}),
      estado: "ENVIADA",
      seguimientoActivo: true,
      enviadaEn: { not: null },
    },
    include: {
      cliente: { select: { id: true, nombre: true, empresa: true, email: true, telefono: true, whatsapp: true } },
      vendedor: { select: { id: true, nombre: true, email: true, telefono: true } },
      seguimientos: true,
    },
    orderBy: { enviadaEn: "asc" },
    // Tope de seguridad: el cron de Hobby corta a los 60 s. Con más de
    // esto conviene que quede para la corrida siguiente antes que
    // arriesgarse a que se muera a mitad de camino.
    take: 60,
  });

  for (const cot of candidatas) {
    const enviada = cot.enviadaEn!.getTime();
    const vence = venceEl(cot);
    const reg = new Map(cot.seguimientos.map(s => [s.toque, s]));

    // Una oferta vencida ya no se persigue: el toque 3 pierde sentido
    // (su gracia es avisar ANTES) y el 1 llegaría fuera de tiempo.
    if (vence.getTime() < ahora) {
      for (const t of [1, 2, 3] as const) {
        const r = reg.get(t);
        if (r && r.estado === "PENDIENTE" && !opts.dry) {
          await prisma.seguimientoCotizacion.update({
            where: { id: r.id },
            data: { estado: "OMITIDO", error: "La oferta venció antes de que saliera este toque." },
          });
        }
      }
      omitidas.push(`${cot.numero}: la oferta venció el ${vence.toLocaleDateString("es-CO")}`);
      continue;
    }

    // ── Toque 1 ──
    const prog1 = new Date(enviada + cfg.t1Horas * HORA);
    const r1 = reg.get(1);
    if (ahora >= prog1.getTime() && (!r1 || r1.estado === "PENDIENTE")) {
      if (opts.dry) {
        acciones.push({ cotizacion: cot.numero, toque: 1, estado: "SIMULADO", detalle: "Se enviaría el toque 1" });
      } else {
        const r = await ejecutarToqueAutomatico(cot, 1, cfg, prog1);
        acciones.push({ cotizacion: cot.numero, ...r });
      }
    }

    // ── Toque 2 (persona) ──
    const prog2 = new Date(enviada + cfg.t2Horas * HORA);
    const limite2 = new Date(enviada + cfg.t2LimiteHoras * HORA);
    const r2 = reg.get(2);
    if (ahora >= prog2.getTime() && !r2) {
      if (opts.dry) {
        acciones.push({ cotizacion: cot.numero, toque: 2, estado: "SIMULADO", detalle: "Se crearía la tarea del asesor" });
      } else {
        const r = await crearTareaToque2(cot, cfg, prog2, limite2);
        acciones.push({ cotizacion: cot.numero, ...r });
      }
    } else if (r2 && r2.estado === "PENDIENTE" && ahora > limite2.getTime()) {
      // ¿La hizo y solo cerró la tarea sin volver aquí? Se comprueba
      // contra la tarea antes de acusar a nadie.
      const tarea = r2.tareaId
        ? await prisma.tarea.findUnique({ where: { id: r2.tareaId }, select: { estado: true } })
        : null;
      if (tarea?.estado === "COMPLETADA") {
        if (!opts.dry) {
          await prisma.seguimientoCotizacion.update({
            where: { id: r2.id },
            data: { estado: "HECHO", ejecutadoEn: new Date() },
          });
        }
        acciones.push({ cotizacion: cot.numero, toque: 2, estado: "HECHO", detalle: "El asesor completó la llamada" });
      } else if (!r2.alertaEnviadaEn) {
        if (opts.dry) {
          acciones.push({ cotizacion: cot.numero, toque: 2, estado: "SIMULADO", detalle: "Se alertaría a gerencia" });
        } else {
          const r = await alertarGerencia(cot, r2.id, limite2);
          acciones.push({ cotizacion: cot.numero, ...r });
        }
      }
    }

    // ── Toque 3 ──
    const prog3 = new Date(vence.getTime() - cfg.t3DiasAntes * DIA);
    const r3 = reg.get(3);
    if (ahora >= prog3.getTime() && (!r3 || r3.estado === "PENDIENTE")) {
      if (opts.dry) {
        acciones.push({ cotizacion: cot.numero, toque: 3, estado: "SIMULADO", detalle: "Se enviaría el toque 3" });
      } else {
        const r = await ejecutarToqueAutomatico(cot, 3, cfg, prog3);
        acciones.push({ cotizacion: cot.numero, ...r });
      }
    }
  }

  return {
    revisadas: candidatas.length,
    acciones,
    omitidas,
    configurado: { correo: await correoConfigurado(), whatsapp: cfg.porWhatsapp },
  };
}

/** Dispara un toque a mano desde la ficha de la cotización. */
export async function dispararToque(cotizacionId: string, toque: 1 | 3): Promise<ResultadoToque> {
  const cot = await cargarCotizacion(cotizacionId);
  if (!cot) return { toque, estado: "ERROR", detalle: "La cotización no existe." };
  if (!cot.enviadaEn) {
    return { toque, estado: "ERROR", detalle: "Todavía no se ha enviado: no hay de qué hacer seguimiento." };
  }
  const cfg = await getConfigSeguimiento();
  return ejecutarToqueAutomatico(cot, toque, cfg, new Date());
}

/** El asesor marca la llamada del toque 2 como hecha, con lo que le dijeron. */
export async function marcarToque2Hecho(cotizacionId: string, nota: string): Promise<ResultadoToque> {
  const reg = await prisma.seguimientoCotizacion.findUnique({
    where: { cotizacionId_toque: { cotizacionId, toque: 2 } },
  });
  if (!reg) return { toque: 2, estado: "ERROR", detalle: "Este toque todavía no está programado." };

  await prisma.seguimientoCotizacion.update({
    where: { id: reg.id },
    data: { estado: "HECHO", ejecutadoEn: new Date(), mensaje: nota || reg.mensaje },
  });

  if (reg.tareaId) {
    await prisma.tarea.update({
      where: { id: reg.tareaId },
      data: {
        estado: "COMPLETADA",
        completadaEn: new Date(),
        ...(nota ? { descripcion: `${reg.mensaje ?? ""}\n\n— Resultado: ${nota}` } : {}),
      },
    }).catch(() => undefined);
  }

  return { toque: 2, estado: "HECHO", detalle: "Llamada registrada" };
}
