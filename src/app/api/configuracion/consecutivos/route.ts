// ============================================================
// GET  /api/configuracion/consecutivos   numeración de cada documento
// POST /api/configuracion/consecutivos   fija número, prefijo y dígitos
//
// Existe porque una empresa que viene de otro sistema necesita CONTINUAR
// su numeración, no empezar de cero. Costamallas llevaba 12.063
// cotizaciones en SIIGO: arrancar en COT-00001 le habría dicho a cada
// cliente que son nuevos.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { estadoConsecutivo, fijarConsecutivo, TIPOS, type TipoDocumento } from "@/lib/consecutivos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  return NextResponse.json({
    success: true,
    data: await Promise.all(TIPOS.map(t => estadoConsecutivo(t))),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  const tipo = String(b.tipo ?? "") as TipoDocumento;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ success: false, error: "Tipo de documento desconocido" }, { status: 400 });
  }

  const r = await fijarConsecutivo(tipo, {
    desde: b.desde === undefined || b.desde === "" ? undefined : Number(b.desde),
    prefijo: b.prefijo === undefined ? undefined : String(b.prefijo),
    digitos: b.digitos === undefined || b.digitos === "" ? undefined : Number(b.digitos),
  });

  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });

  const estado = await estadoConsecutivo(tipo);
  return NextResponse.json({
    success: true,
    data: estado,
    mensaje: `El próximo documento será ${estado.proximo}`,
  });
}
