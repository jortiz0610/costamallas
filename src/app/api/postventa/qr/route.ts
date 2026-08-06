// ============================================================
// GET /api/postventa/qr — el QR de la encuesta de satisfacción, en PNG.
//
// Lleva a la reseña de Google. Se genera en el servidor y no con un
// servicio externo a propósito: un QR impreso en cientos de entregas no
// puede depender de que un tercero siga existiendo dentro de dos años.
//
// Si la URL de la reseña no está cargada, devuelve 409 con el motivo.
// NO genera un QR que lleve a ninguna parte: uno impreso que no funciona
// es peor que no poner ninguno.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getUserFromRequest } from "@/lib/auth";
import { getConfigPostventa } from "@/lib/postventa";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const cfg = await getConfigPostventa();
  if (!cfg.urlResena) {
    return NextResponse.json(
      { success: false, error: "Falta el enlace de reseñas de Google en Configuración → Postventa." },
      { status: 409 },
    );
  }

  const tam = Math.min(1200, Math.max(160, Number(req.nextUrl.searchParams.get("tam")) || 480));

  try {
    const png = await QRCode.toBuffer(cfg.urlResena, {
      type: "png",
      width: tam,
      margin: 1,
      errorCorrectionLevel: "M",
      // Negro sobre blanco: los lectores fallan con poco contraste, y
      // esto se imprime a una tinta.
      color: { dark: "#11110fff", light: "#ffffffff" },
    });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Cambia solo cuando cambie la URL, que es casi nunca.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: `No se pudo generar el código: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
