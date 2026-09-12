// ============================================================
// El documento a secas, para fabricar el PDF.
//
// Es la misma cotización que ve el cliente, pero sin nada alrededor: sin
// barra de acciones, sin fondo gris, sin botones. Lo que Chromium
// imprime es exactamente esto.
//
// POR QUÉ NO SE REUTILIZA LA PÁGINA DEL CLIENTE
// ---------------------------------------------
// Porque esa página CUENTA cada apertura y, la primera vez, le avisa al
// asesor de que el cliente acaba de abrir su oferta. Si el PDF se
// fabricara abriéndola, cada descarga inflaría el contador y dispararía
// un aviso falso — el asesor llamaría creyendo que el cliente está
// mirando la cotización en ese momento.
//
// Los datos salen del mismo sitio (lib/cotizacion-doc.ts), así que el
// PDF no puede decir algo distinto de lo que vio el cliente.
// ============================================================

import { notFound } from "next/navigation";
import { cargarCotizacionDoc } from "@/lib/cotizacion-doc";
import { CotizacionDoc } from "@/components/crm/CotizacionDoc";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ token: string }> };

export default async function CotizacionImprimir({ params }: P) {
  const { token } = await params;
  const datos = await cargarCotizacionDoc(token);
  if (!datos) notFound();

  return (
    // Fondo blanco y sin márgenes: el papel lo pone Chromium.
    <div className="print-area" style={{ backgroundColor: "#fff" }}>
      <div style={{ maxWidth: "210mm", margin: "0 auto" }}>
        <CotizacionDoc data={datos.doc} brand={datos.marca} config={datos.config} />
      </div>
    </div>
  );
}
