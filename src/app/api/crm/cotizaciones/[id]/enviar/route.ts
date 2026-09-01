// ============================================================
// POST /api/crm/cotizaciones/[id]/enviar
//
// La puerta del portal. Comprueba la sesión y delega en
// `lib/envio-cotizacion.ts`, que es donde vive el envío de verdad.
//
// Se separó porque hay DOS puertas que tienen que hacer exactamente lo
// mismo: este botón y el ensayo general. Si el ensayo llamara a un
// camino propio, el correo que verifica no sería el que reciben los
// clientes — y entonces no verificaría nada.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { enviarCotizacionPorCorreo } from "@/lib/envio-cotizacion";

type P = { params: Promise<{ id: string }> };

/** Qué código HTTP le corresponde a cada motivo. */
const CODIGO: Record<string, number> = {
  "no-existe": 404,
  "sin-visto-bueno": 400,
  "rechazada": 400,
  "sin-correo": 400,
  "smtp": 500,
};

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const r = await enviarCotizacionPorCorreo(id, {
    comoModificada: req.nextUrl.searchParams.get("plantilla") === "modificada",
    usuarioId: user.sub,
  });

  if (!r.ok) {
    return NextResponse.json(
      { success: false, error: r.error },
      { status: CODIGO[r.motivo ?? ""] ?? 500 },
    );
  }

  return NextResponse.json({
    success: true,
    mensaje: `Cotización enviada a ${r.destino}`,
    enlace: r.enlace,
  });
}
