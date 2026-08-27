"use client";

// ============================================================
// El aviso flotante de costo que acompaña a cada botón de IA.
//
// Antes solo la pantalla del lote de SEO decía lo que iba a gastar. En
// el resto —redactar un producto, leer una ficha, sugerir una respuesta
// en Nexus— se apretaba a ciegas, y el gasto se descubría al mes
// siguiente en la factura.
//
// Va FLOTANDO y no en línea a propósito: estos botones están dentro de
// formularios ya apretados, y meter una etiqueta más en el flujo
// desordenaría la pantalla. Flotando se pega al botón sin empujar nada.
//
// El número es el de VERDAD: la mediana de lo que costaron las últimas
// corridas, tomada de los registros. Solo si la tarea no se ha usado
// nunca sale una estimación, y entonces se dice.
//
// Un solo `fetch` para toda la pantalla: react-query comparte la misma
// clave, así que diez botones no son diez llamadas.
// ============================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { formatoUSD, type ClaveTareaIA, type CostoTarea } from "@/lib/costos-ia-tareas";

export function CostoIA({ tarea, className = "" }: { tarea: ClaveTareaIA; className?: string }) {
  const [abierto, setAbierto] = useState(false);

  const { data } = useQuery<CostoTarea[]>({
    queryKey: ["costos-ia"],
    queryFn: async () => {
      const j = await (await fetch("/api/ai/costos")).json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    // El precio no cambia de un minuto a otro: no tiene sentido volver a
    // pedirlo cada vez que la pestaña recupera el foco.
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const c = data?.find(x => x.clave === tarea);
  if (!c) return null;

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
    >
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none cursor-help"
        style={{ backgroundColor: "var(--brand-color-10, rgba(0,0,0,.06))", color: "var(--text-muted)" }}
        aria-label={`Costo aproximado: ${formatoUSD(c.costoUSD)}`}
      >
        <Sparkles size={9} />
        {formatoUSD(c.costoUSD)}
      </button>

      {abierto && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full right-0 mb-1.5 w-60 p-2.5 rounded-xl text-left shadow-lg"
          style={{ backgroundColor: "var(--surface-1, #fff)", border: "1px solid var(--border)" }}
        >
          <span className="block text-[11px] font-bold text-soft">{c.label}</span>
          <span className="block text-[10px] text-muted mt-0.5 leading-snug">{c.descripcion}</span>

          <span className="block mt-2 pt-2 border-t divider text-[10px] text-muted leading-snug">
            {c.origen === "medido" ? (
              <>
                <strong className="text-soft">{formatoUSD(c.costoUSD)}</strong> por vez. Es la mediana
                real de las últimas {c.corridas} {c.corridas === 1 ? "corrida" : "corridas"}, no un cálculo.
              </>
            ) : (
              <>
                <strong className="text-soft">≈ {formatoUSD(c.costoUSD)}</strong> por vez.{" "}
                <span style={{ color: "#d97706" }}>Estimado</span>: esta tarea todavía no se ha usado,
                así que el número sale del tamaño típico del texto. En cuanto se use, pasa a ser el
                costo medido.
              </>
            )}
          </span>
          <span className="block mt-1 text-[10px] text-muted">Modelo: {c.modelo}</span>
        </span>
      )}
    </span>
  );
}
