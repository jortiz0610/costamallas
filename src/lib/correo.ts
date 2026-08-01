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
import { decryptIfNeeded, encrypt } from "@/lib/encryption";

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

/**
 * Estado de la configuración para mostrar en el portal, **sin la
 * contraseña**. `descifra` en false significa que hay una contraseña
 * guardada que este entorno no puede leer: se cargó con otra
 * ENCRYPTION_KEY (típicamente desde local hacia producción).
 */
export async function estadoCorreo(): Promise<{
  configurado: boolean;
  descifra: boolean;
  host: string; puerto: string; seguro: boolean;
  usuario: string; remitenteNombre: string; remitenteEmail: string;
  tienePassword: boolean;
}> {
  const filas = await prisma.configuracion.findMany({ where: { clave: { in: [...CLAVES] } } });
  const map = Object.fromEntries(filas.map(f => [f.clave, f]));
  const plano = (clave: string) => map[clave]?.valor ?? "";

  const pass = map["smtp_password"];
  let descifra = true;
  if (pass?.valor) {
    try {
      const v = pass.encrypted ? decryptIfNeeded(pass.valor) : pass.valor;
      descifra = Boolean(v);
    } catch {
      descifra = false;
    }
  }

  return {
    configurado: (await getConfigCorreo()) !== null,
    descifra,
    host: plano("smtp_host"),
    puerto: plano("smtp_port") || "587",
    seguro: plano("smtp_secure") === "true",
    usuario: plano("smtp_user"),
    remitenteNombre: plano("smtp_from_name"),
    remitenteEmail: plano("smtp_from_email"),
    tienePassword: Boolean(pass?.valor),
  };
}

/**
 * Guarda la configuración SMTP. La contraseña se cifra; si llega vacía
 * se deja la que ya estaba, para poder cambiar el puerto o el remitente
 * sin tener que volver a escribirla.
 */
export async function setConfigCorreo(datos: Partial<Record<(typeof CLAVES)[number], string>>) {
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined) continue;
    const cifrar = clave === "smtp_password";
    if (cifrar && !valor) continue;
    const guardado = cifrar ? encrypt(valor) : valor;
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: guardado, encrypted: cifrar },
      update: { valor: guardado, encrypted: cifrar },
    });
  }
}

/** Borra las credenciales SMTP. Deja de poder enviarse correo. */
export async function borrarConfigCorreo() {
  await prisma.configuracion.deleteMany({ where: { clave: { in: [...CLAVES] } } });
}

/** Quita las claves vacías o indefinidas para que no pisen lo guardado. */
function limpiar(o?: Partial<ConfigCorreo>): Partial<ConfigCorreo> {
  if (!o) return {};
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Partial<ConfigCorreo>;
}

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

/**
 * Prueba la conexión sin mandar nada. Para el botón "Probar" del portal.
 *
 * Acepta valores sueltos para poder probar lo que el usuario acaba de
 * escribir antes de guardarlo. Lo que no venga se toma de lo guardado
 * (así se prueba un host nuevo sin volver a teclear la contraseña).
 */
export async function probarCorreo(
  override?: Partial<ConfigCorreo>,
): Promise<{ ok: boolean; mensaje: string }> {
  const guardada = await getConfigCorreo();
  const mezcla = { ...(guardada ?? {}), ...limpiar(override) } as Partial<ConfigCorreo>;
  const cfg =
    mezcla.host && mezcla.usuario && mezcla.password
      ? {
          host: mezcla.host,
          puerto: mezcla.puerto || 587,
          seguro: mezcla.seguro ?? mezcla.puerto === 465,
          usuario: mezcla.usuario,
          password: mezcla.password,
          remitenteNombre: mezcla.remitenteNombre || "Costamallas",
          remitenteEmail: mezcla.remitenteEmail || mezcla.usuario,
        }
      : null;
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
