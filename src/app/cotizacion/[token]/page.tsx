// ============================================================
// La cotización que ve el cliente. Pública a propósito: se comparte por
// WhatsApp o correo y se abre sin cuenta. Se llega por un token de 22
// caracteres, no por el id, así que no se puede saltar de una cotización
// a otra cambiando un número.
//
// Cada apertura queda registrada. Eso es lo que le permite al asesor
// saber si el cliente ya la vio antes de llamarlo, y es la base del
// seguimiento automático.
//
// Los DATOS del documento se cargan desde lib/cotizacion-doc.ts, que es
// el mismo sitio del que los saca la página de imprimir. Estaban escritos
// aquí; se movieron para que el PDF no pueda acabar diciendo algo
// distinto de lo que el cliente tiene en pantalla.
// ============================================================

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { avisarApertura } from "@/lib/aviso-apertura";
import { urlPortal } from "@/lib/url-portal";
import { cargarCotizacionDoc } from "@/lib/cotizacion-doc";
import { CotizacionDoc } from "@/components/crm/CotizacionDoc";
import { BarraPublica } from "./BarraPublica";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ token: string }> };

export default async function CotizacionPublica({ params }: P) {
  const { token } = await params;

  const datos = await cargarCotizacionDoc(token);
  if (!datos) notFound();

  const { cotizacion, doc, marca, config, vencida, venceEl } = datos;

  // Registrar la apertura. Si falla, la cotización se muestra igual: el
  // cliente no tiene por qué quedarse sin ver su oferta porque no se pudo
  // guardar una métrica.
  await prisma.cotizacion
    .update({
      where: { id: cotizacion.id },
      data: {
        vistas: { increment: 1 },
        vistaUltimaEn: new Date(),
        ...(cotizacion.vistaPrimeraEn ? {} : { vistaPrimeraEn: new Date() }),
      },
    })
    .catch(() => undefined);

  // La PRIMERA apertura le avisa al asesor: el mejor momento para llamar
  // es cuando el cliente tiene la oferta en la pantalla. Solo la primera:
  // un cliente que la abre ocho veces mientras la lee no debe generar
  // ocho avisos, porque a la tercera el asesor deja de mirarlos.
  if (!cotizacion.vistaPrimeraEn) {
    await avisarApertura(cotizacion.id, urlPortal()).catch(() => undefined);
  }

  return (
    <div style={{ backgroundColor: "#e9ecef", minHeight: "100vh" }}>
      <BarraPublica
        numero={cotizacion.numero}
        vencida={vencida}
        venceEl={venceEl}
        asesor={cotizacion.vendedor?.nombre ?? null}
        telefono={cotizacion.vendedor?.telefono ?? marca.phone ?? null}
        token={token}
        estado={cotizacion.estado}
        enRevision={cotizacion.aprobacionEstado === "PENDIENTE"}
      />
      {/* pb-24: la barra de acciones es fija; sin este relleno taparia
          el final del documento, que es justo donde estan los totales. */}
      <div className="pt-6 pb-24 print:pb-0 print-area">
        <div className="mx-auto shadow-2xl print:shadow-none" style={{ maxWidth: "210mm" }}>
          <CotizacionDoc data={doc} brand={marca} config={config} />
        </div>
      </div>
    </div>
  );
}
