"use client";

// ============================================================
// Qué trae cada rol de fábrica.
//
// Es de solo lectura a propósito: el juego por defecto de un rol es
// política de la empresa y vive en código (`lib/permisos.ts`). Si fuera
// editable desde aquí, el día que se agregue una pantalla nueva habría
// que acordarse de dársela a cada rol a mano — y no se haría.
//
// Lo que sí se toca por pantalla son las excepciones de cada persona,
// en el botón de permisos de su fila.
// ============================================================

import { useState } from "react";
import { ChevronDown, Info, Eye, MousePointerClick } from "lucide-react";
import { PERMISOS, PERMISOS_POR_ROL, type ModuloClave } from "@/lib/permisos";

const ROLES_MOSTRADOS = [
  { v: "ADMIN", l: "Administrador", d: "Todo menos las conexiones externas y el SEO con IA." },
  { v: "MARKETING", l: "Marketing", d: "Campañas, atribución y retorno. Ve el embudo y los clientes; no toca ofertas." },
  { v: "VENDEDOR", l: "Vendedor", d: "Su ciclo comercial completo, más lo del ERP que necesita para vender." },
  { v: "PRODUCCION", l: "Producción", d: "Fabricación, trabajos e instalaciones. En Nexus, solo el chat del equipo." },
];

const COLOR_MODULO: Record<ModuloClave, string> = {
  ERP: "#185FA5",
  CRM: "#BA7517",
  NEXUS: "#7c3aed",
  MARKETING: "#db2777",
  SISTEMA: "#64748b",
};

export function PanelRoles() {
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setAbierto(abierto === "__panel" ? null : "__panel")}
        className="w-full card-header text-left"
      >
        <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Info size={15} className="text-gray-400" /> Qué trae cada rol de fábrica
        </h2>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="p-4 space-y-2">
          <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
            Esto es el punto de partida de cada rol y no se edita aquí: es política de la empresa
            y cambia para todos a la vez. Para darle o quitarle algo puntual a una persona,
            usa el botón de permisos de su fila.
          </p>

          {ROLES_MOSTRADOS.map(rol => {
            const claves = new Set(PERMISOS_POR_ROL[rol.v] ?? []);
            const abiertoEste = abierto === rol.v;
            return (
              <div key={rol.v} className="border border-gray-100 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setAbierto(abiertoEste ? "__panel" : rol.v)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors text-left"
                >
                  <span className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 w-28 flex-shrink-0">
                    {rol.l}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 flex-1 min-w-0 truncate">
                    {rol.d}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">
                    {claves.size} permisos
                  </span>
                  <ChevronDown size={13} className={`text-gray-300 flex-shrink-0 transition-transform ${abiertoEste ? "rotate-180" : ""}`} />
                </button>

                {abiertoEste && (
                  <div className="px-3 pb-3 pt-1 grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
                    {PERMISOS.map(p => (
                      <div
                        key={p.clave}
                        className={`flex items-center gap-1.5 text-[11px] py-0.5 ${
                          claves.has(p.clave) ? "" : "opacity-30 line-through"
                        }`}
                      >
                        {p.tipo === "vista"
                          ? <Eye size={10} className="flex-shrink-0" style={{ color: COLOR_MODULO[p.modulo] }} />
                          : <MousePointerClick size={10} className="flex-shrink-0" style={{ color: COLOR_MODULO[p.modulo] }} />}
                        <span className="text-gray-600 dark:text-slate-300 truncate">
                          <span className="text-gray-400">{p.modulo}</span> · {p.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
