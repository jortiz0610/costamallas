"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, FileText, Loader2, DollarSign, Clock, AlertTriangle, Eye } from "lucide-react";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";

const ERP_COLOR = "#185FA5";
const ESTADOS: Record<string, { l: string; c: string }> = {
  BORRADOR: { l: "Borrador", c: "#64748b" },
  EMITIDA: { l: "Emitida", c: "#185FA5" },
  PARCIAL: { l: "Pago parcial", c: "#d97706" },
  PAGADA: { l: "Pagada", c: "#16a34a" },
  ANULADA: { l: "Anulada", c: "#dc2626" },
  VENCIDA: { l: "Vencida", c: "#dc2626" },
};

interface Factura {
  id: string; numero: string; estado: string; estadoDian: string;
  total: number; saldoPendiente: number; createdAt: string; fechaVence?: string;
  cliente: { nombre: string; empresa?: string };
}

function FacturacionContent() {
  const [filtro, setFiltro] = useState("");
  const { data: facturas = [], isLoading } = useQuery<Factura[]>({
    queryKey: ["facturas", filtro],
    queryFn: async () => (await (await fetch(`/api/facturacion/facturas${filtro ? `?estado=${filtro}` : ""}`)).json()).data ?? [],
  });

  const activas = facturas.filter(f => f.estado !== "ANULADA");
  const facturado = activas.reduce((s, f) => s + Number(f.total), 0);
  const porCobrar = activas.reduce((s, f) => s + Number(f.saldoPendiente), 0);
  const pagado = facturado - porCobrar;
  const vencidas = activas.filter(f => Number(f.saldoPendiente) > 0 && f.fechaVence && new Date(f.fechaVence) < new Date()).length;

  return (
    <>
      <Topbar title="Facturación" actions={
        <Link href="/facturacion/nueva" className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: ERP_COLOR }}>
          <Plus size={13} /> Nueva factura
        </Link>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { l: "Facturado", v: formatCOP(facturado), c: ERP_COLOR, Icon: FileText },
            { l: "Pagado", v: formatCOP(pagado), c: "#16a34a", Icon: DollarSign },
            { l: "Por cobrar", v: formatCOP(porCobrar), c: "#d97706", Icon: Clock },
            { l: "Vencidas", v: String(vencidas), c: "#dc2626", Icon: AlertTriangle },
          ].map(k => {
            const Icon = k.Icon;
            return (
              <div key={k.l} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: k.c + "18" }}><Icon size={18} style={{ color: k.c }} /></div>
                <div className="min-w-0"><p className="text-xs text-muted">{k.l}</p><p className="text-lg font-bold truncate" style={{ color: k.c }}>{k.v}</p></div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFiltro("")} className="pill" style={!filtro ? { backgroundColor: ERP_COLOR, color: "white" } : {}}>Todas</button>
          {Object.entries(ESTADOS).map(([v, m]) => (
            <button key={v} onClick={() => setFiltro(filtro === v ? "" : v)} className="pill" style={filtro === v ? { backgroundColor: m.c, color: "white" } : {}}>{m.l}</button>
          ))}
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: ERP_COLOR }} /></div>
        ) : facturas.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">Sin facturas. Crea la primera desde un pedido o manualmente.</p>
            <Link href="/facturacion/nueva" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: ERP_COLOR }}><Plus size={14} /> Nueva factura</Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="table-wrapper" style={{ border: "none" }}>
              <table className="table">
                <thead><tr><th>Número</th><th>Cliente</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Saldo</th><th></th></tr></thead>
                <tbody>
                  {facturas.map(f => {
                    const m = ESTADOS[f.estado] ?? ESTADOS.BORRADOR;
                    return (
                      <tr key={f.id}>
                        <td className="font-mono text-xs font-bold">{f.numero}</td>
                        <td className="font-medium text-gray-800 dark:text-gray-100">{f.cliente.nombre}</td>
                        <td><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: m.c + "20", color: m.c }}>{m.l}</span></td>
                        <td className="text-right font-semibold">{formatCOP(Number(f.total))}</td>
                        <td className="text-right" style={{ color: Number(f.saldoPendiente) > 0 ? "#dc2626" : "#16a34a" }}>{formatCOP(Number(f.saldoPendiente))}</td>
                        <td className="text-right">
                          <Link href={`/facturacion/${f.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: ERP_COLOR + "18", color: ERP_COLOR }}><Eye size={12} /> Ver</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><FacturacionContent /></Suspense>; }
