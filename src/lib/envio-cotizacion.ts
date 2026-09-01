// ============================================================
// Mandarle la cotización al cliente.
//
// Vivía dentro de la route handler. Se sacó aquí porque ahora hay DOS
// puertas que tienen que hacer exactamente lo mismo: el botón de
// "Enviar" del portal y el ensayo general. Si el ensayo llamara a un
// camino propio, no estaría probando nada — el correo que verifica no
// sería el que reciben los clientes.
//
// Se manda el ENLACE y no un PDF adjunto a propósito: el enlace deja
// saber si el cliente la abrió, y eso es lo que dispara el seguimiento.
// Un adjunto llega y no se sabe si alguien lo miró.
// ============================================================

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { urlCotizacion } from "@/lib/url-portal";
import { enviarCorreo } from "@/lib/correo";
import { getMarca } from "@/lib/marca";
import { armarCorreo } from "@/lib/correo-plantillas-server";
import { formatCOP } from "@/lib/utils";

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";

export interface ResultadoEnvio {
  ok: boolean;
  /** Por qué no salió, en el idioma de quien lo va a leer. */
  error?: string;
  destino?: string;
  asunto?: string;
  enlace?: string;
  /** Para que quien llama decida el código HTTP. */
  motivo?: "no-existe" | "sin-visto-bueno" | "rechazada" | "sin-correo" | "smtp";
}

export interface OpcionesEnvio {
  /** Fuerza el texto de "la cotización cambió" aunque sea el primer envío. */
  comoModificada?: boolean;
  /** Quién lo disparó, para el registro. Nulo = no hay sesión. */
  usuarioId?: string | null;
}

export async function enviarCotizacionPorCorreo(
  id: string,
  opciones: OpcionesEnvio = {},
): Promise<ResultadoEnvio> {
  const cot = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true, empresa: true, email: true } },
      vendedor: { select: { nombre: true, email: true, telefono: true } },
      items: { orderBy: { orden: "asc" } },
    },
  });
  if (!cot) return { ok: false, error: "La cotización no existe", motivo: "no-existe" };

  // Una oferta fuera de la política comercial no sale sin visto bueno.
  // Se para aquí y no al aprobar: mandarla ya es prometerle el precio al
  // cliente, y desdecirse después cuesta más que la venta.
  if (cot.aprobacionEstado === "PENDIENTE") {
    return {
      ok: false,
      motivo: "sin-visto-bueno",
      error: `Esta oferta necesita el visto bueno de un administrador antes de enviarse. ${cot.aprobacionMotivo ?? ""}`.trim(),
    };
  }
  if (cot.aprobacionEstado === "RECHAZADA") {
    return {
      ok: false,
      motivo: "rechazada",
      error: "Un administrador rechazó estas condiciones. Ajusta el descuento o el anticipo antes de enviarla.",
    };
  }

  const destino = cot.cliente.email?.trim();
  if (!destino) {
    return {
      ok: false,
      motivo: "sin-correo",
      error: `${cot.cliente.nombre} no tiene correo registrado en el CRM.`,
    };
  }

  // Una cotización vieja puede no tener token todavía.
  const publicId = cot.publicId ?? randomBytes(16).toString("base64url");

  const marca = await getMarca();
  const enlace = `${urlCotizacion()}/cotizacion/${publicId}`;

  // Con la prórroga incluida: si se aplazó, el correo tiene que decir la
  // fecha nueva, no la que ya pasó.
  const vence = new Date(cot.createdAt.getTime() + (cot.validezDias + cot.prorrogaDias) * 86400000)
    .toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  // La TABLA de ítems es el único HTML que se arma aquí: no se puede
  // escribir en texto plano sin que se desarme en el teléfono. Todo lo
  // demás —cabecera, cuerpo, banner y pie— sale de la plantilla, que
  // gerencia edita en Configuración → Plantillas de correo.
  const filas = cot.items
    .map(i => `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #eee;font-size:13px;color:#2b2d29">
        ${i.descripcion}${i.tipo === "INSTALACION" ? ' <span style="background:#11110f;color:#ffdd00;font-size:9px;font-weight:700;padding:2px 6px;text-transform:uppercase">Servicio</span>' : ""}
      </td>
      <td style="padding:9px 0;border-bottom:1px solid #eee;text-align:right;font-size:13px;color:#6b6f6a;white-space:nowrap">
        ${Number(i.cantidad).toLocaleString("es-CO")} ${i.unidad ?? ""}
      </td>
      <td style="padding:9px 0 9px 14px;border-bottom:1px solid #eee;text-align:right;font-size:13px;font-weight:700;color:#11110f;white-space:nowrap">
        ${formatCOP(Number(i.subtotal))}
      </td>
    </tr>`)
    .join("");

  const tabla = `
    <table style="width:100%;border-collapse:collapse;margin:6px 0 18px">
      <tbody>${filas}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;background:${NEGRO}">
      <tr>
        <td style="padding:14px 16px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fff">Total</td>
        <td style="padding:14px 16px;text-align:right;font-size:22px;font-weight:900;color:${AMARILLO}">${formatCOP(Number(cot.total))}</td>
      </tr>
    </table>`;

  // ¿Es el primer envío o un reenvío de algo que el cliente ya tenía?
  // El texto es distinto: "le compartimos la propuesta" no sirve para
  // algo que ya tiene desde hace una semana.
  const yaLaTenia = Boolean(cot.enviadaEn);
  const plantilla = opciones.comoModificada || yaLaTenia
    ? "cotizacion_modificada"
    : "cotizacion_envio";

  const correo = await armarCorreo(
    plantilla,
    {
      cliente: cot.cliente.empresa || cot.cliente.nombre,
      contacto: cot.cliente.nombre,
      numero: cot.numero,
      total: formatCOP(Number(cot.total)),
      vence,
      enlace,
      asesor: cot.vendedor?.nombre ?? "",
      asesorTelefono: cot.vendedor?.telefono ?? marca.phone ?? "",
    },
    {
      urlBoton: enlace,
      pieDelBoton: `Válida hasta el ${vence}.`,
      extraHtml: tabla,
    },
  );

  try {
    await enviarCorreo({
      para: destino,
      responderA: cot.vendedor?.email || marca.email || undefined,
      asunto: correo.asunto,
      html: correo.html,
      texto: correo.texto,
    });
  } catch (e) {
    const mensaje = (e as Error).message;
    // El estado NO cambia: se puede reintentar sabiendo por qué falló.
    await prisma.cotizacion.update({ where: { id }, data: { errorEnvio: mensaje, publicId } });
    return { ok: false, error: mensaje, destino, motivo: "smtp" };
  }

  await prisma.cotizacion.update({
    where: { id },
    data: {
      publicId,
      estado: cot.estado === "BORRADOR" ? "ENVIADA" : cot.estado,
      enviadaEn: new Date(),
      enviadaAEmail: destino,
      errorEnvio: null,
    },
  });

  await prisma.log
    .create({
      data: {
        usuarioId: opciones.usuarioId ?? null,
        accion: "COTIZACION_ENVIADA",
        detalle: `${cot.numero} → ${destino}`,
        resultado: "OK",
      },
    })
    .catch(() => undefined);

  return { ok: true, destino, asunto: correo.asunto, enlace };
}
