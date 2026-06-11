"use client";

import { Suspense, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Zap, MessageSquare, GitBranch, Bot, Plus, X, Loader2, Trash2, Save,
  Sparkles, UserPlus, ArrowRightLeft, Tag, Clock, HelpCircle, Webhook,
  FileText, ArrowDown, GripVertical, Power,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const NEXUS = "#7c3aed";

interface Nodo { id: string; tipo: string; config: Record<string, unknown>; }
interface Flujo { id: string; nombre: string; disparador: string[]; objetivo: string; activo: boolean; nodos?: Nodo[]; }

// Catálogo de bloques disponibles
const BLOQUES = [
  { tipo: "trigger",    l: "Disparador",          Icon: Zap,           c: "#16a34a", desc: "Inicia el flujo por palabras clave" },
  { tipo: "mensaje",    l: "Enviar mensaje",      Icon: MessageSquare, c: "#185FA5", desc: "Responde con texto" },
  { tipo: "pregunta",   l: "Pregunta",            Icon: HelpCircle,    c: "#0891b2", desc: "Captura un dato del cliente" },
  { tipo: "ia",         l: "Respuesta IA",        Icon: Bot,           c: "#7c3aed", desc: "IA con contexto y tareas" },
  { tipo: "condicion",  l: "Condición",           Icon: GitBranch,     c: "#d97706", desc: "Ramifica según la respuesta" },
  { tipo: "espera",     l: "Esperar",             Icon: Clock,         c: "#0e7490", desc: "Pausa el flujo" },
  { tipo: "etiqueta",   l: "Etiquetar",           Icon: Tag,           c: "#db2777", desc: "Añade una etiqueta al contacto" },
  { tipo: "crm",        l: "Guardar en CRM",      Icon: UserPlus,      c: "#BA7517", desc: "Crea/actualiza el cliente" },
  { tipo: "cotizar",    l: "Cotización",          Icon: FileText,      c: "#185FA5", desc: "Inicia un cotizador" },
  { tipo: "transferir", l: "Transferir a asesor", Icon: ArrowRightLeft,c: "#ea580c", desc: "Pasa a un humano" },
  { tipo: "webhook",    l: "Webhook",             Icon: Webhook,       c: "#64748b", desc: "Conecta con un sistema externo" },
];
const meta = (tipo: string) => BLOQUES.find(b => b.tipo === tipo) ?? BLOQUES[0];

function defaultConfig(tipo: string): Record<string, unknown> {
  switch (tipo) {
    case "trigger": return { disparador: "" };
    case "mensaje": return { texto: "" };
    case "pregunta": return { texto: "", variable: "" };
    case "ia": return { contexto: "", tareas: [] };
    case "condicion": return { ramas: [{ si: "", etiqueta: "" }] };
    case "espera": return { minutos: 5 };
    case "etiqueta": return { etiqueta: "" };
    case "crm": return { estado: "INTERESADO" };
    case "cotizar": return {};
    case "transferir": return { motivo: "" };
    case "webhook": return { url: "" };
    default: return {};
  }
}

// Editor de configuración por tipo de bloque
function NodoEditor({ nodo, onChange }: { nodo: Nodo; onChange: (config: Record<string, unknown>) => void }) {
  const c = nodo.config;
  const set = (k: string, v: unknown) => onChange({ ...c, [k]: v });
  const inputCls = "input py-1.5 text-sm";

  if (nodo.tipo === "trigger") return <input className={inputCls} placeholder="Palabras clave (coma): precio, cotizar…" value={String(c.disparador ?? "")} onChange={e => set("disparador", e.target.value)} />;
  if (nodo.tipo === "mensaje") return <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Texto del mensaje. Usa {nombre}…" value={String(c.texto ?? "")} onChange={e => set("texto", e.target.value)} />;
  if (nodo.tipo === "pregunta") return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Pregunta al cliente" value={String(c.texto ?? "")} onChange={e => set("texto", e.target.value)} />
      <input className={inputCls} placeholder="Guardar respuesta en (variable): medidas" value={String(c.variable ?? "")} onChange={e => set("variable", e.target.value)} />
    </div>
  );
  if (nodo.tipo === "ia") {
    const tareas: string[] = Array.isArray(c.tareas) ? c.tareas as string[] : [];
    return (
      <div className="space-y-2">
        <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Contexto: qué información debe usar la IA…" value={String(c.contexto ?? "")} onChange={e => set("contexto", e.target.value)} />
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase mb-1">Tareas del agente</p>
          {tareas.map((t, i) => (
            <div key={i} className="flex gap-1.5 mb-1.5">
              <input className={inputCls} value={t} onChange={e => set("tareas", tareas.map((x, j) => j === i ? e.target.value : x))} placeholder="Ej: Identificar el producto" />
              <button onClick={() => set("tareas", tareas.filter((_, j) => j !== i))} className="text-muted hover:text-red-500"><X size={13} /></button>
            </div>
          ))}
          <button onClick={() => set("tareas", [...tareas, ""])} className="text-[11px] font-semibold flex items-center gap-1" style={{ color: NEXUS }}><Plus size={11} /> Agregar tarea</button>
        </div>
      </div>
    );
  }
  if (nodo.tipo === "condicion") {
    const ramas: { si: string; etiqueta: string }[] = Array.isArray(c.ramas) ? c.ramas as { si: string; etiqueta: string }[] : [];
    return (
      <div className="space-y-1.5">
        {ramas.map((r, i) => (
          <div key={i} className="flex gap-1.5">
            <input className={inputCls} placeholder="Si contiene…" value={r.si} onChange={e => set("ramas", ramas.map((x, j) => j === i ? { ...x, si: e.target.value } : x))} />
            <input className={inputCls} placeholder="→ etiqueta/rama" value={r.etiqueta} onChange={e => set("ramas", ramas.map((x, j) => j === i ? { ...x, etiqueta: e.target.value } : x))} />
            <button onClick={() => set("ramas", ramas.filter((_, j) => j !== i))} className="text-muted hover:text-red-500"><X size={13} /></button>
          </div>
        ))}
        <button onClick={() => set("ramas", [...ramas, { si: "", etiqueta: "" }])} className="text-[11px] font-semibold flex items-center gap-1" style={{ color: NEXUS }}><Plus size={11} /> Agregar rama</button>
      </div>
    );
  }
  if (nodo.tipo === "espera") return <input type="number" className={inputCls} placeholder="Minutos" value={Number(c.minutos ?? 5)} onChange={e => set("minutos", parseInt(e.target.value) || 0)} />;
  if (nodo.tipo === "etiqueta") return <input className={inputCls} placeholder="Etiqueta a aplicar" value={String(c.etiqueta ?? "")} onChange={e => set("etiqueta", e.target.value)} />;
  if (nodo.tipo === "crm") return (
    <select className={inputCls} value={String(c.estado ?? "INTERESADO")} onChange={e => set("estado", e.target.value)}>
      {["PROSPECTO", "INTERESADO", "CALIFICADO", "CLIENTE_ACTIVO"].map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
  if (nodo.tipo === "transferir") return <input className={inputCls} placeholder="Motivo de la transferencia" value={String(c.motivo ?? "")} onChange={e => set("motivo", e.target.value)} />;
  if (nodo.tipo === "webhook") return <input className={inputCls} placeholder="https://…" value={String(c.url ?? "")} onChange={e => set("url", e.target.value)} />;
  return <p className="text-xs text-muted">Sin configuración.</p>;
}

function FlujosContent() {
  const qc = useQueryClient();
  const { data: flujos = [], isLoading } = useQuery<Flujo[]>({
    queryKey: ["nexus-flujos"],
    queryFn: async () => (await (await fetch("/api/nexus/flujos")).json()).data ?? [],
  });

  const [selId, setSelId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [activo, setActivo] = useState(true);
  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [dragTipo, setDragTipo] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overCanvas, setOverCanvas] = useState(false);
  const [saving, setSaving] = useState(false);

  const sel = flujos.find(f => f.id === selId) ?? null;
  useEffect(() => {
    if (!selId && flujos.length) setSelId(flujos[0].id);
  }, [flujos, selId]);
  useEffect(() => {
    if (sel) {
      setNombre(sel.nombre); setActivo(sel.activo);
      // Deriva nodos si el flujo guardado no tiene
      const ns = sel.nodos && sel.nodos.length ? sel.nodos : [
        { id: "n1", tipo: "trigger", config: { disparador: sel.disparador.join(", ") } },
        ...(sel.objetivo ? [{ id: "n2", tipo: "ia", config: { contexto: sel.objetivo, tareas: [] } }] : []),
      ];
      setNodos(ns);
    }
  }, [sel?.id]); // eslint-disable-line

  const addNodo = (tipo: string, at?: number) => {
    const nuevo: Nodo = { id: `n_${Date.now()}`, tipo, config: defaultConfig(tipo) };
    setNodos(p => { const n = [...p]; n.splice(at ?? n.length, 0, nuevo); return n; });
    setAbierto(nuevo.id);
  };
  const delNodo = (id: string) => setNodos(p => p.filter(n => n.id !== id));
  const updNodo = (id: string, config: Record<string, unknown>) => setNodos(p => p.map(n => n.id === id ? { ...n, config } : n));
  const moverNodo = (from: number, to: number) => setNodos(p => { const n = [...p]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });

  const guardar = async () => {
    if (!sel) return;
    setSaving(true);
    const res = await fetch("/api/nexus/flujos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sel.id, nombre, activo, nodos }) });
    setSaving(false);
    if ((await res.json()).success) { toast.success("Flujo guardado"); qc.invalidateQueries({ queryKey: ["nexus-flujos"] }); }
    else toast.error("Error al guardar");
  };

  const nuevoFlujo = async () => {
    const res = await fetch("/api/nexus/flujos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: "Nuevo flujo", nodos: [{ id: "n1", tipo: "trigger", config: { disparador: "" } }] }) });
    const json = await res.json();
    if (json.success) { await qc.invalidateQueries({ queryKey: ["nexus-flujos"] }); setSelId(json.data.id); }
  };
  const eliminarFlujo = async () => {
    if (!sel || !confirm("¿Eliminar este flujo?")) return;
    await fetch(`/api/nexus/flujos?id=${sel.id}`, { method: "DELETE" });
    setSelId(null);
    qc.invalidateQueries({ queryKey: ["nexus-flujos"] });
  };

  return (
    <>
      <Topbar title="Flujos & Automatización" actions={
        <div className="flex items-center gap-2">
          <button onClick={nuevoFlujo} className="btn-secondary btn-sm"><Plus size={13} /> Nuevo</button>
          {sel && <button onClick={guardar} disabled={saving} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: NEXUS }}>{saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar</button>}
        </div>
      } />
      <div className="flex-1 overflow-hidden flex page-bg">

        {/* Paleta de bloques */}
        <div className="w-60 flex-shrink-0 border-r divider surface flex flex-col">
          <div className="p-3 border-b divider"><p className="text-xs font-bold uppercase tracking-wider text-muted">Bloques</p><p className="text-[10px] text-muted mt-0.5">Arrástralos al lienzo</p></div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {BLOQUES.map(b => {
              const Icon = b.Icon;
              return (
                <div key={b.tipo} draggable onDragStart={() => setDragTipo(b.tipo)} onDragEnd={() => setDragTipo(null)}
                  onClick={() => sel && addNodo(b.tipo)}
                  className="card p-2.5 flex items-start gap-2.5 cursor-grab hover:shadow-md transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: b.c + "18" }}><Icon size={15} style={{ color: b.c }} /></div>
                  <div className="min-w-0"><p className="text-xs font-bold text-gray-800 dark:text-gray-100">{b.l}</p><p className="text-[10px] text-muted leading-tight">{b.desc}</p></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lienzo */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Selector de flujo */}
          <div className="px-4 py-2.5 border-b divider surface flex items-center gap-2 overflow-x-auto flex-shrink-0">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : flujos.map(f => (
              <button key={f.id} onClick={() => setSelId(f.id)} className="pill flex-shrink-0" style={selId === f.id ? { backgroundColor: NEXUS, color: "white" } : {}}>
                {!f.activo && <Power size={10} />} {f.nombre}
              </button>
            ))}
          </div>

          {!sel ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted gap-3">
              <Sparkles size={30} /><p className="text-sm">Crea un flujo para empezar a construir.</p>
              <button onClick={nuevoFlujo} className="btn-primary btn-sm"><Plus size={13} /> Nuevo flujo</button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto"
              onDragOver={e => { e.preventDefault(); setOverCanvas(true); }}
              onDragLeave={() => setOverCanvas(false)}
              onDrop={() => { if (dragTipo) addNodo(dragTipo); setDragTipo(null); setOverCanvas(false); }}>
              {/* Encabezado del flujo */}
              <div className="p-4 flex items-center gap-3 max-w-2xl mx-auto w-full">
                <input value={nombre} onChange={e => setNombre(e.target.value)} className="input font-bold flex-1" placeholder="Nombre del flujo" />
                <button onClick={() => setActivo(v => !v)} className="flex items-center gap-2" title="Activo/Inactivo">
                  <span className="w-10 h-5 rounded-full relative transition-all" style={{ backgroundColor: activo ? "#16a34a" : "var(--surface-3)" }}><span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: activo ? "translateX(22px)" : "translateX(2px)" }} /></span>
                </button>
                <button onClick={eliminarFlujo} className="text-muted hover:text-red-500"><Trash2 size={15} /></button>
              </div>

              {/* Nodos */}
              <div className="px-4 pb-10 flex flex-col items-center" style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
                {nodos.length === 0 && <div className={`w-80 card p-6 border-2 border-dashed text-center text-sm text-muted ${overCanvas ? "border-violet-400" : "divider"}`}>Arrastra bloques aquí</div>}
                {nodos.map((n, i) => {
                  const m = meta(n.tipo); const Icon = m.Icon; const open = abierto === n.id;
                  return (
                    <div key={n.id} className="flex flex-col items-center w-full max-w-md">
                      <div draggable onDragStart={() => setDragIdx(i)} onDragEnd={() => setDragIdx(null)}
                        onDragOver={e => { e.preventDefault(); }}
                        onDrop={e => { e.stopPropagation(); if (dragIdx !== null && dragIdx !== i) moverNodo(dragIdx, i); setDragIdx(null); if (dragTipo) { addNodo(dragTipo, i); setDragTipo(null); } }}
                        className={`card w-full transition-all ${dragIdx === i ? "opacity-40" : ""}`} style={{ borderTop: `3px solid ${m.c}` }}>
                        <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setAbierto(open ? null : n.id)}>
                          <GripVertical size={14} className="text-muted cursor-grab" />
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.c + "18" }}><Icon size={15} style={{ color: m.c }} /></div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-800 dark:text-gray-100">{m.l}</p><p className="text-[10px] text-muted truncate">{resumen(n)}</p></div>
                          <button onClick={e => { e.stopPropagation(); delNodo(n.id); }} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                        {open && <div className="px-3 pb-3 border-t divider pt-3"><NodoEditor nodo={n} onChange={c => updNodo(n.id, c)} /></div>}
                      </div>
                      {i < nodos.length - 1 && (
                        <div className="flex flex-col items-center py-1"><div className="w-0.5 h-3" style={{ backgroundColor: "var(--border-strong)" }} /><ArrowDown size={13} className="text-muted -my-0.5" /><div className="w-0.5 h-3" style={{ backgroundColor: "var(--border-strong)" }} /></div>
                      )}
                    </div>
                  );
                })}
                {/* Drop final */}
                {nodos.length > 0 && (
                  <div className="flex flex-col items-center py-1"><div className="w-0.5 h-3" style={{ backgroundColor: "var(--border-strong)" }} /><ArrowDown size={13} className="text-muted -my-0.5" /></div>
                )}
                <button onClick={() => sel && addNodo("mensaje")} className="w-full max-w-md card p-3 border-2 border-dashed divider flex items-center justify-center gap-2 text-muted hover:surface-2 transition-colors text-sm font-semibold"><Plus size={15} /> Agregar bloque</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function resumen(n: Nodo): string {
  const c = n.config;
  switch (n.tipo) {
    case "trigger": return String(c.disparador || "sin palabras clave");
    case "mensaje": return String(c.texto || "sin texto");
    case "pregunta": return String(c.texto || "pregunta");
    case "ia": return `${(Array.isArray(c.tareas) ? c.tareas.length : 0)} tareas · ${String(c.contexto || "").slice(0, 40)}`;
    case "condicion": return `${Array.isArray(c.ramas) ? c.ramas.length : 0} ramas`;
    case "espera": return `${c.minutos} min`;
    case "etiqueta": return String(c.etiqueta || "");
    case "crm": return String(c.estado || "");
    case "transferir": return String(c.motivo || "a un asesor");
    case "webhook": return String(c.url || "");
    default: return "";
  }
}

export default function FlujosPage() { return <Suspense><FlujosContent /></Suspense>; }
