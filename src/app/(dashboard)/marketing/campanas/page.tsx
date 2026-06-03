"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, X, Loader2, Megaphone, Trash2, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";
import { CANALES, kpis } from "@/lib/marketing";

const MKT = "#db2777";
const ESTADOS = [
  { v: "activa", l: "Activa", c: "#16a34a" },
  { v: "pausada", l: "Pausada", c: "#d97706" },
  { v: "finalizada", l: "Finalizada", c: "#64748b" },
];

interface Campana {
  id: string; nombre: string; canal: string; estado: string;
  inversion: number; impresiones: number; clics: number; leads: number; conversiones: number; ingresos: number;
  fechaInicio?: string | null; fechaFin?: string | null;
}

function ModalCampana({ campana, onClose, onSaved }: { campana?: Campana; onClose: () => void; onSaved: () => void }) {
  const editar = !!campana;
  const [f, setF] = useState({
    nombre: campana?.nombre ?? "", canal: campana?.canal ?? "google", estado: campana?.estado ?? "activa",
    inversion: campana?.inversion ?? 0, impresiones: campana?.impresiones ?? 0, clics: campana?.clics ?? 0,
    leads: campana?.leads ?? 0, conversiones: campana?.conversiones ?? 0, ingresos: campana?.ingresos ?? 0,
    fechaInicio: campana?.fechaInicio ?? "", fechaFin: campana?.fechaFin ?? "",
  });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.nombre.trim()) return toast.error("Nombre requerido");
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/campanas", {
        method: editar ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editar ? { id: campana!.id, ...f } : f),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success(editar ? "Campaña actualizada" : "Campaña creada");
      onSaved();
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  const NUM = [
    { k: "inversion", l: "Inversión (COP)" }, { k: "ingresos", l: "Ingresos generados (COP)" },
    { k: "impresiones", l: "Impresiones" }, { k: "clics", l: "Clics" },
    { k: "leads", l: "Leads" }, { k: "conversiones", l: "Ventas cerradas" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-lg my-4 animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Megaphone size={16} style={{ color: MKT }} /> {editar ? "Editar" : "Nueva"} campaña</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre *</label>
            <input className="input" value={f.nombre} onChange={e => u("nombre", e.target.value)} placeholder="Ej: Mallas balcón - Verano" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Canal</label>
              <select className="input" value={f.canal} onChange={e => u("canal", e.target.value)}>
                {CANALES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Estado</label>
              <select className="input" value={f.estado} onChange={e => u("estado", e.target.value)}>
                {ESTADOS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {NUM.map(n => (
              <div key={n.k}>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{n.l}</label>
                <input type="number" className="input" value={(f as Record<string, unknown>)[n.k] as number} onChange={e => u(n.k, e.target.value)} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Inicio</label>
              <input type="date" className="input" value={f.fechaInicio ?? ""} onChange={e => u("fechaInicio", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Fin</label>
              <input type="date" className="input" value={f.fechaFin ?? ""} onChange={e => u("fechaFin", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: MKT }}>
            {saving && <Loader2 size={13} className="animate-spin" />} {editar ? "Guardar" : "Crear campaña"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampanasContent() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; campana?: Campana }>({ open: false });

  const { data: campanas = [], isLoading } = useQuery<Campana[]>({
    queryKey: ["mkt-campanas"],
    queryFn: async () => (await (await fetch("/api/marketing/campanas")).json()).data ?? [],
  });

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar campaña?")) return;
    await fetch(`/api/marketing/campanas?id=${id}`, { method: "DELETE" });
    toast.success("Eliminada");
    qc.invalidateQueries({ queryKey: ["mkt-campanas"] });
  };

  return (
    <>
      <Topbar title="Campañas" actions={
        <button onClick={() => setModal({ open: true })} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: MKT }}>
          <Plus size={13} /> Nueva campaña
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6">
        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: MKT }} /></div>
        ) : campanas.length === 0 ? (
          <div className="card p-12 text-center">
            <Megaphone size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">Sin campañas. Crea la primera.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="table-wrapper" style={{ border: "none" }}>
              <table className="table">
                <thead><tr><th>Campaña</th><th>Canal</th><th>Estado</th><th className="text-right">Inversión</th><th className="text-right">Leads</th><th className="text-right">Ventas</th><th className="text-right">Ingresos</th><th className="text-right">ROAS</th><th></th></tr></thead>
                <tbody>
                  {campanas.map(c => {
                    const ch = CANALES.find(x => x.v === c.canal);
                    const est = ESTADOS.find(x => x.v === c.estado);
                    const r = kpis([c]);
                    return (
                      <tr key={c.id} className="group">
                        <td className="font-medium text-gray-800 dark:text-gray-100">{c.nombre}</td>
                        <td><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: (ch?.c ?? "#64748b") + "20", color: ch?.c ?? "#64748b" }}>{ch?.l ?? c.canal}</span></td>
                        <td><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: (est?.c ?? "#64748b") + "20", color: est?.c ?? "#64748b" }}>{est?.l ?? c.estado}</span></td>
                        <td className="text-right">{formatCOP(c.inversion)}</td>
                        <td className="text-right">{c.leads}</td>
                        <td className="text-right">{c.conversiones}</td>
                        <td className="text-right">{formatCOP(c.ingresos)}</td>
                        <td className="text-right font-bold" style={{ color: r.roas >= 1 ? "#16a34a" : "#dc2626" }}>{r.roas.toFixed(2)}x</td>
                        <td className="text-right">
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setModal({ open: true, campana: c })} className="text-muted hover:text-blue-500"><Pencil size={13} /></button>
                            <button onClick={() => eliminar(c.id)} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {modal.open && <ModalCampana campana={modal.campana} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); qc.invalidateQueries({ queryKey: ["mkt-campanas"] }); }} />}
    </>
  );
}

export default function Page() { return <Suspense><CampanasContent /></Suspense>; }
