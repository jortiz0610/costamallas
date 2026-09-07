// ============================================================
// GET /api/sistema/recursos — qué está gastando el portal
//
// Solo lectura y solo para administración: decir cuánta memoria queda y
// cómo se llama la máquina es información de sistemas, no del negocio.
//
// La pantalla la pregunta cada pocos segundos, así que tiene que ser
// barata. Lo único que toca la base es un `SELECT 1` para medir cuánto
// tarda en contestar.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { medirRecursos } from "@/lib/recursos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: await medirRecursos() });
}
