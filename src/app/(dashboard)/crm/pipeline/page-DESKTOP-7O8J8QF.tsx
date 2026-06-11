"use client";
import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Loader2, Wrench, RefreshCw, TrendingUp, Package, ArrowRight, MoreVertical } from "lucide-react";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";
import toast from "react-hot-toast";

interface Pedido {
  id: string; numero: string; estado: string; total: number; createdAt: string;
  tieneInstalacion: boolean;
  cliente: { nombre: string; empresa?: string };
  _count: { items: number };
}
const CRM_COLOR = "#BA7517";
const COLUMNAS = [
  { id: "NUEVO",         label: "Nuevos",      hdr: "#64748b" },
  { id: "CONFIRMADO",    label: "Confirmados", hdr: "#185FA5" },
  { id: "EN_PRODUCCION", label: "Producción",  hdr: CRM_COLOR },
  { id: "LISTO",         label: "Listos",      hdr: "#7c3aed" },
  { id: "DESPACHADO",    label: "Despachados", hdr: "#0891b2" },
  { id: "ENTREGADO",     label: "Entregados",  hdr: "#0f766e" },
  { id: "INSTALADO",     label: "Instalados",  hdr: "#16a34a" },
];
const SIGUIENTE: Record<string, string> = { NUEVO: "CONFIRMADO", CONFIRMADO: "EN_PRODUCCION", EN_PRODUCCION: "LISTO", LISTO: "DESPACHADO", DESPACHADO: "ENTREGADO", ENTREGADO: "INSTALADO" };
const AV = [CRM_COLOR, "#185FA5", "#7c3aed", "#059669", "#dc2626"];
function av(n: string) { return AV[n.charCodeAt(0) % AV.length]; }

function PipelineContent() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const { data: pedidos = [], isLoading, refetch } = useQuery<Pedido[]>({
    queryKey: ["pedidos-pipeline"],
    queryFn: async () => (await (await fetch("/api/crm/pedidos")).json()).data ?? [],
    refetchInterval: 60_000,
  });

  const handleRefresh = async () => { setRefreshing(true); await refetch(); toast.success("Pipeline actualizado"); setTimeout(() => setRefreshing(false), 2200); };

  const avanzar = async (pedidoId: string, nuevoEstado: string) => {
    const res = await fetch(`/api/crm/pedidos/${pedidoId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: nuevoEstado }) });
    const json = await res.json();
    if (json.success) { toast.success(`→ ${nuevoEstado.replace("_", " ").toLowerCase()}`); qc.invalidateQueries({ queryKey: ["pedidos-pipeline"] }); }
    else toast.error(json.error ?? "Error");
  };

  const onDrop = (colId: string) => {
    setDragCol(null);
    if (!dragId) return;
    const ped = pedidos.find(p => p.id === dragId);
    setDragId(null);
    if (ped && ped.estado !== colId) avanzar(ped.id, colId);
  };

  const activos = pedidos.filter(p => p.estado !== "CANCELADO");
  const totalValor = activos.reduce((s, p) => s + Number(p.total), 0);

  return (
    <>
      <Topbar title="Pipeline de producción" actions={
        <button onClick={handleRefresh} className={`btn-secondary btn-sm transition-all ${refreshing ? "animate-refresh-success" : ""}`}>
          <RefreshCw size={12} className={refreshing ? "animate-spin-once" : ""} /> Actualizar
        </button>
      } />
      <div className="flex-1 overflow-hidden flex flex-col page-bg">

        {/* Barra de resumen */}
        <div className="px-6 py-3 flex items-center gap-3 flex-wrap flex-shrink-0">
          <div className="card px-4 py-2 flex items-center gap-2">
            <Package size={14} className="text-muted" />
            <span className="text-xs text-muted">Activos</span>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{activos.length}</span>
          </div>
          <div className="card px-4 py-2 flex items-center gap-2">
            <TrendingUp size={14} style={{ color: CRM_COLOR }} />
            <span className="text-xs text-muted">Valor en pipeline</span>
            <span className="text-sm font-bold" style={{ color: CRM_COLOR }}>{formatCOP(totalValor)}</span>
          </div>
        </div>

        {/* Tablero */}
        <div className="flex-1 overflow-x-auto px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted"><Loader2 size={18} className="animate-spin mr-2" style={{ color: CRM_COLOR }} /><span className="text-sm">Cargando pipeline...</span></div>
          ) : (
            <div className="flex gap-4 h-full min-w-max">
              {COLUMNAS.map(col => {
                const tarjetas = pedidos.filter(p => p.estado === col.id);
                const valorCol = tarjetas.reduce((s, p) => s + Number(p.total), 0);
                return (
                  <div key={col.id} className="w-64 flex flex-col flex-shrink-0">
                    {/* Header columna */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.hdr }} />
                        <span className="text-xs font-bold uppercase tracking-wide text-soft">{col.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: col.hdr + "20", color: col.hdr }}>{tarjetas.length}</span>
                      </div>
                    </div>

                    {/* Cards (zona de drop) */}
                    <div
                      onDragOver={e => { e.preventDefault(); if (dragCol !== col.id) setDragCol(col.id); }}
                      onDragLeave={() => setDragCol(c => c === col.id ? null : c)}
                      onDrop={() => onDrop(col.id)}
                      className="flex-1 rounded-2xl p-2 space-y-2 overflow-y-auto surface-2 border transition-all"
                      style={{ minHeight: "100px", borderColor: dragCol === col.id ? col.hdr : "var(--border)", backgroundColor: dragCol === col.id ? col.hdr + "10" : undefined, borderStyle: dragCol === col.id ? "dashed" : "solid", borderWidth: dragCol === col.id ? "2px" : "1px" }}>
                      {tarjetas.length === 0 && (
                        <div className="text-center py-10 text-[11px] text-muted font-medium">{dragCol === col.id ? "Suelta aquí" : "Sin pedidos"}</div>
                      )}
                      {tarjetas.map(p => (
                        <div key={p.id} draggable
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => { setDragId(null); setDragCol(null); }}
                          className={`card p-3 group hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${dragId === p.id ? "opacity-40" : ""}`}
                          style={{ borderTop: `2px solid ${col.hdr}` }}>
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-[10px] font-mono font-bold text-muted surface-3 px-1.5 py-0.5 rounded">{p.numero}</span>
                            {p.tieneInstalacion && <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Wrench size={8} />Inst.</span>}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: av(p.cliente.nombre) }}>{p.cliente.nombre.charAt(0)}</div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{p.cliente.nombre}</p>
                              {p.cliente.empresa && <p className="text-[10px] text-muted truncate">{p.cliente.empresa}</p>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t divider">
                            <span className="text-xs font-bold text-soft">{formatCOP(Number(p.total))}</span>
                            <span className="text-[10px] text-muted">{p._count.items} ítem{p._count.items !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href="/crm/pedidos" className="flex-1 text-center text-[10px] text-muted hover:text-soft py-1.5 rounded-lg surface-2 font-medium">Ver</Link>
                            {SIGUIENTE[col.id] && (
                              <button onClick={() => avanzar(p.id, SIGUIENTE[col.id])} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg text-white transition-all flex items-center justify-center gap-1" style={{ backgroundColor: col.hdr }}>
                                Avanzar <ArrowRight size={9} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer valor */}
                    {valorCol > 0 && (
                      <div className="mt-2 px-1 text-center">
                        <span className="text-[10px] text-muted">{formatCOP(valorCol)}</span>
                      </div>
                    )}
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
