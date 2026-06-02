"use client";

import { Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Loader2, Wrench, RefreshCw } from "lucide-react";
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
  { id: "NUEVO",          label: "Nuevos",        color: "bg-gray-100",   dot: "bg-gray-400",   text: "text-gray-700" },
  { id: "CONFIRMADO",     label: "Confirmados",   color: "bg-blue-50",    dot: "bg-blue-500",   text: "text-blue-700" },
  { id: "EN_PRODUCCION",  label: "Producción",    color: "bg-amber-50",   dot: "bg-amber-500",  text: "text-amber-700" },
  { id: "LISTO",          label: "Listos",        color: "bg-purple-50",  dot: "bg-purple-500", text: "text-purple-700" },
  { id: "DESPACHADO",     label: "Despachados",   color: "bg-indigo-50",  dot: "bg-indigo-500", text: "text-indigo-700" },
  { id: "ENTREGADO",      label: "Entregados",    color: "bg-green-50",   dot: "bg-green-500",  text: "text-green-700" },
  { id: "INSTALADO",      label: "Instalados",    color: "bg-emerald-50", dot: "bg-emerald-500",text: "text-emerald-700" },
];

const SIGUIENTE: Record<string, string> = {
  NUEVO: "CONFIRMADO", CONFIRMADO: "EN_PRODUCCION", EN_PRODUCCION: "LISTO",
  LISTO: "DESPACHADO", DESPACHADO: "ENTREGADO", ENTREGADO: "INSTALADO",
};

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
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* KPIs */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-6">
          <div><span className="text-xs text-gray-400">Pedidos activos</span><span className="ml-2 font-bold text-gray-900">{activos.length}</span></div>
          <div><span className="text-xs text-gray-400">Valor total</span><span className="ml-2 font-bold text-gray-900">{formatCOP(totalValor)}</span></div>
          {COLUMNAS.map(c => {
            const cnt = pedidos.filter(p => p.estado === c.id).length;
            if (!cnt) return null;
            return <div key={c.id}><span className="text-xs text-gray-400">{c.label}</span><span className={`ml-1.5 text-xs font-bold ${c.text}`}>{cnt}</span></div>;
          })}
        </div>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400"><Loader2 size={20} className="animate-spin mr-2" />Cargando pipeline…</div>
          ) : (
            <div className="flex gap-3 h-full min-w-max">
              {COLUMNAS.map(col => {
                const tarjetas = pedidos.filter(p => p.estado === col.id);
                return (
                  <div key={col.id} className={`w-64 flex flex-col rounded-2xl ${col.color} overflow-hidden flex-shrink-0`}>
                    {/* Header columna */}
                    <div className="px-4 py-3 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className={`text-[12px] font-bold ${col.text}`}>{col.label}</span>
                      <span className="ml-auto text-[11px] font-semibold text-gray-400 bg-white px-1.5 py-0.5 rounded-full">{tarjetas.length}</span>
                    </div>

                    {/* Tarjetas */}
                    <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2">
                      {tarjetas.length === 0 && (
                        <div className="text-center py-6 text-[11px] text-gray-300">Sin pedidos</div>
                      )}
                      {tarjetas.map(p => (
                        <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border border-white hover:border-gray-200 transition-all group">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-[10px] font-mono font-bold text-gray-400">{p.numero}</span>
                            {p.tieneInstalacion && <Wrench size={11} className="text-orange-400" />}
                          </div>
                          <p className="text-[13px] font-semibold text-gray-800 leading-tight">{p.cliente.nombre}</p>
                          {p.cliente.empresa && <p className="text-[11px] text-gray-400">{p.cliente.empresa}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[12px] font-bold text-gray-700">{formatCOP(Number(p.total))}</span>
                            <span className="text-[10px] text-gray-300">{p._count.items} ítem{p._count.items !== 1 ? "s" : ""}</span>
                          </div>
                          {/* Acciones */}
                          <div className="mt-2 pt-2 border-t border-gray-50 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/crm/pedidos`} className="flex-1 text-center text-[10px] text-gray-400 hover:text-gray-600 py-1">Ver</Link>
                            {SIGUIENTE[col.id] && (
                              <button onClick={() => avanzar(p.id, SIGUIENTE[col.id])}
                                className={`flex-1 text-[10px] font-semibold py-1 rounded-lg ${col.dot.replace("bg-","text-")} hover:bg-gray-50 transition-colors`}>
                                → {SIGUIENTE[col.id].replace("_"," ")}
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
