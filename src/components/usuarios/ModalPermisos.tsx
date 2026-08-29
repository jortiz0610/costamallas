"use client";

// ============================================================
// Permisos de UNA persona.
//
// Muestra las tres cosas que hay que ver a la vez para no equivocarse:
// qué trae el rol, qué se cambió a mano y cuál es el resultado. Sin eso,
// quien administra no distingue "esto lo tiene porque es vendedor" de
// "esto se lo dieron a él en particular" — y esa confusión es la razón
// por la que los permisos sueltos se quedan puestos para siempre.
// ============================================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  X, Loader2, RotateCcw, ShieldCheck, Eye, MousePointerClick, HelpCircle,
} from "lucide-react";
import type { Permiso, ModuloClave } from "@/lib/permisos";

interface Props {
  usuario: { id: string; nombre: string; email: string; rol: string };
  onClose: () => void;
  onSaved?: () => void;
}

interface Respuesta {
  usuario: { id: string; nombre: string; rol: string };
  catalogo: Permiso[];
  porDefectoDelRol: string[];
  excepciones: Record<string, boolean>;
  efectivos: string[];
  bloqueado: boolean;
}

const NOMBRE_MODULO: Record<ModuloClave, string> = {
  ERP: "ERP · Catálogo y operación",
  CRM: "CRM · Comercial",
  NEXUS: "Nexus · Conversaciones",
  MARKETING: "Growth · Marketing",
  SISTEMA: "Sistema",
};

const COLOR_MODULO: Record<ModuloClave, string> = {
  ERP: "#185FA5",
  CRM: "#BA7517",
  NEXUS: "#7c3aed",
  MARKETING: "#db2777",
  SISTEMA: "#64748b",
};

export function ModalPermisos({ usuario, onClose, onSaved }: Props) {
  // Solo los permisos que se tocaron en esta sesión de edición:
  // clave → true/false, o `null` para volver al valor del rol.
  const [cambios, setCambios] = useState<Record<string, boolean | null>>({});
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading, refetch } = useQuery<Respuesta>({
    queryKey: ["permisos", usuario.id],
    queryFn: async () => {
      const res = await fetch(`/api/usuarios/${usuario.id}/permisos`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const porDefecto = useMemo(() => new Set(data?.porDefectoDelRol ?? []), [data]);

  /** Estado actual en pantalla: lo guardado más lo que se acaba de tocar. */
  const valorDe = (clave: string): boolean => {
    if (clave in cambios) {
      const v = cambios[clave];
      return v === null ? porDefecto.has(clave) : v;
    }
    const guardado = data?.excepciones?.[clave];
    return guardado === undefined ? porDefecto.has(clave) : guardado;
  };

  /** ¿Está distinto de lo que trae su rol? */
  const esExcepcion = (clave: string) => valorDe(clave) !== porDefecto.has(clave);

  const alternar = (clave: string) => {
    const nuevo = !valorDe(clave);
    setCambios(c => ({
      ...c,
      // Si vuelve a coincidir con el rol, se manda `null` para BORRAR la
      // excepción en vez de guardar una que no excepciona nada.
      [clave]: nuevo === porDefecto.has(clave) ? null : nuevo,
    }));
  };

  const volverAlRol = () => {
    if (!data) return;
    const reset: Record<string, boolean | null> = {};
    for (const p of data.catalogo) reset[p.clave] = null;
    setCambios(reset);
  };

  const hayCambios = Object.keys(cambios).some(c => {
    const v = cambios[c];
    const guardado = data?.excepciones?.[c];
    const actual = guardado === undefined ? porDefecto.has(c) : guardado;
    return (v === null ? porDefecto.has(c) : v) !== actual;
  });

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/permisos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cambios }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "No se pudo guardar");
      toast.success("Permisos actualizados");
      setCambios({});
      await refetch();
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const modulos = useMemo(() => {
    const orden: ModuloClave[] = ["ERP", "CRM", "NEXUS", "MARKETING", "SISTEMA"];
    return orden
      .map(m => ({ modulo: m, permisos: (data?.catalogo ?? []).filter(p => p.modulo === m) }))
      .filter(g => g.permisos.length > 0);
  }, [data]);

  const totalExcepciones = (data?.catalogo ?? []).filter(p => esExcepcion(p.clave)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="card w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="card-header flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <ShieldCheck size={15} className="text-gray-400" />
              Permisos de {usuario.nombre}
            </h2>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
              Rol {usuario.rol}
              {totalExcepciones > 0 && (
                <> · <span className="font-semibold text-amber-600">{totalExcepciones} ajuste{totalExcepciones === 1 ? "" : "s"} personal{totalExcepciones === 1 ? "" : "es"}</span></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="p-10 text-center">
            <Loader2 size={18} className="animate-spin mx-auto text-gray-400" />
          </div>
        ) : data.bloqueado ? (
          <div className="p-8 text-center text-[13px] text-gray-500 dark:text-slate-400">
            El superadministrador lo tiene todo por definición.
            <br />
            <span className="text-[11px] text-gray-400">
              No admite excepciones a propósito: si una mal puesta le cerrara esta pantalla,
              no habría forma de deshacerlo desde el portal.
            </span>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                El punto de partida es lo que trae el rol <strong>{usuario.rol}</strong>. Lo que cambies aquí
                es una excepción <em>solo para esta persona</em>: queda marcada en ámbar y se puede deshacer.
                Si el rol gana pantallas nuevas más adelante, esta persona también las recibe.
              </p>

              {modulos.map(({ modulo, permisos }) => (
                <div key={modulo}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: COLOR_MODULO[modulo] }}
                  >
                    {NOMBRE_MODULO[modulo]}
                  </p>
                  <div className="space-y-1">
                    {permisos.map(p => {
                      const activo = valorDe(p.clave);
                      const excepcion = esExcepcion(p.clave);
                      return (
                        <label
                          key={p.clave}
                          className={`flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            excepcion
                              ? "bg-amber-50 dark:bg-amber-900/15"
                              : "hover:bg-gray-50 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={() => alternar(p.clave)}
                            className="mt-0.5 w-4 h-4 rounded flex-shrink-0 accent-current"
                            style={{ accentColor: COLOR_MODULO[modulo] }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.tipo === "vista"
                                ? <Eye size={11} className="text-gray-300 flex-shrink-0" />
                                : <MousePointerClick size={11} className="text-gray-300 flex-shrink-0" />}
                              <span className="text-[12.5px] font-medium text-gray-800 dark:text-gray-100">
                                {p.label}
                              </span>
                              {p.tipo === "accion" && (
                                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300">
                                  acción
                                </span>
                              )}
                              {excepcion && (
                                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                  {activo ? "concedido a mano" : "retirado a mano"}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{p.ayuda}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Pie */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 dark:border-slate-700 flex-shrink-0">
              <button
                onClick={volverAlRol}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                title="Quitar todas las excepciones y dejarlo con lo que trae su rol"
              >
                <RotateCcw size={13} /> Volver a lo que trae el rol
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] text-gray-400 hidden sm:inline-flex items-center gap-1">
                  <HelpCircle size={11} /> Ocultar un menú no basta: el permiso se valida también en el servidor.
                </span>
                <button onClick={onClose} className="btn-secondary btn-sm">Cerrar</button>
                <button
                  onClick={guardar}
                  disabled={!hayCambios || guardando}
                  className="btn-primary btn-sm disabled:opacity-40"
                >
                  {guardando ? <Loader2 size={13} className="animate-spin" /> : null}
                  Guardar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
