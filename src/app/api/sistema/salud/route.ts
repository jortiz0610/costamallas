// ============================================================
// GET /api/sistema/salud — ¿está todo funcionando?
//
// Lo lee la pantalla de Estado del sistema. Solo lectura.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { revisarSalud } from "@/lib/salud";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  // Dice qué está conectado y qué no: es información de administración.
  if (!esAdmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: await revisarSalud() });
}
