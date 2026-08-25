// ============================================================
// Vista de muestra de las dos plantillas de cotización.
//
// Sirve para revisar el diseño y enseñárselo al equipo sin abrir una
// cotización real. Los DATOS son inventados —no toca cotizaciones ni
// clientes—, pero la MARCA y los TEXTOS salen de la configuración real.
//
// Antes estaban quemados en el código, con `logoUrl: null`. Así la
// muestra enseñaba algo distinto de lo que le llega al cliente, que es
// justo lo contrario de para lo que sirve una muestra: se revisaba aquí,
// se daba por bueno, y en la oferta real salía otra cosa.
//
// Es una ruta pública, así que la configuración se lee en el servidor
// (no hay sesión con la que pedirla por API).
// ============================================================

import { getMarca } from "@/lib/marca";
import { getConfigCotizacion } from "@/lib/cotizacion-config";
import type { CotizacionDocData } from "@/components/crm/CotizacionDoc";
import { Muestra } from "./Muestra";

export const dynamic = "force-dynamic";

const MUESTRA: CotizacionDocData = {
  numero: "COT-00148",
  createdAt: new Date().toISOString(),
  validezDias: 3,
  plantilla: "PROPUESTA",
  subtotal: 14_820_000,
  descuento: 420_000,
  iva: 2_736_000,
  total: 17_136_000,
  anticipoPct: 50,
  ciudadInstalacion: "Santa Marta, Magdalena",
  direccionInstalacion: "Km 8 vía Ciénaga, Bodega 4 — Zona Industrial",
  notas: "El metraje final se confirma con la visita técnica. Los postes se instalan cada 3 metros.",
  cliente: {
    nombre: "Skarlyn Cervantes",
    empresa: "Inversiones del Caribe S.A.S.",
    nit: "901.455.221-3",
    email: "compras@inversionescaribe.com",
    telefono: "300 607 8956",
    ciudad: "Barranquilla",
    direccion: "Calle 58 # 46-107",
  },
  vendedor: { nombre: "Lady Martínez", telefono: "324 591 2653", email: "ventas@costamallas.com" },
  items: [
    {
      descripcion: "Malla eslabonada ciclón calibre 10.5 — ojo 2½\"",
      detalle: "Galvanizada, forrada en PVC verde. Rollo de 1.80 m de alto.",
      cantidad: 620, unidad: "m2", precioUnitario: 16_900, subtotal: 10_478_000, tipo: "PRODUCTO",
    },
    {
      descripcion: "Poste tubular galvanizado 2\" × 2.40 m",
      detalle: "Con tapa y base de anclaje.",
      cantidad: 84, unidad: "unidad", precioUnitario: 38_500, subtotal: 3_234_000, tipo: "PRODUCTO",
    },
    {
      descripcion: "Alambre de púa calibre 12.5 — 3 hilos",
      cantidad: 250, unidad: "m", precioUnitario: 2_400, subtotal: 600_000, tipo: "PRODUCTO",
    },
    {
      descripcion: "Instalación de cerramiento en malla eslabonada",
      detalle: "Incluye replanteo, excavación, fundida de postes y tensado. Recargo por desplazamiento a Santa Marta aplicado.",
      cantidad: 620, unidad: "m2", precioUnitario: 8_900, subtotal: 5_518_000, tipo: "INSTALACION",
    },
  ],
};

export default async function DemoCotizacion() {
  const [marca, config] = await Promise.all([getMarca(), getConfigCotizacion()]);
  return <Muestra data={MUESTRA} brand={marca} config={config} />;
}
