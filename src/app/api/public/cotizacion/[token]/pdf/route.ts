// ============================================================
// GET /api/public/cotizacion/<token>/pdf
//
// Devuelve la cotización como ARCHIVO. Pública, igual que la página que
// abre el cliente y con la misma llave: el token de 22 caracteres.
//
// Se sirve con `Content-Disposition: attachment`, que es lo que hace que
// el teléfono la guarde en Descargas en vez de intentar pintarla. Es la
// diferencia entre poder reenviarle la oferta a alguien por WhatsApp y
// no poder hacer nada con ella.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { cargarCotizacionDoc, nombreArchivoPdf } from "@/lib/cotizacion-doc";
import { pdfDeRuta } from "@/lib/pdf";

export const dynamic = "force-dynamic";
// Chromium necesita el Node de verdad; en el entorno recortado no corre.
export const runtime = "nodejs";
// Un documento con muchas fotos tarda. El tope por defecto se queda corto.
export const maxDuration = 60;

type P = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: P) {
  const { token } = await params;

  // Se comprueba ANTES de arrancar Chromium. Levantar un navegador para
  // descubrir que la cotización no existe cuesta segundos y memoria.
  const datos = await cargarCotizacionDoc(token);
  if (!datos) {
    return NextResponse.json(
      { success: false, error: "Esta cotización no está disponible." },
      { status: 404 },
    );
  }

  try {
    const pdf = await pdfDeRuta({ ruta: `/cotizacion/${encodeURIComponent(token)}/imprimir` });
    const nombre = nombreArchivoPdf(datos.cotizacion.numero);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // `attachment` = guardar, no abrir. Es el punto de todo esto.
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Content-Length": String(pdf.length),
        // No se guarda en caché: si el asesor corrige la oferta y la
        // vuelve a mandar, el cliente tiene que bajarse la corregida.
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // Se registra con el número para poder encontrarlo, y al cliente se
    // le dice algo que pueda usar: que abra el enlace, que ahí está.
    console.error(`[pdf] No se pudo generar el PDF de ${datos.cotizacion.numero}:`, e);
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo preparar el PDF en este momento. La cotización se puede ver en el enlace.",
      },
      { status: 500 },
    );
  }
}
