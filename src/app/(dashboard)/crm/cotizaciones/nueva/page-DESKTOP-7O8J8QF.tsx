"use client";

import { useState, Suspense, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import {
  ArrowLeft, Search, Plus, Trash2, X, Loader2, Check,
  FileText, Eye, Printer, Send, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";
import { useBrand } from "@/contexts/BrandContext";

const CRM_COLOR = "#BA7517";

interface Producto { id: string; sku: string; nombre: string; precioNormal: number | null; stock: number; acfUnidadVenta?: string; }
interface Cliente { id: string; nombre: string; empresa?: string; email?: string; telefono?: string; ciudad?: string; nit?: string; }
interface Item { productoId?: string; descripcion: string; cantidad: number; precioUnitario: number; descuento: number; unidad: string; stock?: number; }

const IVA = 0.19;

function PDFPreview({ items, cliente, notas, descuentoGlobal, tieneInstalacion, brand, numero }: {
  items: Item[]; cliente: Cliente | null; notas: string; descuentoGlobal: number;
  tieneInstalacion: boolean; brand: { companyName: string; brandColor: string; legalName?: string; nit?: string; address?: string; phone?: string; email?: string; logoUrl?: string | null }; numero: string;
}) {
  const subtotal = items.reduce((a, it) => a + it.cantidad * it.precioUnitario * (1 - it.descuento / 100), 0);
  const dv = subtotal * (descuentoGlobal / 100);
  const base = subtotal - dv;
  const iva = base * IVA;
  const total = base + iva;
  const today = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-100" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: `linear-gradient(135deg, ${brand.brandColor}, ${brand.brandColor}cc)` }}>
        <div className="flex items-start justify-between">
          <div>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.companyName} className="h-12 object-contain mb-2 brightness-0 invert" />
            ) : (
              <div className="text-2xl font-black text-white mb-1">{brand.companyName}</div>
            )}
            <p className="text-white/70 text-xs">{brand.legalName || brand.companyName}</p>
            {brand.nit && <p className="text-white/60 text-[11px]">NIT: {brand.nit}</p>}
          </div>
          <div className="text-right">
            <div className="bg-white/20 rounded-xl px-4 py-2 inline-block">
              <p className="text-white/60 text-[10px] uppercase tracking-wider font-bold">Cotización</p>
              <p className="text-white font-black text-2xl">{numero || "COT-00001"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* Datos empresa + cliente */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Empresa</p>
            <p className="text-xs text-gray-600">{brand.address}</p>
            <p className="text-xs text-gray-600">{brand.phone} · {brand.email}</p>
            <p className="text-xs text-gray-500">Fecha: {today}</p>
            <p className="text-xs text-gray-500">Válida por 30 días</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Para</p>
            {cliente ? (
              <>
                <p className="text-sm font-bold text-gray-800">{cliente.nombre}</p>
                {cliente.empresa && <p className="text-xs text-gray-600">{cliente.empresa}</p>}
                {cliente.nit && <p className="text-xs text-gray-500">NIT: {cliente.nit}</p>}
                {cliente.email && <p className="text-xs text-gray-500">{cliente.email}</p>}
                {cliente.ciudad && <p className="text-xs text-gray-500">{cliente.ciudad}</p>}
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">Selecciona un cliente</p>
            )}
          </div>
        </div>

        {/* Tabla de items */}
        {items.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: brand.brandColor + "12", borderBottom: `2px solid ${brand.brandColor}` }}>
                <th className="text-left py-2.5 px-3 font-bold text-gray-600">Descripción</th>
                <th className="text-center py-2.5 px-3 font-bold text-gray-600 w-16">Cant.</th>
                <th className="text-center py-2.5 px-3 font-bold text-gray-600 w-16">Unid.</th>
                <th className="text-right py-2.5 px-3 font-bold text-gray-600 w-28">Precio unit.</th>
                <th className="text-center py-2.5 px-3 font-bold text-gray-600 w-16">Desc%</th>
                <th className="text-right py-2.5 px-3 font-bold text-gray-600 w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const sub = it.cantidad * it.precioUnitario * (1 - it.descuento / 100);
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td className="py-2.5 px-3 font-medium text-gray-700">{it.descripcion}</td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{it.cantidad}</td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{it.unidad}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{formatCOP(it.precioUnitario)}</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">{it.descuento > 0 ? `${it.descuento}%` : "—"}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-800">{formatCOP(sub)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="h-24 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-xs text-gray-400">Agrega productos para ver la tabla</p>
          </div>
        )}

        {/* Totales */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-xs">
            <div className="flex justify-between text-gray-500 py-1"><span>Subtotal</span><span className="font-medium">{formatCOP(subtotal)}</span></div>
            {descuentoGlobal > 0 && <div className="flex justify-between text-red-500 py-1"><span>Descuento ({descuentoGlobal}%)</span><span>-{formatCOP(dv)}</span></div>}
            <div className="flex justify-between text-gray-500 py-1"><span>IVA (19%)</span><span>{formatCOP(iva)}</span></div>
            {tieneInstalacion && <div className="flex justify-between text-amber-600 py-1"><span>Instalación</span><span>A convenir</span></div>}
            <div className="flex justify-between font-black text-base py-2 border-t-2" style={{ borderColor: brand.brandColor, color: brand.brandColor }}>
              <span>TOTAL</span><span>{formatCOP(total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        {notas && (
          <div className="rounded-xl p-3" style={{ backgroundColor: brand.brandColor + "08", borderLeft: `3px solid ${brand.brandColor}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Observaciones</p>
            <p className="text-xs text-gray-600">{notas}</p>
          </div>
        )}

        {/* Pie de página */}
        <div className="pt-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">
            Esta cotización es válida por 30 días desde la fecha de emisión.
            Los precios incluyen IVA del 19%. Precios en pesos colombianos (COP).
          </p>
          <p className="text-[10px] text-gray-300 mt-1">
            {brand.companyName} · {brand.address} · {brand.phone}
          </p>
        </div>
      </div>
    </div>
  );
}

function NuevaCotizacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { brand } = useBrand();
  const preClienteId = searchParams.get("clienteId") ?? "";

  const [clienteId, setClienteId] = useState(preClienteId);
  const [clienteBusq, setClienteBusq] = useState("");
  const [prodBusq, setProdBusq] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [tieneInstalacion, setTieneInstalacion] = useState(false);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["clientes-search", clienteBusq],
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`)).json()).data ?? [],
    enabled: clienteBusq.length > 1,
  });

  const { data: clientePre } = useQuery<Cliente>({
    queryKey: ["cliente-pre", preClienteId],
    queryFn: async () => (await (await fetch(`/api/crm/clientes/${preClienteId}`)).json()).data,
    enabled: !!preClienteId,
  });

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["productos-cotizador", prodBusq],
    queryFn: async () => (await (await fetch(`/api/productos?busqueda=${encodeURIComponent(prodBusq)}&limit=10`)).json()).data ?? [],
    enabled: prodBusq.length > 1,
  });

  const clienteSeleccionado: Cliente | null = clientePre ?? clientes.find(c => c.id === clienteId) ?? null;

  const addProducto = (p: Producto) => {
    setItems(prev => [...prev, { productoId: p.id, descripcion: p.nombre, cantidad: 1, precioUnitario: p.precioNormal ?? 0, descuento: 0, unidad: p.acfUnidadVenta ?? "und", stock: p.stock }]);
    setProdBusq("");
  };

  const upd = (i: number, k: keyof Item, v: unknown) => setItems(prev => { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n; });

  const subtotal = items.reduce((a, it) => a + it.cantidad * it.precioUnitario * (1 - it.descuento / 100), 0);
  const dv = subtotal * (descuentoGlobal / 100);
  const base = subtotal - dv;
  const total = base + base * IVA;

  const save = async (estado: "BORRADOR" | "ENVIADA" = "BORRADOR") => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (!items.length) return toast.error("Agrega al menos un producto");
    setSaving(true);
    try {
      const res = await fetch("/api/crm/cotizaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, items, tieneInstalacion, descuentoGlobal, notas, estado }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success(estado === "ENVIADA" ? "Cotización creada y enviada" : "Cotización guardada como borrador");
      router.push("/crm/cotizaciones");
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <>
      <Topbar
        title="Nueva cotización"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/crm/cotizaciones" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
            <button onClick={() => setShowPreview(v => !v)} className="btn-secondary btn-sm">
              <Eye size={13} /> {showPreview ? "Ocultar" : "Vista previa PDF"}
            </button>
            <button onClick={() => window.print()} className="btn-secondary btn-sm no-print">
              <Printer size={13} /> Imprimir
            </button>
            <button onClick={() => save("BORRADOR")} disabled={saving} className="btn-secondary btn-sm">
              Guardar borrador
            </button>
            <button onClick={() => save("ENVIADA")} disabled={saving}
              className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ backgroundColor: CRM_COLOR }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Crear y enviar
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg">
        <div className={`p-6 ${showPreview ? "grid grid-cols-2 gap-6 items-start" : "max-w-3xl mx-auto space-y-5"}`}>

          {/* Formulario */}
          <div className="space-y-5">

            {/* Cliente */}
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <FileText size={12} style={{ color: CRM_COLOR }} /> Cliente *
              </h3>
              {clienteSeleccionado && clienteId ? (
                <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: CRM_COLOR + "10", border: `1px solid ${CRM_COLOR}30` }}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{clienteSeleccionado.nombre}</p>
                    {clienteSeleccionado.empresa && <p className="text-xs text-gray-400">{clienteSeleccionado.empresa}</p>}
                    {clienteSeleccionado.email && <p className="text-xs text-gray-400">{clienteSeleccionado.email}</p>}
                  </div>
                  {!preClienteId && (
                    <button onClick={() => { setClienteId(""); setClienteBusq(""); }} className="text-gray-400 hover:text-red-500"><X size={13} /></button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente por nombre o empresa..." />
                  {clientes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden max-h-56 overflow-y-auto">
                      {clientes.map(c => (
                        <button key={c.id} type="button" onClick={() => { setClienteId(c.id); setClienteBusq(""); }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 border-b last:border-0 border-gray-50 dark:border-slate-700/50">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.nombre}</p>
                          {c.empresa && <p className="text-xs text-gray-400">{c.empresa}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <Link href="/crm/clientes/nuevo" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                      <Plus size={11} /> Crear nuevo cliente
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Productos */}
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Productos</h3>
              <div className="relative mb-4">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" value={prodBusq} onChange={e => setProdBusq(e.target.value)} placeholder="Buscar producto por SKU o nombre..." />
                {productos.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden max-h-56 overflow-y-auto">
                    {productos.map(p => (
                      <button key={p.id} type="button" onClick={() => addProducto(p)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 flex justify-between gap-3 border-b last:border-0 border-gray-50 dark:border-slate-700/50">
                        <div>
                          <p className="text-xs font-mono text-gray-400">{p.sku}</p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.nombre}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.precioNormal ? formatCOP(p.precioNormal) : "—"}</p>
                          <p className={`text-[10px] font-semibold ${p.stock > 0 ? "text-green-600" : "text-red-500"}`}>
                            {p.stock > 0 ? `${p.stock} disp.` : "Sin stock"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 ? (
                <div className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-500 font-semibold">Descripción</th>
                        <th className="text-center px-2 py-2 text-gray-500 font-semibold w-20">Cant.</th>
                        <th className="text-right px-2 py-2 text-gray-500 font-semibold w-28">Precio</th>
                        <th className="text-center px-2 py-2 text-gray-500 font-semibold w-16">Desc%</th>
                        <th className="text-right px-3 py-2 text-gray-500 font-semibold w-28">Subtotal</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => {
                        const sub = it.cantidad * it.precioUnitario * (1 - it.descuento / 100);
                        return (
                          <tr key={i} className="border-t border-gray-50 dark:border-slate-700/50">
                            <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{it.descripcion}</td>
                            <td className="px-2 py-2">
                              <input type="number" min="0.01" step="0.01" value={it.cantidad}
                                onChange={e => upd(i, "cantidad", parseFloat(e.target.value) || 0)}
                                className="w-full text-center border border-gray-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-xs bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200" />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" min="0" value={it.precioUnitario}
                                onChange={e => upd(i, "precioUnitario", parseFloat(e.target.value) || 0)}
                                className="w-full text-right border border-gray-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-xs bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200" />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" min="0" max="100" value={it.descuento}
                                onChange={e => upd(i, "descuento", parseFloat(e.target.value) || 0)}
                                className="w-full text-center border border-gray-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-xs bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200" />
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-gray-800 dark:text-gray-100">{formatCOP(sub)}</td>
                            <td className="px-2 py-2">
                              <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="p-4 flex flex-col items-end gap-2 border-t border-gray-50 dark:border-slate-700">
                    <div className="w-56 space-y-1.5">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>Subtotal</span><span className="font-medium">{formatCOP(subtotal)}</span></div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Descuento global %</span>
                        <input type="number" min="0" max="100" value={descuentoGlobal} onChange={e => setDescuentoGlobal(parseFloat(e.target.value) || 0)}
                          className="w-16 text-right border border-gray-200 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200" />
                      </div>
                      {dv > 0 && <div className="flex justify-between text-xs text-red-500"><span>- Descuento</span><span>-{formatCOP(dv)}</span></div>}
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>IVA 19%</span><span>{formatCOP(base * IVA)}</span></div>
                      <div className="flex justify-between text-sm font-black border-t border-gray-100 dark:border-slate-700 pt-2"
                        style={{ color: CRM_COLOR }}>
                        <span>Total</span><span>{formatCOP(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-400">Busca y agrega productos</p>
                </div>
              )}
            </div>

            {/* Opciones */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Opciones</h3>

              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: tieneInstalacion ? "#fffbeb" : "transparent", border: `1px solid ${tieneInstalacion ? "#fde68a" : "#e5e7eb"}` }}>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Incluye instalación</p>
                  <p className="text-xs text-gray-400">Se generará una orden de instalación</p>
                </div>
                <button type="button" onClick={() => setTieneInstalacion(v => !v)}
                  className="w-11 h-6 rounded-full relative transition-all"
                  style={{ backgroundColor: tieneInstalacion ? CRM_COLOR : "#d1d5db" }}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${tieneInstalacion ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notas / Condiciones</label>
                <textarea className="input resize-none" rows={3} value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Condiciones de pago, tiempo de entrega, observaciones..." />
              </div>
            </div>

            {/* Warnings */}
            {items.some(it => (it.stock ?? 0) < it.cantidad) && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Algunos productos tienen stock insuficiente. Verifica disponibilidad antes de enviar.
                </p>
              </div>
            )}
          </div>

          {/* Preview PDF */}
          {showPreview && (
            <div className="sticky top-6 print-area">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 no-print">Vista previa de la cotización</p>
              <PDFPreview
                items={items}
                cliente={clienteSeleccionado}
                notas={notas}
                descuentoGlobal={descuentoGlobal}
                tieneInstalacion={tieneInstalacion}
                brand={brand}
                numero="COT-XXXXX"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function NuevaCotizacionPage() {
  return <Suspense><NuevaCotizacionContent /></Suspense>;
}
