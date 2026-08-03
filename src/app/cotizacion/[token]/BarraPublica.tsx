"use client";

// Barra de la cotización pública. No se imprime: solo sirve para que el
// cliente descargue el PDF o le escriba al asesor.

import { Printer, MessageCircle } from "lucide-react";

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";

export function BarraPublica({ numero, vencida, venceEl, asesor, telefono }: {
  numero: string; vencida: boolean; venceEl: string; asesor: string | null; telefono: string | null;
}) {
  // El wa.me necesita el número sin espacios ni signos y con indicativo.
  const wa = telefono ? telefono.replace(/\D/g, "").replace(/^0+/, "") : null;
  const waLink = wa ? `https://wa.me/${wa.length <= 10 ? `57${wa}` : wa}?text=${encodeURIComponent(`Hola, sobre la cotización ${numero}…`)}` : null;

  return (
    <div className="no-print sticky top-0 z-10" style={{ backgroundColor: NEGRO }}>
      <div className="mx-auto px-5 py-3 flex items-center gap-3 flex-wrap" style={{ maxWidth: "210mm" }}>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-black uppercase tracking-tight m-0">Cotización {numero}</p>
          <p className="text-[11px] m-0" style={{ color: vencida ? "#ff6b6b" : "rgba(255,255,255,.55)" }}>
            {vencida ? `Venció el ${venceEl} — escríbenos y la actualizamos` : `Válida hasta el ${venceEl}`}
            {asesor && ` · ${asesor}`}
          </p>
        </div>

        {waLink && (
          <a
            href={waLink} target="_blank" rel="noreferrer"
            className="px-4 py-2 text-xs font-black uppercase tracking-wide flex items-center gap-1.5"
            style={{ backgroundColor: "#1fae5b", color: "#fff" }}
          >
            <MessageCircle size={13} /> Escribir
          </a>
        )}
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-xs font-black uppercase tracking-wide flex items-center gap-1.5"
          style={{ backgroundColor: AMARILLO, color: NEGRO }}
        >
          <Printer size={13} /> Descargar PDF
        </button>
      </div>
    </div>
  );
}
