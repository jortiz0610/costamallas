"use client";

import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Download, RefreshCw, CheckCircle, Loader2, Package, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";

interface WCPreview {
  wcId: number;
  sku: string;
  nombre: string;
  tipo: string;
  estado: string;
  precioNormal: string;
  stock: number | null;
  categorias: string[];
  imagen: string | null;
  yaImportado: boolean;
}

async function fetchPreview(): Promise<WCPreview[]> {
  const res = await fetch("/api/woocommerce/import");
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error ?? "Error al cargar productos");
  }
  const json = await res.json();
  return json.data;
}

function ImportarContent() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "nuevos" | "importados">("todos");

  const { data: productos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["wc-preview"],
    queryFn: fetchPreview,
  });

  const productosFiltrados = productos.filter((p) => {
    if (filtro === "nuevos") return !p.yaImportado;
    if (filtro === "importados") return p.yaImportado;
    return true;
  });

  const toggleAll = () => {
    const ids = productosFiltrados.map((p) => p.wcId);
    if (ids.every((id) => selected.has(id))) {
      setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
    }
  };

  const handleImportar = async () => {
    if (!selected.size) return toast.error("Selecciona al menos un producto");
    setLoading(true);
    try {
      const res = await fetch("/api/woocommerce/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wcIds: [...selected] }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error en la importación");
      const { creados, actualizados, errores } = json.data;
      toast.success(`${creados} creados, ${actualizados} actualizados`);
      if (errores > 0) {
        const primerError = json.data.detallesError?.[0];
        toast.error(primerError ? `Error: ${primerError.error}` : `${errores} productos fallaron`);
      }
      setSelected(new Set());
      refetch();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Importar desde WooCommerce" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total en WooCommerce", value: productos.length, color: "text-gray-800" },
            { label: "Nuevos (sin importar)", value: productos.filter((p) => !p.yaImportado).length, color: "text-blue-600" },
            { label: "Ya importados", value: productos.filter((p) => p.yaImportado).length, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-[11px] text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{isLoading ? "—" : s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-gray-800">Productos WooCommerce</h2>
              <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600">
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              {/* Filtros */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[11px]">
                {(["todos", "nuevos", "importados"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`px-3 py-1.5 capitalize transition-colors ${filtro === f ? "bg-cm-yellow text-cm-black font-medium" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="text-[12px] text-gray-500">{selected.size} seleccionados</span>
              <button onClick={toggleAll} className="btn-secondary btn-sm">
                {productosFiltrados.every((p) => selected.has(p.wcId)) ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
              <button onClick={handleImportar} disabled={loading || !selected.size} className="btn-primary btn-sm">
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Importar seleccionados
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 text-center text-[12px] text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Cargando productos de WooCommerce…
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-gray-600">Error al conectar con WooCommerce</p>
                <p className="text-[12px] text-gray-400 mt-1">{(error as Error).message}</p>
                <p className="text-[11px] text-gray-400 mt-2">Verifica las credenciales en Configuración</p>
              </div>
            ) : !productosFiltrados.length ? (
              <div className="p-8 text-center">
                <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-gray-600">
                  {filtro === "nuevos" ? "No hay productos nuevos para importar" : "No hay productos"}
                </p>
              </div>
            ) : (
              productosFiltrados.map((p) => (
                <label key={p.wcId} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(p.wcId)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      e.target.checked ? next.add(p.wcId) : next.delete(p.wcId);
                      setSelected(next);
                    }}
                    className="w-4 h-4 accent-cm-yellow"
                  />
                  {p.imagen ? (
                    <Image src={p.imagen} alt={p.nombre} width={36} height={36} className="rounded object-cover bg-gray-100" unoptimized />
                  ) : (
                    <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center">
                      <Package size={14} className="text-gray-400" />
                    </div>
                  )}
                  <span className="sku-tag">{p.sku || `ID:${p.wcId}`}</span>
                  <span className="flex-1 text-[13px] text-gray-700">{p.nombre}</span>
                  <span className="text-[11px] text-gray-400">{p.categorias[0] ?? "—"}</span>
                  <span className="text-[11px] text-gray-500">{p.precioNormal ? `$${p.precioNormal}` : "—"}</span>
                  {p.yaImportado ? (
                    <span className="badge badge-green text-[9px]">Importado</span>
                  ) : (
                    <span className="badge badge-blue text-[9px]">Nuevo</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ImportarPage() {
  return (
    <Suspense>
      <ImportarContent />
    </Suspense>
  );
}
