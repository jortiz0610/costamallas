"use client";
import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Wrench, Calendar, MapPin, User, CheckCircle2, Clock, AlertCircle, RefreshCw, ListTodo } from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";

interface Instalacion {
  id: string; estado: string; fechaAgendada?: string; direccion?: string; ciudad?: string; notas?: string;
  pedido: { numero: string; total: number; cliente: { nombre: string; empresa?: string } };
  tecnico?: { nombre: string };
}
const CRM_COLOR = "#BA7517";
const ESTADOS = [
  { v: "PENDIENTE",  l: "Pendiente",  bg: "#fef3c7", text: "#92400e", Icon: Clock },
  { v: "AGENDADA",   l: "Agendada",   bg: "#dbeafe", text: "#1d4ed8", Icon: Calendar },
  { v: "EN_CURSO",   l: "En curso",   bg: "#ede9fe", text: "#5b21b6", Icon: Wrench },
  { v: "COMPLETADA", l: "Completada", bg: "#d1fae5", text: "#065f46", Icon: CheckCircle2 },
  { v: "CANCELADA",  l: "Cancelada",  bg: "#fee2e2", text: "#b91c1c", Icon: AlertCircle },
];
const AV = [CRM_COLOR,"#185FA5","#7c3aed","#059669","#dc2626"];
function av(n: string) { return AV[n.charCodeAt(0) % AV.length]; }
function Badge({ estado }: { estado: string }) {
  const e = ESTADOS.find(x => x.v === estado);
  const Icon = e?.Icon ?? Clock;
  return <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: e?.bg ?? "#f1f5f9", color: e?.text ?? "#6b7280" }}><Icon size={10} />{e?.l ?? estado}</span>;
}
const STATS = [
  { key: "total",     label: "Total",     color: "#6b7280", Icon: ListTodo },
  { key: "PENDIENTE", label: "Pendientes",color: CRM_COLOR, Icon: Clock },
  { key: "AGENDADA",  label: "Agendadas", color: "#185FA5", Icon: Calendar },
  { key: "EN_CURSO",  label: "En curso",  color: "#7c3aed", Icon: Wrench },
];

function InstalacionesContent() {
  const [filtro, setFiltro] = useState("todos");
  const qc = useQueryClient();
  const { data: instalaciones = [], isLoading, refetch } = useQuery<Instalacion[]>({
    queryKey: ["instalaciones"],
    queryFn: async () => (await (await fetch("/api/crm/instalaciones")).json()).data ?? [],
    refetchInterval: 60_000,
  });
  const lista = filtro === "todos" ? instalaciones : instalaciones.filter(i => i.estado === filtro);
  const cambiarEstado = async (id: string, estado: string) => {
    const res = await fetch(`/api/crm/instalaciones/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    const json = await res.json();
    if (json.success) { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["instalaciones"] }); }
    else toast.error(json.error ?? "Error");
  };
  return (
    <>
      <Topbar title="Instalaciones" actions={<button onClick={() => refetch()} className="btn-secondary btn-sm"><RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /></button>} />
      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {STATS.map(s => {
            const count = s.key === "total" ? instalaciones.length : instalaciones.filter(i => i.estado === s.key).length;
            const Icon = s.Icon;
            return (
              <div key={s.key} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + "18" }}><Icon size={16} style={{ color: s.color }} /></div>
                <div><p className="text-xs text-gray-400">{s.label}</p><p className="text-xl font-bold" style={{ color: s.color }}>{count}</p></div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 flex-wrap">
          {([{ v: "todos", l: "Todas" }, ...ESTADOS] as { v: string; l: string }[]).map(e => (
            <button key={e.v} onClick={() => setFiltro(e.v)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={filtro === e.v ? { backgroundColor: "var(--brand-color)", color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
              {e.l}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {isLoading ? <div className="card p-8 text-center text-sm text-gray-400">Cargando...</div>
          : lista.length === 0 ? (
            <div className="card p-12 text-center"><Wrench size={28} className="mx-auto mb-3 text-gray-200" /><p className="text-sm text-gray-400">Sin instalaciones</p></div>
          ) : lista.map(inst => (
            <div key={inst.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: av(inst.pedido.cliente.nombre) }}>{inst.pedido.cliente.nombre.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{inst.pedido.numero}</span>
                    <Badge estado={inst.estado} />
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{inst.pedido.cliente.nombre}</p>
                  {inst.pedido.cliente.empresa && <p className="text-xs text-gray-400">{inst.pedido.cliente.empresa}</p>}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {inst.fechaAgendada && <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg"><Calendar size={11} className="text-blue-500" />{new Date(inst.fechaAgendada).toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})}</div>}
                    {inst.direccion && <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-lg"><MapPin size={11} />{inst.direccion}{inst.ciudad ? `, ${inst.ciudad}` : ""}</div>}
                    {inst.tecnico && <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 rounded-lg"><User size={11} className="text-purple-500" />{inst.tecnico.nombre}</div>}
                    <span className="ml-auto text-sm font-bold text-gray-800 dark:text-gray-200">{formatCOP(Number(inst.pedido.total))}</span>
                  </div>
                  {inst.notas && <p className="text-xs text-gray-500 mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2">{inst.notas}</p>}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {ESTADOS.filter(e => e.v !== inst.estado && e.v !== "CANCELADA").slice(0,2).map(e => (
                    <button key={e.v} onClick={() => cambiarEstado(inst.id, e.v)} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors border border-gray-100 dark:border-gray-700 whitespace-nowrap">
                      {e.l}
                    </button>
                  ))}
                  {inst.estado !== "CANCELADA" && inst.estado !== "COMPLETADA" && (
                    <button onClick={() => cambiarEstado(inst.id,"CANCELADA")} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 transition-colors border border-red-100 dark:border-red-800">Cancelar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
export default function Page() { return <Suspense><InstalacionesContent /></Suspense>; }
