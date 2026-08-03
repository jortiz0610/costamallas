"use client";

// ============================================================
// Vista de muestra de las dos plantillas de cotización.
//
// Sirve para revisar el diseño y para enseñárselo al equipo sin tener que
// abrir una cotización real. No toca la base de datos: los datos son
// inventados y los textos son los que trae la configuración por defecto.
// ============================================================

import { useState } from "react";
import { CotizacionDoc, type CotizacionDocData } from "@/components/crm/CotizacionDoc";
import { DEFAULTS } from "@/lib/cotizacion-textos";

const MUESTRA: CotizacionDocData = {
  numero: "COT-00148",
  createdAt: new Date().toISOString(),
  validezDias: 3,
  plantilla: "PROPUESTA",
  subtotal: 14_820_000,
  descuento: 420_000,
  iva: 2_736_000,
  total: 17_136_000,
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

const MARCA = {
  companyName: "Costamallas",
  brandColor: "#ffdd00",
  legalName: "COSTAMALLAS S.A.S.",
  nit: "900.659.899-8",
  address: "Calle 58 # 46-107, Barranquilla",
  phone: "300 607 8956",
  email: "gerencia@costamallas.com",
  logoUrl: null,
};

export default function DemoCotizacion() {
  const [plantilla, setPlantilla] = useState<"EXPRESS" | "PROPUESTA">("PROPUESTA");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#e9ecef" }}>
      <div className="no-print sticky top-0 z-10 px-6 py-3 flex items-center gap-3" style={{ backgroundColor: "#0d1117" }}>
        <p className="text-white text-sm font-bold flex-1">Muestra de cotización</p>
        {(["EXPRESS", "PROPUESTA"] as const).map(p => (
          <button
            key={p}
            onClick={() => setPlantilla(p)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={plantilla === p
              ? { backgroundColor: "#f9df1e", color: "#0d1117" }
              : { backgroundColor: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.7)" }}
          >
            {p === "EXPRESS" ? "Express" : "Propuesta"}
          </button>
        ))}
        <button onClick={() => window.print()} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white/70">
          Imprimir
        </button>
      </div>

      <div className="py-8 print-area">
        <div className="mx-auto shadow-2xl print:shadow-none" style={{ maxWidth: "210mm" }}>
          <CotizacionDoc data={{ ...MUESTRA, plantilla }} brand={MARCA} config={DEFAULTS} />
        </div>
      </div>
    </div>
  );
}
