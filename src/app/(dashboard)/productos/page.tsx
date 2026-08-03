"use client";

// ============================================================
// Catálogo de productos.
//
// El filtro no es solo "buscar": esta pantalla se abre casi siempre con
// una pregunta de trabajo en la cabeza — qué me falta para publicar, qué
// no llegó a la tienda, qué está sin precio. Por eso además de los
// desplegables hay atajos de un clic para esas preguntas.
// ============================================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import Link from "next/link";
import {
  Plus, Search, RefreshCw, Package, X, SlidersHorizontal, ArrowUpDown, ImageOff,
  DollarSign, Globe, Ruler, FileWarning, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
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

/** Atajos de un clic. Cada uno responde a una pregunta real del día. */
const ATAJOS = [
  { k: "sinImagen",     l: "Sin imagen",        Icon: ImageOff,    ayuda: "No se pueden publicar así" },
  { k: "sinPrecio",     l: "Sin precio",        Icon: DollarSign,  ayuda: "Sin precio no se venden" },
  { k: "sinSEO",        l: "Sin SEO",           Icon: FileWarning, ayuda: "Les falta meta título o descripción" },
  { k: "sinFicha",      l: "Sin ficha técnica", Icon: FileWarning, ayuda: "Sin PDF de ficha cargado" },
  { k: "sinTienda",     l: "No están en la tienda", Icon: Globe,   ayuda: "Nunca se sincronizaron con WooCommerce" },
  { k: "aMedida",       l: "A medida",          Icon: Ruler,       ayuda: "Se fabrican con largo y ancho" },
  { k: "listoExportar", l: "Listos para exportar", Icon: CheckCircle2, ayuda: "Marcados como listos" },
] as const;

type ClaveAtajo = (typeof ATAJOS)[number]["k"];

const NIVELES: { v: string; l: string }[] = [
  { v: "", l: "Cualquier stock" },
  { v: "AGOTADO", l: "Agotados" },
  { v: "CRITICO", l: "Críticos" },
  { v: "BAJO", l: "Stock bajo" },
  { v: "ADVERTENCIA", l: "En advertencia" },
  { v: "OK", l: "En orden" },
];

const ORDENES: { v: string; l: string }[] = [
  { v: "updatedAt:desc", l: "Modificados recientemente" },
  { v: "createdAt:desc", l: "Más nuevos primero" },
  { v: "nombre:asc", l: "Nombre A-Z" },
  { v: "sku:asc", l: "SKU A-Z" },
  { v: "precioNormal:desc", l: "Precio, mayor primero" },
  { v: "precioNormal:asc", l: "Precio, menor primero" },
  { v: "stock:asc", l: "Menos stock primero" },
];

interface Catalogo { id: string; valor: string; label: string }

async function fetchProductos(params: Record<string, string>): Promise<{ data: ProductoListItem[]; total: number; totalPages: number }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/productos?${qs}`);
  if (!res.ok) throw new Error("Error al cargar productos");
  return res.json();
}

export default function ProductosPage() {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [categoria, setCategoria] = useState("");
  const [publicado, setPublicado] = useState("");
  const [nivel, setNivel] = useState("");
  const [orden, setOrden] = useState("updatedAt:desc");
  const [atajos, setAtajos] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [refrescando, setRefrescando] = useState(false);

  /** Cualquier cambio de filtro devuelve a la página 1: si no, se queda
   *  en una página que ya no existe y la tabla sale vacía sin explicación. */
  const cambiar = (fn: () => void) => { fn(); setPage(1); };

  const alternarAtajo = (k: ClaveAtajo) =>
    cambiar(() => setAtajos(p => ({ ...p, [k]: !p[k] })));

  const [orderBy, order] = orden.split(":");

  const params: Record<string, string> = { page: String(page), limit: "25", orderBy, order };
  if (busqueda) params.busqueda = busqueda;
  if (estado) params.estado = estado;
  if (categoria) params.categoria = categoria;
  if (publicado) params.publicado = publicado;
  if (nivel) params.nivel = nivel;
  for (const a of ATAJOS) if (atajos[a.k]) params[a.k] = "true";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["productos", params],
    queryFn: () => fetchProductos(params),
    staleTime: 30_000,
  });

  const { data: categorias = [] } = useQuery<Catalogo[]>({
    queryKey: ["catalogo-categorias"],
    queryFn: async () => (await (await fetch("/api/catalogos?tipo=CATEGORIA")).json()).data ?? [],
    staleTime: 300_000,
  });

  const activos = useMemo(
    () => [busqueda, estado, categoria, publicado, nivel].filter(Boolean).length
      + ATAJOS.filter(a => atajos[a.k]).length,
    [busqueda, estado, categoria, publicado, nivel, atajos],
  );

  const limpiar = () => cambiar(() => {
    setBusqueda(""); setEstado(""); setCategoria(""); setPublicado(""); setNivel(""); setAtajos({});
  });

  const refrescar = async () => {
    setRefrescando(true);
    await refetch();
    toast.success("Productos actualizados");
    setTimeout(() => setRefrescando(false), 1500);
  };

  return (
    <>
      <Topbar
        title="Productos"
        actions={
          <>
            <button onClick={refrescar} className="btn-secondary btn-sm">
              <RefreshCw size={12} className={isLoading || refrescando ? "animate-spin" : ""} />
            </button>
            <Link href="/productos/nuevo" className="btn-primary btn-sm">
              <Plus size={14} /> Nuevo producto
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* ── Filtro ── */}
        <div className="card p-4 mb-5 space-y-3">
          <div className="flex flex-wrap gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busqueda}
                onChange={e => cambiar(() => setBusqueda(e.target.value))}
                className="input pl-9"
                placeholder="Buscar por SKU, nombre, marca o categoría…"
              />
              {busqueda && (
                <button onClick={() => cambiar(() => setBusqueda(""))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-red-500">
                  <X size={13} />
                </button>
              )}
            </div>

            <select className="input w-auto" value={categoria} onChange={e => cambiar(() => setCategoria(e.target.value))}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.valor}>{c.label}</option>)}
            </select>

            <select className="input w-auto" value={estado} onChange={e => cambiar(() => setEstado(e.target.value))}>
              <option value="">Todos los estados</option>
              {Object.entries(estadoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <select className="input w-auto" value={publicado} onChange={e => cambiar(() => setPublicado(e.target.value))}>
              <option value="">Publicados y no</option>
              <option value="true">Solo publicados</option>
              <option value="false">Solo no publicados</option>
            </select>

            <select className="input w-auto" value={nivel} onChange={e => cambiar(() => setNivel(e.target.value))}>
              {NIVELES.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
            </select>
          </div>

          {/* Atajos */}
          <div className="flex flex-wrap items-center gap-1.5">
            <SlidersHorizontal size={13} className="text-muted mr-0.5" />
            {ATAJOS.map(a => {
              const Icon = a.Icon;
              const on = Boolean(atajos[a.k]);
              return (
                <button
                  key={a.k}
                  onClick={() => alternarAtajo(a.k)}
                  title={a.ayuda}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all",
                    on ? "text-white" : "surface-3 text-muted hover:brand-bg-10",
                  )}
                  style={on ? { backgroundColor: "var(--brand-color)" } : undefined}
                >
                  <Icon size={11} /> {a.l}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-[12px] text-muted">
              <span>
                <span className="font-bold text-soft">{data?.total ?? "—"}</span> producto{data?.total === 1 ? "" : "s"}
              </span>
              {activos > 0 && (
                <button onClick={limpiar} className="font-semibold flex items-center gap-1" style={{ color: "var(--brand-color)" }}>
                  <X size={11} /> Limpiar {activos} filtro{activos === 1 ? "" : "s"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={12} className="text-muted" />
              <select className="input py-1 text-xs w-auto" value={orden} onChange={e => cambiar(() => setOrden(e.target.value))}>
                {ORDENES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
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
                    <p className="text-[12px] text-gray-400">
                      {activos > 0 ? "Ningún producto cumple estos filtros" : "No se encontraron productos"}
                    </p>
                    {activos > 0 && (
                      <button onClick={limpiar} className="text-[12px] font-semibold mt-2" style={{ color: "var(--brand-color)" }}>
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                data.data.map((p) => (
                  <tr key={p.id}>
                    <td><span className="sku-tag">{p.sku}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        {p.imagenPrincipal ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagenPrincipal} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded surface-3 flex items-center justify-center flex-shrink-0" title="Sin imagen">
                            <ImageOff size={11} className="text-gray-400" />
                          </div>
                        )}
                        <Link href={`/productos/${p.id}`} className="font-medium text-gray-800 dark:text-gray-100 hover:text-cm-yellow-dark transition-colors">
                          {p.nombre}
                        </Link>
                        {p.acfFabricacionMedida && (
                          <span className="badge badge-gray text-[9px] flex items-center gap-1"><Ruler size={9} /> a medida</span>
                        )}
                      </div>
                    </td>
                    <td className="text-gray-500 text-[12px]">{p.categorias[0] ?? "—"}</td>
                    <td className={cn("font-medium", !p.precioNormal && "text-red-500")}>
                      {p.precioNormal ? formatCOP(p.precioNormal) : "sin precio"}
                    </td>
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
            <p className="text-[12px] text-gray-500">Página {page} de {data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">
                ← Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="btn-secondary btn-sm">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
