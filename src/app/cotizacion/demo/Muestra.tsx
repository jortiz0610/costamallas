"use client";

// ============================================================
// La parte interactiva de la muestra: el conmutador de plantilla.
//
// La marca y los textos llegan del servidor (ver page.tsx) porque esta
// ruta es pública y no puede pedirlos por API. Antes estaban quemados
// aquí con `logoUrl: null`, así que la muestra enseñaba algo distinto de
// lo que recibe el cliente — justamente lo contrario de para lo que
// sirve una muestra.
// ============================================================

import { useState } from "react";
import { CotizacionDoc, type CotizacionDocData, type BrandInfo } from "@/components/crm/CotizacionDoc";
import type { ConfigCotizacion } from "@/lib/cotizacion-textos";

export function Muestra({ data, brand, config }: {
  data: CotizacionDocData; brand: BrandInfo; config: ConfigCotizacion;
}) {
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
          <CotizacionDoc data={{ ...data, plantilla }} brand={brand} config={config} />
        </div>
      </div>
    </div>
  );
}
