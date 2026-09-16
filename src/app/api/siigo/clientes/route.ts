// ============================================================
// POST /api/siigo/clientes — traer los clientes de SIIGO al CRM
//
// Solo administración. Traer 4.284 clientes es una operación que se hace
// una vez y se nota en todo el CRM; no es algo que deba poder disparar
// cualquiera con sesión.
//
// ?ensayo=1 → dice exactamente qué haría, sin escribir nada. Es el modo
// POR DEFECTO a propósito: para que escriba de verdad hay que pedirlo.
// Una importación masiva que se dispara sola por un clic mal dado no
// tiene vuelta atrás cómoda.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/lib/auth";
import { importarClientesSiigo } from "@/lib/siigo/importar-clientes";
import { credencialesSiigo } from "@/lib/siigo/cliente-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 43 páginas de 100 clientes contra una API ajena. El tope por defecto
// se queda corto y la importación moriría a la mitad.
export const maxDuration = 300;

/**
 * Quién puede disparar esto: un administrador con sesión, o el servidor
 * con el `CRON_SECRET`.
 *
 * Lo segundo es el mismo trato que `/api/cron/diario` y existe por una
 * razón práctica: la primera importación se lanza desde el servidor,
 * antes de que exista un botón en ninguna pantalla, y sin esto habría
 * que inventarse una sesión para poder correrla.
 */
async function autorizado(req: NextRequest): Promise<{ ok: boolean; usuarioId?: string }> {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get("authorization") === `Bearer ${secreto}`) return { ok: true };
  const user = await getUserFromRequest(req);
  if (user && isAdmin(user)) return { ok: true, usuarioId: user.sub };
  return { ok: false };
}

export async function POST(req: NextRequest) {
  const quien = await autorizado(req);
  if (!quien.ok) {
    return NextResponse.json(
      { success: false, error: "Solo un administrador puede importar desde SIIGO." },
      { status: 403 },
    );
  }

  if (!(await credencialesSiigo())) {
    return NextResponse.json(
      { success: false, error: "SIIGO no está configurado. Faltan el usuario y la clave de API." },
      { status: 400 },
    );
  }

  // Sin ?ensayo=0 explícito, NO escribe.
  const ensayo = req.nextUrl.searchParams.get("ensayo") !== "0";
  const maxPaginas = Number(req.nextUrl.searchParams.get("paginas")) || undefined;

  const inicio = Date.now();
  try {
    const r = await importarClientesSiigo({ ensayo, maxPaginas });

    if (!ensayo) {
      await prisma.log.create({
        data: {
          // Sin sesion -disparo desde el servidor- no hay usuario a quien
          // atribuirlo, y el registro lo dice en vez de inventarse uno.
          usuarioId: quien.usuarioId ?? null,
          accion: "SIIGO_IMPORTAR_CLIENTES",
          detalle: `${r.creados} creados, ${r.actualizados} completados, ${r.sinCambios} sin cambios, ${r.errores.length} con error`,
          resultado: r.errores.length ? "PARCIAL" : "OK",
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...r,
        // Las listas completas pueden traer miles de filas; se recortan
        // para que la respuesta sea legible y no un volcado.
        omitidos: r.omitidos.slice(0, 50),
        omitidosTotal: r.omitidos.length,
        errores: r.errores.slice(0, 50),
        erroresTotal: r.errores.length,
        duracionSegundos: Math.round((Date.now() - inicio) / 1000),
      },
    });
  } catch (e) {
    console.error("[siigo/clientes]", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error importando desde SIIGO" },
      { status: 500 },
    );
  }
}
