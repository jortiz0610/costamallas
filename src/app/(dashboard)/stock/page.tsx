"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import { Archive, Check, X } from "lucide-react";
import Link from "next/link";
import type { NivelStock } from "@/types";
import toast from "react-hot-toast";

const stockBadge: Record<NivelStock, string> = {
  OK: "badge-green", ADVERTENCIA: "badge-yellow",
  BAJO: "badge-orange", CRITICO: "badge-red",
};

async function fetchAlertas() {
  const res = await fetch("/api/stock/alertas");
  if (!res.ok) throw new Error("Error");
  return (await res.json()).data;
}

type StockItem = { id: string; sku: string; nombre: string; stock: number; stockMinimo: number; nivelStock: NivelStock };

export default function StockPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const { data = [], isLoading } = useQuery({ queryKey: ["stock", "alertas"], queryFn: fetchAlertas, refetchInterval: 60_000 });

  const criticos = data.filter((a: StockItem) => a.nivelStock === "CRITICO").length;
  const bajos = data.filter((a: StockItem) => a.nivelStock === "BAJO").length;

  const handleSaveStock = async (id: string) => {
    const nuevoStock = parseInt(editVal);
    if (isNaN(nuevoStock) || nuevoStock < 0) return toast.error("Valor inválido");
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: nuevoStock }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success("Stock actualizado");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
    } catch { toast.error("Error de conexión"); }
  };

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
                <th>SKU</th><th>Producto</th>
                <th>Stock actual <span className="text-[10px] font-normal text-gray-400">(click para editar)</span></th>
                <th>Stock mínimo</th><th>Estado</th>
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
                data.map((a: StockItem) => (
                  <tr key={a.id} className="group">
                    <td><span className="sku-tag">{a.sku}</span></td>
                    <td className="font-medium">
                      <Link href={`/productos/${a.id}`} className="hover:text-cm-black hover:underline">
                        {a.nombre}
                      </Link>
                    </td>
                    <td>
                      {editId === a.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveStock(a.id); if (e.key === "Escape") setEditId(null); }}
                            className="input w-20 py-1 text-[12px]"
                          />
                          <button onClick={() => handleSaveStock(a.id)} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(a.id); setEditVal(String(a.stock)); }}
                          className="font-bold text-gray-900 hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer"
                        >
                          {a.stock} ud
                        </button>
                      )}
                    </td>
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
