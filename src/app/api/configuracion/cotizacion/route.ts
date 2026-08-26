// ============================================================
// GET  /api/configuracion/cotizacion   textos e imágenes de la cotización
// POST /api/configuracion/cotizacion   guarda lo que venga
//
// No hay nada secreto aquí (son los textos que se le muestran al cliente),
// así que no se cifra. Editarlo sí es cosa de administración: son las
// condiciones comerciales con las que la empresa se compromete.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { getConfigCotizacion, setConfigCotizacion, DEFAULTS } from "@/lib/cotizacion-config";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  // La leen también los asesores: es lo que sale en el PDF que envían.
  return NextResponse.json({ success: true, data: await getConfigCotizacion(), defaults: DEFAULTS });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();

  const validezDias = b.validezDias != null ? Number(b.validezDias) : undefined;
  if (validezDias != null && (!Number.isInteger(validezDias) || validezDias < 1 || validezDias > 365)) {
    return NextResponse.json({ success: false, error: "La validez debe ir entre 1 y 365 días" }, { status: 400 });
  }

  // El recorte va en % vertical. Se sanea aquí y no en la pantalla porque
  // esto también lo puede llamar otro cliente: un valor fuera de rango
  // produce un `object-position` inválido, que el navegador ignora en
  // silencio y deja la foto descuadrada sin decir por qué.
  const posiciones: Record<string, number | undefined> = {};
  for (const k of ["posPortada", "posBanda", "posInstalacion", "posContraportada"] as const) {
    if (b[k] == null) continue;
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return NextResponse.json(
        { success: false, error: "La posición del recorte va entre 0 y 100" },
        { status: 400 },
      );
    }
    posiciones[k] = Math.round(v);
  }

  const qrPagos = Array.isArray(b.qrPagos)
    ? b.qrPagos
        .filter((q: { etiqueta?: string; url?: string }) => q?.url?.trim())
        .map((q: { etiqueta?: string; url?: string }) => ({
          etiqueta: String(q.etiqueta ?? "").trim(),
          url: String(q.url).trim(),
        }))
    : undefined;

  await setConfigCotizacion({
    carta: b.carta,
    infoPago: b.infoPago,
    formaPago: b.formaPago,
    tiempoEntrega: b.tiempoEntrega,
    sitioEntrega: b.sitioEntrega,
    garantia: b.garantia,
    instalacionIncluye: b.instalacionIncluye,
    instalacionRequiere: b.instalacionRequiere,
    observaciones: b.observaciones,
    politicas: b.politicas,
    vigencia: b.vigencia,
    validezDias,
    imgPortada: b.imgPortada,
    imgBanda: b.imgBanda,
    imgInstalacion: b.imgInstalacion,
    imgContraportada: b.imgContraportada,
    posPortada: posiciones.posPortada,
    posBanda: posiciones.posBanda,
    posInstalacion: posiciones.posInstalacion,
    posContraportada: posiciones.posContraportada,
    qrPagos,
  });

  return NextResponse.json({ success: true, data: await getConfigCotizacion() });
}
