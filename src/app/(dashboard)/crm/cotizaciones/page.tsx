"use client";
import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, Search, X, Loader2, Trash2, FileText, ExternalLink, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";

interface Cotizacion {
  id: string; numero: string; estado: string; total: number; createdAt: string;
  cliente: { nombre: string; empresa?: string };
  vendedor?: { nombre: string };
  _count: { items: number };
}
interface Producto { id: string; sku: string; nombre: string; precioNormal: number | null; stock: number; acfUnidadVenta?: string; }
interface Cliente { id: string; nombre: string; empresa?: string; }
interface Item { productoId?: string; descripcion: string; cantidad: number; precioUnitario: number; descuento: number; unidad: string; stock?: number; }

const CRM_COLOR = "#BA7517";
const ESTADOS = [
  { v: "BORRADOR",  l: "Borrador",  bg: "#f1f5f9", text: "#6b7280" },
  { v: "ENVIADA",   l: "Enviada",   bg: "#dbeafe", text: "#1d4ed8" },
  { v: "APROBADA",  l: "Aprobada",  bg: "#d1fae5", text: "#065f46" },
  { v: "RECHAZADA", l: "Rechazada", bg: "#fee2e2", text: "#b91c1c" },
  { v: "VENCIDA",   l: "Vencida",   bg: "#fef3c7", text: "#92400e" },
];
function Badge({ estado }: { estado: string }) {
  const e = ESTADOS.find(x => x.v === estado);
  return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: e?.bg ?? "#f1f5f9", color: e?.text ?? "#6b7280" }}>{e?.l ?? estado}</span>;
}

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
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`)).json()).data ?? [],
    enabled: clienteBusq.length > 1,
  });
  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["productos-cotizador", prodBusq],
    queryFn: async () => (await (await fetch(`/api/productos?busqueda=${encodeURIComponent(prodBusq)}&limit=10`)).json()).data ?? [],
    enabled: prodBusq.length > 1,
  });
  const addProducto = (p: Producto) => {
    setItems(prev => [...prev, { productoId: p.id, descripcion: p.nombre, cantidad: 1, precioUnitario: p.precioNormal ?? 0, descuento: 0, unidad: p.acfUnidadVenta ?? "und", stock: p.stock }]);
    setProdBusq("");
  };
  const upd = (i: number, k: keyof Item, v: unknown) => setItems(prev => { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n; });
  const IVA = 0.19;
  const subtotal = items.reduce((a, it) => a + it.cantidad * it.precioUnitario * (1 - it.descuento / 100), 0);
  const dv = subtotal * (descuentoGlobal / 100);
  const base = subtotal - dv;
  const total = base + base * IVA;
  const save = async () => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (!items.length) return toast.error("Agrega al menos un producto");
    setSaving(true);
    try {
      const res = await fetch("/api/crm/cotizaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId, items, tieneInstalacion, descuentoGlobal, notas }) });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success("Cotizacion creada"); onSaved();
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };
  const clienteSeleccionado = clientes.find(c => c.id === clienteId);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl my-4 border border-gray-100 dark:border-gray-800">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: CRM_COLOR + "20" }}><FileText size={16} style={{ color: CRM_COLOR }} /></div>
            <div><h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Nueva Cotizacion</h2><p className="text-xs text-gray-400 mt-0.5">Selecciona cliente y productos</p></div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Cliente *</label>
            {clienteSeleccionado ? (
              <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: CRM_COLOR + "10", border: `1px solid ${CRM_COLOR}40` }}>
                <div><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{clienteSeleccionado.nombre}</p>{clienteSeleccionado.empresa && <p className="text-xs text-gray-400">{clienteSeleccionado.empresa}</p>}</div>
                <button onClick={() => { setClienteId(""); setClienteBusq(""); }} className="text-gray-400 hover:text-red-500"><X size={13} /></button>
              </div>
            ) : (
              <div className="relative">
                <input className="input" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente..." />
                {clientes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl z-10 overflow-hidden">
                    {clientes.map(c => <button key={c.id} type="button" onClick={() => { setClienteId(c.id); setClienteBusq(""); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800"><p className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.nombre}</p>{c.empresa && <p className="text-xs text-gray-400">{c.empresa}</p>}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Agregar producto</label>
            <div className="relative">
              <input className="input" value={prodBusq} onChange={e => setProdBusq(e.target.value)} placeholder="Buscar por nombre o SKU..." />
              {productos.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl z-10 overflow-hidden max-h-52 overflow-y-auto">
                  {productos.map(p => (
                    <button key={p.id} type="button" onClick={() => addProducto(p)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{p.sku} - {p.nombre}</span>
                      <div className="text-right flex-shrink-0"><p className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.precioNormal ? formatCOP(p.precioNormal) : "-"}</p><p className={`text-[10px] ${p.stock > 0 ? "text-green-600" : "text-red-500"}`}>{p.stock} stock</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <tr><th className="text-left px-4 py-2 text-gray-500">Descripcion</th><th className="text-center px-3 py-2 text-gray-500 w-20">Cant.</th><th className="text-right px-3 py-2 text-gray-500 w-32">Precio</th><th className="text-center px-3 py-2 text-gray-500 w-20">Desc%</th><th className="text-right px-3 py-2 text-gray-500 w-32">Subtotal</th><th className="w-8"></th></tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const sub = it.cantidad * it.precioUnitario * (1 - it.descuento / 100);
                    return (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{it.descripcion}</td>
                        <td className="px-3 py-2"><input type="number" min="0.01" step="0.01" value={it.cantidad} onChange={e => upd(i,"cantidad",parseFloat(e.target.value)||0)} className="w-full text-center border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none" /></td>
                        <td className="px-3 py-2"><input type="number" min="0" value={it.precioUnitario} onChange={e => upd(i,"precioUnitario",parseFloat(e.target.value)||0)} className="w-full text-right border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none" /></td>
                        <td className="px-3 py-2"><input type="number" min="0" max="100" value={it.descuento} onChange={e => upd(i,"descuento",parseFloat(e.target.value)||0)} className="w-full text-center border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none" /></td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">{formatCOP(sub)}</td>
                        <td className="px-2"><button onClick={() => setItems(prev => prev.filter((_,j)=>j!==i))} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-4 flex justify-end">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span className="font-medium text-gray-800 dark:text-gray-200">{formatCOP(subtotal)}</span></div>
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400"><span>Descuento %</span><input type="number" min="0" max="100" value={descuentoGlobal} onChange={e => setDescuentoGlobal(parseFloat(e.target.value)||0)} className="w-16 text-right border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none" /></div>
                  {dv > 0 && <div className="flex justify-between text-red-500"><span>- Descuento</span><span>-{formatCOP(dv)}</span></div>}
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>IVA 19%</span><span>{formatCOP(base * IVA)}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 border-t border-gray-100 dark:border-gray-700 pt-2"><span>Total</span><span style={{ color: CRM_COLOR }}>{formatCOP(total)}</span></div>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
            <div><p className="text-sm font-semibold text-gray-700">Incluye instalacion</p><p className="text-xs text-gray-400">El pedido requerira instalacion</p></div>
            <button type="button" onClick={() => setTieneInstalacion(v => !v)} className="w-11 h-6 rounded-full relative transition-all" style={{ backgroundColor: tieneInstalacion ? CRM_COLOR : "#d1d5db" }}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${tieneInstalacion ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div><label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Notas</label><textarea className="input resize-none" rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Condiciones, observaciones..." /></div>
        </div>
        <div className="p-5 pt-0 flex gap-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
            {saving && <Loader2 size={13} className="animate-spin" />} Crear cotizacion
          </button>
        </div>
      </div>
    </div>
  );
}

function CotizacionesContent() {
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
    const res = await fetch(`/api/crm/cotizaciones/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    const json = await res.json();
    if (json.success) { toast.success(estado === "APROBADA" ? "Aprobada - Pedido creado" : `-> ${estado}`); qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] }); }
  };
  return (
    <>
      <Topbar title="Cotizaciones" actions={
        <Link href="/crm/cotizaciones/nueva" className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: CRM_COLOR }}>
          <Plus size={13} /> Nueva cotización
        </Link>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">
        <div className="grid grid-cols-5 gap-3">
          {ESTADOS.map(e => {
            const count = cotizaciones.filter(c => c.estado === e.v).length;
            const activo = filtroEstado === e.v;
            return (
              <button key={e.v} onClick={() => setFiltroEstado(activo ? "" : e.v)}
                className="card p-3 text-left transition-all hover:shadow-md"
                style={activo ? { backgroundColor: e.bg, borderColor: e.text + "60" } : {}}>
                <p className="text-xs text-gray-400">{e.l}</p>
                <p className="text-xl font-bold mt-0.5 text-gray-800 dark:text-gray-100" style={{ color: activo ? e.text : undefined }}>{count}</p>
              </button>
            );
          })}
        </div>
        <div className="card overflow-hidden">
          {isLoading ? <div className="p-8 text-center text-sm text-gray-400">Cargando...</div>
          : cotizaciones.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">Sin cotizaciones</div>
          : cotizaciones.map(c => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 group transition-colors last:border-b-0">
              <div className="flex-shrink-0"><p className="text-xs font-mono font-bold text-gray-500">{c.numero}</p><p className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("es-CO")}</p></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.cliente.nombre}</p>{c.cliente.empresa && <p className="text-xs text-gray-400">{c.cliente.empresa}</p>}</div>
              <Badge estado={c.estado} />
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 w-32 text-right">{formatCOP(c.total)}</p>
              <div className="flex items-center gap-1.5">
                {c.estado === "BORRADOR" && <button onClick={() => cambiarEstado(c.id,"ENVIADA")} className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Enviar</button>}
                {c.estado === "ENVIADA" && <>
                  <button onClick={() => cambiarEstado(c.id,"APROBADA")} className="px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Aprobar</button>
                  <button onClick={() => cambiarEstado(c.id,"RECHAZADA")} className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-300 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Rechazar</button>
                </>}
                <Link href={`/crm/cotizaciones/${c.id}`} className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1" style={{ backgroundColor: CRM_COLOR + "18", color: CRM_COLOR }}>
                  <Eye size={12} /> Ver
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
export default function Page() { return <Suspense><CotizacionesContent /></Suspense>; }
