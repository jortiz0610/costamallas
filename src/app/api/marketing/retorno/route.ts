// ============================================================
// GET /api/marketing/retorno — plata real por fuente y campaña.
//
// A diferencia de /api/marketing/campanas, que devuelve lo que alguien
// tecleó, esto se calcula siguiendo la cadena lead → cliente →
// cotizaciones → pedidos. Solo lectura.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { calcularRetorno } from "@/lib/atribucion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const dias = Math.min(730, Math.max(1, Number(req.nextUrl.searchParams.get("dias")) || 90));
  return NextResponse.json({ success: true, data: await calcularRetorno(dias) });
}
