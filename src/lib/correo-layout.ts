// ============================================================
// El diseño de los correos: uno solo para todos.
//
// Antes cada correo armaba su propio HTML donde le tocaba, así que el
// mismo cliente recibía tres correos de Costamallas con tres cabeceras
// distintas y tres pies distintos. Aquí se pone el marco y el cuerpo va
// dentro, venga de donde venga.
//
// **HTML de correo, no HTML de web.** Se escribe con tablas y estilos en
// línea a propósito: Gmail y Outlook borran el `<style>` del `<head>`,
// no entienden flexbox y Outlook de escritorio renderiza con el motor de
// Word. Todo lo que parece anticuado aquí lo es por eso.
//
// El BANNER lleva los dos botones que pidió gerencia —catálogo y
// tienda—, en horizontal y discretos: es un correo comercial, no una
// valla. Si el catálogo todavía no está publicado, el botón
// sencillamente no sale; un enlace roto en un correo a un cliente es
// peor que un botón que falta.
// ============================================================

import type { Marca } from "@/lib/marca";
import { HORARIO_TEXTO } from "@/lib/horario-habil";

/** Teléfonos y correo de ventas. Van al pie de TODO lo que sale. */
export const PIE_TELEFONOS = "3006078956 – 3245912653";
export const PIE_EMAIL = "ventas@costamallas.com";

/** La tienda. Es fija: es el dominio de la empresa. */
export const URL_TIENDA = "https://costamallas.com";

export interface OpcionesCorreo {
  /** El título grande de arriba. Vacío = no se pinta. */
  titulo?: string;
  /** El cuerpo, en TEXTO plano. Los saltos de línea se respetan. */
  cuerpo: string;
  /** El botón principal. */
  boton?: { texto: string; url: string };
  marca: Marca;
  /** URL del catálogo en PDF. Sin ella, el botón no sale. */
  urlCatalogo?: string | null;
  /** Se pinta pequeñito bajo el botón. Ej: "Vence el 15 de septiembre". */
  pieDelBoton?: string;
  /**
   * Un bloque de HTML propio del correo, entre el cuerpo y el botón.
   * Es lo único que puede traer HTML: la tabla de ítems de la
   * cotización, que no se puede escribir en texto plano sin que se
   * desarme en el teléfono. Lo arma el portal, no lo escribe nadie.
   */
  extraHtml?: string;
}

const NEGRO = "#11110f";
const GRIS = "#5b5f59";
const GRIS_SUAVE = "#8a8f88";
const LINEA = "#e4e4de";

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Texto plano → párrafos HTML, respetando los saltos de línea. */
function aParrafos(texto: string): string {
  return escapar(texto)
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p =>
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRIS};">` +
      p.replace(/\n/g, "<br>") +
      "</p>",
    )
    .join("");
}

/**
 * Envuelve el cuerpo con la cabecera, el banner y el pie.
 *
 * Devuelve el HTML y también la versión en texto plano: un correo sin
 * `text/plain` tiene más probabilidad de acabar en spam, y hay clientes
 * de correo que solo muestran esa.
 */
export function envolverCorreo(o: OpcionesCorreo): { html: string; texto: string } {
  const amarillo = o.marca.brandColor || "#ffdd00";
  const empresa = o.marca.companyName || "Costamallas";
  const telefonos = o.marca.phone || PIE_TELEFONOS;
  const email = o.marca.email || PIE_EMAIL;

  const logo = o.marca.logoUrl
    ? `<img src="${o.marca.logoUrl}" alt="${escapar(empresa)}" width="150" style="display:block;border:0;max-width:150px;height:auto;">`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:-.3px;color:${NEGRO};">${escapar(empresa)}</span>`;

  // El banner: dos botones en una fila, sobre franja amarilla. Vistoso
  // pero de 56 px: no tapa el mensaje.
  const botonesBanner: string[] = [];
  if (o.urlCatalogo) {
    botonesBanner.push(
      `<a href="${o.urlCatalogo}" style="display:inline-block;padding:9px 16px;margin:0 4px;` +
      `background:${NEGRO};color:${amarillo};text-decoration:none;font-size:12px;` +
      `font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Ver el catálogo</a>`,
    );
  }
  botonesBanner.push(
    `<a href="${URL_TIENDA}" style="display:inline-block;padding:9px 16px;margin:0 4px;` +
    `background:transparent;color:${NEGRO};text-decoration:none;font-size:12px;` +
    `font-weight:700;text-transform:uppercase;letter-spacing:.06em;border:2px solid ${NEGRO};">Ir a la tienda</a>`,
  );

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(o.titulo || empresa)}</title>
</head>
<body style="margin:0;padding:0;background:#f2f2ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2ee;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">

    <!-- Cabecera -->
    <tr><td style="padding:22px 28px 18px;border-bottom:3px solid ${amarillo};">
      ${logo}
    </td></tr>

    <!-- Cuerpo -->
    <tr><td style="padding:26px 28px 8px;">
      ${o.titulo ? `<h1 style="margin:0 0 16px;font-size:19px;line-height:1.3;font-weight:800;color:${NEGRO};">${escapar(o.titulo)}</h1>` : ""}
      ${aParrafos(o.cuerpo)}
      ${o.extraHtml ?? ""}
    </td></tr>

    ${o.boton ? `
    <!-- Botón principal -->
    <tr><td style="padding:8px 28px 24px;">
      <a href="${o.boton.url}" style="display:inline-block;padding:13px 26px;background:${NEGRO};color:${amarillo};text-decoration:none;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;">${escapar(o.boton.texto)}</a>
      ${o.pieDelBoton ? `<p style="margin:10px 0 0;font-size:12px;color:${GRIS_SUAVE};">${escapar(o.pieDelBoton)}</p>` : ""}
    </td></tr>` : ""}

    <!-- Banner -->
    <tr><td style="padding:16px 28px;background:${amarillo};text-align:center;">
      <p style="margin:0 0 10px;font-size:12.5px;font-weight:700;color:${NEGRO};">
        Mallas, cerramientos y seguridad perimetral en toda la costa
      </p>
      ${botonesBanner.join("")}
    </td></tr>

    <!-- Pie -->
    <tr><td style="padding:20px 28px;border-top:1px solid ${LINEA};">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${NEGRO};">${escapar(empresa)}</p>
      <p style="margin:0;font-size:12.5px;line-height:1.6;color:${GRIS};">
        Teléfonos ${escapar(telefonos)}<br>
        <a href="mailto:${email}" style="color:${GRIS};text-decoration:underline;">${escapar(email)}</a>
        ${o.marca.address ? `<br>${escapar(o.marca.address)}` : ""}
      </p>
      ${/* El horario de atención, en TODO lo que sale.

           No es decoración: la mitad de los correos de este portal son
           automáticos y llegan pidiendo una respuesta. Sin decir cuándo
           hay alguien, un cliente llama el domingo, no le contestan, y la
           impresión que queda es que no atienden — cuando lo que pasó es
           que llamó cerrado. */ ""}
      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:${GRIS};">
        <strong style="color:${NEGRO};">Horario de atención</strong><br>
        ${HORARIO_TEXTO.split("\n").map(l => escapar(l)).join("<br>")}
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:${GRIS_SUAVE};">
        Este correo se envió desde el portal de ${escapar(empresa)}.
        Si no esperabas recibirlo, respóndenos y lo corregimos.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

  // La versión en texto: el mismo contenido, sin adornos.
  const texto = [
    o.titulo ? o.titulo.toUpperCase() : "",
    o.titulo ? "" : "",
    o.cuerpo,
    o.boton ? `\n${o.boton.texto}: ${o.boton.url}` : "",
    o.pieDelBoton ? o.pieDelBoton : "",
    "",
    "—",
    empresa,
    `Teléfonos ${telefonos}`,
    email,
    "",
    "HORARIO DE ATENCIÓN",
    HORARIO_TEXTO,
    "",
    URL_TIENDA,
  ].filter(l => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { html, texto };
}
