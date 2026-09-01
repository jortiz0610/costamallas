// ============================================================
// GET    /api/sistema/ensayo — qué hay del ensayo ahora mismo
// POST   /api/sistema/ensayo — correr un paso  { paso, correo }
// DELETE /api/sistema/ensayo — borrar todo lo del ensayo
//
// Escribe en producción a propósito: es lo que hace que la prueba sirva.
// Todo lo que crea queda marcado como prueba y se borra en bloque.
//
// Solo superadministrador: crea datos y manda correos de verdad.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";
import { correrPaso, limpiarEnsayo, PASOS, MARCA_ENSAYO, type ClavePaso } from "@/lib/ensayo";
import { prisma } from "@/lib/prisma";
import { correoConfigurado } from "@/lib/correo";

export const dynamic = "force-dynamic";

async function guardia(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 }) };
  if (!esSuperadmin(user.rol)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Solo el superadministrador puede correr el ensayo: crea datos y manda correos de verdad." },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const [cliente, cotizaciones, pedidos, hayCorreo] = await Promise.all([
    prisma.cliente.findFirst({
      where: { nombre: { startsWith: MARCA_ENSAYO } },
      orderBy: { createdAt: "desc" },
      select: { id: true, nombre: true, email: true, createdAt: true },
    }),
    prisma.cotizacion.count({ where: { esPrueba: true } }),
    prisma.pedido.count({ where: { esPrueba: true } }),
    correoConfigurado(),
  ]);

  return NextResponse.json({
    success: true,
    data: { pasos: PASOS, cliente, cotizaciones, pedidos, hayCorreo },
  });
}

export async function POST(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const paso = String(body.paso ?? "") as ClavePaso;
  const correo = String(body.correo ?? "").trim();

  if (!PASOS.some(p => p.clave === paso)) {
    return NextResponse.json({ success: false, error: `No existe el paso «${paso}».` }, { status: 400 });
  }
  // Solo el primer paso necesita el correo, pero se exige siempre: es lo
  // que garantiza que nadie corra el ensayo sin haber decidido a dónde
  // van a llegar los mensajes.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return NextResponse.json(
      { success: false, error: "Escribe un correo válido: es a donde va a llegar todo." },
      { status: 400 },
    );
  }

  const resultado = await correrPaso(paso, correo, g.user!.sub);
  return NextResponse.json({ success: true, data: resultado });
}

export async function DELETE(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const resumen = await limpiarEnsayo({ dry });
  return NextResponse.json({ success: true, data: resumen });
}
