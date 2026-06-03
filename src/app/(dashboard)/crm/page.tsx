"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Users, ClipboardList, ShoppingCart, TrendingUp, RefreshCw, ArrowRight,
  UserPlus, Plus, Star, Wrench, CheckSquare, Clock, DollarSign, Target,
} from "lucide-react";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";

const CRM_COLOR = "#BA7517";

const ESTADOS_CLIENTE = [
  { v: "PROSPECTO",       l: "Prospecto",      dot: "#9ca3af" },
  { v: "INTERESADO",      l: "Interesado",     dot: "#3b82f6" },
  { v: "CALIFICADO",      l: "Calificado",     dot: "#f59e0b" },
  { v: "CLIENTE_ACTIVO",  l: "Cliente activo", dot: "#10b981" },
  { v: "RECURRENTE",      l: "Recurrente",     dot: "#7c3aed" },
  { v: "VIP",             l: "VIP",            dot: "#eab308" },
  { v: "CLIENTE_INACTIVO",l: "Inactivo",       dot: "#ef4444" },
  { v: "NO_CALIFICADO",   l: "No calificado",  dot: "#94a3b8" },
];

interface Cliente { id: string; nombre: string; empresa?: string; estado: string; createdAt: string; _count: { cotizaciones: number; pedidos: number }; }
interface Cotizacion { id: string; numero: string; estado: string; total: number; createdAt: string; cliente: { nombre: string }; }
interface Pedido { id: string; estado: string; total: number; tieneInstalacion: boolean; }
interface Tarea { id: string; titulo: string; estado: string; prioridad: string; fechaVence?: string; cliente?: { nombre: string }; }

function avatarColor(name: string) {
  const colors = [CRM_COLOR, "#185FA5", "#7c3aed", "#059669", "#dc2626", "#0891b2"];
  return colors[(name?.charCodeAt(0) ?? 0) % colors.length];
}

function CRMDashboardContent() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: clientes = [], refetch: r1 } = useQuery<Cliente[]>({
    queryKey: ["crm-dash-clientes"],
    queryFn: async () => (await (await fetch("/api/crm/clientes")).json()).data ?? [],
  });
  const { data: cotizaciones = [], refetch: r2 } = useQuery<Cotizacion[]>({
    queryKey: ["crm-dash-cotizaciones"],
    queryFn: async () => (await (await fetch("/api/crm/cotizaciones")).json()).data ?? [],
  });
  const { data: pedidos = [], refetch: r3 } = useQuery<Pedido[]>({
    queryKey: ["crm-dash-pedidos"],
    queryFn: async () => (await (await fetch("/api/crm/pedidos")).json()).data ?? [],
  });
  const { data: tareas = [], refetch: r4 } = useQuery<Tarea[]>({
    queryKey: ["crm-dash-tareas"],
    queryFn: async () => (await (await fetch("/api/crm/tareas?estado=PENDIENTE")).json()).data ?? [],
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([r1(), r2(), r3(), r4()]);
    setTimeout(() => setRefreshing(false), 2200);
  };

  const activos = clientes.filter(c => ["CLIENTE_ACTIVO", "RECURRENTE", "VIP"].includes(c.estado)).length;
  const ventasMes = pedidos.filter(p => p.estado !== "CANCELADO").reduce((s, p) => s + Number(p.total), 0);
  const pipelineValor = cotizaciones.filter(c => ["ENVIADA", "BORRADOR"].includes(c.estado)).reduce((s, c) => s + Number(c.total), 0);
  const tasaConversion = cotizaciones.length > 0
    ? Math.round((cotizaciones.filter(c => c.estado === "APROBADA").length / cotizaciones.length) * 100)
    : 0;

  // Distribución por estado
  const distribucion = ESTADOS_CLIENTE.map(e => ({ ...e, count: clientes.filter(c => c.estado === e.v).length })).filter(e => e.count > 0);
  const maxCount = Math.max(...distribucion.map(d => d.count), 1);

  const topClientes = [...clientes]
    .sort((a, b) => (b._count.cotizaciones + b._count.pedidos) - (a._count.cotizaciones + a._count.pedidos))
    .slice(0, 5);

  const cotizacionesRecientes = [...cotizaciones].slice(0, 5);

  const KPIS = [
    { l: "Clientes totales",   v: String(clientes.length),       sub: `${activos} activos`,            c: CRM_COLOR,  Icon: Users },
    { l: "Ventas (pedidos)",   v: formatCOP(ventasMes),          sub: `${pedidos.length} pedidos`,     c: "#16a34a",  Icon: DollarSign },
    { l: "Pipeline abierto",   v: formatCOP(pipelineValor),      sub: `${cotizaciones.filter(c => ["ENVIADA","BORRADOR"].includes(c.estado)).length} cotizaciones`, c: "#185FA5", Icon: Target },
    { l: "Tasa de conversión", v: `${tasaConversion}%`,          sub: "cotización → venta",            c: "#7c3aed",  Icon: TrendingUp },
  ];

  return (
    <>
      <Topbar
        title="CRM · Resumen"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/crm/clientes/nuevo" className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: CRM_COLOR }}>
              <UserPlus size={13} /> Nuevo cliente
            </Link>
            <button onClick={handleRefresh} className={`btn-secondary btn-sm transition-all ${refreshing ? "animate-refresh-success" : ""}`}>
              <RefreshCw size={12} className={refreshing ? "animate-spin-once" : ""} /> Actualizar
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map(k => {
            const Icon = k.Icon;
            return (
              <div key={k.l} className="card card-hover p-5 animate-fade-up">
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: k.c + "18" }}>
                    <Icon size={20} style={{ color: k.c }} />
                  </div>
                </div>
                <p className="text-2xl font-bold mt-3" style={{ color: k.c }}>{k.v}</p>
                <p className="text-sm font-medium text-soft mt-0.5">{k.l}</p>
                <p className="text-xs text-muted mt-0.5">{k.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Distribución de clientes */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Distribución de clientes por estado</h2>
              <Link href="/crm/clientes" className="text-xs font-semibold flex items-center gap-1 hover:gap-2 transition-all" style={{ color: CRM_COLOR }}>
                Ver todos <ArrowRight size={12} />
              </Link>
            </div>
            {distribucion.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">Aún no hay clientes registrados</p>
            ) : (
              <div className="space-y-3">
                {distribucion.map(d => (
                  <div key={d.v} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.dot }} />
                    <span className="text-xs font-medium text-soft w-28 flex-shrink-0">{d.l}</span>
                    <div className="flex-1 h-6 rounded-lg overflow-hidden surface-2">
                      <div className="h-full rounded-lg flex items-center justify-end px-2 transition-all duration-500"
                        style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: d.dot, minWidth: "28px" }}>
                        <span className="text-[10px] font-bold text-white">{d.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accesos rápidos */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">Acciones rápidas</h2>
            <div className="space-y-2">
              {[
                { l: "Nueva cotización", Icon: ClipboardList, href: "/crm/cotizaciones/nueva", c: CRM_COLOR },
                { l: "Registrar cliente", Icon: UserPlus, href: "/crm/clientes/nuevo", c: "#185FA5" },
                { l: "Ver pedidos", Icon: ShoppingCart, href: "/crm/pedidos", c: "#16a34a" },
                { l: "Tareas pendientes", Icon: CheckSquare, href: "/crm/tareas", c: "#7c3aed" },
                { l: "Instalaciones", Icon: Wrench, href: "/crm/instalaciones", c: "#d97706" },
              ].map(a => {
                const Icon = a.Icon;
                return (
                  <Link key={a.l} href={a.href}
                    className="flex items-center gap-3 p-3 rounded-xl surface-2 hover:translate-x-1 transition-all group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: a.c + "18" }}>
                      <Icon size={15} style={{ color: a.c }} />
                    </div>
                    <span className="text-xs font-semibold text-soft flex-1">{a.l}</span>
                    <ArrowRight size={13} className="text-muted group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top clientes */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Star size={15} style={{ color: "#eab308" }} /> Clientes más activos</h2>
            </div>
            {topClientes.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Sin datos aún</p>
            ) : (
              <div className="space-y-1">
                {topClientes.map((c, i) => (
                  <Link key={c.id} href={`/crm/clientes/${c.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:surface-2 transition-colors">
                    <span className="text-xs font-bold text-muted w-4">{i + 1}</span>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: avatarColor(c.nombre) }}>
                      {c.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{c.nombre}</p>
                      {c.empresa && <p className="text-xs text-muted truncate">{c.empresa}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-soft">{c._count.cotizaciones + c._count.pedidos}</p>
                      <p className="text-[10px] text-muted">interacciones</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Cotizaciones recientes */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><ClipboardList size={15} style={{ color: CRM_COLOR }} /> Cotizaciones recientes</h2>
              <Link href="/crm/cotizaciones" className="text-xs font-semibold flex items-center gap-1" style={{ color: CRM_COLOR }}>Ver todas</Link>
            </div>
            {cotizacionesRecientes.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Sin cotizaciones aún</p>
            ) : (
              <div className="space-y-1">
                {cotizacionesRecientes.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:surface-2 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-muted">{c.numero}</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{c.cliente.nombre}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full surface-3 text-soft">{c.estado}</span>
                    <p className="text-sm font-bold text-soft">{formatCOP(c.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tareas pendientes banner */}
        {tareas.length > 0 && (
          <Link href="/crm/tareas" className="card card-hover p-4 flex items-center gap-4 block" style={{ borderLeft: `4px solid ${CRM_COLOR}` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: CRM_COLOR + "18" }}>
              <Clock size={18} style={{ color: CRM_COLOR }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Tienes {tareas.length} tarea{tareas.length !== 1 ? "s" : ""} pendiente{tareas.length !== 1 ? "s" : ""}</p>
              <p className="text-xs text-muted">{tareas.slice(0, 2).map(t => t.titulo).join(" · ")}{tareas.length > 2 ? "…" : ""}</p>
            </div>
            <ArrowRight size={16} className="text-muted" />
          </Link>
        )}
      </div>
    </>
  );
}

export default function CRMDashboardPage() {
  return <Suspense><CRMDashboardContent /></Suspense>;
}
