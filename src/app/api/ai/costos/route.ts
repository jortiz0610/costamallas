// ============================================================
// GET /api/ai/costos — qué cuesta cada tarea de IA
//
// Lo consulta el aviso flotante que sale al lado de cada botón de IA,
// para que nadie apriete sin saber qué está gastando. El número sale
// del historial real de `logs`, no de una estimación, salvo que la tarea
// no se haya usado nunca.
//
// Lo puede leer cualquiera que entre al portal: quien va a apretar el
// botón es quien tiene que ver el precio. Esconderlo a los asesores
// sería justo al revés de para qué existe.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { costosIA } from "@/lib/costos-ia";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  return NextResponse.json({ success: true, data: await costosIA() });
}
