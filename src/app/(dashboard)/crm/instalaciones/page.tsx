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

const ESTADOS = [
  { v: "PENDIENTE",  l: "Pendiente",  pill: "bg-amber-100 text-amber-700",   icon: Clock,         btn: "bg-amber-400" },
  { v: "AGENDADA",   l: "Agendada",   pill: "bg-sky-100 text-sky-700",       icon: Calendar,      btn: "bg-sky-400" },
  { v: "EN_CURSO",   l: "En curso",   pill: "bg-violet-100 text-violet-700", icon: Wrench,        btn: "bg-violet-400" },
  { v: "COMPLETADA", l: "Completada", pill: "bg-emerald-100 text-emerald-700",icon: CheckCircle2, btn: "bg-emerald-400" },
  { v: "CANCELADA",  l: "Cancelada",  pill: "bg-rose-100 text-rose-600",     icon: AlertCircle,   btn: "bg-rose-400" },
];

const STATS_CONFIG = [
  { key: "total",      label: "Total",      gradient: "from-slate-500 to-slate-600",   icon: ListTodo },
  { key: "PENDIENTE",  label: "Pendientes", gradient: "from-amber-400 to-orange-500",  icon: Clock },
  { key: "AGENDADA",   label: "Agendadas",  gradient: "from-sky-400 to-blue-500",      icon: Calendar },
  { key: "EN_CURSO",   label: "En curso",   gradient: "from-violet-400 to-purple-500", icon: Wrench },
];

const GRADIENTS_AVATAR = [
  "from-violet-400 to-indigo-500", "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-pink-400 to-rose-500",
];
function getAvatarGradient(name: string) {
  return GRADIENTS_AVATAR[name.charCodeAt(0) % GRADIENTS_AVATAR.length];
}

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS.find(x => x.v === estado);
  const Icon = e?.icon ?? Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${e?.pill ?? "bg-slate-100 text-slate-600"}`}>
      <Icon size={10} />{e?.l ?? estado}
    </span>
  );
}

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
    const res = await fetch(`/api/crm/instalaciones/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    if (json.success) { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["instalaciones"] }); }
    else toast.error(json.error ?? "Error");
  };

  return (
    <>
      <Topbar title="Instalaciones"
        actions={
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {STATS_CONFIG.map(s => {
            const count = s.key === "total"
              ? instalaciones.length
              : instalaciones.filter(i => i.estado === s.key).length;
            const Icon = s.icon;
            return (
              <div key={s.key} className={`bg-gradient-to-br ${s.gradient} rounded-2xl p-5 text-white shadow-lg`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">{s.label}</span>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon size={14} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setFiltro("todos")}
            className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all border ${filtro === "todos"
              ? "bg-slate-800 border-slate-800 text-white shadow-sm"
              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
            Todas
          </button>
          {ESTADOS.map(e => (
            <button key={e.v} onClick={() => setFiltro(filtro === e.v ? "todos" : e.v)}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all border ${filtro === e.v
                ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
              {e.l}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-sm text-slate-400 shadow-sm">
              Cargando…
            </div>
          ) : lista.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Wrench size={24} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Sin instalaciones en esta categoría</p>
            </div>
          ) : lista.map(inst => (
            <div key={inst.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start gap-4">
                {/* Avatar con gradiente */}
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${getAvatarGradient(inst.pedido.cliente.nombre)} flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-sm`}>
                  {inst.pedido.cliente.nombre.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{inst.pedido.numero}</span>
                    <EstadoBadge estado={inst.estado} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{inst.pedido.cliente.nombre}</p>
                  {inst.pedido.cliente.empresa && <p className="text-xs text-slate-400">{inst.pedido.cliente.empresa}</p>}

                  <div className="flex flex-wrap gap-4 mt-3">
                    {inst.fechaAgendada && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-sky-50 px-3 py-1.5 rounded-xl">
                        <Calendar size={11} className="text-sky-500" />
                        {new Date(inst.fechaAgendada).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    )}
                    {inst.direccion && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl">
                        <MapPin size={11} className="text-slate-400" />
                        {inst.direccion}{inst.ciudad ? `, ${inst.ciudad}` : ""}
                      </div>
                    )}
                    {inst.tecnico && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-violet-50 px-3 py-1.5 rounded-xl">
                        <User size={11} className="text-violet-500" />
                        {inst.tecnico.nombre}
                      </div>
                    )}
                    <div className="flex items-center ml-auto">
                      <span className="text-sm font-bold text-slate-800">{formatCOP(Number(inst.pedido.total))}</span>
                    </div>
                  </div>

                  {inst.notas && (
                    <p className="text-xs text-slate-500 mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      {inst.notas}
                    </p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {ESTADOS.filter(e => e.v !== inst.estado && e.v !== "CANCELADA").slice(0, 2).map(e => (
                    <button key={e.v} onClick={() => cambiarEstado(inst.id, e.v)}
                      className="text-[11px] font-semibold px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors whitespace-nowrap border border-slate-100">
                      → {e.l}
                    </button>
                  ))}
                  {inst.estado !== "CANCELADA" && inst.estado !== "COMPLETADA" && (
                    <button onClick={() => cambiarEstado(inst.id, "CANCELADA")}
                      className="text-[11px] font-semibold px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-100">
                      Cancelar
                    </button>
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
