"use client";

// ============================================================
// Los medidores de recursos de Estado del sistema.
//
// Un arco por cosa medida, que se refresca solo cada cinco segundos.
// La aguja se mueve con transición: un número que salta de 20 a 80 sin
// más no se lee, y viendo el movimiento se distingue un pico puntual de
// algo que lleva rato arriba.
//
// Dos decisiones que no son estéticas:
//
//   · **El color lo decide el servidor**, no la pantalla. Los umbrales
//     viven en lib/recursos.ts; si estuvieran aquí acabaría habiendo dos
//     opiniones sobre qué es "crítico".
//   · **En Vercel se avisa de que las cifras no significan lo que
//     parece.** Cada petición la atiende una función que nace y muere,
//     así que "encendido: 12 s" y la memoria de una máquina compartida
//     no sirven para decidir nada. Un panel bonito que miente es peor
//     que no tener panel.
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, Server, Cloud, Info, Loader2 } from "lucide-react";
import type { Recursos, Medidor, NivelRecurso } from "@/lib/recursos";

const COLOR: Record<NivelRecurso, { base: string; claro: string; l: string }> = {
  ok:      { base: "#16a34a", claro: "#4ade80", l: "bien" },
  aviso:   { base: "#d97706", claro: "#fbbf24", l: "atento" },
  critico: { base: "#dc2626", claro: "#f87171", l: "crítico" },
};

// El arco es media circunferencia de radio 50: π × 50 ≈ 157,08. Se
// escribe el número porque es el que usa el dasharray.
const LARGO_ARCO = Math.PI * 50;

function Arco({ m }: { m: Medidor }) {
  const [abierto, setAbierto] = useState(false);
  const c = COLOR[m.nivel];
  const pct = Math.min(Math.max(m.porcentaje, 0), 100);
  const idGrad = `grad-${m.clave}`;

  return (
    <div className="card p-4 flex flex-col items-center text-center">
      <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted mb-1">
        {m.titulo}
      </p>

      <div className="relative">
        <svg viewBox="0 0 120 68" className="w-full max-w-[150px] overflow-visible">
          <defs>
            <linearGradient id={idGrad} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c.claro} />
              <stop offset="100%" stopColor={c.base} />
            </linearGradient>
          </defs>

          {/* La pista. Con opacidad, para que sirva igual en claro y en
              oscuro sin tener dos colores. */}
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-slate-700"
            strokeWidth="9"
            strokeLinecap="round"
          />

          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={`url(#${idGrad})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={LARGO_ARCO}
            strokeDashoffset={LARGO_ARCO * (1 - pct / 100)}
            style={{
              transition: "stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)",
              filter: m.nivel === "ok" ? undefined : `drop-shadow(0 0 5px ${c.base}66)`,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
          <span
            className="text-[21px] font-bold leading-none tabular-nums"
            style={{ color: c.base }}
          >
            {m.valor}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-muted mt-1.5 leading-snug">{m.detalle}</p>

      {m.significa && (
        <>
          <button
            onClick={() => setAbierto(v => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-muted hover:opacity-70"
          >
            <Info size={10} /> qué significa
          </button>
          {abierto && (
            <p className="text-[10.5px] text-soft mt-1.5 leading-snug rounded-lg p-2"
               style={{ backgroundColor: "var(--surface-3)" }}>
              {m.significa}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Medidores() {
  const { data, isLoading, isError } = useQuery<Recursos>({
    queryKey: ["recursos"],
    queryFn: async () => {
      const r = await fetch("/api/sistema/recursos");
      const j = await r.json();
      if (!j.success) throw new Error(j.error ?? "No se pudo medir");
      return j.data;
    },
    // Cada cinco segundos: suficiente para ver un pico, y lo bastante
    // espaciado para que mirar la pantalla no sea lo que carga el
    // servidor. Solo mientras la pestaña esté delante.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  if (isError) {
    return (
      <div className="card p-4">
        <p className="text-[12px] text-muted">No se pudieron leer los recursos del servidor.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="card p-8 text-center">
        <Loader2 size={18} className="animate-spin mx-auto text-gray-400" />
        <p className="text-[11px] text-muted mt-2">Midiendo…</p>
      </div>
    );
  }

  const enVercel = data.entorno === "vercel";

  return (
    <div className="space-y-3">
      {/* Dónde corre esto */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "var(--brand-color-10)" }}
        >
          {enVercel
            ? <Cloud size={17} style={{ color: "var(--brand-color)" }} />
            : <Server size={17} style={{ color: "var(--brand-color)" }} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 truncate">
            {data.donde}
          </p>
          <p className="text-[11px] text-muted">
            {data.datos.map(d => `${d.etiqueta}: ${d.valor}`).join(" · ")}
            {data.version !== "—" && ` · versión ${data.version}`}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ backgroundColor: "#16a34a" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "#16a34a" }} />
          </span>
          en vivo
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.medidores.map(m => <Arco key={m.clave} m={m} />)}
      </div>

      {/* La advertencia que hace que el panel no mienta. */}
      {enVercel ? (
        <div className="card p-3.5 flex gap-2.5" style={{ borderLeft: "4px solid #d97706" }}>
          <Activity size={15} className="flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} />
          <p className="text-[11px] text-soft leading-relaxed">
            <strong>Estas cifras son de una función, no de un servidor.</strong> En Vercel cada
            petición la atiende un proceso que nace y muere: el tiempo encendido son segundos, y
            la memoria y el disco son los de una máquina compartida que no es de la empresa. Sirven
            para ver si la base contesta rápido; para todo lo demás, no hay nada que vigilar aquí.
            Cuando el portal corra en el servidor propio, estos números pasan a ser los de esa
            máquina y sí valen.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 leading-relaxed px-1">
          Medido en el momento de preguntar, cada cinco segundos. No se guarda historial: esto es
          para mirar de reojo cómo va el servidor, no para hacer informes.
        </p>
      )}
    </div>
  );
}
