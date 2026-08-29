// ============================================================
// GET    /api/crm/cotizaciones/pruebas — cuántas hay, sin borrar nada
// DELETE /api/crm/cotizaciones/pruebas — borrarlas todas, con sus pedidos
//
// El GET existe para poder decir "se van a borrar 7" ANTES de que
// alguien confirme. Un borrado en bloque que no dice cuánto va a borrar
// se pulsa a ciegas.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";
import { borrarPruebas } from "@/lib/cotizaciones-prueba";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  return NextResponse.json({ success: true, data: await borrarPruebas({ dry: true }) });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  // Quien las crea es quien las borra. Se exige superadmin y no el
  // permiso `crm.cotizaciones.prueba` porque esto borra en bloque: si
  // mañana se le da el permiso a alguien para que pueda ensayar, no se
  // le está dando también la capacidad de vaciar la tabla.
  if (!esSuperadmin(user.rol)) {
    return NextResponse.json(
      { success: false, error: "Solo el superadministrador puede borrar las cotizaciones de prueba en bloque." },
      { status: 403 },
    );
  }

  const resumen = await borrarPruebas();
  return NextResponse.json({ success: true, data: resumen });
}
