// ============================================================
// GET/POST /api/cron/diario — la corrida diaria del portal
// ------------------------------------------------------------
// Hace dos cosas:
//   1. Vencer lo que caducó (cotizaciones y facturas).
//   2. El seguimiento post-cotización.
//
// En ese orden a propósito: primero se vence y después se hace el
// seguimiento, para no perseguir una oferta que ya caducó esta misma
// madrugada.
//
// Existe como ruta "diaria" y no como "/api/cron/seguimiento" por una
// limitación concreta del plan: **Vercel Hobby permite 2 crons y solo
// frecuencia diaria**. Ya hay uno (sync-woo), así que este es el último
// cupo. Todo lo demás que haya que correr una vez al día tiene que
// entrar aquí dentro, no como un cron nuevo.
//
// Un cron más frecuente que diario no falla suave: rompe el deploy
// entero y el auto-deploy se cae en silencio.
//
// La ejecuta Vercel Cron con `Authorization: Bearer <CRON_SECRET>`, y
// también puede dispararla un administrador desde el portal.
//
// ?dry=1 → dice qué haría, sin mandar ni escribir nada.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { correrSeguimientos } from "@/lib/seguimiento";
import { marcarVencidos } from "@/lib/vencimientos";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function autorizado(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true; // Vercel Cron
  const user = await getUserFromRequest(req); // disparo manual desde el portal
  return !!user && (user.rol === "ADMIN" || user.rol === "SUPERADMIN");
}

async function handle(req: NextRequest) {
  if (!(await autorizado(req))) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const inicio = Date.now();

  try {
    // Primero vencer, después perseguir: si no, el seguimiento le manda
    // el "su oferta vence mañana" a una que caducó anoche.
    const vencimientos = await marcarVencidos({ dry });
    const seguimiento = await correrSeguimientos({ dry });

    return NextResponse.json({
      success: true,
      data: {
        dryRun: dry,
        duracionMs: Date.now() - inicio,
        vencimientos,
        seguimiento,
      },
    });
  } catch (err) {
    console.error("[cron/diario]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error en la corrida diaria" },
      { status: 500 },
    );
  }
}

export const GET = handle;  // Vercel Cron
export const POST = handle; // botón del portal
