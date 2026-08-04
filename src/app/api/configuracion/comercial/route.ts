// ============================================================
// GET  /api/configuracion/comercial   tope de descuento y anticipo mínimo
// POST /api/configuracion/comercial
//
// La leen todos (el asesor tiene que ver contra qué se compara lo que
// está cotizando); solo un administrador la cambia.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import {
  getPoliticaComercial, setPoliticaComercial, POLITICA_DEFAULTS,
} from "@/lib/politica-comercial";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  return NextResponse.json({
    success: true,
    data: await getPoliticaComercial(),
    defaults: POLITICA_DEFAULTS,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();

  const pct = (v: unknown, nombre: string): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`${nombre} tiene que ir entre 0 y 100.`);
    return n;
  };

  try {
    await setPoliticaComercial({
      descuentoMaxPct: pct(b.descuentoMaxPct, "El descuento máximo"),
      anticipoMinPct: pct(b.anticipoMinPct, "El anticipo mínimo"),
      exigirAprobacion: typeof b.exigirAprobacion === "boolean" ? b.exigirAprobacion : undefined,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: await getPoliticaComercial() });
}
