"use client";

// ============================================================
// Un solo botón de "Filtrar", en vez de dos filas de chips.
//
// El inbox tenía arriba tres botones de estado (abierta / resuelta /
// archivada) y una fila de chips de canal. En un teléfono eso es media
// pantalla gastada en controles que se usan una vez al día, encima de la
// lista, que es lo único que se mira todo el rato.
//
// Ahora los filtros viven detrás de un botón —con un contador de cuántos
// hay puestos— y lo que diferencia una conversación de otra en la lista
// es su ETIQUETA de color, que cada persona configura a su gusto.
// ============================================================

import { useState } from "react";
import { SlidersHorizontal, X, Check, Volume2, VolumeX } from "lucide-react";
import {
  leerPrefs, guardarPrefs, CANALES_CONOCIDOS, TEMAS,
  type PrefsNexus,
} from "@/lib/nexus-preferencias";

export interface EstadoFiltros {
  estado: string;
  canal: string;
}

const ESTADOS = [
  { v: "ABIERTA", l: "Abiertas" },
  { v: "RESUELTA", l: "Resueltas" },
  { v: "ARCHIVADA", l: "Archivadas" },
  { v: "", l: "Todas" },
];

/** Colores entre los que se elige. Suficientes para distinguir, pocos
 *  para no convertir la lista en un arcoíris. */
const PALETA = [
  "#25D366", "#0891b2", "#BA7517", "#7c3aed", "#d946ef",
  "#1d4ed8", "#dc2626", "#059669", "#64748b", "#ea580c",
];

export function BotonFiltros({
  filtros,
  onCambiar,
  prefs,
  onPrefs,
}: {
  filtros: EstadoFiltros;
  onCambiar: (f: EstadoFiltros) => void;
  prefs: PrefsNexus;
  onPrefs: (p: PrefsNexus) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<"filtros" | "etiquetas" | "aspecto">("filtros");

  // "Abiertas" es el valor de arranque, así que no cuenta como filtro
  // puesto: si contara, el botón saldría siempre en 1 y dejaría de
  // llamar la atención cuando de verdad hay algo filtrado.
  const puestos = (filtros.estado && filtros.estado !== "ABIERTA" ? 1 : 0) + (filtros.canal ? 1 : 0);

  const actualizar = (p: Partial<PrefsNexus>) => {
    const nuevo = { ...prefs, ...p };
    guardarPrefs(nuevo);
    onPrefs(nuevo);
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all surface-2 text-soft"
      >
        <SlidersHorizontal size={13} />
        Filtrar
        {puestos > 0 && (
          <span className="min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center bg-violet-600">
            {puestos}
          </span>
        )}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setAbierto(false)}>
          <div
            className="card w-full sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden rounded-b-none sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="card-header flex-shrink-0">
              <div className="flex gap-1 rounded-xl p-0.5" style={{ backgroundColor: "var(--surface-3)" }}>
                {([["filtros", "Filtros"], ["etiquetas", "Etiquetas"], ["aspecto", "Aspecto"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setPestana(k)}
                    className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold transition-all"
                    style={pestana === k ? { backgroundColor: "#7c3aed", color: "white" } : { color: "var(--text-muted)" }}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={() => setAbierto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {pestana === "aspecto" ? (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      Fondo del chat
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-3 leading-relaxed">
                      Es tuyo y solo se ve en tu pantalla. Los tres están pensados para que
                      el texto se lea bien; no hay ninguno donde se pierda.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {TEMAS.map(t => {
                        const activo = prefs.tema === t.v;
                        return (
                          <button
                            key={t.v}
                            onClick={() => actualizar({ tema: t.v })}
                            className="rounded-xl overflow-hidden border-2 transition-all text-left"
                            style={{ borderColor: activo ? "#7c3aed" : "transparent" }}
                          >
                            {/* Una miniatura del chat de verdad: dos
                                burbujas sobre su fondo. Un cuadrado de
                                color no dice cómo se va a ver. */}
                            <span className="block p-2.5 space-y-1.5" style={{ backgroundColor: t.fondo }}>
                              <span className="block w-[70%] h-4 rounded-lg rounded-bl-sm" style={{ backgroundColor: t.suya }} />
                              <span className="block w-[55%] h-4 rounded-lg rounded-br-sm ml-auto" style={{ backgroundColor: t.mia }} />
                            </span>
                            <span className="flex items-center justify-between px-2.5 py-1.5 surface">
                              <span className="text-[11.5px] font-semibold text-gray-800 dark:text-gray-100">{t.l}</span>
                              {activo && <Check size={13} className="text-violet-600" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => actualizar({ sonido: !prefs.sonido })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50 text-left"
                    >
                      {prefs.sonido
                        ? <Volume2 size={16} className="text-violet-500 flex-shrink-0" />
                        : <VolumeX size={16} className="text-gray-400 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">
                          Sonido al entrar un mensaje
                        </p>
                        <p className="text-[10.5px] text-gray-400">
                          {prefs.sonido ? "Encendido" : "Apagado"} · solo suena lo que escriben otros
                        </p>
                      </div>
                      <span
                        className="w-9 h-5 rounded-full flex-shrink-0 transition-colors relative"
                        style={{ backgroundColor: prefs.sonido ? "#7c3aed" : "var(--surface-3)" }}
                      >
                        <span
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                          style={{ left: prefs.sonido ? 18 : 2 }}
                        />
                      </span>
                    </button>
                  </div>
                </>
              ) : pestana === "filtros" ? (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Estado</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ESTADOS.map(e => {
                        const activo = filtros.estado === e.v;
                        return (
                          <button key={e.v || "todas"} onClick={() => onCambiar({ ...filtros, estado: e.v })}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all"
                            style={activo
                              ? { backgroundColor: "#7c3aed", color: "white" }
                              : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                            {e.l}
                            {activo && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Canal</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onCambiar({ ...filtros, canal: "" })}
                        className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all"
                        style={!filtros.canal
                          ? { backgroundColor: "#7c3aed", color: "white" }
                          : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                        Todos
                      </button>
                      {CANALES_CONOCIDOS.filter(c => c !== "INTERNO").map(canal => {
                        const activo = filtros.canal === canal;
                        const color = prefs.colores[canal];
                        return (
                          <button key={canal} onClick={() => onCambiar({ ...filtros, canal: activo ? "" : canal })}
                            className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all"
                            style={activo
                              ? { backgroundColor: color, color: "white" }
                              : { backgroundColor: color + "1f", color }}>
                            {prefs.etiquetas[canal]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {puestos > 0 && (
                    <button onClick={() => onCambiar({ estado: "ABIERTA", canal: "" })}
                      className="w-full py-2 text-[11.5px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                      Quitar los filtros
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                    El color y el nombre con el que ves cada canal en tu bandeja. Es tuyo:
                    no le cambia nada a nadie más del equipo.
                  </p>

                  {CANALES_CONOCIDOS.map(canal => (
                    <div key={canal} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: prefs.colores[canal] }} />
                        <input
                          value={prefs.etiquetas[canal] ?? ""}
                          onChange={e => actualizar({ etiquetas: { ...prefs.etiquetas, [canal]: e.target.value } })}
                          className="input py-1.5 text-sm flex-1"
                          maxLength={16}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {PALETA.map(c => (
                          <button
                            key={c}
                            onClick={() => actualizar({ colores: { ...prefs.colores, [canal]: c } })}
                            aria-label={`Color ${c}`}
                            className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                            style={{
                              backgroundColor: c,
                              outline: prefs.colores[canal] === c ? "2px solid var(--text-soft)" : "none",
                              outlineOffset: 2,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { leerPrefs };
