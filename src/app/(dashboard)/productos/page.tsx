"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import Link from "next/link";
import { Plus, Search, Filter, RefreshCw, Package } from "lucide-react";
import { formatCOP, cn } from "@/lib/utils";
import type { ProductoListItem, NivelStock, EstadoProducto } from "@/types";

const estadoBadge: Record<EstadoProducto, string> = {
  BORRADOR:  "badge-gray",
  REVISION:  "badge-blue",
  LISTO:     "badge-green",
  PUBLICADO: "badge-green",
  ARCHIVADO: "badge-gray",
};

const estadoLabel: Record<EstadoProducto, string> = {
  BORRADOR:  "Borrador",
  REVISION:  "En revisión",
  LISTO:     "Listo",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};

const stockBadge: Record<NivelStock, string> = {
  OK: "badge-green", ADVERTENCIA: "badge-yellow",
  BAJO: "badge-orange", CRITICO: "badge-red",
};

async function fetchProductos(params: Record<string, string>): Promise<{ data: ProductoListItem[]; total: number; totalPages: number }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/productos?${qs}`);
  if (!res.ok) throw new Error("Error al cargar productos");
  return res.json();
}

export default function ProductosPage() {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), limit: "25" };
  if (busqueda) params.busqueda = busqueda;
  if (estado) params.estado = estado;

  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["productos", params],
    queryFn: () => fetchProductos(params),
    staleTime: 30_000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 2200);
  };

  return (
    <>
      <Topbar
        title="Productos"
        actions={
          <>
            <button onClick={handleRefresh} className={`btn-secondary btn-sm transition-all ${refreshing ? "animate-refresh-success" : ""}`}>
              <RefreshCw size={12} className={isLoading ? "animate-spin" : refreshing ? "animate-spin-once" : ""} />
            </button>
            <Link href="/productos/nuevo" className="btn-primary btn-sm">
              <Plus size={14} /> Nuevo producto
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
              className="input pl-9"
              placeholder="Buscar por SKU, nombre, marca…"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setPage(1); }}
            className="input w-44"
          >
            <option value="">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="REVISION">En revisión</option>
            <option value="LISTO">Listo</option>
            <option value="PUBLICADO">Publicado</option>
          </select>
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <span className="font-medium text-gray-800">{data?.total ?? "—"}</span> productos
          </div>
        </div>

        {/* Tabla */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>WC</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Cargando…</td></tr>
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Package size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-[12px] text-gray-400">No se encontraron productos</p>
                  </td>
                </tr>
              ) : (
                data.data.map((p) => (
                  <tr key={p.id}>
                    <td><span className="sku-tag">{p.sku}</span></td>
                    <td>
                      <Link href={`/productos/${p.id}`} className="font-medium text-gray-800 hover:text-cm-yellow-dark transition-colors">
                        {p.nombre}
                      </Link>
                    </td>
                    <td className="text-gray-500 text-[12px]">{p.categorias[0] ?? "—"}</td>
                    <td className="font-medium">{formatCOP(p.precioNormal)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>{p.stock}</span>
                        <span className={cn("badge text-[9px]", stockBadge[p.nivelStock])}>
                          {p.nivelStock}
                        </span>
                      </div>
                    </td>
                    <td><span className={cn("badge", estadoBadge[p.intEstado])}>{estadoLabel[p.intEstado]}</span></td>
                    <td>
                      {p.wcId
                        ? <span className="badge-green badge">Sync</span>
                        : <span className="badge-gray badge">—</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[12px] text-gray-500">
              Página {page} de {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">
                ← Anterior
              </button>
              <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="btn-secondary btn-sm">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
