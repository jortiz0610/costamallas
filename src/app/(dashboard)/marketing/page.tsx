"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  DollarSign, Users, ShoppingBag, TrendingUp, MousePointerClick, Target,
  Percent, Megaphone, Plus, RefreshCw, Sparkles, ArrowRight, BarChart3,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";
import { CANALES, kpis } from "@/lib/marketing";

const MKT = "#db2777";

interface Campana {
  id: string; nombre: string; canal: string; estado: string;
  inversion: number; impresiones: number; clics: number; leads: number; conversiones: number; ingresos: number;
}

function MarketingDashboardContent() {
  const [canal, setCanal] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: campanas = [], refetch } = useQuery<Campana[]>({
    queryKey: ["mkt-campanas"],
    queryFn: async () => (await (await fetch("/api/marketing/campanas")).json()).data ?? [],
  });

  const handleRefresh = async () => { setRefreshing(true); await refetch(); toast.success("Marketing actualizado"); setTimeout(() => setRefreshing(false), 2200); };

  const filtradas = canal ? campanas.filter(c => c.canal === canal) : campanas;
  const k = kpis(filtradas);

  const KPIS = [
    { l: "Inversión total", v: formatCOP(k.inversion), c: MKT, Icon: DollarSign },
    { l: "Leads generados", v: String(k.leads), c: "#185FA5", Icon: Users },
    { l: "Ventas (ingresos)", v: formatCOP(k.ingresos), c: "#16a34a", Icon: ShoppingBag },
    { l: "ROAS", v: `${k.roas.toFixed(2)}x`, c: "#7c3aed", Icon: TrendingUp },
    { l: "ROI", v: `${k.roi.toFixed(0)}%`, c: k.roi >= 0 ? "#16a34a" : "#dc2626", Icon: Percent },
    { l: "CPC", v: formatCOP(k.cpc), c: "#0891b2", Icon: MousePointerClick },
    { l: "CPL", v: formatCOP(k.cpl), c: "#d97706", Icon: Target },
    { l: "Tasa conversión", v: `${k.tasaConv.toFixed(1)}%`, c: "#db2777", Icon: Percent },
  ];

  // Por canal
  const porCanal = CANALES.map(ch => {
    const cs = campanas.filter(c => c.canal === ch.v);
    return { ...ch, ...kpis(cs), nCampanas: cs.length };
  }).filter(c => c.nCampanas > 0);
  const maxInv = Math.max(...porCanal.map(c => c.inversion), 1);

  const topCampanas = [...filtradas].sort((a, b) => kpis([b]).roas - kpis([a]).roas).slice(0, 5);

  return (
    <>
      <Topbar title="Marketing · Resumen" actions={
        <div className="flex items-center gap-2">
          <Link href="/marketing/campanas" className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: MKT }}>
            <Plus size={13} /> Nueva campaña
          </Link>
          <button onClick={handleRefresh} className={`btn-secondary btn-sm transition-all ${refreshing ? "animate-refresh-success" : ""}`}>
            <RefreshCw size={12} className={refreshing ? "animate-spin-once" : ""} /> Actualizar
          </button>
        </div>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-6">

        {/* Filtro por canal */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCanal("")} className="pill" style={!canal ? { backgroundColor: MKT, color: "white" } : {}}>Todos los canales</button>
          {CANALES.map(ch => (
            <button key={ch.v} onClick={() => setCanal(canal === ch.v ? "" : ch.v)} className="pill" style={canal === ch.v ? { backgroundColor: ch.c, color: "white" } : {}}>{ch.l}</button>
          ))}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPIS.map(kp => {
            const Icon = kp.Icon;
            return (
              <div key={kp.l} className="card card-hover p-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: kp.c + "18" }}>
                  <Icon size={20} style={{ color: kp.c }} />
                </div>
                <p className="text-2xl font-bold mt-3" style={{ color: kp.c }}>{kp.v}</p>
                <p className="text-sm font-medium text-soft mt-0.5">{kp.l}</p>
              </div>
            );
          })}
        </div>

        {campanas.length === 0 ? (
          <div className="card p-12 text-center">
            <Megaphone size={28} className="mx-auto mb-3 text-muted" />
            <p className="text-sm font-semibold text-soft">Aún no hay campañas</p>
            <p className="text-xs text-muted mt-1">Crea tu primera campaña para empezar a medir resultados.</p>
            <Link href="/marketing/campanas" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: MKT }}>
              <Plus size={14} /> Nueva campaña
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inversión por canal */}
            <div className="card p-5 lg:col-span-2">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">Inversión por canal</h2>
              <div className="space-y-3">
                {porCanal.map(c => (
                  <div key={c.v} className="flex items-center gap-3">
                    <span className="w-24 text-xs font-medium text-soft flex-shrink-0">{c.l}</span>
                    <div className="flex-1 h-6 rounded-lg overflow-hidden surface-2">
                      <div className="h-full rounded-lg flex items-center justify-end px-2 transition-all duration-500" style={{ width: `${(c.inversion / maxInv) * 100}%`, backgroundColor: c.c, minWidth: "40px" }}>
                        <span className="text-[10px] font-bold text-white">{formatCOP(c.inversion)}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted w-16 text-right">ROAS {c.roas.toFixed(1)}x</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Advisor placeholder */}
            <div className="card p-5" style={{ background: `linear-gradient(135deg, ${MKT}10, transparent)` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: MKT }}><Sparkles size={18} className="text-white" /></div>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">AI Marketing Advisor</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">Pendiente API</span>
                </div>
              </div>
              <p className="text-xs text-muted">Cuando conectes una API de IA, aquí tendrás análisis automático: mejor/peor campaña, recomendaciones de presupuesto y predicciones de ROAS.</p>
              <ul className="mt-3 space-y-1.5 text-xs text-soft">
                <li className="flex items-center gap-2"><ArrowRight size={11} style={{ color: MKT }} /> Detección de campañas ganadoras</li>
                <li className="flex items-center gap-2"><ArrowRight size={11} style={{ color: MKT }} /> Sugerencias de optimización</li>
                <li className="flex items-center gap-2"><ArrowRight size={11} style={{ color: MKT }} /> Generador de copys (FB/IG/TikTok)</li>
              </ul>
            </div>

            {/* Top campañas */}
            <div className="card p-5 lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Mejores campañas por ROAS</h2>
                <Link href="/marketing/campanas" className="text-xs font-semibold" style={{ color: MKT }}>Ver todas</Link>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Campaña</th><th>Canal</th><th className="text-right">Inversión</th><th className="text-right">Leads</th><th className="text-right">Ingresos</th><th className="text-right">ROAS</th></tr></thead>
                  <tbody>
                    {topCampanas.map(c => {
                      const ch = CANALES.find(x => x.v === c.canal);
                      const r = kpis([c]);
                      return (
                        <tr key={c.id}>
                          <td className="font-medium">{c.nombre}</td>
                          <td><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: (ch?.c ?? "#64748b") + "20", color: ch?.c ?? "#64748b" }}>{ch?.l ?? c.canal}</span></td>
                          <td className="text-right">{formatCOP(c.inversion)}</td>
                          <td className="text-right">{c.leads}</td>
                          <td className="text-right">{formatCOP(c.ingresos)}</td>
                          <td className="text-right font-bold" style={{ color: r.roas >= 1 ? "#16a34a" : "#dc2626" }}>{r.roas.toFixed(2)}x</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><MarketingDashboardContent /></Suspense>; }
