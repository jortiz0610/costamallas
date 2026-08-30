// ============================================================
// GET /api/auth/me
//
// Además del usuario devuelve sus PERMISOS ya calculados (rol + las
// excepciones suyas). El navegador no puede calcularlos solo: las
// excepciones están en la base. Van aquí y no en el token porque un
// permiso que se otorga debe surtir efecto sin reemitir la sesión.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { permisosDe } from "@/lib/permisos-server";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: user.sub },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, ultimoAcceso: true },
  });

  if (!usuario || !usuario.activo) {
    return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
  }

  const permisos = await permisosDe(usuario.id, user.rol);

  return NextResponse.json({
    success: true,
    data: {
      ...usuario,
      permisos: [...permisos],
    },
  });
}
