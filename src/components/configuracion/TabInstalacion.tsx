"use client";

// ============================================================
// Catálogo de instalación: qué servicios se cobran y cuánto se recarga
// por salir de la ciudad base.
//
// Antes la instalación era un sí/no en la cotización: no tenía precio ni
// quedaba discriminada. Aquí se define una vez y el asesor solo la elige.
// ============================================================

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Check, Wrench, MapPin, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";

export interface ServicioInstalacion {
  id: string; nombre: string; descripcion: string | null; unidad: string;
  precioBase: number; categorias: string[]; minimoCobro: number | null;
  activo: boolean; orden: number;
}
export interface RecargoCiudad {
  id: string; ciudad: string; departamento: string | null;
  porcentaje: number; montoFijo: number; activo: boolean;
}

const UNIDADES = ["m2", "ml", "unidad", "dia", "global"];

export function TabInstalacion() {
  const qc = useQueryClient();
  const [servicio, setServicio] = useState<Partial<ServicioInstalacion> | null>(null);
  const [ciudad, setCiudad] = useState<Partial<RecargoCiudad> | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading } = useQuery<{ servicios: ServicioInstalacion[]; ciudades: RecargoCiudad[] }>({
    queryKey: ["instalacion-catalogo"],
    queryFn: async () => (await (await fetch("/api/crm/instalacion-catalogo?todos=1")).json()).data ?? { servicios: [], ciudades: [] },
  });

  const refrescar = () => qc.invalidateQueries({ queryKey: ["instalacion-catalogo"] });

  const guardar = async (cuerpo: Record<string, unknown>, esCiudad = false) => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/instalacion-catalogo${esCiudad ? "?tipo=ciudad" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Guardado");
      setServicio(null); setCiudad(null);
      refrescar();
    } finally { setGuardando(false); }
  };

  const eliminar = async (id: string, esCiudad = false) => {
    if (!confirm("¿Desactivar? Deja de aparecer al cotizar; las cotizaciones viejas no cambian.")) return;
    await fetch(`/api/crm/instalacion-catalogo?id=${id}${esCiudad ? "&tipo=ciudad" : ""}`, { method: "DELETE" });
    refrescar();
  };

  if (isLoading) {
    return <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>;
  }

  const servicios = data?.servicios ?? [];
  const ciudades = data?.ciudades ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}>
          <Wrench size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Catálogo de instalación</h2>
          <p className="text-xs text-muted mt-0.5">
            Los servicios que el asesor puede agregar a una cotización, con su precio por unidad y el recargo por ciudad.
          </p>
        </div>
      </div>

      {/* ── Servicios ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Servicios</p>
          <button onClick={() => setServicio({ unidad: "m2", activo: true })} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: "var(--brand-color)" }}>
            <Plus size={13} /> Agregar
          </button>
        </div>

        {servicios.length === 0 ? (
          <div className="p-6 text-center surface-2 rounded-xl">
            <p className="text-xs text-muted">Sin servicios cargados.</p>
            <p className="text-[11px] text-muted mt-1">Mientras no haya ninguno, la instalación hay que escribirla a mano en cada cotización.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {servicios.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl surface-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${s.activo ? "text-soft" : "text-muted line-through"}`}>{s.nombre}</p>
                  {s.descripcion && <p className="text-[10px] text-muted truncate">{s.descripcion}</p>}
                  {s.categorias.length > 0 && (
                    <p className="text-[10px] text-muted">Aplica a: {s.categorias.join(", ")}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-soft">{formatCOP(s.precioBase)}</p>
                  <p className="text-[10px] text-muted">
                    por {s.unidad}{s.minimoCobro ? ` · mín. ${s.minimoCobro}` : ""}
                  </p>
                </div>
                <button onClick={() => setServicio(s)} className="text-xs font-semibold" style={{ color: "var(--brand-color)" }}>Editar</button>
                <button onClick={() => eliminar(s.id)} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recargos por ciudad ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Recargo por ciudad</p>
          <button onClick={() => setCiudad({ activo: true })} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: "var(--brand-color)" }}>
            <Plus size={13} /> Agregar
          </button>
        </div>
        <p className="text-[11px] text-muted mb-3">
          Viáticos y desplazamiento. Se aplica sobre el valor de la instalación cuando la cotización tiene una ciudad distinta a la base.
        </p>

        {ciudades.length === 0 ? (
          <div className="p-6 text-center surface-2 rounded-xl">
            <p className="text-xs text-muted">Sin recargos. La instalación cuesta lo mismo en cualquier ciudad.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {ciudades.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl surface-2">
                <MapPin size={14} className="text-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${c.activo ? "text-soft" : "text-muted line-through"}`}>{c.ciudad}</p>
                  {c.departamento && <p className="text-[10px] text-muted">{c.departamento}</p>}
                </div>
                <p className="text-xs font-bold text-soft flex-shrink-0">
                  {c.porcentaje > 0 && `+${c.porcentaje}%`}
                  {c.porcentaje > 0 && c.montoFijo > 0 && " · "}
                  {c.montoFijo > 0 && `+${formatCOP(c.montoFijo)}`}
                  {c.porcentaje === 0 && c.montoFijo === 0 && "sin recargo"}
                </p>
                <button onClick={() => setCiudad(c)} className="text-xs font-semibold" style={{ color: "var(--brand-color)" }}>Editar</button>
                <button onClick={() => eliminar(c.id, true)} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted">
        Cuando llegue la lista de precios en Excel de gerencia, esto se llena en un rato y el asesor deja de calcular la
        instalación de memoria.
      </p>

      {/* ── Modal servicio ── */}
      {servicio && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-lg my-4 animate-fade-up">
            <div className="card-header">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{servicio.id ? "Editar servicio" : "Nuevo servicio"}</h3>
              <button onClick={() => setServicio(null)} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre *</label>
                <input className="input" value={servicio.nombre ?? ""} onChange={e => setServicio(p => ({ ...p, nombre: e.target.value }))} placeholder="Instalación de cerramiento en malla eslabonada" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Descripción</label>
                <textarea className="input resize-none" rows={2} value={servicio.descripcion ?? ""} onChange={e => setServicio(p => ({ ...p, descripcion: e.target.value }))} placeholder="Incluye replanteo, excavación, fundida de postes y tensado." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Unidad</label>
                  <select className="input" value={servicio.unidad ?? "m2"} onChange={e => setServicio(p => ({ ...p, unidad: e.target.value }))}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Precio</label>
                  <input type="number" className="input" value={servicio.precioBase ?? ""} onChange={e => setServicio(p => ({ ...p, precioBase: Number(e.target.value) }))} placeholder="8900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Mínimo</label>
                  <input type="number" className="input" value={servicio.minimoCobro ?? ""} onChange={e => setServicio(p => ({ ...p, minimoCobro: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="—" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Categorías donde se sugiere</label>
                <input
                  className="input"
                  value={(servicio.categorias ?? []).join(", ")}
                  onChange={e => setServicio(p => ({ ...p, categorias: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                  placeholder="mallas-metalicas, seguridad-perimetral"
                />
                <p className="text-[11px] text-muted mt-1">Separadas por coma. Vacío = se sugiere siempre.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-soft">
                <input type="checkbox" checked={servicio.activo !== false} onChange={e => setServicio(p => ({ ...p, activo: e.target.checked }))} />
                Activo
              </label>
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button onClick={() => setServicio(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => guardar(servicio as Record<string, unknown>)} disabled={guardando} className="btn-primary flex-1 justify-center">
                {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ciudad ── */}
      {ciudad && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-md my-4 animate-fade-up">
            <div className="card-header">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{ciudad.id ? "Editar recargo" : "Nuevo recargo"}</h3>
              <button onClick={() => setCiudad(null)} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Ciudad *</label>
                  <input className="input" value={ciudad.ciudad ?? ""} onChange={e => setCiudad(p => ({ ...p, ciudad: e.target.value }))} placeholder="Santa Marta" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Departamento</label>
                  <input className="input" value={ciudad.departamento ?? ""} onChange={e => setCiudad(p => ({ ...p, departamento: e.target.value }))} placeholder="Magdalena" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Recargo %</label>
                  <input type="number" className="input" value={ciudad.porcentaje ?? ""} onChange={e => setCiudad(p => ({ ...p, porcentaje: Number(e.target.value) }))} placeholder="15" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Monto fijo</label>
                  <input type="number" className="input" value={ciudad.montoFijo ?? ""} onChange={e => setCiudad(p => ({ ...p, montoFijo: Number(e.target.value) }))} placeholder="0" />
                </div>
              </div>
              <p className="text-[11px] text-muted">Si pones los dos, se suman: primero el porcentaje sobre la instalación y luego el monto fijo.</p>
              <label className="flex items-center gap-2 text-xs text-soft">
                <input type="checkbox" checked={ciudad.activo !== false} onChange={e => setCiudad(p => ({ ...p, activo: e.target.checked }))} />
                Activo
              </label>
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button onClick={() => setCiudad(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => guardar(ciudad as Record<string, unknown>, true)} disabled={guardando} className="btn-primary flex-1 justify-center">
                {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
