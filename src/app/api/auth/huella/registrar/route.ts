// ============================================================
// GET  /api/auth/huella/registrar — pedir el reto para registrar
// POST /api/auth/huella/registrar — guardar la llave pública
// DELETE                          — quitar una credencial
//
// Solo desde una sesión YA iniciada. Ese es el detalle que hace que esto
// no debilite el doble factor: para registrar la huella en un teléfono
// hubo que entrar antes en ese teléfono con contraseña y código.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import {
  generateRegistrationOptions, verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import {
  dominioDe, guardarReto, leerReto, borrarReto, credencialesDe, apodoDeDispositivo,
} from "@/lib/huella";
import { urlPortal } from "@/lib/url-portal";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { rpID } = dominioDe(urlPortal(req));
  const usuario = await prisma.usuario.findUnique({
    where: { id: user.sub },
    select: { email: true, nombre: true },
  });
  const yaTiene = await credencialesDe(user.sub);

  const opciones = await generateRegistrationOptions({
    rpName: "Costamallas",
    rpID,
    userName: usuario?.email ?? user.sub,
    userDisplayName: usuario?.nombre ?? usuario?.email ?? "",
    // Que no registre dos veces la misma huella en el mismo aparato: el
    // navegador avisa en vez de crear una credencial duplicada que luego
    // nadie sabe cuál es.
    excludeCredentials: yaTiene.map(c => ({ id: c.credentialId })),
    authenticatorSelection: {
      // "platform" = el sensor del propio aparato (huella, Face ID, PIN).
      // Sin esto, el navegador ofrece también llaves USB, que aquí no
      // sirven para nada y confunden.
      authenticatorAttachment: "platform",
      // La llave se queda en el dispositivo, así se puede entrar sin
      // escribir el correo primero.
      residentKey: "preferred",
      // Exige el gesto: huella, cara o PIN. Sin esto, un teléfono
      // desbloqueado en una mesa entra solo.
      userVerification: "required",
    },
    attestationType: "none",
  });

  await guardarReto(opciones.challenge);
  return NextResponse.json({ success: true, data: opciones });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const reto = await leerReto();
  if (!reto) {
    return NextResponse.json(
      { success: false, error: "Se acabó el tiempo. Vuelve a intentarlo." },
      { status: 400 },
    );
  }

  const { rpID, origin } = dominioDe(urlPortal(req));
  const cuerpo = (await req.json().catch(() => null)) as RegistrationResponseJSON | null;
  if (!cuerpo) return NextResponse.json({ success: false, error: "Respuesta inválida" }, { status: 400 });

  try {
    const r = await verifyRegistrationResponse({
      response: cuerpo,
      expectedChallenge: reto,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!r.verified || !r.registrationInfo) {
      return NextResponse.json({ success: false, error: "No se pudo verificar" }, { status: 400 });
    }

    const { credential } = r.registrationInfo;

    await prisma.credencialWebauthn.create({
      data: {
        usuarioId: user.sub,
        credentialId: credential.id,
        // La llave pública es binaria; se guarda en base64url para que
        // quepa en una columna de texto sin transformaciones raras.
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        contador: BigInt(credential.counter),
        transports: credential.transports?.join(",") ?? null,
        apodo: apodoDeDispositivo(req.headers.get("user-agent") ?? ""),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 400 },
    );
  } finally {
    // De un solo uso, salga bien o mal.
    await borrarReto();
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  // El `usuarioId` en el where no sobra: sin él, cualquiera con una
  // sesión podría borrar la llave de otro pasando su id.
  const r = await prisma.credencialWebauthn.deleteMany({
    where: { id, usuarioId: user.sub },
  });

  return NextResponse.json({ success: r.count > 0 });
}
