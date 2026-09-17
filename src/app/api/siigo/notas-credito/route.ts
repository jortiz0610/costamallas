// ============================================================
// POST /api/siigo/notas-credito
//
// Mismas reglas que las demas importaciones: solo administracion o
// `CRON_SECRET`, y NO ESCRIBE salvo que se pida con ?ensayo=0.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/lib/auth";
import { importarNotasCreditoSiigo } from "@/lib/siigo/importar-notas-credito";
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
    return NextResponse.json({ success: false, error: "SIIGO no esta configurado." }, { status: 400 });
  }

  const ensayo = req.nextUrl.searchParams.get("ensayo") !== "0";
  const inicio = Date.now();
  try {
    const r = await importarNotasCreditoSiigo({ ensayo });
    if (!ensayo) {
      await prisma.log.create({
        data: {
          usuarioId: quien.usuarioId ?? null,
          accion: "SIIGO_IMPORTAR_NOTAS",
          detalle: JSON.stringify(r).slice(0, 500),
          resultado: r.errores.length ? "PARCIAL" : "OK",
        },
      }).catch(() => undefined);
    }
    return NextResponse.json({
      success: true,
      data: { ...r, errores: r.errores.slice(0, 50), erroresTotal: r.errores.length,
              duracionSegundos: Math.round((Date.now() - inicio) / 1000) },
    });
  } catch (e) {
    console.error("[siigo/notas-credito]", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error importando" },
      { status: 500 },
    );
  }
}
