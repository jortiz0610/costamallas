// ============================================================
// GET  /api/auth/huella/entrar — pedir el reto para entrar
// POST /api/auth/huella/entrar — comprobar la firma y abrir sesión
//
// Es PÚBLICO: se llama desde la pantalla de entrada, sin sesión. Por eso
// las tres cosas de abajo no son opcionales.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { dominioDe, guardarReto, leerReto, borrarReto } from "@/lib/huella";
import { urlPortal } from "@/lib/url-portal";
import { recordarDispositivo } from "@/lib/twofa";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!rateLimit(`huella-reto:${ip}`, 20, 60_000).success) {
    return NextResponse.json({ success: false, error: "Demasiados intentos." }, { status: 429 });
  }

  const { rpID } = dominioDe(urlPortal(req));

  // NO se listan credenciales.
  //
  // Se podría pasar `allowCredentials` con las llaves del correo que
  // escriba la persona, pero eso convierte este endpoint en un detector
  // de cuentas: cualquiera podría preguntar por correos hasta dar con
  // uno. Con la lista vacía, el navegador ofrece las llaves que tenga
  // guardadas para este dominio y nosotros no confirmamos nada.
  const opciones = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });

  await guardarReto(opciones.challenge);
  return NextResponse.json({ success: true, data: opciones });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!rateLimit(`huella-entrar:${ip}`, 10, 60_000).success) {
    return NextResponse.json({ success: false, error: "Demasiados intentos." }, { status: 429 });
  }

  const reto = await leerReto();
  if (!reto) {
    return NextResponse.json(
      { success: false, error: "Se acabó el tiempo. Vuelve a intentarlo." },
      { status: 400 },
    );
  }

  const cuerpo = (await req.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!cuerpo?.id) {
    return NextResponse.json({ success: false, error: "Respuesta inválida" }, { status: 400 });
  }

  try {
    const cred = await prisma.credencialWebauthn.findUnique({
      where: { credentialId: cuerpo.id },
      include: {
        usuario: { select: { id: true, email: true, rol: true, activo: true, nombre: true } },
      },
    });

    // Mismo mensaje para "no existe" y "está desactivado": distinguirlos
    // le diría a quien prueba llaves cuáles son de una cuenta real.
    if (!cred || !cred.usuario.activo) {
      return NextResponse.json({ success: false, error: "No se pudo entrar" }, { status: 401 });
    }

    const { rpID, origin } = dominioDe(urlPortal(req));
    const r = await verifyAuthenticationResponse({
      response: cuerpo,
      expectedChallenge: reto,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64url")),
        counter: Number(cred.contador),
        transports: cred.transports
          ? (cred.transports.split(",") as never)
          : undefined,
      },
    });

    if (!r.verified) {
      return NextResponse.json({ success: false, error: "No se pudo entrar" }, { status: 401 });
    }

    // El contador solo puede subir. Que no suba en un autenticador que sí
    // lo lleva significa credencial clonada; se registra pero no se
    // bloquea la entrada, porque muchos autenticadores de teléfono
    // devuelven siempre 0 y bloquear ahí dejaría a media empresa fuera.
    const nuevo = BigInt(r.authenticationInfo.newCounter);
    if (nuevo > BigInt(0) && nuevo <= cred.contador) {
      console.error(`[huella] Contador sospechoso en ${cred.credentialId} (${cred.usuarioId})`);
    }

    await prisma.credencialWebauthn.update({
      where: { id: cred.id },
      data: { contador: nuevo, ultimoUsoEn: new Date() },
    });

    // Exactamente la misma sesión que abre el login normal: mismo
    // contenido en el token y mismo refresh guardado en la base. Una
    // sesión "de huella" con otra forma acabaría comportándose distinto
    // en algún sitio y nadie sabría por qué.
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        sub: cred.usuario.id,
        email: cred.usuario.email,
        nombre: cred.usuario.nombre,
        rol: cred.usuario.rol,
      }),
      signRefreshToken(cred.usuario.id),
    ]);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        usuarioId: cred.usuario.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.usuario.update({
      where: { id: cred.usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    await setAuthCookies(accessToken, refreshToken);

    // La huella solo se pudo registrar desde una sesión que YA pasó el
    // doble factor en este aparato, así que entrar con ella mantiene la
    // confianza del dispositivo en vez de volver a pedir el código.
    await recordarDispositivo(cred.usuario.id);

    return NextResponse.json({
      success: true,
      data: { nombre: cred.usuario.nombre, rol: cred.usuario.rol },
    });
  } catch {
    return NextResponse.json({ success: false, error: "No se pudo entrar" }, { status: 401 });
  } finally {
    await borrarReto();
  }
}
