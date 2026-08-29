// ============================================================
// GET  /api/crm/clientes/estados      — qué estado le tocaría a cada uno
// POST /api/crm/clientes/estados      — recalcular y guardar
//
// El GET no escribe nada: sirve para mirar antes de tocar. Se usa en la
// pantalla de clientes para poder decir "hay 3 fichas desfasadas" sin
// haberlas cambiado todavía.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { recalcularEstados } from "@/lib/estados-cliente-server";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const resumen = await recalcularEstados({ dry: true });
  return NextResponse.json({ success: true, data: resumen });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  // Reescribe el estado de todas las fichas: es de administración.
  if (!esAdmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Solo un administrador puede recalcular los estados" }, { status: 403 });
  }

  const resumen = await recalcularEstados();
  return NextResponse.json({ success: true, data: resumen });
}
