"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ChevronRight, Package, Wrench, ClipboardList, Truck, CheckCircle2, Clock } from "lucide-react";
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
  { v: "NUEVO",         l: "Nuevo",          pill: "bg-slate-100 text-slate-600",     next: "CONFIRMADO" },
  { v: "CONFIRMADO",    l: "Confirmado",      pill: "bg-sky-100 text-sky-700",         next: "EN_PRODUCCION" },
  { v: "EN_PRODUCCION", l: "En producción",   pill: "bg-amber-100 text-amber-700",     next: "LISTO" },
  { v: "LISTO",         l: "Listo",           pill: "bg-violet-100 text-violet-700",   next: "DESPACHADO" },
  { v: "DESPACHADO",    l: "Despachado",      pill: "bg-orange-100 text-orange-600",   next: "ENTREGADO" },
  { v: "ENTREGADO",     l: "Entregado",       pill: "bg-teal-100 text-teal-700",       next: "INSTALADO" },
  { v: "INSTALADO",     l: "Instalado ✓",    pill: "bg-emerald-100 text-emerald-700", next: null },
  { v: "CANCELADO",     l: "Cancelado",       pill: "bg-rose-100 text-rose-600",       next: null },
];

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS_FLUJO.find(x => x.v === estado);
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${e?.pill ?? "bg-slate-100 text-slate-600"}`}>{e?.l ?? estado}</span>;
}

const GRADIENTS_AVATAR = [
  "from-violet-400 to-indigo-500", "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-pink-400 to-rose-500",
];
function getAvatarGradient(name: string) {
  return GRADIENTS_AVATAR[name.charCodeAt(0) % GRADIENTS_AVATAR.length];
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

  const columnas = [
    { estados: ["NUEVO", "CONFIRMADO"],    label: "Por confirmar", icon: Clock,         gradient: "from-slate-400 to-slate-500" },
    { estados: ["EN_PRODUCCION", "LISTO"], label: "Producción",    icon: ClipboardList,  gradient: "from-amber-400 to-orange-500" },
    { estados: ["DESPACHADO", "ENTREGADO"],label: "Despacho",      icon: Truck,          gradient: "from-indigo-400 to-violet-500" },
    { estados: ["INSTALADO"],              label: "Completados",   icon: CheckCircle2,   gradient: "from-emerald-400 to-green-500" },
  ];

  return (
    <>
      <Topbar title="Pedidos" />
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {columnas.map(col => {
            const count = pedidos.filter(p => col.estados.includes(p.estado)).length;
            const Icon = col.icon;
            return (
              <div key={col.label} className={`bg-gradient-to-br ${col.gradient} rounded-2xl p-5 text-white shadow-lg`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">{col.label}</span>
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon size={14} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Filtros por estado */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button onClick={() => setFiltroEstado("")}
            className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all border ${!filtroEstado
              ? "bg-slate-800 border-slate-800 text-white shadow-sm"
              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
            Todos ({pedidos.length})
          </button>
          {ESTADOS_FLUJO.filter(e => e.v !== "CANCELADO").map(e => {
            const count = pedidos.filter(p => p.estado === e.v).length;
            if (count === 0) return null;
            return (
              <button key={e.v} onClick={() => setFiltroEstado(filtroEstado === e.v ? "" : e.v)}
                className={`px-4 py-2 rounded-2xl text-xs font-semibold transition-all border ${filtroEstado === e.v
                  ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                {e.l} ({count})
              </button>
            );
          })}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {isLoading ? (
              <div className="p-10 text-center text-sm text-slate-400">Cargando pedidos…</div>
            ) : pedidos.length === 0 ? (
              <div className="p-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Package size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">Sin pedidos</p>
                <p className="text-xs text-slate-400 mt-1">Los pedidos se crean automáticamente al aprobar una cotización</p>
              </div>
            ) : pedidos.map(p => {
              const eInfo = ESTADOS_FLUJO.find(e => e.v === p.estado);
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 group transition-colors">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${getAvatarGradient(p.cliente.nombre)} flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-sm`}>
                    {p.cliente.nombre.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{p.cliente.nombre}</p>
                      {p.tieneInstalacion && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-semibold">
                          <Wrench size={9} /> Instalación
                        </span>
                      )}
                    </div>
                    {p.cliente.empresa && <p className="text-xs text-slate-400">{p.cliente.empresa}</p>}
                    {p.instalacion && <p className="text-[10px] text-teal-600 mt-0.5 font-medium">🔧 Instalación: {p.instalacion.estado}</p>}
                  </div>

                  <div className="flex-shrink-0 text-center hidden md:block">
                    <p className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{p.numero}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(p.createdAt).toLocaleDateString("es-CO")}</p>
                  </div>

                  <EstadoBadge estado={p.estado} />

                  <p className="text-sm font-bold text-slate-900 w-32 text-right">{formatCOP(p.total)}</p>

                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {eInfo?.next && (
                      <button onClick={() => avanzarEstado(p)}
                        className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-xs font-semibold text-white transition-colors">
                        → {ESTADOS_FLUJO.find(e => e.v === eInfo.next)?.l}
                      </button>
                    )}
                    <Link href={`/crm/pedidos/${p.id}`}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors flex items-center gap-1">
                      Ver <ChevronRight size={11} />
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
