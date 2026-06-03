"use client";
import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ChevronRight, Package, Wrench, ClipboardList, Truck, CheckCircle2, Clock, Globe, RefreshCw } from "lucide-react";
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

const CRM_COLOR = "#BA7517";
const ESTADOS_FLUJO = [
  { v: "NUEVO",         l: "Nuevo",         bg: "#f1f5f9", text: "#6b7280",  next: "CONFIRMADO" },
  { v: "CONFIRMADO",    l: "Confirmado",    bg: "#dbeafe", text: "#1d4ed8",  next: "EN_PRODUCCION" },
  { v: "EN_PRODUCCION", l: "En producción", bg: "#fef3c7", text: "#92400e",  next: "LISTO" },
  { v: "LISTO",         l: "Listo",         bg: "#ede9fe", text: "#5b21b6",  next: "DESPACHADO" },
  { v: "DESPACHADO",    l: "Despachado",    bg: "#ffedd5", text: "#9a3412",  next: "ENTREGADO" },
  { v: "ENTREGADO",     l: "Entregado",     bg: "#ccfbf1", text: "#0f766e",  next: "INSTALADO" },
  { v: "INSTALADO",     l: "Instalado",     bg: "#d1fae5", text: "#065f46",  next: null },
  { v: "CANCELADO",     l: "Cancelado",     bg: "#fee2e2", text: "#b91c1c",  next: null },
];

function Badge({ estado }: { estado: string }) {
  const e = ESTADOS_FLUJO.find(x => x.v === estado);
  return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: e?.bg ?? "#f1f5f9", color: e?.text ?? "#6b7280" }}>{e?.l ?? estado}</span>;
}

const AV_COLORS = [CRM_COLOR, "#185FA5", "#7c3aed", "#059669", "#dc2626"];
function av(n: string) { return AV_COLORS[n.charCodeAt(0) % AV_COLORS.length]; }

function PedidoRow({ p, onAvanzar }: { p: Pedido; onAvanzar: (p: Pedido) => void }) {
  const eInfo = ESTADOS_FLUJO.find(e => e.v === p.estado);
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors group last:border-b-0">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: av(p.cliente.nombre) }}>
        {p.cliente.nombre.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.cliente.nombre}</p>
          {p.tieneInstalacion && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 flex items-center gap-1">
              <Wrench size={9} />Inst.
            </span>
          )}
        </div>
        {p.cliente.empresa && <p className="text-xs text-gray-400">{p.cliente.empresa}</p>}
      </div>
      <p className="text-[10px] font-mono text-gray-400 hidden md:block">{p.numero}</p>
      <Badge estado={p.estado} />
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 w-28 text-right">{formatCOP(p.total)}</p>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {eInfo?.next && (
          <button onClick={() => onAvanzar(p)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: CRM_COLOR }}>
            Avanzar
          </button>
        )}
        <Link href={`/crm/pedidos/${p.id}`} className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
          Ver <ChevronRight size={11} />
        </Link>
      </div>
    </div>
  );
}

function PedidosContent() {
  const [tab, setTab] = useState<"internet" | "instalacion">("internet");
  const [filtroEstado, setFiltroEstado] = useState("");
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: pedidos = [], isLoading, refetch } = useQuery<Pedido[]>({
    queryKey: ["crm-pedidos"],
    queryFn: async () => (await (await fetch("/api/crm/pedidos")).json()).data ?? [],
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const avanzar = async (pedido: Pedido) => {
    const current = ESTADOS_FLUJO.find(e => e.v === pedido.estado);
    if (!current?.next) return;
    const res = await fetch(`/api/crm/pedidos/${pedido.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: current.next }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(`→ ${ESTADOS_FLUJO.find(e => e.v === current.next)?.l}`);
      qc.invalidateQueries({ queryKey: ["crm-pedidos"] });
    }
  };

  // Split by tieneInstalacion
  const pedidosInternet = pedidos.filter(p => !p.tieneInstalacion);
  const pedidosInstalacion = pedidos.filter(p => p.tieneInstalacion);
  const base = tab === "internet" ? pedidosInternet : pedidosInstalacion;
  const filtrados = filtroEstado ? base.filter(p => p.estado === filtroEstado) : base;

  const COLS_INTERNET = [
    { estados: ["NUEVO", "CONFIRMADO"],     label: "Por confirmar", Icon: Clock,        color: "#6b7280" },
    { estados: ["EN_PRODUCCION", "LISTO"],  label: "Producción",   Icon: ClipboardList, color: CRM_COLOR },
    { estados: ["DESPACHADO", "ENTREGADO"], label: "Despacho",     Icon: Truck,         color: "#185FA5" },
    { estados: ["INSTALADO"],               label: "Completados",  Icon: CheckCircle2,  color: "#16a34a" },
  ];

  const COLS_INST = [
    { estados: ["NUEVO", "CONFIRMADO"],     label: "Pendientes",   Icon: Clock,         color: "#6b7280" },
    { estados: ["EN_PRODUCCION", "LISTO"],  label: "En proceso",   Icon: Wrench,        color: CRM_COLOR },
    { estados: ["DESPACHADO", "ENTREGADO"], label: "En camino",    Icon: Truck,         color: "#185FA5" },
    { estados: ["INSTALADO"],               label: "Instalados",   Icon: CheckCircle2,  color: "#16a34a" },
  ];

  const cols = tab === "internet" ? COLS_INTERNET : COLS_INST;

  return (
    <>
      <Topbar title="Pedidos" actions={
        <button
          onClick={handleRefresh}
          className={`btn-secondary btn-sm transition-all ${refreshing ? "animate-refresh-success" : ""}`}
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Actualizar
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">

        {/* Tabs */}
        <div className="flex rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 w-fit">
          <button
            onClick={() => { setTab("internet"); setFiltroEstado(""); }}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all"
            style={tab === "internet"
              ? { backgroundColor: CRM_COLOR, color: "white" }
              : { backgroundColor: "var(--surface)", color: "var(--text-muted)" }}
          >
            <Globe size={14} /> Pedidos web ({pedidosInternet.length})
          </button>
          <button
            onClick={() => { setTab("instalacion"); setFiltroEstado(""); }}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all"
            style={tab === "instalacion"
              ? { backgroundColor: "#d97706", color: "white" }
              : { backgroundColor: "var(--surface)", color: "var(--text-muted)" }}
          >
            <Wrench size={14} /> Con instalación ({pedidosInstalacion.length})
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {cols.map(col => {
            const count = base.filter(p => col.estados.includes(p.estado)).length;
            const Icon = col.Icon;
            return (
              <div key={col.label} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: col.color + "18" }}>
                  <Icon size={16} style={{ color: col.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{col.label}</p>
                  <p className="text-xl font-bold" style={{ color: col.color }}>{count}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFiltroEstado("")}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={!filtroEstado ? { backgroundColor: "var(--brand-color)", color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
            Todos ({base.length})
          </button>
          {ESTADOS_FLUJO.filter(e => e.v !== "CANCELADO").map(e => {
            const count = base.filter(p => p.estado === e.v).length;
            if (!count) return null;
            return (
              <button key={e.v} onClick={() => setFiltroEstado(filtroEstado === e.v ? "" : e.v)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={filtroEstado === e.v
                  ? { backgroundColor: "var(--brand-color)", color: "white" }
                  : { backgroundColor: e.bg, color: e.text }}>
                {e.l} ({count})
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center">
              <Package size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Sin pedidos en esta categoría</p>
            </div>
          ) : filtrados.map(p => (
            <PedidoRow key={p.id} p={p} onAvanzar={avanzar} />
          ))}
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><PedidosContent /></Suspense>; }
