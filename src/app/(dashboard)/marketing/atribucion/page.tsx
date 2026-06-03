"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Target, Link2, Users, TrendingUp } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import { CANALES, kpis } from "@/lib/marketing";

const MKT = "#db2777";

interface Campana { id: string; nombre: string; canal: string; inversion: number; impresiones: number; clics: number; leads: number; conversiones: number; ingresos: number; }

function AtribucionContent() {
  const { data: campanas = [] } = useQuery<Campana[]>({
    queryKey: ["mkt-campanas"],
    queryFn: async () => (await (await fetch("/api/marketing/campanas")).json()).data ?? [],
  });

  const totalLeads = campanas.reduce((a, c) => a + c.leads, 0);

  const porCanal = CANALES.map(ch => {
    const cs = campanas.filter(c => c.canal === ch.v);
    const k = kpis(cs);
    return { ...ch, leads: k.leads, conversiones: k.conversiones, cpl: k.cpl, cac: k.conversiones ? k.inversion / k.conversiones : 0, ingresos: k.ingresos, pct: totalLeads ? (k.leads / totalLeads) * 100 : 0 };
  }).filter(c => c.leads > 0).sort((a, b) => b.leads - a.leads);

  return (
    <>
      <Topbar title="Atribución de leads" />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-6">

        {/* Explicación UTM */}
        <div className="card p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${MKT}10, transparent)` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: MKT }}><Link2 size={22} className="text-white" /></div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">¿De dónde vienen tus clientes?</p>
            <p className="text-xs text-muted mt-0.5">Aquí ves qué canal y campaña generan tus leads y ventas. La <b>captura automática de UTMs</b> (utm_source, utm_campaign…) por cada lead se activa al conectar el formulario web / cotizador embebible.</p>
          </div>
        </div>

        {/* Distribución de leads por canal */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><Users size={15} style={{ color: MKT }} /> Leads por canal</h2>
          {porCanal.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">Registra leads en tus campañas para ver la atribución.</p>
          ) : (
            <div className="space-y-3">
              {porCanal.map(c => (
                <div key={c.v} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.c }} />
                  <span className="w-28 text-xs font-medium text-soft flex-shrink-0">{c.l}</span>
                  <div className="flex-1 h-6 rounded-lg overflow-hidden surface-2">
                    <div className="h-full rounded-lg flex items-center justify-end px-2" style={{ width: `${c.pct}%`, backgroundColor: c.c, minWidth: "36px" }}>
                      <span className="text-[10px] font-bold text-white">{c.leads}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted w-20 text-right">{c.pct.toFixed(0)}% · CPL {formatCOP(c.cpl)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rendimiento detallado */}
        <div className="card overflow-hidden">
          <div className="card-header"><h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><TrendingUp size={15} style={{ color: MKT }} /> Rendimiento por canal</h2></div>
          <div className="table-wrapper" style={{ border: "none" }}>
            <table className="table">
              <thead><tr><th>Canal</th><th className="text-right">Leads</th><th className="text-right">Ventas</th><th className="text-right">CPL</th><th className="text-right">CAC</th><th className="text-right">Ingresos</th></tr></thead>
              <tbody>
                {porCanal.map(c => (
                  <tr key={c.v}>
                    <td><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.c }} />{c.l}</span></td>
                    <td className="text-right">{c.leads}</td>
                    <td className="text-right">{c.conversiones}</td>
                    <td className="text-right">{formatCOP(c.cpl)}</td>
                    <td className="text-right">{formatCOP(c.cac)}</td>
                    <td className="text-right font-semibold">{formatCOP(c.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><AtribucionContent /></Suspense>; }
