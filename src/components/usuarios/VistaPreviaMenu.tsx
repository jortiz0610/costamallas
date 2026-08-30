"use client";

// ============================================================
// "¿Qué ve esta persona?" — sin ponerse su rol.
//
// Reemplaza a "ver el portal como…", que hacía lo mismo cambiándole el
// rol a la sesión del superadministrador mediante una cookie. Funcionaba,
// pero el precio era alto: una sesión cuyo rol dependía de una cookie, un
// bloqueo de escrituras para TODO el portal mientras estuviera puesto, y
// el fallo probable —olvidarse el modo activo y creer que el portal está
// roto— pegado justo a quien más permisos tiene.
//
// Esto responde la misma pregunta y no toca nada: pinta el menú que le
// queda a esa persona con sus permisos efectivos, aquí al lado de las
// casillas que se están marcando.
// ============================================================

import { useMemo } from "react";
import { Eye, EyeOff, Smartphone, Monitor } from "lucide-react";
import { PERMISOS, modulosVisibles, type ModuloClave } from "@/lib/permisos";

const NOMBRE_MODULO: Record<ModuloClave, string> = {
  ERP: "ERP",
  CRM: "CRM",
  NEXUS: "Nexus",
  MARKETING: "Growth",
  SISTEMA: "Sistema",
};

const COLOR_MODULO: Record<ModuloClave, string> = {
  ERP: "#185FA5",
  CRM: "#BA7517",
  NEXUS: "#7c3aed",
  MARKETING: "#db2777",
  SISTEMA: "#64748b",
};

export function VistaPreviaMenu({
  permisos,
  nombre,
}: {
  /** Los permisos EFECTIVOS: rol + excepciones, ya calculados. */
  permisos: Set<string>;
  nombre: string;
}) {
  const modulos = useMemo(() => modulosVisibles(permisos), [permisos]);

  // En el teléfono se entra por Nexus (ver `ModuloDeArranque`), así que
  // el primer módulo que verá no es necesariamente el primero del menú.
  const arranqueMovil = modulos.includes("NEXUS") ? "NEXUS" : modulos[0];
  const arranqueEscritorio = modulos.includes("ERP") ? "ERP" : modulos[0];

  if (modulos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 p-4 text-center">
        <EyeOff size={18} className="mx-auto mb-2 text-gray-300" />
        <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
          {nombre} no vería ninguna pantalla
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Puede iniciar sesión, pero el portal le quedaría vacío.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 bg-gray-50 dark:bg-slate-800/60">
        <Eye size={13} className="text-gray-400" />
        <p className="text-[11.5px] font-semibold text-gray-700 dark:text-gray-200">
          El menú que le queda a {nombre}
        </p>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-gray-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Smartphone size={11} /> Entra por <strong>{NOMBRE_MODULO[arranqueMovil]}</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <Monitor size={11} /> Entra por <strong>{NOMBRE_MODULO[arranqueEscritorio]}</strong>
          </span>
        </div>

        {modulos.map(m => {
          const pantallas = PERMISOS.filter(
            p => p.modulo === m && p.tipo === "vista" && permisos.has(p.clave),
          );
          return (
            <div key={m}>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: COLOR_MODULO[m] }}
              >
                {NOMBRE_MODULO[m]}
              </p>
              <div className="flex flex-wrap gap-1">
                {pantallas.map(p => (
                  <span
                    key={p.clave}
                    className="text-[11px] px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: COLOR_MODULO[m] + "14", color: COLOR_MODULO[m] }}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Las acciones no salen en el menú pero cambian lo que puede
            hacer dentro, y es donde más se equivoca uno al configurar. */}
        {(() => {
          const acciones = PERMISOS.filter(p => p.tipo === "accion" && permisos.has(p.clave));
          if (!acciones.length) return null;
          return (
            <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Además puede
              </p>
              <div className="flex flex-wrap gap-1">
                {acciones.map(p => (
                  <span
                    key={p.clave}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
