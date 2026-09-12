// ============================================================
// Cargar una cotización para PINTARLA como documento.
//
// Vive aquí porque ahora hay DOS pantallas que pintan el mismo papel:
//
//   · /cotizacion/<token>          — la que abre el cliente. Registra la
//     apertura y trae la barra de acciones.
//   · /cotizacion/<token>/imprimir — la que abre Chromium para fabricar
//     el PDF. Ni registra ni trae barra.
//
// Tenerlo escrito dos veces significaría que el día que se añada un
// campo al documento —un descuento, un dato del AIU— aparezca en la
// pantalla del cliente y NO en el PDF que se descarga. Un PDF que no
// dice lo mismo que la oferta que vio el cliente es un problema de
// verdad, no un detalle de código.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getMarca } from "@/lib/marca";
import { getConfigCotizacion } from "@/lib/cotizacion-config";
import { completarFotos } from "@/lib/cotizacion-imagenes";
import type { CotizacionDocData } from "@/components/crm/CotizacionDoc";

export async function cargarCotizacionDoc(token: string) {
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { publicId: token },
    include: {
      cliente: true,
      vendedor: { select: { nombre: true, email: true, telefono: true } },
      items: { orderBy: { orden: "asc" } },
    },
  });

  if (!cotizacion) return null;

  // Un borrador no se le enseña al cliente aunque tenga el enlace: puede
  // estar a medio armar y con precios que todavía no son la oferta. Vale
  // igual para el PDF — si no se puede ver, no se puede descargar.
  if (cotizacion.estado === "BORRADOR") return null;

  // Una cotización borrada dejó de existir para todo el mundo. Sin esta
  // línea, el enlace que ya se le mandó al cliente por WhatsApp seguiría
  // abriendo el documento después de borrarla.
  if (cotizacion.borradaEn) return null;

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
      descuento: Number(i.descuento ?? 0),
      unidad: i.unidad,
      tipo: i.tipo,
      productoId: i.productoId,
      imagenUrl: i.imagenUrl,
    }))),
  };

  // El vencimiento incluye lo que se haya aplazado.
  const vence = new Date(
    cotizacion.createdAt.getTime() + (cotizacion.validezDias + cotizacion.prorrogaDias) * 86400000,
  );

  return {
    cotizacion,
    doc,
    marca,
    config,
    vence,
    vencida: vence.getTime() < Date.now(),
    venceEl: vence.toLocaleDateString("es-CO", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bogota",
    }),
  };
}

/** El nombre con el que se guarda el archivo en el teléfono. */
export function nombreArchivoPdf(numero: string) {
  // Sin espacios ni acentos: algunos gestores de archivos y clientes de
  // correo los rompen o los convierten en %20.
  const limpio = numero
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-");
  return `Cotizacion-${limpio}.pdf`;
}
