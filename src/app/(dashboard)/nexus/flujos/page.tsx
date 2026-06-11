"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Zap, MessageSquare, GitBranch, Bot, Plus, X, Loader2, Trash2, Pencil,
  Sparkles, UserPlus, ArrowRightLeft, Tag, Hash,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const NEXUS_COLOR = "#7c3aed";

const ACCIONES = [
  { v: "responder_ia", l: "Responder con IA", Icon: Bot, c: "#7c3aed" },
  { v: "transferir", l: "Transferir a asesor", Icon: ArrowRightLeft, c: "#d97706" },
  { v: "etiquetar", l: "Etiquetar contacto", Icon: Tag, c: "#0891b2" },
  { v: "saludo", l: "Mensaje de saludo", Icon: MessageSquare, c: "#16a34a" },
];

interface Flujo {
  id: string; nombre: string; disparador: string[]; objetivo: string;
  accion: string; transferirSiComplejo: boolean; canal: string; activo: boolean;
}

function ModalFlujo({ flujo, onClose, onSaved }: { flujo?: Flujo; onClose: () => void; onSaved: () => void }) {
  const editar = !!flujo;
  const [f, setF] = useState({
    nombre: flujo?.nombre ?? "", disparador: (flujo?.disparador ?? []).join(", "),
    objetivo: flujo?.objetivo ?? "", accion: flujo?.accion ?? "responder_ia",
    transferirSiComplejo: flujo?.transferirSiComplejo ?? false, canal: flujo?.canal ?? "todos",
  });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.nombre.trim()) return toast.error("Nombre requerido");
    setSaving(true);
    try {
      const body = { ...(editar ? { id: flujo!.id } : {}), ...f, disparador: f.disparador.split(",").map(s => s.trim()).filter(Boolean) };
      const res = await fetch("/api/nexus/flujos", { method: editar ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success(editar ? "Flujo actualizado" : "Flujo creado");
      onSaved();
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-lg my-4 animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Zap size={16} style={{ color: NEXUS_COLOR }} /> {editar ? "Editar" : "Nuevo"} flujo</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre del flujo *</label>
            <input className="input" value={f.nombre} onChange={e => u("nombre", e.target.value)} placeholder="Ej: Consulta de producto" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Palabras que lo activan</label>
            <input className="input" value={f.disparador} onChange={e => u("disparador", e.target.value)} placeholder="precio, cotizar, medidas (separadas por coma)" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Objetivo del agente</label>
            <textarea className="input resize-none" rows={3} value={f.objetivo} onChange={e => u("objetivo", e.target.value)} placeholder="Describe qué debe lograr el agente en este flujo…" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Acción</label>
            <div className="grid grid-cols-2 gap-2">
              {ACCIONES.map(a => {
                const Icon = a.Icon; const sel = f.accion === a.v;
                return (
                  <button key={a.v} type="button" onClick={() => u("accion", a.v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all"
                    style={sel ? { borderColor: a.c, backgroundColor: a.c + "12" } : { borderColor: "var(--border)" }}>
                    <Icon size={14} style={{ color: sel ? a.c : "var(--text-muted)" }} />
                    <span className="text-xs font-semibold" style={{ color: sel ? a.c : "var(--text-soft)" }}>{a.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={() => u("transferirSiComplejo", !f.transferirSiComplejo)} className="flex items-center gap-3">
            <span className="w-10 h-5 rounded-full relative transition-all" style={{ backgroundColor: f.transferirSiComplejo ? NEXUS_COLOR : "var(--surface-3)" }}>
              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: f.transferirSiComplejo ? "translateX(22px)" : "translateX(2px)" }} />
            </span>
            <span className="text-sm text-soft">Transferir a un asesor humano si se complica</span>
          </button>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: NEXUS_COLOR }}>
            {saving && <Loader2 size={13} className="animate-spin" />} {editar ? "Guardar" : "Crear flujo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlujosContent() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; flujo?: Flujo }>({ open: false });

  const { data: flujos = [], isLoading } = useQuery<Flujo[]>({
    queryKey: ["nexus-flujos"],
    queryFn: async () => (await (await fetch("/api/nexus/flujos")).json()).data ?? [],
  });

  const toggle = async (fl: Flujo) => {
    await fetch("/api/nexus/flujos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fl.id, activo: !fl.activo }) });
    qc.invalidateQueries({ queryKey: ["nexus-flujos"] });
  };
  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este flujo?")) return;
    await fetch(`/api/nexus/flujos?id=${id}`, { method: "DELETE" });
    toast.success("Flujo eliminado");
    qc.invalidateQueries({ queryKey: ["nexus-flujos"] });
  };

  return (
    <>
      <Topbar title="Flujos & Automatización" actions={
        <button onClick={() => setModal({ open: true })} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: NEXUS_COLOR }}>
          <Plus size={13} /> Nuevo flujo
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-4 sm:p-6 space-y-5">

        {/* Hero */}
        <div className="card p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${NEXUS_COLOR}12, transparent)` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: NEXUS_COLOR }}><Sparkles size={22} className="text-white" /></div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Automatiza la atención al cliente</p>
            <p className="text-xs text-muted mt-0.5">Define flujos que el agente IA usa para responder. Necesitan la IA configurada en <Link href="/configuracion?tab=ia" className="font-semibold underline" style={{ color: NEXUS_COLOR }}>Configuración → IA</Link> y los canales conectados.</p>
          </div>
        </div>

        {/* Lista de flujos */}
        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: NEXUS_COLOR }} /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {flujos.map(fl => {
              const acc = ACCIONES.find(a => a.v === fl.accion) ?? ACCIONES[0];
              const AccIcon = acc.Icon;
              return (
                <div key={fl.id} className="card p-5 group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: acc.c + "18" }}><AccIcon size={18} style={{ color: acc.c }} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{fl.nombre}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: acc.c + "18", color: acc.c }}>{acc.l}</span>
                    </div>
                    <button onClick={() => toggle(fl)} title={fl.activo ? "Activo" : "Inactivo"}
                      className="w-10 h-5 rounded-full relative transition-all flex-shrink-0" style={{ backgroundColor: fl.activo ? "#16a34a" : "var(--surface-3)" }}>
                      <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: fl.activo ? "translateX(22px)" : "translateX(2px)" }} />
                    </button>
                  </div>
                  {fl.objetivo && <p className="text-xs text-muted mt-3 line-clamp-2">{fl.objetivo}</p>}
                  {fl.disparador.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {fl.disparador.slice(0, 5).map(d => <span key={d} className="text-[10px] font-medium px-2 py-0.5 rounded-full surface-3 text-muted flex items-center gap-0.5"><Hash size={8} />{d}</span>)}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t divider">
                    {fl.transferirSiComplejo
                      ? <span className="text-[10px] text-amber-600 flex items-center gap-1"><ArrowRightLeft size={10} /> Transfiere a humano si se complica</span>
                      : <span />}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModal({ open: true, flujo: fl })} className="text-muted hover:text-blue-500"><Pencil size={13} /></button>
                      <button onClick={() => eliminar(fl.id)} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Crear */}
            <button onClick={() => setModal({ open: true })} className="card p-5 border-2 border-dashed divider flex flex-col items-center justify-center gap-2 text-muted hover:surface-2 transition-colors min-h-[140px]">
              <Plus size={22} /> <span className="text-sm font-semibold">Crear nuevo flujo</span>
            </button>
          </div>
        )}
      </div>
      {modal.open && <ModalFlujo flujo={modal.flujo} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); qc.invalidateQueries({ queryKey: ["nexus-flujos"] }); }} />}
    </>
  );
}

export default function FlujosPage() { return <Suspense><FlujosContent /></Suspense>; }
