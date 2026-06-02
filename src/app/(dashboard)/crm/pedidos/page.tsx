"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ChevronRight, Package, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";

interface Pedido {
  id: string; numero: string; estado: string; total: number; createdAt: string;
  tieneInstalacion: boolean;
  cliente: { nombre: string; empresa?: string };
  vendedor?: { nombre: string };
  instalacion?: { estado: string; fechaAgendada?: string };
  _count: { items: number };
}

const ESTADOS_FLUJO = [
  { v: "NUEVO",         l: "Nuevo",          c: "bg-gray-100 text-gray-600",     next: "CONFIRMADO" },
  { v: "CONFIRMADO",    l: "Confirmado",      c: "bg-blue-100 text-blue-700",     next: "EN_PRODUCCION" },
  { v: "EN_PRODUCCION", l: "En producción",   c: "bg-yellow-100 text-yellow-700", next: "LISTO" },
  { v: "LISTO",         l: "Listo",           c: "bg-purple-100 text-purple-700", next: "DESPACHADO" },
  { v: "DESPACHADO",    l: "Despachado",      c: "bg-orange-100 text-orange-600", next: "ENTREGADO" },
  { v: "ENTREGADO",     l: "Entregado",       c: "bg-teal-100 text-teal-700",     next: "INSTALADO" },
  { v: "INSTALADO",     l: "Instalado ✓",    c: "bg-green-100 text-green-700",   next: null },
  { v: "CANCELADO",     l: "Cancelado",       c: "bg-red-100 text-red-600",       next: null },
];

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS_FLUJO.find(x => x.v === estado);
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${e?.c ?? "bg-gray-100 text-gray-600"}`}>{e?.l ?? estado}</span>;
}

function PedidosContent() {
  const [filtroEstado, setFiltroEstado] = useState("");
  const qc = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery<Pedido[]>({
    queryKey: ["crm-pedidos", filtroEstado],
    queryFn: async () => {
      const qs = filtroEstado ? `?estado=${filtroEstado}` : "";
      return (await (await fetch(`/api/crm/pedidos${qs}`)).json()).data ?? [];
    },
  });

  const avanzarEstado = async (pedido: Pedido) => {
    const current = ESTADOS_FLUJO.find(e => e.v === pedido.estado);
    if (!current?.next) return;
    const res = await fetch(`/api/crm/pedidos/${pedido.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: current.next }),
    });
    const json = await res.json();
    if (json.success) {
      const nextLabel = ESTADOS_FLUJO.find(e => e.v === current.next)?.l;
      toast.success(`Pedido → ${nextLabel}`);
      if (current.next === "EN_PRODUCCION") toast("📦 Stock descontado automáticamente", { icon: "ℹ️" });
      if (current.next === "DESPACHADO" && pedido.tieneInstalacion) toast("🔧 Instalación creada automáticamente", { icon: "ℹ️" });
      qc.invalidateQueries({ queryKey: ["crm-pedidos"] });
    }
  };

  // Columnas kanban
  const columnas = [
    { estados: ["NUEVO", "CONFIRMADO"], label: "Por confirmar" },
    { estados: ["EN_PRODUCCION", "LISTO"], label: "Producción" },
    { estados: ["DESPACHADO", "ENTREGADO"], label: "Despacho" },
    { estados: ["INSTALADO"], label: "Completados" },
  ];

  return (
    <>
      <Topbar title="Pedidos" />
      <div className="flex-1 overflow-y-auto p-6">

        {/* Stats rápidas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {columnas.map(col => {
            const count = pedidos.filter(p => col.estados.includes(p.estado)).length;
            return (
              <div key={col.label} className="card p-4">
                <p className="text-xs text-gray-400">{col.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Filtros por estado */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button onClick={() => setFiltroEstado("")} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${!filtroEstado ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
            Todos ({pedidos.length})
          </button>
          {ESTADOS_FLUJO.filter(e => e.v !== "CANCELADO").map(e => {
            const count = pedidos.filter(p => p.estado === e.v).length;
            if (count === 0) return null;
            return (
              <button key={e.v} onClick={() => setFiltroEstado(filtroEstado === e.v ? "" : e.v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${filtroEstado === e.v ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                {e.l} ({count})
              </button>
            );
          })}
        </div>

        {/* Lista de pedidos */}
        <div className="card">
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Cargando pedidos…</div>
            ) : pedidos.length === 0 ? (
              <div className="p-12 text-center">
                <Package size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">Sin pedidos</p>
                <p className="text-xs text-gray-400 mt-1">Los pedidos se crean automáticamente al aprobar una cotización</p>
              </div>
            ) : pedidos.map(p => {
              const eInfo = ESTADOS_FLUJO.find(e => e.v === p.estado);
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 group transition-colors">
                  <div className="flex-shrink-0 text-center w-24">
                    <p className="text-xs font-mono font-bold text-gray-500">{p.numero}</p>
                    <p className="text-[10px] text-gray-400">{new Date(p.createdAt).toLocaleDateString("es-CO")}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{p.cliente.nombre}</p>
                      {p.tieneInstalacion && <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold"><Wrench size={9}/> Instalación</span>}
                    </div>
                    {p.cliente.empresa && <p className="text-xs text-gray-400">{p.cliente.empresa}</p>}
                    {p.instalacion && <p className="text-[10px] text-teal-600 mt-0.5">🔧 Instalación: {p.instalacion.estado}</p>}
                  </div>

                  <EstadoBadge estado={p.estado} />

                  <p className="text-sm font-bold text-gray-900 w-28 text-right">{formatCOP(p.total)}</p>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {eInfo?.next && (
                      <button onClick={() => avanzarEstado(p)}
                        className="btn-primary btn-sm text-xs">
                        → {ESTADOS_FLUJO.find(e => e.v === eInfo.next)?.l}
                      </button>
                    )}
                    <Link href={`/crm/pedidos/${p.id}`} className="btn-secondary btn-sm text-xs">
                      Ver <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><PedidosContent /></Suspense>; }
