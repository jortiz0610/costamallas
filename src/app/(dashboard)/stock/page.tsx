"use client";

// ============================================================
// Control de Stock
//
// Antes solo listaba alertas (bajo un umbral fijo de 30 y con tope de 50
// filas), así que no había forma de revisar el inventario completo.
// Ahora trae todo el catálogo con buscador, filtro por nivel y por
// categoría, y edición del stock en la misma tabla.
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import {
  Archive, Check, X, AlertTriangle, TrendingDown, Search,
  PackageX, PackageCheck, ChevronLeft, ChevronRight, Copy, Send,
} from "lucide-react";
import { EnviarANexus } from "@/components/nexus/EnviarANexus";
import { PIE_COSTAMALLAS } from "@/lib/ficha-cliente";
import Link from "next/link";
import type { NivelStock } from "@/types";
import toast from "react-hot-toast";

const stockBadge: Record<NivelStock, string> = {
  OK: "badge-green", ADVERTENCIA: "badge-yellow",
  BAJO: "badge-orange", CRITICO: "badge-red",
};

interface StockItem {
  id: string; sku: string; nombre: string; stock: number; stockMinimo: number;
  nivelStock: NivelStock; agotado: boolean; categorias: string[];
  acfUnidadVenta: string | null; publicado: boolean;
}

interface Resumen {
  total: number; agotados: number; criticos: number; bajos: number;
  ok: number; unidadesTotales: number;
}

const FILTROS_NIVEL = [
  { id: "", etiqueta: "Todos" },
  { id: "AGOTADO", etiqueta: "Agotados" },
  { id: "CRITICO", etiqueta: "Críticos" },
  { id: "BAJO", etiqueta: "Bajos" },
  { id: "ADVERTENCIA", etiqueta: "Advertencia" },
  { id: "OK", etiqueta: "En orden" },
];

export default function StockPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [aNexus, setANexus] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState("");
  const [nivel, setNivel] = useState("");
  const [categoria, setCategoria] = useState("");
  const [orden, setOrden] = useState("stock");
  const [pagina, setPagina] = useState(1);

  // Antirrebote: sin esto cada tecla dispara una consulta a la BD.
  useEffect(() => {
    const t = setTimeout(() => { setQ(busqueda); setPagina(1); }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => { setPagina(1); }, [nivel, categoria, orden]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["stock", { q, nivel, categoria, orden, pagina }],
    queryFn: async () => {
      const p = new URLSearchParams({ orden, pagina: String(pagina) });
      if (q) p.set("q", q);
      if (nivel) p.set("nivel", nivel);
      if (categoria) p.set("categoria", categoria);
      const res = await fetch(`/api/stock?${p}`);
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    // Mantiene la tabla anterior mientras llega la nueva: evita el
    // parpadeo a "vacío" en cada tecleo.
    placeholderData: keepPreviousData,
  });

  const items: StockItem[] = data?.data ?? [];
  const resumen: Resumen | undefined = data?.resumen;
  const pag = data?.paginacion;

  // Las categorías salen de lo que hay en pantalla; el catálogo cabe de
  // sobra en una sola carga, así que no hace falta otro endpoint.
  const { data: catData } = useQuery({
    queryKey: ["stock", "categorias"],
    queryFn: async () => (await (await fetch("/api/stock")).json()),
    staleTime: 300_000,
  });
  const categorias = useMemo(() => {
    const s = new Set<string>();
    (catData?.data ?? []).forEach((p: StockItem) => p.categorias.forEach(c => s.add(c)));
    return [...s].sort();
  }, [catData]);

  const guardarStock = async (id: string) => {
    const nuevoStock = parseInt(editVal, 10);
    if (isNaN(nuevoStock) || nuevoStock < 0) return toast.error("El stock debe ser un número igual o mayor a 0");
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: nuevoStock }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo guardar");
      toast.success("Stock actualizado");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
    } catch { toast.error("Error de conexión"); }
  };

  const hayFiltro = Boolean(q || nivel || categoria);

  /**
   * La disponibilidad de lo que está en pantalla, en texto.
   *
   * Es la pregunta que más llega al chat —"¿tienen de esto?"— y hasta
   * ahora se contestaba mirando la tabla y escribiendo a mano, producto
   * por producto. Solo salen los que TIENEN existencias: mandarle a un
   * cliente una lista con ceros no ayuda a nadie.
   */
  const textoDisponibilidad = useMemo(() => {
    const conStock = items.filter(i => i.stock > 0);
    if (conStock.length === 0) return "";
    const lineas = conStock.map(i =>
      `• ${i.nombre} — ${i.stock}${i.acfUnidadVenta ? " " + i.acfUnidadVenta : ""} disponibles`,
    );
    return [
      "*Disponibilidad actual*",
      "",
      ...lineas,
      "",
      PIE_COSTAMALLAS,
    ].join("\n");
  }, [items]);

  const copiarDisponibilidad = async () => {
    if (!textoDisponibilidad) return toast.error("Nada con existencias en esta vista");
    try {
      await navigator.clipboard.writeText(textoDisponibilidad);
      toast.success(`${items.filter(i => i.stock > 0).length} productos copiados`);
    } catch { toast.error("El navegador no dejó copiar"); }
  };

  return (
    <>
      <Topbar
        title="Control de Stock"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={copiarDisponibilidad} disabled={!textoDisponibilidad} className="btn-secondary btn-sm disabled:opacity-40"
              title="Copiar en texto lo que hay disponible en esta vista">
              <Copy size={12} /> Copiar disponibilidad
            </button>
            <button onClick={() => setANexus(textoDisponibilidad)} disabled={!textoDisponibilidad} className="btn-secondary btn-sm disabled:opacity-40"
              title="Mandar la disponibilidad a un chat de Nexus">
              <Send size={12} /> A un chat
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto page-bg p-4 sm:p-6 space-y-5">
        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Agotados", value: resumen?.agotados, color: "#dc2626", Icon: PackageX, filtro: "AGOTADO" },
            { label: "Críticos", value: resumen?.criticos, color: "#ea580c", Icon: AlertTriangle, filtro: "CRITICO" },
            { label: "Stock bajo", value: resumen?.bajos, color: "#d97706", Icon: TrendingDown, filtro: "BAJO" },
            { label: "En orden", value: resumen?.ok, color: "#16a34a", Icon: PackageCheck, filtro: "OK" },
          ].map(({ label, value, color, Icon, filtro }) => (
            <button
              key={label}
              onClick={() => setNivel(nivel === filtro ? "" : filtro)}
              className={cn(
                "card p-4 flex items-center gap-3 sm:gap-4 text-left transition-all hover:shadow-md",
                nivel === filtro && "ring-2",
              )}
              style={{ borderLeft: `3px solid ${color}`, ...(nivel === filtro ? { "--tw-ring-color": color } as React.CSSProperties : {}) }}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted truncate">{label}</p>
                <p className="text-2xl sm:text-3xl font-bold mt-0.5" style={{ color }}>{value ?? "—"}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Buscador y filtros */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                className="input pl-9"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por SKU, nombre o marca…"
              />
              {busqueda && (
                <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-soft" aria-label="Limpiar búsqueda">
                  <X size={14} />
                </button>
              )}
            </div>
            <select className="input sm:w-52" value={categoria} onChange={e => setCategoria(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input sm:w-44" value={orden} onChange={e => setOrden(e.target.value)}>
              <option value="stock">Menor stock primero</option>
              <option value="nombre">Nombre (A–Z)</option>
              <option value="sku">SKU (A–Z)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTROS_NIVEL.map(f => (
              <button
                key={f.id}
                onClick={() => setNivel(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
                  nivel === f.id ? "text-white" : "surface-2 text-soft hover:brand-bg-10",
                )}
                style={nivel === f.id ? { backgroundColor: "var(--brand-color)" } : undefined}
              >
                {f.etiqueta}
              </button>
            ))}
            {hayFiltro && (
              <button
                onClick={() => { setBusqueda(""); setNivel(""); setCategoria(""); }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 ml-auto"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {pag && (
            <p className="text-[11px] text-muted">
              {pag.totalFiltrado === 0
                ? "Ningún producto coincide"
                : `${pag.totalFiltrado} producto${pag.totalFiltrado > 1 ? "s" : ""}`}
              {resumen && !hayFiltro && ` · ${resumen.unidadesTotales.toLocaleString("es-CO")} unidades en total`}
              {isFetching && " · actualizando…"}
            </p>
          )}
        </div>

        {/* Tabla */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Stock <span className="text-[10px] font-normal text-gray-400">(clic para editar)</span></th>
                <th className="hidden sm:table-cell">Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Cargando…</td></tr>
              ) : !items.length ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <Archive size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-[12px] text-gray-400">
                      {hayFiltro ? "Ningún producto coincide con el filtro" : "No hay productos en el catálogo"}
                    </p>
                  </td>
                </tr>
              ) : (
                items.map(a => (
                  <tr key={a.id} className="group">
                    <td><span className="sku-tag">{a.sku}</span></td>
                    <td className="font-medium">
                      <Link href={`/productos/${a.id}`} className="hover:underline">{a.nombre}</Link>
                      {!a.publicado && <span className="ml-2 badge badge-gray text-[9px]">sin publicar</span>}
                    </td>
                    <td>
                      {editId === a.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") guardarStock(a.id); if (e.key === "Escape") setEditId(null); }}
                            className="input w-20 py-1 text-[12px]"
                          />
                          <button onClick={() => guardarStock(a.id)} className="text-green-500 hover:text-green-600" aria-label="Guardar"><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cancelar"><X size={14} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(a.id); setEditVal(String(a.stock)); }}
                          className={cn(
                            "font-bold px-2 py-0.5 rounded cursor-pointer hover:surface-2",
                            a.agotado ? "text-red-600" : "text-gray-900 dark:text-gray-100",
                          )}
                        >
                          {a.stock} {a.acfUnidadVenta ?? "ud"}
                        </button>
                      )}
                    </td>
                    <td className="text-gray-500 hidden sm:table-cell">{a.stockMinimo}</td>
                    <td>
                      <span className={cn("badge", a.agotado ? "badge-red" : stockBadge[a.nivelStock])}>
                        {a.agotado ? "AGOTADO" : a.nivelStock}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pag && pag.totalPaginas > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-[12px] text-muted px-2">Página {pag.pagina} de {pag.totalPaginas}</span>
            <button
              onClick={() => setPagina(p => Math.min(pag.totalPaginas, p + 1))}
              disabled={pagina >= pag.totalPaginas}
              className="btn-secondary btn-sm disabled:opacity-40"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      {aNexus && (
        <EnviarANexus
          contenido={aNexus}
          titulo="Mandar la disponibilidad a un chat"
          onClose={() => setANexus(null)}
        />
      )}
    </>
  );
}
