"use client";

// ============================================================
// Ficha del proveedor: qué le compramos y en qué condiciones.
//
// El autoarmado de órdenes se apoya en estos vínculos: si un producto
// no está aquí, nunca entrará en un pedido automático aunque esté bajo
// mínimos. Por eso la ficha muestra cuáles están bajo mínimo ahora.
// ============================================================

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Loader2, Plus, Trash2, Star, Search, Package, Factory, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP, cn } from "@/lib/utils";

const ERP_COLOR = "#185FA5";

export interface ProveedorFicha {
  id: string; nombre: string; email?: string | null; esPropio?: boolean;
}

interface Vinculo {
  productoId: string;
  referencia: string | null;
  precioCompra: number | null;
  minimoPedido: number | null;
  leadTimeDias: number | null;
  preferido: boolean;
  bajoMinimo: boolean;
  producto: { id: string; sku: string; nombre: string; stock: number; stockMinimo: number };
}

interface ProductoBusqueda { id: string; sku: string; nombre: string; }

export function FichaProveedor({ proveedor, onClose }: { proveedor: ProveedorFicha; onClose: () => void }) {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState<ProductoBusqueda | null>(null);
  const [form, setForm] = useState({ referencia: "", precioCompra: "", minimoPedido: "", leadTimeDias: "", preferido: false });
  const [guardando, setGuardando] = useState(false);
  const [esPropio, setEsPropio] = useState(Boolean(proveedor.esPropio));

  const { data: vinculos = [], isLoading } = useQuery<Vinculo[]>({
    queryKey: ["proveedor-productos", proveedor.id],
    queryFn: async () => (await (await fetch(`/api/compras/proveedores/${proveedor.id}/productos`)).json()).data ?? [],
  });

  const { data: resultados = [] } = useQuery<ProductoBusqueda[]>({
    queryKey: ["buscar-producto", busqueda],
    enabled: busqueda.trim().length >= 2,
    queryFn: async () =>
      (await (await fetch(`/api/productos?busqueda=${encodeURIComponent(busqueda)}&limit=8`)).json()).data ?? [],
  });

  const yaVinculado = new Set(vinculos.map(v => v.productoId));

  const agregar = async () => {
    if (!nuevo) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/compras/proveedores/${proveedor.id}/productos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId: nuevo.id, ...form }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success(`${nuevo.sku} asignado a ${proveedor.nombre}`);
      setNuevo(null); setBusqueda("");
      setForm({ referencia: "", precioCompra: "", minimoPedido: "", leadTimeDias: "", preferido: false });
      qc.invalidateQueries({ queryKey: ["proveedor-productos", proveedor.id] });
    } finally { setGuardando(false); }
  };

  const quitar = async (v: Vinculo) => {
    if (!confirm(`¿Quitar ${v.producto.sku} de ${proveedor.nombre}?`)) return;
    await fetch(`/api/compras/proveedores/${proveedor.id}/productos?productoId=${v.productoId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["proveedor-productos", proveedor.id] });
    toast.success("Producto retirado");
  };

  const marcarPreferido = async (v: Vinculo) => {
    await fetch(`/api/compras/proveedores/${proveedor.id}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoId: v.productoId, referencia: v.referencia, precioCompra: v.precioCompra,
        minimoPedido: v.minimoPedido, leadTimeDias: v.leadTimeDias, preferido: !v.preferido,
      }),
    });
    qc.invalidateQueries({ queryKey: ["proveedor-productos", proveedor.id] });
  };

  const cambiarPropio = async (valor: boolean) => {
    setEsPropio(valor);
    const res = await fetch("/api/compras/proveedores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proveedor.id, esPropio: valor }),
    });
    if (!res.ok) { setEsPropio(!valor); return toast.error("No se pudo cambiar"); }
    toast.success(valor ? "Marcado como fabricación propia" : "Vuelve a contar como proveedor externo");
    qc.invalidateQueries({ queryKey: ["proveedores"] });
    qc.invalidateQueries({ queryKey: ["productos-reabastecer"] });
  };

  const bajoMinimo = vinculos.filter(v => v.bajoMinimo).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-3xl my-4 animate-fade-up">
        <div className="card-header">
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Package size={16} style={{ color: ERP_COLOR }} /> {proveedor.nombre}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {vinculos.length} producto{vinculos.length === 1 ? "" : "s"} asignado{vinculos.length === 1 ? "" : "s"}
              {bajoMinimo > 0 && <span className="text-red-500 font-semibold"> · {bajoMinimo} bajo mínimo</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Fabricación propia */}
          <label className="flex items-start gap-3 p-3 rounded-xl surface-2 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={esPropio} onChange={e => cambiarPropio(e.target.checked)} />
            <div className="flex-1">
              <p className="text-xs font-semibold text-soft flex items-center gap-1.5"><Factory size={12} /> Fabricación propia</p>
              <p className="text-[11px] text-muted mt-0.5">
                Lo que Costamallas fabrica no se le compra a nadie: sus productos siguen apareciendo en Stock,
                pero dejan de contarse como &quot;por reabastecer&quot; y no se le pueden hacer órdenes de compra.
              </p>
            </div>
          </label>

          {esPropio && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle size={13} /> A un proveedor de fabricación propia no se le envían órdenes de compra.
            </div>
          )}

          {/* Productos asignados */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Productos que provee</p>
            {isLoading ? (
              <div className="p-6 text-center"><Loader2 size={16} className="animate-spin mx-auto" style={{ color: ERP_COLOR }} /></div>
            ) : vinculos.length === 0 ? (
              <div className="p-6 text-center surface-2 rounded-xl">
                <p className="text-xs text-muted">Todavía no tiene productos asignados.</p>
                <p className="text-[11px] text-muted mt-1">Sin esto, el pedido automático no encuentra qué comprarle.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {vinculos.map(v => (
                  <div key={v.productoId} className="flex items-center gap-3 p-2.5 rounded-xl surface-2">
                    <button
                      onClick={() => marcarPreferido(v)}
                      title={v.preferido ? "Proveedor preferido para este producto" : "Marcar como preferido"}
                      className="flex-shrink-0"
                    >
                      <Star size={14} className={v.preferido ? "text-amber-400 fill-amber-400" : "text-muted"} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-soft truncate">{v.producto.nombre}</p>
                      <p className="text-[10px] text-muted font-mono">
                        {v.producto.sku}
                        {v.referencia && <span className="ml-2">· ref. proveedor: {v.referencia}</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-soft">{v.precioCompra ? formatCOP(v.precioCompra) : "—"}</p>
                      <p className={cn("text-[10px]", v.bajoMinimo ? "text-red-500 font-bold" : "text-muted")}>
                        {v.producto.stock}/{v.producto.stockMinimo}
                        {v.minimoPedido ? ` · mín. pedido ${v.minimoPedido}` : ""}
                      </p>
                    </div>
                    <button onClick={() => quitar(v)} className="text-muted hover:text-red-500 flex-shrink-0"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agregar producto */}
          <div className="pt-4 border-t divider">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Asignar un producto</p>

            {!nuevo ? (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-9 py-1.5 text-xs"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar producto por nombre o SKU…"
                />
                {resultados.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 card p-1 max-h-52 overflow-y-auto">
                    {resultados.map(p => {
                      const puesto = yaVinculado.has(p.id);
                      return (
                        <button
                          key={p.id}
                          disabled={puesto}
                          onClick={() => { setNuevo(p); setBusqueda(""); }}
                          className="w-full text-left p-2 rounded-lg hover:brand-bg-10 disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <p className="text-xs font-semibold text-soft truncate">{p.nombre}</p>
                          <p className="text-[10px] text-muted font-mono">{p.sku}{puesto && " · ya asignado"}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2.5 rounded-xl surface-2">
                  <Package size={14} style={{ color: ERP_COLOR }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-soft truncate">{nuevo.nombre}</p>
                    <p className="text-[10px] text-muted font-mono">{nuevo.sku}</p>
                  </div>
                  <button onClick={() => setNuevo(null)} className="text-muted"><X size={13} /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase mb-1">Ref. proveedor</label>
                    <input className="input py-1.5 text-xs" value={form.referencia} onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))} placeholder="A-1024" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase mb-1">Precio compra</label>
                    <input type="number" className="input py-1.5 text-xs" value={form.precioCompra} onChange={e => setForm(p => ({ ...p, precioCompra: e.target.value }))} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase mb-1">Mín. pedido</label>
                    <input type="number" className="input py-1.5 text-xs" value={form.minimoPedido} onChange={e => setForm(p => ({ ...p, minimoPedido: e.target.value }))} placeholder="1" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted uppercase mb-1">Lead time (días)</label>
                    <input type="number" className="input py-1.5 text-xs" value={form.leadTimeDias} onChange={e => setForm(p => ({ ...p, leadTimeDias: e.target.value }))} placeholder="15" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-soft">
                  <input type="checkbox" checked={form.preferido} onChange={e => setForm(p => ({ ...p, preferido: e.target.checked }))} />
                  Proveedor preferido para este producto
                </label>
                <button onClick={agregar} disabled={guardando} className="btn-primary w-full justify-center">
                  {guardando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Asignar producto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
