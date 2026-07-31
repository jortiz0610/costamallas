// ============================================================
// Envío de correo (SMTP)
//
// Se usa para mandarle las órdenes de compra a los proveedores. Las
// credenciales van cifradas en la tabla `configuracion`, igual que las de
// WooCommerce y la IA, y se editan desde el portal.
//
// ⚠️ Cárgalas desde el portal EN PRODUCCIÓN. Un secreto cifrado en local
// no se puede descifrar en Vercel: las ENCRYPTION_KEY son distintas.
// ============================================================

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptIfNeeded } from "@/lib/encryption";

export interface ConfigCorreo {
  host: string;
  puerto: number;
  seguro: boolean;
  usuario: string;
  password: string;
  remitenteNombre: string;
  remitenteEmail: string;
}

const CLAVES = [
  "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_password",
  "smtp_from_name", "smtp_from_email",
] as const;

/** Lee la configuración SMTP. Devuelve null si falta lo indispensable. */
export async function getConfigCorreo(): Promise<ConfigCorreo | null> {
  const filas = await prisma.configuracion.findMany({ where: { clave: { in: [...CLAVES] } } });
  const map = Object.fromEntries(filas.map(f => [f.clave, f]));

  const valor = (clave: string): string => {
    const f = map[clave];
    if (!f?.valor) return "";
    try {
      return f.encrypted ? decryptIfNeeded(f.valor) : f.valor;
    } catch {
      // Clave de cifrado distinta a la que guardó el dato: se trata como
      // ausente en vez de tumbar todo el módulo de compras.
      console.error(`[correo] No se pudo descifrar ${clave} en este entorno.`);
      return "";
    }
  };

  const host = valor("smtp_host");
  const usuario = valor("smtp_user");
  const password = valor("smtp_password");
  if (!host || !usuario || !password) return null;

  const puerto = Number(valor("smtp_port")) || 587;
  return {
    host,
    puerto,
    // El puerto 465 es SMTPS (TLS desde el saludo). El 587 usa STARTTLS,
    // que nodemailer negocia con secure=false.
    seguro: valor("smtp_secure") === "true" || puerto === 465,
    usuario,
    password,
    remitenteNombre: valor("smtp_from_name") || "Costamallas",
    remitenteEmail: valor("smtp_from_email") || usuario,
  };
}

export const correoConfigurado = async () => (await getConfigCorreo()) !== null;

interface Adjunto { filename: string; content: Buffer | string; contentType?: string }

/**
 * Envía un correo. Lanza excepción con un mensaje entendible si algo
 * falla, para poder mostrárselo al usuario y guardarlo en la orden.
 */
export async function enviarCorreo(opciones: {
  para: string | string[];
  copia?: string[];
  asunto: string;
  html: string;
  texto?: string;
  adjuntos?: Adjunto[];
  responderA?: string;
}): Promise<{ messageId: string }> {
  const cfg = await getConfigCorreo();
  if (!cfg) {
    throw new Error(
      "El correo no está configurado. Un administrador debe cargar los datos SMTP en Configuración → Correo.",
    );
  }

  const transporte = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.puerto,
    secure: cfg.seguro,
    auth: { user: cfg.usuario, pass: cfg.password },
    // Sin esto, un servidor que no responde deja la petición colgada
    // hasta el timeout de Vercel y el usuario no sabe qué pasó.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    const info = await transporte.sendMail({
      from: `"${cfg.remitenteNombre}" <${cfg.remitenteEmail}>`,
      to: Array.isArray(opciones.para) ? opciones.para.join(", ") : opciones.para,
      cc: opciones.copia?.length ? opciones.copia.join(", ") : undefined,
      replyTo: opciones.responderA,
      subject: opciones.asunto,
      html: opciones.html,
      text: opciones.texto,
      attachments: opciones.adjuntos,
    });
    return { messageId: info.messageId };
  } catch (e) {
    const msg = (e as Error).message;
    // Los errores de SMTP son crípticos; se traducen los más comunes.
    if (/auth|535|password/i.test(msg)) {
      throw new Error("El servidor rechazó el usuario o la contraseña de correo.");
    }
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) {
      throw new Error(`No se encontró el servidor de correo "${cfg.host}". Revisa el host.`);
    }
    if (/ETIMEDOUT|timeout/i.test(msg)) {
      throw new Error("El servidor de correo no respondió a tiempo. Revisa el host y el puerto.");
    }
    throw new Error(`No se pudo enviar el correo: ${msg}`);
  } finally {
    transporte.close();
  }
}

/** Prueba la conexión sin mandar nada. Para el botón "Probar" del portal. */
export async function probarCorreo(): Promise<{ ok: boolean; mensaje: string }> {
  const cfg = await getConfigCorreo();
  if (!cfg) return { ok: false, mensaje: "Faltan datos: host, usuario o contraseña." };

  const transporte = nodemailer.createTransport({
    host: cfg.host, port: cfg.puerto, secure: cfg.seguro,
    auth: { user: cfg.usuario, pass: cfg.password },
    connectionTimeout: 15_000, greetingTimeout: 10_000,
  });
  try {
    await transporte.verify();
    return { ok: true, mensaje: `Conectado a ${cfg.host}:${cfg.puerto} como ${cfg.usuario}` };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message.slice(0, 200) };
  } finally {
    transporte.close();
  }
}
