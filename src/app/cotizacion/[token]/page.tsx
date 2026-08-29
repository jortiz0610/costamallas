// ============================================================
// La cotización que ve el cliente. Pública a propósito: se comparte por
// WhatsApp o correo y se abre sin cuenta. Se llega por un token de 22
// caracteres, no por el id, así que no se puede saltar de una cotización
// a otra cambiando un número.
//
// Cada apertura queda registrada. Eso es lo que le permite al asesor
// saber si el cliente ya la vio antes de llamarlo, y es la base del
// seguimiento automático.
// ============================================================

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMarca } from "@/lib/marca";
import { getConfigCotizacion } from "@/lib/cotizacion-config";
import { completarFotos } from "@/lib/cotizacion-imagenes";
import { avisarApertura } from "@/lib/aviso-apertura";
import { urlPortal } from "@/lib/url-portal";
import { CotizacionDoc, type CotizacionDocData } from "@/components/crm/CotizacionDoc";
import { BarraPublica } from "./BarraPublica";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ token: string }> };

export default async function CotizacionPublica({ params }: P) {
  const { token } = await params;

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { publicId: token },
    include: {
      cliente: true,
      vendedor: { select: { nombre: true, email: true, telefono: true } },
      items: { orderBy: { orden: "asc" } },
    },
  });

  if (!cotizacion) notFound();

  // Un borrador no se le muestra al cliente aunque tenga el enlace: puede
  // estar a medio armar y con precios que todavía no son la oferta.
  if (cotizacion.estado === "BORRADOR") notFound();

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

  const [marca, config] = await Promise.all([getMarca(), getConfigCotizacion()]);

  const doc: CotizacionDocData = {
    numero: cotizacion.numero,
    createdAt: cotizacion.createdAt.toISOString(),
    validezDias: cotizacion.validezDias,
    notas: cotizacion.notas,
    subtotal: Number(cotizacion.subtotal),
    descuento: Number(cotizacion.descuento),
    iva: Number(cotizacion.iva),
    total: Number(cotizacion.total),
    // AIU. Sin esto el documento no enseña el desglose y la oferta de
    // una obra sale con un IVA que no se explica solo.
    aiuActivo: Boolean(cotizacion.aiuActivo),
    aiuAdminPct: Number(cotizacion.aiuAdminPct ?? 0),
    aiuImprevPct: Number(cotizacion.aiuImprevPct ?? 0),
    aiuUtilidadPct: Number(cotizacion.aiuUtilidadPct ?? 0),
    aiuAdmin: Number(cotizacion.aiuAdmin ?? 0),
    aiuImprev: Number(cotizacion.aiuImprev ?? 0),
    aiuUtilidad: Number(cotizacion.aiuUtilidad ?? 0),
    ivaUtilidad: Number(cotizacion.ivaUtilidad ?? 0),
    tiempoEntrega: cotizacion.tiempoEntrega,
    anticipoPct: cotizacion.anticipoPct == null ? null : Number(cotizacion.anticipoPct),
    plantilla: cotizacion.plantilla,
    ciudadInstalacion: cotizacion.ciudadInstalacion,
    direccionInstalacion: cotizacion.direccionInstalacion,
    cliente: {
      nombre: cotizacion.cliente.nombre,
      empresa: cotizacion.cliente.empresa,
      email: cotizacion.cliente.email,
      telefono: cotizacion.cliente.telefono,
      ciudad: cotizacion.cliente.ciudad,
      direccion: cotizacion.cliente.direccion,
      nit: cotizacion.cliente.nit,
      cedula: cotizacion.cliente.cedula,
    },
    vendedor: cotizacion.vendedor,
    // Las cotizaciones anteriores al arreglo se guardaron sin foto aunque
    // el producto sí la tuviera. Se rellena al mostrar, para no tener que
    // reescribir ofertas ya enviadas.
    items: await completarFotos(cotizacion.items.map(i => ({
      descripcion: i.descripcion,
      detalle: i.detalle,
      cantidad: Number(i.cantidad),
      precioUnitario: Number(i.precioUnitario),
      subtotal: Number(i.subtotal),
      unidad: i.unidad,
      tipo: i.tipo,
      productoId: i.productoId,
      imagenUrl: i.imagenUrl,
    }))),
  };

  // El vencimiento incluye lo que se haya aplazado.
  const vence = new Date(cotizacion.createdAt.getTime() + (cotizacion.validezDias + cotizacion.prorrogaDias) * 86400000);
  const vencida = vence.getTime() < Date.now();

  return (
    <div style={{ backgroundColor: "#e9ecef", minHeight: "100vh" }}>
      <BarraPublica
        numero={cotizacion.numero}
        vencida={vencida}
        venceEl={vence.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
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
