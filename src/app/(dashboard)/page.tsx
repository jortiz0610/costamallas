"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import {
  Package, ShoppingCart, AlertTriangle,
  CheckCircle, RefreshCw, FileOutput, TrendingUp,
  ImageIcon, DollarSign, FileText, CheckCheck,
} from "lucide-react";
import { formatCOP, formatDate, cn } from "@/lib/utils";
import Link from "next/link";
import toast from "react-hot-toast";
import type { DashboardKPIs, NivelStock } from "@/types";
import { useBrand } from "@/contexts/BrandContext";

async function fetchKPIs(): Promise<DashboardKPIs> {
  const res = await fetch("/api/dashboard/kpis");
  if (!res.ok) throw new Error("Error al cargar KPIs");
  return (await res.json()).data;
}

const stockBadge: Record<NivelStock, string> = {
  OK:          "badge-green",
  ADVERTENCIA: "badge-yellow",
  BAJO:        "badge-orange",
  CRITICO:     "badge-red",
};

export default function DashboardPage() {
  const [refreshing, setRefreshing] = useState(false);
  const { brand } = useBrand();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: fetchKPIs,
    staleTime: 60_000,
    refetchInterval: 2 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    toast.success("Dashboard actualizado");
    setTimeout(() => setRefreshing(false), 2200);
  };

  return (
    <>
      <Topbar
        title="Dashboard"
        actions={
          <button onClick={handleRefresh} className={`btn-secondary btn-sm transition-all ${refreshing ? "animate-refresh-success" : ""}`}>
            <RefreshCw size={13} className={isLoading ? "animate-spin" : refreshing ? "animate-spin-once" : ""} />
            Actualizar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-6">
        {/* KPIs — tarjetas consistentes con el resto del sistema */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "Total productos",   v: data?.productos.total ?? "—",                          sub: `${data?.productos.publicados ?? 0} publicados`, c: brand.brandColor, Icon: Package },
            { l: "En WooCommerce",    v: data?.productos.publicados ?? "—",                      sub: `${data?.productos.total ? Math.round((data.productos.publicados / data.productos.total) * 100) : 0}% del total`, c: "#7c3aed", Icon: ShoppingCart },
            { l: "Precio promedio",   v: data ? formatCOP(data.productos.precioPromedio) : "—",  sub: "Todos los tipos", c: "#16a34a", Icon: TrendingUp },
            { l: "Stock crítico",     v: data?.stock.criticos ?? "—",                            sub: data?.stock.criticos ? "Requiere atención" : "Sin alertas", c: "#dc2626", Icon: AlertTriangle },
            { l: "Sin imagen",        v: data?.productos.sinImagen ?? "—",                       sub: "Productos sin foto", c: "#0891b2", Icon: ImageIcon },
            { l: "Sin precio",        v: data?.productos.sinPrecio ?? "—",                       sub: "Falta precio", c: "#d97706", Icon: DollarSign },
            { l: "Borradores",        v: data?.productos.borradores ?? "—",                      sub: "En edición", c: "#64748b", Icon: FileText },
            { l: "Listos p/ exportar",v: data?.woocommerce.pendientesExportar ?? "—",            sub: "Pendientes WC", c: "#0f766e", Icon: CheckCheck },
          ].map(k => {
            const Icon = k.Icon;
            return (
              <div key={k.l} className="card card-hover p-5">
                <div className="flex items-center justify-between">
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
          {/* Alertas de stock */}
          <div className="lg:col-span-2 card">
            <div className="card-header">
              <h2 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
                <AlertTriangle size={14} className="text-orange-500" />
                Alertas de stock
              </h2>
              <Link href="/stock" className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                Ver todo →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {isLoading ? (
                <div className="p-6 text-center text-[12px] text-gray-400">Cargando…</div>
              ) : !data?.stock.alertas.length ? (
                <div className="p-6 text-center">
                  <CheckCircle size={20} className="text-green-500 mx-auto mb-2" />
                  <p className="text-[12px] text-gray-500">¡Todo el stock está en orden!</p>
                </div>
              ) : (
                data.stock.alertas.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="sku-tag">{a.sku}</span>
                    <span className="flex-1 text-[12px] text-gray-700 truncate">{a.nombre}</span>
                    <span className="text-[12px] font-medium text-gray-600">{a.stock} ud</span>
                    <span className={cn("badge", stockBadge[a.nivelStock])}>
                      {a.nivelStock === "CRITICO" ? "Crítico" : a.nivelStock === "BAJO" ? "Bajo" : "Advertencia"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Categorías */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-[13px] font-semibold text-gray-800">Por categoría</h2>
            </div>
            <div className="p-5 space-y-4">
              {isLoading ? (
                <div className="text-center text-[12px] text-gray-400">Cargando…</div>
              ) : (
                data?.categorias.map((c) => (
                  <div key={c.categoria}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-gray-700 truncate">{c.categoria}</span>
                      <span className="text-gray-500 ml-2 flex-shrink-0">{c.total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cm-yellow rounded-full"
                        style={{ width: `${c.porcentaje}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Panel WooCommerce */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Última sincronización</p>
              <p className="text-[13px] font-semibold text-gray-800">
                {data?.woocommerce.ultimaSync ? formatDate(data.woocommerce.ultimaSync) : "Nunca"}
              </p>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-cm-yellow/20 flex items-center justify-center flex-shrink-0">
              <FileOutput size={18} className="text-cm-yellow-dark" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Listos para exportar</p>
              <p className="text-[22px] font-semibold text-gray-800">{data?.woocommerce.pendientesExportar ?? "—"}</p>
            </div>
            <Link href="/exportar" className="ml-auto btn-primary btn-sm">Exportar</Link>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Errores pendientes</p>
              <p className="text-[22px] font-semibold text-gray-800">{data?.woocommerce.erroresPendientes ?? "—"}</p>
            </div>
            {(data?.woocommerce.erroresPendientes ?? 0) > 0 && (
              <Link href="/errores" className="ml-auto btn-danger btn-sm">Ver</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
