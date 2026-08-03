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
    },
    vendedor: cotizacion.vendedor,
    items: cotizacion.items.map(i => ({
      descripcion: i.descripcion,
      detalle: i.detalle,
      cantidad: Number(i.cantidad),
      precioUnitario: Number(i.precioUnitario),
      subtotal: Number(i.subtotal),
      unidad: i.unidad,
      tipo: i.tipo,
      imagenUrl: i.imagenUrl,
    })),
  };

  const vence = new Date(cotizacion.createdAt.getTime() + cotizacion.validezDias * 86400000);
  const vencida = vence.getTime() < Date.now();

  return (
    <div style={{ backgroundColor: "#e9ecef", minHeight: "100vh" }}>
      <BarraPublica
        numero={cotizacion.numero}
        vencida={vencida}
        venceEl={vence.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
        asesor={cotizacion.vendedor?.nombre ?? null}
        telefono={cotizacion.vendedor?.telefono ?? marca.phone ?? null}
      />
      <div className="py-6 print-area">
        <div className="mx-auto shadow-2xl print:shadow-none" style={{ maxWidth: "210mm" }}>
          <CotizacionDoc data={doc} brand={marca} config={config} />
        </div>
      </div>
    </div>
  );
}
