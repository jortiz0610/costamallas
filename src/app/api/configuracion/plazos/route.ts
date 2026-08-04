// ============================================================
// GET  /api/configuracion/plazos   formas de pago y sus días
// POST /api/configuracion/plazos
//
// Lo lee cualquiera con sesión: el formulario de factura necesita el
// desplegable. Solo un administrador lo cambia, porque de aquí sale la
// fecha con la que se cobra.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { getPlazosPago, setPlazosPago, PLAZOS_DEFAULTS } from "@/lib/plazos-pago";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ success: true, data: await getPlazosPago(), defaults: PLAZOS_DEFAULTS });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  if (!Array.isArray(b.plazos)) {
    return NextResponse.json({ success: false, error: "Faltan las formas de pago" }, { status: 400 });
  }

  try {
    await setPlazosPago(b.plazos);
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: await getPlazosPago() });
}
