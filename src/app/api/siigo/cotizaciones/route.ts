// ============================================================
// POST /api/siigo/cotizaciones — traer el histórico de SIIGO
//
// Mismas reglas que la de clientes: solo administración o `CRON_SECRET`,
// y NO ESCRIBE salvo que se pida con ?ensayo=0.
//
// Son 6.323 ofertas con 22.531 líneas. Tarda, y por eso el tope de
// duración es alto.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/lib/auth";
import { importarCotizacionesSiigo } from "@/lib/siigo/importar-cotizaciones";
import { credencialesSiigo } from "@/lib/siigo/cliente-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 800;

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
      { success: false, error: "SIIGO no está configurado." },
      { status: 400 },
    );
  }

  const ensayo = req.nextUrl.searchParams.get("ensayo") !== "0";
  const maxPaginas = Number(req.nextUrl.searchParams.get("paginas")) || undefined;

  const inicio = Date.now();
  try {
    const r = await importarCotizacionesSiigo({ ensayo, maxPaginas });

    if (!ensayo) {
      await prisma.log.create({
        data: {
          usuarioId: quien.usuarioId ?? null,
          accion: "SIIGO_IMPORTAR_COTIZACIONES",
          detalle: `${r.creadas} creadas, ${r.yaEstaban} ya estaban, ${r.sinCliente} sin cliente, ${r.errores.length} con error`,
          resultado: r.errores.length ? "PARCIAL" : "OK",
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...r,
        errores: r.errores.slice(0, 50),
        erroresTotal: r.errores.length,
        duracionSegundos: Math.round((Date.now() - inicio) / 1000),
      },
    });
  } catch (e) {
    console.error("[siigo/cotizaciones]", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error importando" },
      { status: 500 },
    );
  }
}
