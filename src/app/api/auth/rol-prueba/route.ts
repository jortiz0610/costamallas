// ============================================================
// POST   /api/auth/rol-prueba  { rol }   entrar al modo prueba
// DELETE /api/auth/rol-prueba            salir
//
// "Ver el portal como…". Solo el superadministrador, y solo de lectura:
// el middleware rechaza toda escritura mientras esté activo.
//
// ⚠️ El rol se comprueba contra el TOKEN, no contra `getUserFromRequest`.
// Esa función ya devuelve el rol de prueba aplicado, así que usarla aquí
// permitiría lo siguiente: ponerse VENDEDOR y desde ahí ponerse ADMIN,
// porque la comprobación vería "VENDEDOR" y no "SUPERADMIN"… o al revés,
// dejaría atrapado a quien ya está en modo prueba. Se lee el token
// directo para saber quién es DE VERDAD.
//
// Esta ruta está en la lista de escapes del middleware: si no, entrar en
// modo prueba bloquearía la petición que sirve para salir de él.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { COOKIE_ROL_PRUEBA, esRolProbable, ROLES_PROBABLES } from "@/lib/rol-prueba";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Quién es de verdad, ignorando cualquier rol de prueba puesto. */
async function usuarioReal(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function GET(req: NextRequest) {
  const real = await usuarioReal(req);
  if (!real) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const activo = req.cookies.get(COOKIE_ROL_PRUEBA)?.value;
  return NextResponse.json({
    success: true,
    data: {
      puede: real.rol === "SUPERADMIN",
      rolReal: real.rol,
      rolPrueba: esRolProbable(activo) ? activo : null,
      roles: ROLES_PROBABLES,
    },
  });
}

export async function POST(req: NextRequest) {
  const real = await usuarioReal(req);
  if (!real) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (real.rol !== "SUPERADMIN") {
    return NextResponse.json(
      { success: false, error: "Solo el superadministrador puede probar otros roles" },
      { status: 403 },
    );
  }

  const { rol } = await req.json().catch(() => ({ rol: null }));
  if (!esRolProbable(rol)) {
    return NextResponse.json({ success: false, error: "Ese rol no se puede probar" }, { status: 400 });
  }

  await prisma.log
    .create({
      data: {
        usuarioId: real.sub,
        accion: "ROL_PRUEBA_ENTRAR",
        detalle: `Viendo el portal como ${rol}`,
        resultado: "solo lectura",
      },
    })
    .catch(() => undefined);

  const res = NextResponse.json({ success: true, data: { rol } });
  res.cookies.set(COOKIE_ROL_PRUEBA, rol, {
    // No es httpOnly: la pantalla necesita saber que está activo para
    // pintar el aviso, y su valor no es un secreto — el permiso lo da el
    // token, no esta cookie.
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Se cae sola en 2 horas: olvidarse el modo puesto y creer que el
    // portal está roto es el fallo probable de esto.
    maxAge: 2 * 60 * 60,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const real = await usuarioReal(req);
  if (!real) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_ROL_PRUEBA, "", { path: "/", maxAge: 0 });
  return res;
}
