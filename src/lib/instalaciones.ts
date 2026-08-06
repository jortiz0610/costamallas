// ============================================================
// Instalaciones: aviso al coordinador cuando se cierra una venta.
//
// Una venta con instalación cerrada un viernes por la tarde no le
// llegaba a nadie: el coordinador se enteraba cuando el cliente llamaba
// preguntando cuándo van. Aquí, al aprobar la cotización, la obra queda
// creada y el coordinador avisado.
//
// El aviso se manda UNA sola vez (`avisoCoordinadorEn`). Reaprobar una
// cotización o guardar dos veces no vuelve a escribirle.
// ============================================================

import { prisma } from "@/lib/prisma";
import { enviarCorreo, correoConfigurado } from "@/lib/correo";
import { getMarca } from "@/lib/marca";
import { formatCOP } from "@/lib/utils";

export interface ConfigInstalacion {
  /** Usuario del portal que coordina las obras. */
  coordinadorId: string;
  /** Correo suelto, por si quien coordina no tiene login. */
  coordinadorEmail: string;
  /** Avisar al cerrar una venta con instalación. */
  avisarAlCerrar: boolean;
}

export const INSTALACION_DEFAULTS: ConfigInstalacion = {
  coordinadorId: "",
  coordinadorEmail: "",
  avisarAlCerrar: true,
};

const CLAVES: Record<keyof ConfigInstalacion, string> = {
  coordinadorId: "inst_coordinador_id",
  coordinadorEmail: "inst_coordinador_email",
  avisarAlCerrar: "inst_avisar_al_cerrar",
};

export async function getConfigInstalacion(): Promise<ConfigInstalacion> {
  const filas = await prisma.configuracion.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
    select: { clave: true, valor: true },
  });
  const map = Object.fromEntries(filas.map(f => [f.clave, f.valor]));
  return {
    coordinadorId: map[CLAVES.coordinadorId] ?? "",
    coordinadorEmail: map[CLAVES.coordinadorEmail] ?? "",
    avisarAlCerrar: map[CLAVES.avisarAlCerrar] === undefined
      ? INSTALACION_DEFAULTS.avisarAlCerrar
      : map[CLAVES.avisarAlCerrar] === "true",
  };
}

export async function setConfigInstalacion(datos: Partial<ConfigInstalacion>) {
  for (const [campo, valor] of Object.entries(datos)) {
    const clave = CLAVES[campo as keyof ConfigInstalacion];
    if (!clave || valor === undefined) continue;
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: String(valor), descripcion: "Instalaciones" },
      update: { valor: String(valor) },
    });
  }
}

export interface ResultadoAviso {
  ok: boolean;
  instalacionId?: string;
  detalle: string;
}

/**
 * Se cerró una venta con instalación: crea la obra (si no existe) y
 * avisa al coordinador.
 *
 * Nunca lanza. Que falle el aviso no puede tumbar la aprobación de una
 * cotización: el negocio ya se cerró, y perder eso por un correo sería
 * absurdo. El motivo queda en el log.
 */
export async function avisarInstalacionNueva(pedidoId: string): Promise<ResultadoAviso> {
  try {
    const cfg = await getConfigInstalacion();

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        cliente: { select: { nombre: true, empresa: true, telefono: true, ciudad: true, direccion: true } },
        vendedor: { select: { nombre: true } },
        instalacion: true,
        items: { orderBy: { orden: "asc" }, select: { descripcion: true, cantidad: true, unidad: true } },
      },
    });
    if (!pedido) return { ok: false, detalle: "El pedido no existe" };

    // La obra se crea aunque el aviso esté apagado: sin ella, el pedido
    // con instalación no aparece en ninguna parte del módulo y hay que
    // acordarse de agendarlo a mano.
    let instalacion = pedido.instalacion;
    if (!instalacion) {
      instalacion = await prisma.instalacion.create({
        data: {
          pedidoId: pedido.id,
          estado: "PENDIENTE",
          direccion: pedido.direccionEntrega ?? pedido.cliente.direccion ?? null,
          ciudad: pedido.cliente.ciudad ?? null,
        },
      });
    }

    if (!cfg.avisarAlCerrar) {
      return { ok: true, instalacionId: instalacion.id, detalle: "Obra creada. El aviso automático está apagado." };
    }
    if (instalacion.avisoCoordinadorEn) {
      return { ok: true, instalacionId: instalacion.id, detalle: "Al coordinador ya se le había avisado." };
    }

    const marca = await getMarca();
    const cliente = pedido.cliente.empresa || pedido.cliente.nombre;
    const titulo = `Venta cerrada con instalación: ${pedido.numero}`;
    const donde = [pedido.direccionEntrega ?? pedido.cliente.direccion, pedido.cliente.ciudad]
      .filter(Boolean).join(", ") || "sin dirección registrada";

    const cuerpo =
      `Se cerró el pedido ${pedido.numero} de ${cliente}, por ${formatCOP(Number(pedido.total))}, ` +
      `y lleva instalación.\n\n` +
      `Dónde: ${donde}\n` +
      `Teléfono del cliente: ${pedido.cliente.telefono ?? "no registrado"}\n` +
      `Vendió: ${pedido.vendedor?.nombre ?? "sin asesor"}\n\n` +
      `Qué se instala:\n` +
      pedido.items.map(i => `· ${Number(i.cantidad).toLocaleString("es-CO")} ${i.unidad ?? ""} — ${i.descripcion}`).join("\n") +
      `\n\nLa obra ya está creada en el portal, pendiente de agendar y de asignarle técnico.`;

    // La notificación del portal se crea siempre: no depende de que
    // haya correo configurado.
    await prisma.notificacion.create({
      data: {
        tipo: "SISTEMA",
        titulo,
        mensaje: cuerpo,
        data: { pedidoId: pedido.id, instalacionId: instalacion.id, numero: pedido.numero },
      },
    }).catch(() => undefined);

    // ¿A quién se le escribe? Al usuario elegido como coordinador y/o al
    // correo suelto. Si no hay ninguno, se dice: el aviso interno queda,
    // pero nadie recibe un correo y hay que saberlo.
    const destinos = new Set<string>();
    if (cfg.coordinadorId) {
      const u = await prisma.usuario.findUnique({
        where: { id: cfg.coordinadorId },
        select: { email: true, activo: true },
      });
      if (u?.activo && u.email) destinos.add(u.email);
    }
    if (cfg.coordinadorEmail) destinos.add(cfg.coordinadorEmail);

    if (!destinos.size) {
      await sellar(instalacion.id);
      return {
        ok: true,
        instalacionId: instalacion.id,
        detalle: "Obra creada y notificación en el portal. No hay coordinador configurado, así que no salió correo.",
      };
    }

    if (!(await correoConfigurado())) {
      // No se sella: cuando se carguen las credenciales, el siguiente
      // cierre sí manda. Este ya quedó como notificación en el portal.
      return {
        ok: true,
        instalacionId: instalacion.id,
        detalle: "Obra creada y notificación en el portal. El correo saliente no está configurado.",
      };
    }

    try {
      await enviarCorreo({
        para: [...destinos],
        asunto: `[${marca.companyName}] ${titulo}`,
        html: `<!doctype html><html lang="es"><body style="margin:0;background:#e9ecef;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff">
    <div style="background:#11110f;padding:24px 28px">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffdd00">${marca.companyName}</p>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.15;color:#fff;text-transform:uppercase;font-weight:900">${titulo}</h1>
    </div>
    <div style="height:4px;background:#ffdd00"></div>
    <div style="padding:24px 28px">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#2b2d29;white-space:pre-line">${cuerpo}</p>
    </div>
    <div style="padding:14px 28px;background:#11110f;color:rgba(255,255,255,.45);font-size:11px">Aviso automático del portal</div>
  </div></body></html>`,
        texto: cuerpo,
      });
    } catch (e) {
      return {
        ok: false,
        instalacionId: instalacion.id,
        detalle: `Obra creada, pero el correo al coordinador falló: ${(e as Error).message}`,
      };
    }

    await sellar(instalacion.id);
    return { ok: true, instalacionId: instalacion.id, detalle: `Coordinador avisado (${[...destinos].join(", ")})` };
  } catch (e) {
    return { ok: false, detalle: `No se pudo avisar: ${(e as Error).message}` };
  }
}

const sellar = (id: string) =>
  prisma.instalacion.update({ where: { id }, data: { avisoCoordinadorEn: new Date() } }).catch(() => undefined);
