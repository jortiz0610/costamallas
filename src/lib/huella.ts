// ============================================================
// Entrar con huella, Face ID o el PIN del equipo.
//
// ── Qué es y qué NO es ──
//
// SÍ es un segundo modo de entrar en un dispositivo que YA pasó por
// contraseña + doble factor. La huella no viaja a ningún lado: el
// teléfono guarda la llave privada en su chip seguro y solo nos manda
// una firma. Aquí no se almacena ninguna huella, ni se podría.
//
// NO reemplaza el doble factor, lo respeta. La credencial solo se puede
// registrar desde una sesión ya iniciada, o sea DESPUÉS de haber pasado
// la contraseña y el código. Para tener huella en un teléfono, antes hubo
// que autenticarse entero en ese teléfono.
//
// ── Por qué hace falta ──
//
// Un asesor en la calle entra al portal varias veces al día. Escribir una
// contraseña larga y buscar el código de la app cada vez, con una mano y
// bajo el sol, es cómo se llega a "mejor lo hago cuando vuelva a la
// oficina" — y lo que no se registra en el momento no se registra.
// ============================================================

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/**
 * El dominio de la llave. WebAuthn ata cada credencial a UN dominio, y
 * si no coincide el navegador se niega sin decir por qué.
 *
 * Se saca de la URL del portal en vez de escribirse: con el dominio a
 * mano, mover el portal rompería la huella de todo el mundo y nadie
 * relacionaría una cosa con la otra.
 */
export function dominioDe(origen: string): { rpID: string; origin: string } {
  try {
    const u = new URL(origen);
    return { rpID: u.hostname, origin: u.origin };
  } catch {
    return { rpID: "localhost", origin: origen };
  }
}

/** El reto se guarda en una cookie corta: es de un solo uso y de un minuto. */
const COOKIE_RETO = "cm_wa_reto";

export async function guardarReto(reto: string) {
  (await cookies()).set(COOKIE_RETO, reto, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Dos minutos. Suficiente para poner el dedo, poco para que sirva de
    // algo si alguien lo intercepta.
    maxAge: 120,
  });
}

export async function leerReto(): Promise<string | null> {
  return (await cookies()).get(COOKIE_RETO)?.value ?? null;
}

export async function borrarReto() {
  (await cookies()).delete(COOKIE_RETO);
}

/** Las credenciales de una persona, para ofrecerlas o para excluirlas. */
export async function credencialesDe(usuarioId: string) {
  return prisma.credencialWebauthn.findMany({
    where: { usuarioId },
    select: {
      id: true, credentialId: true, publicKey: true, contador: true,
      apodo: true, transports: true, ultimoUsoEn: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * ¿Este correo tiene huella registrada?
 *
 * Lo consulta la pantalla de entrada para decidir si ofrece el botón. Se
 * responde con un simple sí/no y NUNCA con las credenciales: decirle a
 * un desconocido qué llaves tiene una cuenta es regalarle la mitad del
 * trabajo.
 */
export async function tieneHuella(email: string): Promise<boolean> {
  const u = await prisma.usuario.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, activo: true },
  });
  if (!u || !u.activo) return false;
  return (await prisma.credencialWebauthn.count({ where: { usuarioId: u.id } })) > 0;
}

/** Un nombre reconocible para el dispositivo, sacado del navegador. */
export function apodoDeDispositivo(userAgent: string): string {
  const ua = userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Teléfono Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Computador Windows";
  return "Este dispositivo";
}
