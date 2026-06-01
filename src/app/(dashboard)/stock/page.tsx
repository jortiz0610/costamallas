"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import { Archive, AlertTriangle } from "lucide-react";
import type { NivelStock } from "@/types";

const stockBadge: Record<NivelStock, string> = {
  OK: "badge-green", ADVERTENCIA: "badge-yellow",
  BAJO: "badge-orange", CRITICO: "badge-red",
};

async function fetchAlertas() {
  const res = await fetch("/api/stock/alertas");
  if (!res.ok) throw new Error("Error");
  return (await res.json()).data;
}

export default function StockPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["stock", "alertas"], queryFn: fetchAlertas, refetchInterval: 60_000 });

  const criticos = data.filter((a: { nivelStock: NivelStock }) => a.nivelStock === "CRITICO").length;
  const bajos = data.filter((a: { nivelStock: NivelStock }) => a.nivelStock === "BAJO").length;

  return (
    <>
      <Topbar title="Control de Stock" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Críticos", value: criticos, cls: "bg-red-50 border-red-200 text-red-700" },
            { label: "Stock bajo", value: bajos, cls: "bg-orange-50 border-orange-200 text-orange-700" },
            { label: "Total alertas", value: data.length, cls: "bg-yellow-50 border-yellow-200 text-yellow-700" },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`p-4 rounded-xl border ${cls}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
              <p className="text-3xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th><th>Producto</th><th>Stock actual</th><th>Stock mínimo</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Cargando…</td></tr>
              ) : !data.length ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <Archive size={24} className="text-green-400 mx-auto mb-2" />
                    <p className="text-[12px] text-gray-400">Todo el stock está en orden</p>
                  </td>
                </tr>
              ) : (
                data.map((a: { id: string; sku: string; nombre: string; stock: number; stockMinimo: number; nivelStock: NivelStock }) => (
                  <tr key={a.id}>
                    <td><span className="sku-tag">{a.sku}</span></td>
                    <td className="font-medium">{a.nombre}</td>
                    <td className="font-bold text-gray-900">{a.stock} ud</td>
                    <td className="text-gray-500">{a.stockMinimo} ud</td>
                    <td><span className={cn("badge", stockBadge[a.nivelStock])}>{a.nivelStock}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
