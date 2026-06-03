"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Download, FileText, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";
import { CANALES, kpis } from "@/lib/marketing";

const MKT = "#db2777";
interface Campana { id: string; nombre: string; canal: string; inversion: number; impresiones: number; clics: number; leads: number; conversiones: number; ingresos: number; }

function ReportesContent() {
  const { data: campanas = [] } = useQuery<Campana[]>({
    queryKey: ["mkt-campanas"],
    queryFn: async () => (await (await fetch("/api/marketing/campanas")).json()).data ?? [],
  });

  const k = kpis(campanas);

  const exportarCSV = () => {
    const headers = ["Campaña", "Canal", "Inversión", "Impresiones", "Clics", "CTR%", "Leads", "CPL", "Ventas", "Ingresos", "ROAS", "ROI%"];
    const rows = campanas.map(c => {
      const r = kpis([c]);
      return [c.nombre, c.canal, c.inversion, c.impresiones, c.clics, r.ctr.toFixed(2), c.leads, r.cpl.toFixed(0), c.conversiones, c.ingresos, r.roas.toFixed(2), r.roi.toFixed(0)];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `reporte-marketing-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  const RESUMEN = [
    { l: "Inversión total", v: formatCOP(k.inversion) },
    { l: "Ingresos generados", v: formatCOP(k.ingresos) },
    { l: "ROAS global", v: `${k.roas.toFixed(2)}x` },
    { l: "ROI global", v: `${k.roi.toFixed(0)}%` },
    { l: "Leads totales", v: String(k.leads) },
    { l: "Costo por lead", v: formatCOP(k.cpl) },
  ];

  return (
    <>
      <Topbar title="Reportes de Marketing" actions={
        <div className="flex items-center gap-2 no-print">
          <button onClick={exportarCSV} className="btn-secondary btn-sm"><Download size={12} /> CSV</button>
          <button onClick={() => window.print()} className="btn-secondary btn-sm"><FileText size={12} /> PDF</button>
        </div>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-6 print-area">
        {/* Resumen ejecutivo */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {RESUMEN.map(s => (
            <div key={s.l} className="card p-4">
              <p className="text-xs text-muted">{s.l}</p>
              <p className="text-xl font-bold mt-1" style={{ color: MKT }}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Inversión vs Ventas por canal */}
        <div className="card overflow-hidden">
          <div className="card-header"><h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><TrendingUp size={15} style={{ color: MKT }} /> Inversión vs. Ventas por canal</h2></div>
          <div className="table-wrapper" style={{ border: "none" }}>
            <table className="table">
              <thead><tr><th>Canal</th><th className="text-right">Inversión</th><th className="text-right">Ingresos</th><th className="text-right">ROAS</th><th className="text-right">ROI</th><th className="text-right">CTR</th><th className="text-right">CPL</th></tr></thead>
              <tbody>
                {CANALES.map(ch => {
                  const cs = campanas.filter(c => c.canal === ch.v);
                  if (!cs.length) return null;
                  const r = kpis(cs);
                  return (
                    <tr key={ch.v}>
                      <td><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.c }} />{ch.l}</span></td>
                      <td className="text-right">{formatCOP(r.inversion)}</td>
                      <td className="text-right">{formatCOP(r.ingresos)}</td>
                      <td className="text-right font-bold" style={{ color: r.roas >= 1 ? "#16a34a" : "#dc2626" }}>{r.roas.toFixed(2)}x</td>
                      <td className="text-right">{r.roi.toFixed(0)}%</td>
                      <td className="text-right">{r.ctr.toFixed(2)}%</td>
                      <td className="text-right">{formatCOP(r.cpl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {campanas.length === 0 && <p className="text-sm text-muted text-center">Sin datos. Crea campañas para generar reportes.</p>}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><ReportesContent /></Suspense>; }
