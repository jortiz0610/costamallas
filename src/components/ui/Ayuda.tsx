"use client";

// ============================================================
// La ayuda, en un icono.
//
// El portal se estaba llenando de cajas azules con un párrafo
// explicando la pantalla. Se leen una vez, estorban las mil siguientes y
// empujan hacia abajo lo que la persona vino a hacer.
//
// Esto es lo mismo en 16 px: una "i" que solo cuenta la historia si
// alguien la pide. Funciona con el dedo (toque) y con el ratón (pasar
// por encima), porque en el teléfono no hay hover.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

export function Ayuda({
  children,
  titulo,
  lado = "abajo",
}: {
  /** El texto de la ayuda. Una o dos frases; si necesita más, es que la
   *  pantalla no se explica sola y el arreglo está en otro sitio. */
  children: React.ReactNode;
  titulo?: string;
  lado?: "abajo" | "arriba";
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Un toque fuera lo cierra. Sin esto, en el teléfono el globo se queda
  // abierto tapando la pantalla hasta que se toca el icono otra vez.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
    };
  }, [abierto]);

  return (
    <span className="relative inline-flex align-middle" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        aria-label={titulo ? `Ayuda: ${titulo}` : "Ayuda"}
        aria-expanded={abierto}
        className="w-4 h-4 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors flex-shrink-0"
      >
        <Info size={13} />
      </button>

      {abierto && (
        <span
          role="tooltip"
          className={`absolute z-50 w-60 max-w-[75vw] rounded-xl px-3 py-2 shadow-lg surface border divider text-left ${
            lado === "arriba" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } left-1/2 -translate-x-1/2`}
        >
          {titulo && (
            <span className="block text-[11px] font-bold text-gray-800 dark:text-gray-100 mb-0.5">
              {titulo}
            </span>
          )}
          <span className="block text-[11px] leading-relaxed text-gray-600 dark:text-slate-300">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}
