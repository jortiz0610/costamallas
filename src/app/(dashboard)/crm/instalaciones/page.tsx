"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Wrench, Calendar, MapPin, User, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";

interface Instalacion {
  id: string; estado: string; fechaAgendada?: string; direccion?: string; ciudad?: string; notas?: string;
  pedido: { numero: string; total: number; cliente: { nombre: string; empresa?: string } };
  tecnico?: { nombre: string };
}

const ESTADOS = [
  { v: "PENDIENTE",   l: "Pendiente",   c: "bg-yellow-100 text-yellow-700", icon: Clock },
  { v: "AGENDADA",    l: "Agendada",    c: "bg-blue-100 text-blue-700",     icon: Calendar },
  { v: "EN_CURSO",    l: "En curso",    c: "bg-purple-100 text-purple-700", icon: Wrench },
  { v: "COMPLETADA",  l: "Completada",  c: "bg-green-100 text-green-700",   icon: CheckCircle },
  { v: "CANCELADA",   l: "Cancelada",   c: "bg-red-100 text-red-600",       icon: AlertCircle },
];

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS.find(x => x.v === estado);
  const Icon = e?.icon ?? Clock;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${e?.c ?? "bg-gray-100 text-gray-600"}`}>
      <Icon size={10} />{e?.l ?? estado}
    </span>
  );
}

async function fetchInstalaciones() {
  const res = await fetch("/api/crm/instalaciones");
  return (await res.json()).data ?? [];
}

function InstalacionesContent() {
  const [filtro, setFiltro] = useState("todos");
  const qc = useQueryClient();

  const { data: instalaciones = [], isLoading, refetch } = useQuery<Instalacion[]>({
    queryKey: ["instalaciones"],
    queryFn: fetchInstalaciones,
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

  const pendientes = instalaciones.filter(i => i.estado === "PENDIENTE").length;
  const agendadas = instalaciones.filter(i => i.estado === "AGENDADA").length;
  const enCurso = instalaciones.filter(i => i.estado === "EN_CURSO").length;

  return (
    <>
      <Topbar title="Instalaciones"
        actions={<button onClick={() => refetch()} className="btn-secondary btn-sm"><RefreshCw size={12} /></button>}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { l: "Total", v: instalaciones.length, c: "text-gray-900" },
            { l: "Pendientes", v: pendientes, c: "text-yellow-600" },
            { l: "Agendadas", v: agendadas, c: "text-blue-600" },
            { l: "En curso", v: enCurso, c: "text-purple-600" },
          ].map(s => (
            <div key={s.l} className="card p-4">
              <p className="text-xs text-gray-500">{s.l}</p>
              <p className={`text-2xl font-bold mt-1 ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {([{ v: "todos", l: "Todas" }, ...ESTADOS] as { v: string; l: string }[]).map(e => (
            <button key={e.v} onClick={() => setFiltro(e.v)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors ${filtro === e.v ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              {e.l}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="card p-8 text-center text-gray-400 text-sm">Cargando…</div>
          ) : lista.length === 0 ? (
            <div className="card p-12 text-center">
              <Wrench size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Sin instalaciones en esta categoría</p>
            </div>
          ) : lista.map(inst => (
            <div key={inst.id} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Wrench size={18} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono font-bold text-gray-400">{inst.pedido.numero}</span>
                    <EstadoBadge estado={inst.estado} />
                  </div>
                  <p className="text-[14px] font-semibold text-gray-900">{inst.pedido.cliente.nombre}</p>
                  {inst.pedido.cliente.empresa && <p className="text-xs text-gray-400">{inst.pedido.cliente.empresa}</p>}
                  <div className="flex flex-wrap gap-4 mt-2">
                    {inst.fechaAgendada && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar size={12} />
                        {new Date(inst.fechaAgendada).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    )}
                    {inst.direccion && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={12} />{inst.direccion}{inst.ciudad ? `, ${inst.ciudad}` : ""}
                      </div>
                    )}
                    {inst.tecnico && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <User size={12} />{inst.tecnico.nombre}
                      </div>
                    )}
                    <div className="ml-auto text-xs font-semibold text-gray-700">{formatCOP(Number(inst.pedido.total))}</div>
                  </div>
                  {inst.notas && <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg px-3 py-2">{inst.notas}</p>}
                </div>
                {/* Cambiar estado rápido */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {ESTADOS.filter(e => e.v !== inst.estado && e.v !== "CANCELADA").slice(0, 2).map(e => (
                    <button key={e.v} onClick={() => cambiarEstado(inst.id, e.v)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors whitespace-nowrap">
                      → {e.l}
                    </button>
                  ))}
                  {inst.estado !== "CANCELADA" && inst.estado !== "COMPLETADA" && (
                    <button onClick={() => cambiarEstado(inst.id, "CANCELADA")}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">
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
