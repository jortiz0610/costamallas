"use client";

import { Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Loader2, Wrench, RefreshCw, TrendingUp, Package } from "lucide-react";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";
import toast from "react-hot-toast";

interface Pedido {
  id: string; numero: string; estado: string; total: number; createdAt: string;
  tieneInstalacion: boolean;
  cliente: { nombre: string; empresa?: string };
  vendedor?: { nombre: string };
  _count: { items: number };
}

const COLUMNAS = [
  { id: "NUEVO",         label: "Nuevos",      gradient: "from-slate-400 to-slate-500",   bg: "bg-slate-50",    ring: "ring-slate-200",  pill: "bg-slate-100 text-slate-600",   btn: "bg-slate-500 hover:bg-slate-600" },
  { id: "CONFIRMADO",    label: "Confirmados", gradient: "from-sky-400 to-blue-500",      bg: "bg-sky-50/60",   ring: "ring-sky-200",    pill: "bg-sky-100 text-sky-700",       btn: "bg-sky-500 hover:bg-sky-600" },
  { id: "EN_PRODUCCION", label: "Producción",  gradient: "from-amber-400 to-orange-500",  bg: "bg-amber-50/60", ring: "ring-amber-200",  pill: "bg-amber-100 text-amber-700",   btn: "bg-amber-500 hover:bg-amber-600" },
  { id: "LISTO",         label: "Listos",      gradient: "from-violet-400 to-purple-500", bg: "bg-violet-50/60",ring: "ring-violet-200", pill: "bg-violet-100 text-violet-700", btn: "bg-violet-500 hover:bg-violet-600" },
  { id: "DESPACHADO",    label: "Despachados", gradient: "from-indigo-400 to-indigo-600", bg: "bg-indigo-50/60",ring: "ring-indigo-200", pill: "bg-indigo-100 text-indigo-700", btn: "bg-indigo-500 hover:bg-indigo-600" },
  { id: "ENTREGADO",     label: "Entregados",  gradient: "from-teal-400 to-emerald-500",  bg: "bg-teal-50/60",  ring: "ring-teal-200",   pill: "bg-teal-100 text-teal-700",     btn: "bg-teal-500 hover:bg-teal-600" },
  { id: "INSTALADO",     label: "Instalados",  gradient: "from-emerald-400 to-green-500", bg: "bg-emerald-50/60",ring:"ring-emerald-200",pill: "bg-emerald-100 text-emerald-700",btn: "bg-emerald-500 hover:bg-emerald-600" },
];

const SIGUIENTE: Record<string, string> = {
  NUEVO: "CONFIRMADO", CONFIRMADO: "EN_PRODUCCION", EN_PRODUCCION: "LISTO",
  LISTO: "DESPACHADO", DESPACHADO: "ENTREGADO", ENTREGADO: "INSTALADO",
};

const GRADIENTS_AVATAR = [
  "from-violet-400 to-indigo-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-500",
];
function getAvatarGradient(name: string) {
  return GRADIENTS_AVATAR[name.charCodeAt(0) % GRADIENTS_AVATAR.length];
}

function PipelineContent() {
  const qc = useQueryClient();

  const { data: pedidos = [], isLoading, refetch } = useQuery<Pedido[]>({
    queryKey: ["pedidos-pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/crm/pedidos");
      return (await res.json()).data ?? [];
    },
    refetchInterval: 60_000,
  });

  const avanzar = async (pedidoId: string, nuevoEstado: string) => {
    const res = await fetch(`/api/crm/pedidos/${pedidoId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(`→ ${nuevoEstado.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["pedidos-pipeline"] });
    } else toast.error(json.error ?? "Error");
  };

  const activos = pedidos.filter(p => p.estado !== "CANCELADO");
  const totalValor = activos.reduce((s, p) => s + Number(p.total), 0);

  return (
    <>
      <Topbar title="Pipeline de Pedidos"
        actions={
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          </button>
        }
      />
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
        {/* KPIs */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center gap-5 overflow-x-auto">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Package size={12} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Activos</p>
              <p className="text-sm font-bold text-slate-800">{activos.length}</p>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <TrendingUp size={12} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Valor total</p>
              <p className="text-sm font-bold text-slate-800">{formatCOP(totalValor)}</p>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          {COLUMNAS.map(c => {
            const cnt = pedidos.filter(p => p.estado === c.id).length;
            if (!cnt) return null;
            return (
              <div key={c.id} className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${c.pill}`}>{c.label} {cnt}</span>
              </div>
            );
          })}
        </div>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2 text-violet-400" />
              <span className="text-sm">Cargando pipeline…</span>
            </div>
          ) : (
            <div className="flex gap-3 h-full min-w-max">
              {COLUMNAS.map(col => {
                const tarjetas = pedidos.filter(p => p.estado === col.id);
                return (
                  <div key={col.id} className={`w-64 flex flex-col rounded-2xl ${col.bg} ring-1 ${col.ring} overflow-hidden flex-shrink-0`}>
                    {/* Header columna */}
                    <div className={`px-4 py-3 bg-gradient-to-r ${col.gradient}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-white">{col.label}</span>
                        <span className="text-[11px] font-bold bg-white/25 text-white px-2 py-0.5 rounded-full">{tarjetas.length}</span>
                      </div>
                    </div>

                    {/* Tarjetas */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                      {tarjetas.length === 0 && (
                        <div className="text-center py-8 text-[11px] text-slate-300 font-medium">Sin pedidos</div>
                      )}
                      {tarjetas.map(p => (
                        <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm shadow-slate-100 border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all group cursor-default">
                          <div className="flex items-start justify-between mb-2.5">
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{p.numero}</span>
                            {p.tieneInstalacion && (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-lg">
                                <Wrench size={9} /> Inst.
                              </span>
                            )}
                          </div>
                          {/* Avatar + nombre */}
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${getAvatarGradient(p.cliente.nombre)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                              {p.cliente.nombre.charAt(0)}
                            </div>
                            <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{p.cliente.nombre}</p>
                          </div>
                          {p.cliente.empresa && <p className="text-[11px] text-slate-400 ml-8 mb-1">{p.cliente.empresa}</p>}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                            <span className="text-[12px] font-bold text-slate-700">{formatCOP(Number(p.total))}</span>
                            <span className="text-[10px] text-slate-300">{p._count.items} ítem{p._count.items !== 1 ? "s" : ""}</span>
                          </div>
                          {/* Acciones */}
                          <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/crm/pedidos`} className="flex-1 text-center text-[10px] text-slate-400 hover:text-slate-600 py-1.5 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                              Ver
                            </Link>
                            {SIGUIENTE[col.id] && (
                              <button onClick={() => avanzar(p.id, SIGUIENTE[col.id])}
                                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg text-white ${col.btn} transition-colors`}>
                                → {SIGUIENTE[col.id].replace("_", " ")}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><PipelineContent /></Suspense>; }
