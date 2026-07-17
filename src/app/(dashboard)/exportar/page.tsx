"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { FileOutput, Download, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { ProductoListItem } from "@/types";

async function fetchListosExportar(): Promise<ProductoListItem[]> {
  const res = await fetch("/api/productos?estado=LISTO&limit=100&orderBy=updatedAt");
  if (!res.ok) throw new Error("Error");
  const json = await res.json();
  return json.data;
}

export default function ExportarPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<"api" | "csv">("api");

  const { data: productos = [], isLoading, refetch } = useQuery({
    queryKey: ["productos", "listos"],
    queryFn: fetchListosExportar,
  });

  // Estado de la sincronización automática (compuerta "Listo para exportar")
  const [syncing, setSyncing] = useState(false);
  const { data: pend, refetch: refetchPend } = useQuery({
    queryKey: ["sync-pendientes"],
    queryFn: async () => (await (await fetch("/api/cron/sync-woo?dry=1")).json()).data as { pendientes: number; productos: { sku: string; nombre: string }[] },
  });

  const handleSyncAhora = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/cron/sync-woo", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.data?.error ?? json.error ?? "Error al sincronizar"); return; }
      const d = json.data;
      toast.success(`Sincronizados ${d.sincronizados ?? 0} producto(s) a WooCommerce`);
      for (const a of (d.avisos ?? []).slice(0, 3) as { sku: string; aviso: string }[]) {
        toast(`${a.sku}: ${a.aviso}`, { icon: "🖼️", duration: 10000 });
      }
      refetchPend(); refetch();
    } catch { toast.error("Error de conexión"); }
    finally { setSyncing(false); }
  };

  const toggleAll = () => {
    if (selected.size === productos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(productos.map((p) => p.id)));
    }
  };

  const handleExportar = async () => {
    if (!selected.size) return toast.error("Selecciona al menos un producto");
    setLoading(true);

    try {
      const res = await fetch("/api/exportar/woocommerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoIds: [...selected], modo }),
      });

      if (modo === "csv" && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `costamallas-wc-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV generado exitosamente");
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Error en la exportación");
        return;
      }

      const { created, updated, failed, avisos } = json.data;
      toast.success(`Exportación completa: ${created} creados, ${updated} actualizados`);
      if (failed > 0) toast.error(`${failed} productos fallaron`);
      for (const a of (avisos ?? []).slice(0, 3) as { sku: string; aviso: string }[]) {
        toast(`${a.sku}: ${a.aviso}`, { icon: "🖼️", duration: 12000 });
      }
      refetch();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Exportar a WooCommerce" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Sincronización automática (compuerta "Listo para exportar") */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
                <RefreshCw size={15} /> Sincronización automática
              </h2>
              <p className="text-[12px] text-gray-500 mt-1 max-w-xl">
                El CRM es la fuente de verdad: cada 15 minutos se publican a la tienda los productos
                marcados <b>&ldquo;Listo para exportar&rdquo;</b> que hayan cambiado.
                {pend ? <> Pendientes ahora mismo: <b className="text-gray-700">{pend.pendientes}</b>.</> : null}
              </p>
            </div>
            <button onClick={handleSyncAhora} disabled={syncing} className="btn-primary btn-sm flex-shrink-0">
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Sincronizar ahora
            </button>
          </div>
        </div>

        {/* Modo de exportación */}
        <div className="card p-5">
          <h2 className="text-[13px] font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileOutput size={15} /> Modo de exportación
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setModo("api")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${modo === "api" ? "border-cm-yellow bg-cm-yellow/5" : "border-gray-200 hover:border-gray-300"}`}
            >
              <p className="font-semibold text-[13px] text-gray-800">Vía API REST</p>
              <p className="text-[11px] text-gray-500 mt-1">Sincroniza directamente con tu tienda WooCommerce</p>
            </button>
            <button
              onClick={() => setModo("csv")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${modo === "csv" ? "border-cm-yellow bg-cm-yellow/5" : "border-gray-200 hover:border-gray-300"}`}
            >
              <p className="font-semibold text-[13px] text-gray-800">Descargar CSV</p>
              <p className="text-[11px] text-gray-500 mt-1">Genera un CSV compatible con WooCommerce para importar manualmente</p>
            </button>
          </div>
        </div>

        {/* Selección de productos */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-[13px] font-semibold text-gray-800">
              Productos listos ({productos.length})
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-gray-500">{selected.size} seleccionados</span>
              <button onClick={toggleAll} className="btn-secondary btn-sm">
                {selected.size === productos.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
              <button
                onClick={handleExportar}
                disabled={loading || !selected.size}
                className="btn-primary btn-sm"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <FileOutput size={13} />}
                {modo === "csv" ? "Descargar CSV" : "Exportar a WC"}
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 text-center text-[12px] text-gray-400">Cargando…</div>
            ) : !productos.length ? (
              <div className="p-8 text-center">
                <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-gray-600">No hay productos listos para exportar</p>
                <p className="text-[12px] text-gray-400 mt-1">Marca productos como "Listo" desde la vista de productos</p>
              </div>
            ) : (
              productos.map((p) => (
                <label key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      e.target.checked ? next.add(p.id) : next.delete(p.id);
                      setSelected(next);
                    }}
                    className="w-4 h-4 accent-cm-yellow"
                  />
                  <span className="sku-tag">{p.sku}</span>
                  <span className="flex-1 text-[13px] text-gray-700">{p.nombre}</span>
                  <span className="text-[11px] text-gray-400">{p.categorias[0] ?? "—"}</span>
                  {p.wcId && <span className="badge-green badge text-[9px]">En WC</span>}
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
