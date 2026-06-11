"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Plus, CheckSquare, Square, Clock, Phone, Mail, Users, Calendar,
  FileText, MapPin, X, Loader2, Trash2, AlertCircle, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

const CRM_COLOR = "#BA7517";

const TIPOS = [
  { v: "SEGUIMIENTO", l: "Seguimiento", Icon: Clock,    c: "#185FA5" },
  { v: "LLAMADA",     l: "Llamada",     Icon: Phone,    c: "#16a34a" },
  { v: "EMAIL",       l: "Email",       Icon: Mail,     c: "#7c3aed" },
  { v: "REUNION",     l: "Reunión",     Icon: Users,    c: "#d97706" },
  { v: "COTIZACION",  l: "Cotización",  Icon: FileText, c: CRM_COLOR },
  { v: "VISITA",      l: "Visita",      Icon: MapPin,   c: "#0891b2" },
];

const PRIORIDADES = [
  { v: "BAJA",    l: "Baja",    c: "#94a3b8" },
  { v: "NORMAL",  l: "Normal",  c: "#3b82f6" },
  { v: "ALTA",    l: "Alta",    c: "#f59e0b" },
  { v: "URGENTE", l: "Urgente", c: "#ef4444" },
];

interface Tarea {
  id: string; titulo: string; descripcion?: string; tipo: string; prioridad: string;
  estado: string; fechaVence?: string; createdAt: string;
  cliente?: { id: string; nombre: string; empresa?: string };
  asignado?: { id: string; nombre: string };
}
interface Cliente { id: string; nombre: string; empresa?: string; }

function NuevaTarea({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("SEGUIMIENTO");
  const [prioridad, setPrioridad] = useState("NORMAL");
  const [fechaVence, setFechaVence] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteBusq, setClienteBusq] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["tarea-clientes", clienteBusq],
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`)).json()).data ?? [],
    enabled: clienteBusq.length > 1,
  });
  const clienteSel = clientes.find(c => c.id === clienteId);

  const save = async () => {
    if (!titulo.trim()) return toast.error("Título requerido");
    setSaving(true);
    try {
      const res = await fetch("/api/crm/tareas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descripcion, tipo, prioridad, fechaVence: fechaVence || null, clienteId: clienteId || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success("Tarea creada");
      onSaved();
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-lg my-4 animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CheckSquare size={16} style={{ color: CRM_COLOR }} /> Nueva tarea
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Título *</label>
            <input className="input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Llamar para seguimiento de cotización" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(t => {
                const Icon = t.Icon; const sel = tipo === t.v;
                return (
                  <button key={t.v} type="button" onClick={() => setTipo(t.v)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all"
                    style={sel ? { borderColor: t.c, backgroundColor: t.c + "12" } : { borderColor: "var(--border)" }}>
                    <Icon size={14} style={{ color: sel ? t.c : "var(--text-muted)" }} />
                    <span className="text-xs font-semibold" style={{ color: sel ? t.c : "var(--text-soft)" }}>{t.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Prioridad</label>
              <div className="flex gap-1.5">
                {PRIORIDADES.map(p => {
                  const sel = prioridad === p.v;
                  return (
                    <button key={p.v} type="button" onClick={() => setPrioridad(p.v)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                      style={sel ? { backgroundColor: p.c, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                      {p.l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Vence</label>
              <input type="date" className="input" value={fechaVence} onChange={e => setFechaVence(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Cliente (opcional)</label>
            {clienteSel ? (
              <div className="flex items-center justify-between rounded-xl px-3 py-2 surface-2">
                <span className="text-sm font-medium text-soft">{clienteSel.nombre}</span>
                <button onClick={() => { setClienteId(""); setClienteBusq(""); }} className="text-muted hover:text-red-500"><X size={13} /></button>
              </div>
            ) : (
              <div className="relative">
                <input className="input" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente..." />
                {clientes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 card z-10 overflow-hidden max-h-40 overflow-y-auto">
                    {clientes.map(c => (
                      <button key={c.id} type="button" onClick={() => { setClienteId(c.id); setClienteBusq(""); }}
                        className="w-full text-left px-3 py-2 hover:surface-2 text-sm text-soft">{c.nombre}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Notas</label>
            <textarea className="input resize-none" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalles de la tarea..." />
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
            {saving && <Loader2 size={13} className="animate-spin" />} Crear tarea
          </button>
        </div>
      </div>
    </div>
  );
}

function TareasContent() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState("PENDIENTE");

  const { data: tareas = [], isLoading } = useQuery<Tarea[]>({
    queryKey: ["crm-tareas", filtro],
    queryFn: async () => {
      const qs = filtro === "TODAS" ? "" : `?estado=${filtro}`;
      return (await (await fetch(`/api/crm/tareas${qs}`)).json()).data ?? [];
    },
  });

  const toggle = async (t: Tarea) => {
    const nuevo = t.estado === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA";
    const res = await fetch("/api/crm/tareas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, estado: nuevo }) });
    if ((await res.json()).success) {
      toast.success(nuevo === "COMPLETADA" ? "Completada ✓" : "Reabierta");
      qc.invalidateQueries({ queryKey: ["crm-tareas"] });
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar tarea?")) return;
    await fetch(`/api/crm/tareas?id=${id}`, { method: "DELETE" });
    toast.success("Eliminada");
    qc.invalidateQueries({ queryKey: ["crm-tareas"] });
  };

  const FILTROS = [
    { v: "PENDIENTE",  l: "Pendientes" },
    { v: "COMPLETADA", l: "Completadas" },
    { v: "TODAS",      l: "Todas" },
  ];

  const vencidas = tareas.filter(t => t.estado === "PENDIENTE" && t.fechaVence && new Date(t.fechaVence) < new Date()).length;

  return (
    <>
      <Topbar title="Tareas y seguimientos" actions={
        <button onClick={() => setModal(true)} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: CRM_COLOR }}>
          <Plus size={13} /> Nueva tarea
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5 max-w-4xl mx-auto w-full">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { l: "Pendientes", v: tareas.filter(t => t.estado === "PENDIENTE").length, c: CRM_COLOR, Icon: Clock },
            { l: "Vencidas", v: vencidas, c: "#ef4444", Icon: AlertCircle },
            { l: "Completadas", v: tareas.filter(t => t.estado === "COMPLETADA").length, c: "#16a34a", Icon: CheckCircle2 },
          ].map(s => {
            const Icon = s.Icon;
            return (
              <div key={s.l} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.c + "18" }}>
                  <Icon size={18} style={{ color: s.c }} />
                </div>
                <div><p className="text-xs text-muted">{s.l}</p><p className="text-xl font-bold" style={{ color: s.c }}>{s.v}</p></div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          {FILTROS.map(f => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className="pill" style={filtro === f.v ? { backgroundColor: CRM_COLOR, color: "white" } : {}}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: CRM_COLOR }} /></div>
          ) : tareas.length === 0 ? (
            <div className="p-12 text-center">
              <CheckSquare size={28} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">No hay tareas en este filtro</p>
            </div>
          ) : tareas.map(t => {
            const tipoMeta = TIPOS.find(x => x.v === t.tipo) ?? TIPOS[0];
            const prioMeta = PRIORIDADES.find(x => x.v === t.prioridad) ?? PRIORIDADES[1];
            const TipoIcon = tipoMeta.Icon;
            const done = t.estado === "COMPLETADA";
            const vencida = !done && t.fechaVence && new Date(t.fechaVence) < new Date();
            return (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 border-b last:border-0 divider hover:surface-2 transition-colors group">
                <button onClick={() => toggle(t)} className="flex-shrink-0">
                  {done ? <CheckSquare size={20} style={{ color: "#16a34a" }} /> : <Square size={20} className="text-muted hover:text-gray-500" />}
                </button>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tipoMeta.c + "15" }}>
                  <TipoIcon size={15} style={{ color: tipoMeta.c }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${done ? "line-through text-muted" : "text-gray-800 dark:text-gray-100"}`}>{t.titulo}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {t.cliente && <span className="text-xs text-muted">{t.cliente.nombre}</span>}
                    {t.fechaVence && (
                      <span className={`text-xs flex items-center gap-1 ${vencida ? "text-red-500 font-semibold" : "text-muted"}`}>
                        <Calendar size={10} /> {new Date(t.fechaVence).toLocaleDateString("es-CO")}
                        {vencida && " (vencida)"}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: prioMeta.c + "20", color: prioMeta.c }}>{prioMeta.l}</span>
                <button onClick={() => eliminar(t.id)} className="text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>
      {modal && <NuevaTarea onClose={() => setModal(false)} onSaved={() => { setModal(false); qc.invalidateQueries({ queryKey: ["crm-tareas"] }); }} />}
    </>
  );
}

export default function TareasPage() {
  return <Suspense><TareasContent /></Suspense>;
}
