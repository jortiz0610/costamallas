"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Plus, MessageSquareText, X, Loader2, Trash2, Copy, Zap, Hash,
  Sparkles, Tag,
} from "lucide-react";
import toast from "react-hot-toast";

const NEXUS_COLOR = "#7c3aed";

const CATEGORIAS = [
  { v: "GENERAL",     l: "General",     c: "#6b7280" },
  { v: "SALUDO",      l: "Saludo",      c: "#16a34a" },
  { v: "COTIZACION",  l: "Cotización",  c: "#185FA5" },
  { v: "SEGUIMIENTO", l: "Seguimiento", c: "#d97706" },
  { v: "DESPEDIDA",   l: "Despedida",   c: "#7c3aed" },
  { v: "FAQ",         l: "FAQ",         c: "#0891b2" },
];

interface Plantilla {
  id: string; nombre: string; categoria: string; canal: string;
  contenido: string; atajo?: string; vecesUsada: number;
}

function NuevaPlantilla({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nombre: "", categoria: "GENERAL", canal: "todos", contenido: "", atajo: "" });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.nombre.trim() || !form.contenido.trim()) return toast.error("Nombre y contenido requeridos");
    setSaving(true);
    try {
      const res = await fetch("/api/nexus/plantillas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success("Plantilla creada");
      onSaved();
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-lg my-4 animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><MessageSquareText size={16} style={{ color: NEXUS_COLOR }} /> Nueva plantilla</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e => upd("nombre", e.target.value)} placeholder="Ej: Saludo inicial" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Atajo</label>
              <input className="input" value={form.atajo} onChange={e => upd("atajo", e.target.value)} placeholder="/saludo" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Categoría</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map(c => {
                const sel = form.categoria === c.v;
                return (
                  <button key={c.v} type="button" onClick={() => upd("categoria", c.v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={sel ? { backgroundColor: c.c, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                    {c.l}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Contenido *</label>
            <textarea className="input resize-none" rows={5} value={form.contenido} onChange={e => upd("contenido", e.target.value)}
              placeholder="Hola {nombre}, gracias por contactar a Costamallas. ¿En qué podemos ayudarte?" />
            <p className="text-[11px] text-muted mt-1">Usa <code className="surface-3 px-1 rounded">{"{nombre}"}</code> para personalizar con el nombre del contacto.</p>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: NEXUS_COLOR }}>
            {saving && <Loader2 size={13} className="animate-spin" />} Crear plantilla
          </button>
        </div>
      </div>
    </div>
  );
}

function PlantillasContent() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [filtroCat, setFiltroCat] = useState("");

  const { data: plantillas = [], isLoading } = useQuery<Plantilla[]>({
    queryKey: ["nexus-plantillas", filtroCat],
    queryFn: async () => {
      const qs = filtroCat ? `?categoria=${filtroCat}` : "";
      return (await (await fetch(`/api/nexus/plantillas${qs}`)).json()).data ?? [];
    },
  });

  const copiar = async (p: Plantilla) => {
    await navigator.clipboard.writeText(p.contenido);
    await fetch("/api/nexus/plantillas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, incrementarUso: true }) });
    toast.success("Copiado al portapapeles");
    qc.invalidateQueries({ queryKey: ["nexus-plantillas"] });
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar plantilla?")) return;
    await fetch(`/api/nexus/plantillas?id=${id}`, { method: "DELETE" });
    toast.success("Eliminada");
    qc.invalidateQueries({ queryKey: ["nexus-plantillas"] });
  };

  return (
    <>
      <Topbar title="Plantillas & Automatización" actions={
        <button onClick={() => setModal(true)} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: NEXUS_COLOR }}>
          <Plus size={13} /> Nueva plantilla
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5">

        {/* Hero automatización */}
        <div className="card p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${NEXUS_COLOR}12, transparent)` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: NEXUS_COLOR }}>
            <Sparkles size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Respuestas rápidas para tu equipo</p>
            <p className="text-xs text-muted mt-0.5">Crea mensajes reutilizables y responde más rápido en todos los canales. Pronto: respuestas automáticas por palabras clave.</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl" style={{ backgroundColor: NEXUS_COLOR + "18", color: NEXUS_COLOR }}>{plantillas.length} plantillas</span>
        </div>

        {/* Filtros por categoría */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFiltroCat("")} className="pill" style={!filtroCat ? { backgroundColor: NEXUS_COLOR, color: "white" } : {}}>Todas</button>
          {CATEGORIAS.map(c => (
            <button key={c.v} onClick={() => setFiltroCat(filtroCat === c.v ? "" : c.v)}
              className="pill" style={filtroCat === c.v ? { backgroundColor: c.c, color: "white" } : {}}>
              {c.l}
            </button>
          ))}
        </div>

        {/* Grid de plantillas */}
        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: NEXUS_COLOR }} /></div>
        ) : plantillas.length === 0 ? (
          <div className="card p-12 text-center">
            <MessageSquareText size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">Sin plantillas aún</p>
            <button onClick={() => setModal(true)} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2" style={{ backgroundColor: NEXUS_COLOR }}>
              <Plus size={14} /> Crear primera plantilla
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantillas.map(p => {
              const cat = CATEGORIAS.find(c => c.v === p.categoria) ?? CATEGORIAS[0];
              return (
                <div key={p.id} className="card card-hover p-4 flex flex-col group">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.c + "20", color: cat.c }}>{cat.l}</span>
                    <button onClick={() => eliminar(p.id)} className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} /></button>
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{p.nombre}</p>
                  {p.atajo && <span className="text-[11px] font-mono text-muted flex items-center gap-0.5 mt-0.5"><Hash size={9} />{p.atajo}</span>}
                  <p className="text-xs text-muted mt-2 line-clamp-3 flex-1">{p.contenido}</p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t divider">
                    <span className="text-[10px] text-muted flex items-center gap-1"><Zap size={10} />{p.vecesUsada} usos</span>
                    <button onClick={() => copiar(p)} className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all" style={{ backgroundColor: NEXUS_COLOR + "15", color: NEXUS_COLOR }}>
                      <Copy size={11} /> Copiar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {modal && <NuevaPlantilla onClose={() => setModal(false)} onSaved={() => { setModal(false); qc.invalidateQueries({ queryKey: ["nexus-plantillas"] }); }} />}
    </>
  );
}

export default function PlantillasPage() {
  return <Suspense><PlantillasContent /></Suspense>;
}
