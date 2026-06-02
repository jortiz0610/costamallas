"use client";

import { useState, Suspense, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, Search, X, Loader2, Trash2, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";

interface Cotizacion {
  id: string; numero: string; estado: string; total: number; createdAt: string;
  cliente: { nombre: string; empresa?: string };
  vendedor?: { nombre: string };
  _count: { items: number };
}

interface Producto { id: string; sku: string; nombre: string; precioNormal: number | null; stock: number; acfUnidadVenta?: string; }
interface Cliente { id: string; nombre: string; empresa?: string; }

const ESTADOS = [
  { v: "BORRADOR", l: "Borrador", c: "bg-gray-100 text-gray-600" },
  { v: "ENVIADA",  l: "Enviada",  c: "bg-blue-100 text-blue-700" },
  { v: "APROBADA", l: "Aprobada", c: "bg-green-100 text-green-700" },
  { v: "RECHAZADA",l: "Rechazada",c: "bg-red-100 text-red-600" },
  { v: "VENCIDA",  l: "Vencida",  c: "bg-orange-100 text-orange-600" },
];

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS.find(x => x.v === estado);
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${e?.c ?? "bg-gray-100 text-gray-600"}`}>{e?.l ?? estado}</span>;
}

interface Item { productoId?: string; descripcion: string; cantidad: number; precioUnitario: number; descuento: number; unidad: string; stock?: number; }

function NuevaCotizacion({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [clienteId, setClienteId] = useState("");
  const [clienteBusq, setClienteBusq] = useState("");
  const [prodBusq, setProdBusq] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [tieneInstalacion, setTieneInstalacion] = useState(false);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["clientes-search", clienteBusq],
    queryFn: async () => {
      const res = await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`);
      return (await res.json()).data ?? [];
    },
    enabled: clienteBusq.length > 1,
  });

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["productos-cotizador", prodBusq],
    queryFn: async () => {
      const res = await fetch(`/api/productos?busqueda=${encodeURIComponent(prodBusq)}&limit=10`);
      return (await res.json()).data ?? [];
    },
    enabled: prodBusq.length > 1,
  });

  const addProducto = (p: Producto) => {
    setItems(prev => [...prev, {
      productoId: p.id,
      descripcion: p.nombre,
      cantidad: 1,
      precioUnitario: p.precioNormal ?? 0,
      descuento: 0,
      unidad: p.acfUnidadVenta ?? "und",
      stock: p.stock,
    }]);
    setProdBusq("");
  };

  const updateItem = (i: number, k: keyof Item, v: unknown) => {
    setItems(prev => { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n; });
  };

  const IVA = 0.19;
  const subtotal = items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario * (1 - it.descuento / 100), 0);
  const descuentoVal = subtotal * (descuentoGlobal / 100);
  const baseIva = subtotal - descuentoVal;
  const ivaVal = baseIva * IVA;
  const total = baseIva + ivaVal;

  const save = async () => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (!items.length) return toast.error("Agrega al menos un producto");
    setSaving(true);
    try {
      const res = await fetch("/api/crm/cotizaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, items, tieneInstalacion, descuentoGlobal, notas }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success("Cotización creada");
      onSaved();
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  const clienteSeleccionado = clientes.find(c => c.id === clienteId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Nueva Cotización</h2>
            <p className="text-xs text-gray-400 mt-0.5">Selecciona cliente y agrega productos</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cliente */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Cliente *</label>
            {clienteSeleccionado ? (
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{clienteSeleccionado.nombre}</p>
                  {clienteSeleccionado.empresa && <p className="text-xs text-gray-400">{clienteSeleccionado.empresa}</p>}
                </div>
                <button onClick={() => { setClienteId(""); setClienteBusq(""); }} className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente…" />
                {clientes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-10 overflow-hidden">
                    {clientes.map(c => (
                      <button key={c.id} type="button" onClick={() => { setClienteId(c.id); setClienteBusq(""); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                        {c.empresa && <p className="text-xs text-gray-400">{c.empresa}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Buscador de productos */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Agregar producto</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" value={prodBusq} onChange={e => setProdBusq(e.target.value)} placeholder="Buscar por nombre o SKU…" />
              {productos.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-10 overflow-hidden max-h-52 overflow-y-auto">
                  {productos.map(p => (
                    <button key={p.id} type="button" onClick={() => addProducto(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-3">
                      <div>
                        <span className="sku-tag mr-2">{p.sku}</span>
                        <span className="text-sm text-gray-700">{p.nombre}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{p.precioNormal ? formatCOP(p.precioNormal) : "—"}</p>
                        <p className={`text-[10px] ${p.stock > 0 ? "text-green-600" : "text-red-500"}`}>{p.stock} en stock</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-gray-500">Descripción</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-500 w-20">Cant.</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500 w-32">Precio unit.</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-500 w-20">Desc %</th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-500 w-32">Subtotal</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => {
                      const sub = item.cantidad * item.precioUnitario * (1 - item.descuento / 100);
                      return (
                        <tr key={i}>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-800">{item.descripcion}</p>
                            {item.stock !== undefined && <p className={`text-[10px] ${item.stock > 0 ? "text-green-600" : "text-red-500"}`}>{item.stock > 0 ? `✓ ${item.stock} disponibles` : "⚠ Sin stock"}</p>}
                          </td>
                          <td className="px-3 py-2"><input type="number" min="0.01" step="0.01" value={item.cantidad} onChange={e => updateItem(i, "cantidad", parseFloat(e.target.value) || 0)} className="w-full text-center border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-cm-yellow" /></td>
                          <td className="px-3 py-2"><input type="number" min="0" value={item.precioUnitario} onChange={e => updateItem(i, "precioUnitario", parseFloat(e.target.value) || 0)} className="w-full text-right border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-cm-yellow" /></td>
                          <td className="px-3 py-2"><input type="number" min="0" max="100" value={item.descuento} onChange={e => updateItem(i, "descuento", parseFloat(e.target.value) || 0)} className="w-full text-center border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-cm-yellow" /></td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">{formatCOP(sub)}</td>
                          <td className="px-2"><button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span><span className="font-medium text-gray-900">{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Descuento global %</span>
                    <input type="number" min="0" max="100" value={descuentoGlobal} onChange={e => setDescuentoGlobal(parseFloat(e.target.value) || 0)} className="w-16 text-right border border-gray-200 rounded px-2 py-0.5 text-sm outline-none focus:border-cm-yellow" />
                  </div>
                  {descuentoVal > 0 && <div className="flex justify-between text-sm text-red-500"><span>- Descuento</span><span>-{formatCOP(descuentoVal)}</span></div>}
                  <div className="flex justify-between text-sm text-gray-500"><span>IVA 19%</span><span>{formatCOP(ivaVal)}</span></div>
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2"><span>Total</span><span>{formatCOP(total)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Opciones adicionales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Notas</label>
              <textarea className="input resize-none" rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Condiciones, observaciones…" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-700">Incluye instalación</p>
                <p className="text-xs text-gray-400">El pedido requerirá instalación</p>
              </div>
              <button type="button" onClick={() => setTieneInstalacion(v => !v)}
                className={`w-11 h-6 rounded-full relative transition-colors ${tieneInstalacion ? "bg-cm-yellow" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${tieneInstalacion ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-3 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 size={13} className="animate-spin" />}
            Crear cotización
          </button>
        </div>
      </div>
    </div>
  );
}

function CotizacionesContent() {
  const [modal, setModal] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const qc = useQueryClient();

  const { data: cotizaciones = [], isLoading } = useQuery<Cotizacion[]>({
    queryKey: ["crm-cotizaciones", filtroEstado],
    queryFn: async () => {
      const qs = filtroEstado ? `?estado=${filtroEstado}` : "";
      return (await (await fetch(`/api/crm/cotizaciones${qs}`)).json()).data ?? [];
    },
  });

  const cambiarEstado = async (id: string, estado: string) => {
    const res = await fetch(`/api/crm/cotizaciones/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(estado === "APROBADA" ? "✅ Cotización aprobada — Pedido creado automáticamente" : `Estado actualizado a ${estado}`);
      qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] });
    }
  };

  return (
    <>
      <Topbar title="Cotizaciones" actions={
        <button onClick={() => setModal(true)} className="btn-primary btn-sm"><Plus size={14} /> Nueva cotización</button>
      } />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {ESTADOS.map(e => (
            <button key={e.v} onClick={() => setFiltroEstado(filtroEstado === e.v ? "" : e.v)}
              className={`card p-3 text-left transition-all ${filtroEstado === e.v ? "ring-2 ring-gray-900" : "hover:shadow-md"}`}>
              <p className="text-xs text-gray-400">{e.l}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{cotizaciones.filter(c => c.estado === e.v).length}</p>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Cargando…</div>
            ) : cotizaciones.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">Sin cotizaciones</div>
            ) : cotizaciones.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 group">
                <div className="flex-shrink-0">
                  <p className="text-xs font-mono font-bold text-gray-500">{c.numero}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(c.createdAt).toLocaleDateString("es-CO")}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{c.cliente.nombre}</p>
                  {c.cliente.empresa && <p className="text-xs text-gray-400">{c.cliente.empresa}</p>}
                </div>
                <EstadoBadge estado={c.estado} />
                <p className="text-sm font-bold text-gray-900 w-28 text-right">{formatCOP(c.total)}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {c.estado === "BORRADOR" && <button onClick={() => cambiarEstado(c.id, "ENVIADA")} className="btn-secondary btn-sm text-xs">Enviar</button>}
                  {c.estado === "ENVIADA" && <>
                    <button onClick={() => cambiarEstado(c.id, "APROBADA")} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-green-600 transition-colors">Aprobar</button>
                    <button onClick={() => cambiarEstado(c.id, "RECHAZADA")} className="bg-red-100 text-red-600 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-red-200 transition-colors">Rechazar</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {modal && <NuevaCotizacion onClose={() => setModal(false)} onSaved={() => { setModal(false); qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] }); }} />}
    </>
  );
}

export default function Page() { return <Suspense><CotizacionesContent /></Suspense>; }
