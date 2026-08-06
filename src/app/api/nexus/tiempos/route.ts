// ============================================================
// GET  /api/nexus/tiempos   ¿se cumple el compromiso de responder en 1 h?
// POST /api/nexus/tiempos   ajusta el compromiso y el horario de atención
//
// El dato (`primeraRespuestaEn`) se guardaba desde la Fase 4 y no lo
// miraba nadie. Esto es lo que lo convierte en un indicador.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { informeTiempos, setConfigTiempos, getConfigTiempos } from "@/lib/nexus/tiempos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  // Ventana en días. 30 por defecto: menos no da para ver una tendencia y
  // más empieza a mezclar meses con equipos distintos.
  const dias = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("dias")) || 30));

  return NextResponse.json({ success: true, data: await informeTiempos(dias) });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();

  const compromisoMin = b.compromisoMin == null ? undefined : Number(b.compromisoMin);
  const horaInicio = b.horaInicio == null ? undefined : Number(b.horaInicio);
  const horaFin = b.horaFin == null ? undefined : Number(b.horaFin);

  if (compromisoMin != null && (!Number.isFinite(compromisoMin) || compromisoMin < 1 || compromisoMin > 10_080)) {
    return NextResponse.json({ success: false, error: "El compromiso debe ir entre 1 minuto y una semana." }, { status: 400 });
  }
  if (horaInicio != null && horaFin != null && horaFin <= horaInicio) {
    return NextResponse.json({ success: false, error: "La hora de cierre tiene que ser mayor que la de apertura." }, { status: 400 });
  }

  const dias: number[] | undefined = Array.isArray(b.dias)
    ? [...new Set((b.dias as unknown[]).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))]
    : undefined;
  if (dias && !dias.length) {
    return NextResponse.json({ success: false, error: "Tiene que quedar al menos un día hábil." }, { status: 400 });
  }

  await setConfigTiempos({ compromisoMin, horaInicio, horaFin, dias });
  return NextResponse.json({ success: true, data: await getConfigTiempos() });
}
