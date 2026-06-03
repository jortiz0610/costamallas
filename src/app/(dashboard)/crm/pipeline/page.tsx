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
  _count: { items: number };
}
const CRM_COLOR = "#BA7517";
const COLUMNAS = [
  { id: "NUEVO",         label: "Nuevos",      hdr: "#6b7280", bg: "#f8fafc" },
  { id: "CONFIRMADO",    label: "Confirmados", hdr: "#185FA5", bg: "#eff6ff" },
  { id: "EN_PRODUCCION", label: "Produccion",  hdr: CRM_COLOR, bg: "#fffbeb" },
  { id: "LISTO",         label: "Listos",      hdr: "#7c3aed", bg: "#f5f3ff" },
  { id: "DESPACHADO",    label: "Despachados", hdr: "#0891b2", bg: "#ecfeff" },
  { id: "ENTREGADO",     label: "Entregados",  hdr: "#0f766e", bg: "#f0fdfa" },
  { id: "INSTALADO",     label: "Instalados",  hdr: "#16a34a", bg: "#f0fdf4" },
];
const SIGUIENTE: Record<string,string> = { NUEVO:"CONFIRMADO",CONFIRMADO:"EN_PRODUCCION",EN_PRODUCCION:"LISTO",LISTO:"DESPACHADO",DESPACHADO:"ENTREGADO",ENTREGADO:"INSTALADO" };
const AV = [CRM_COLOR,"#185FA5","#7c3aed","#059669","#dc2626"];
function av(n: string) { return AV[n.charCodeAt(0) % AV.length]; }

function PipelineContent() {
  const qc = useQueryClient();
  const { data: pedidos = [], isLoading, refetch } = useQuery<Pedido[]>({
    queryKey: ["pedidos-pipeline"],
    queryFn: async () => (await (await fetch("/api/crm/pedidos")).json()).data ?? [],
    refetchInterval: 60_000,
  });
  const avanzar = async (pedidoId: string, nuevoEstado: string) => {
    const res = await fetch(`/api/crm/pedidos/${pedidoId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: nuevoEstado }) });
    const json = await res.json();
    if (json.success) { toast.success(`-> ${nuevoEstado.replace("_"," ")}`); qc.invalidateQueries({ queryKey: ["pedidos-pipeline"] }); }
    else toast.error(json.error ?? "Error");
  };
  const activos = pedidos.filter(p => p.estado !== "CANCELADO");
  const totalValor = activos.reduce((s, p) => s + Number(p.total), 0);
  return (
    <>
      <Topbar title="Pipeline de Pedidos" actions={<button onClick={() => refetch()} className="btn-secondary btn-sm"><RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /></button>} />
      <div className="flex-1 overflow-hidden flex flex-col page-bg">
        <div className="px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-5 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-shrink-0"><Package size={13} className="text-gray-400" /><span className="text-xs text-gray-500">Activos:</span><span className="text-xs font-bold text-gray-800 dark:text-gray-200">{activos.length}</span></div>
          <div className="flex items-center gap-1.5 flex-shrink-0"><TrendingUp size={13} className="text-gray-400" /><span className="text-xs text-gray-500">Valor:</span><span className="text-xs font-bold" style={{ color: CRM_COLOR }}>{formatCOP(totalValor)}</span></div>
          {COLUMNAS.map(c => { const cnt = pedidos.filter(p => p.estado === c.id).length; if (!cnt) return null; return <span key={c.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.hdr + "18", color: c.hdr }}>{c.label} {cnt}</span>; })}
        </div>
        <div className="flex-1 overflow-x-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400"><Loader2 size={18} className="animate-spin mr-2" style={{ color: CRM_COLOR }} /><span className="text-sm">Cargando pipeline...</span></div>
          ) : (
            <div className="flex gap-3 h-full min-w-max">
              {COLUMNAS.map(col => {
                const tarjetas = pedidos.filter(p => p.estado === col.id);
                return (
                  <div key={col.id} className="w-60 flex flex-col rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-800" style={{ backgroundColor: col.bg }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: col.hdr }}>
                      <span className="text-[11px] font-bold text-white">{col.label}</span>
                      <span className="text-[10px] font-bold bg-white/25 text-white px-1.5 py-0.5 rounded-full">{tarjetas.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                      {tarjetas.length === 0 && <div className="text-center py-8 text-[11px] text-gray-300 font-medium">Sin pedidos</div>}
                      {tarjetas.map(p => (
                        <div key={p.id} className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-all group cursor-default shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{p.numero}</span>
                            {p.tieneInstalacion && <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Wrench size={8} />Inst.</span>}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: av(p.cliente.nombre) }}>{p.cliente.nombre.charAt(0)}</div>
                            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate">{p.cliente.nombre}</p>
                          </div>
                          {p.cliente.empresa && <p className="text-[10px] text-gray-400 ml-8">{p.cliente.empresa}</p>}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-800">
                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{formatCOP(Number(p.total))}</span>
                            <span className="text-[10px] text-gray-300">{p._count.items} item{p._count.items !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href="/crm/pedidos" className="flex-1 text-center text-[10px] text-gray-400 hover:text-gray-600 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium">Ver</Link>
                            {SIGUIENTE[col.id] && <button onClick={() => avanzar(p.id, SIGUIENTE[col.id])} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg text-white transition-colors" style={{ backgroundColor: col.hdr }}>Avanzar</button>}
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
