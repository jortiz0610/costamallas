"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Ruler, Search, X, Plus, Trash2, Loader2, Calculator, ArrowLeft, Save, Send, UserPlus, Package, Weight,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";

const CRM_COLOR = "#BA7517";
const IVA = 0.19;

interface Producto { id: string; nombre: string; sku: string; precioNormal?: number; pesoKg?: number; acfUnidadVenta?: string; }
interface Cliente { id: string; nombre: string; empresa?: string; }
interface Linea {
  productoId: string; nombre: string; sku: string; modo: "m2" | "unidad";
  largo: number; ancho: number; cantidad: number; precioUnit: number; pesoM2: number;
}

function CotizadorContent() {
  const router = useRouter();
  const [clienteId, setClienteId] = useState("");
  const [clienteBusq, setClienteBusq] = useState("");
  const [prodBusq, setProdBusq] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [tieneInstalacion, setTieneInstalacion] = useState(false);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["cot-clientes", clienteBusq],
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`)).json()).data ?? [],
    enabled: clienteBusq.length > 1,
  });
  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["cot-productos", prodBusq],
    queryFn: async () => (await (await fetch(`/api/productos?busqueda=${encodeURIComponent(prodBusq)}&limit=10`)).json()).data ?? [],
    enabled: prodBusq.length > 1,
  });
  const clienteSel = clientes.find(c => c.id === clienteId);

  const addProducto = (p: Producto) => {
    setLineas(prev => [...prev, {
      productoId: p.id, nombre: p.nombre, sku: p.sku,
      modo: "m2", largo: 1, ancho: 1, cantidad: 1,
      precioUnit: p.precioNormal ?? 0, pesoM2: p.pesoKg ?? 0,
    }]);
    setProdBusq("");
  };
  const upd = (i: number, k: keyof Linea, v: unknown) => setLineas(prev => { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n; });
  const del = (i: number) => setLineas(prev => prev.filter((_, j) => j !== i));

  // Cálculos por línea
  const calc = (l: Linea) => {
    const m2 = l.modo === "m2" ? l.largo * l.ancho * l.cantidad : l.cantidad;
    const subtotal = m2 * l.precioUnit;
    const peso = l.modo === "m2" ? l.largo * l.ancho * l.cantidad * l.pesoM2 : l.cantidad * l.pesoM2;
    return { m2, subtotal, peso };
  };

  const subtotal = lineas.reduce((a, l) => a + calc(l).subtotal, 0);
  const pesoTotal = lineas.reduce((a, l) => a + calc(l).peso, 0);
  const dv = subtotal * (descuentoGlobal / 100);
  const base = subtotal - dv;
  const total = base + base * IVA;

  const guardar = async (estado: "BORRADOR" | "ENVIADA") => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (!lineas.length) return toast.error("Agrega al menos un producto");
    setSaving(true);
    try {
      const items = lineas.map(l => {
        const { m2, subtotal } = calc(l);
        const desc = l.modo === "m2"
          ? `${l.nombre} — ${l.largo}m × ${l.ancho}m × ${l.cantidad} = ${m2.toFixed(2)} m²`
          : `${l.nombre} — ${l.cantidad} und`;
        return { productoId: l.productoId, descripcion: desc, cantidad: Number(m2.toFixed(2)), precioUnitario: l.precioUnit, descuento: 0, unidad: l.modo === "m2" ? "m²" : "und", subtotal };
      });
      const res = await fetch("/api/crm/cotizaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, items, tieneInstalacion, descuentoGlobal, notas, estado }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success(estado === "ENVIADA" ? "Cotización creada y enviada" : "Cotización guardada");
      router.push("/crm/cotizaciones");
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <>
      <Topbar title="Cotizador a medida" actions={
        <div className="flex items-center gap-2">
          <Link href="/crm/cotizaciones" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
          <button onClick={() => guardar("BORRADOR")} disabled={saving} className="btn-secondary btn-sm">{saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Borrador</button>
          <button onClick={() => guardar("ENVIADA")} disabled={saving} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: CRM_COLOR }}><Send size={12} /> Crear y enviar</button>
        </div>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5 max-w-4xl mx-auto w-full">

        {/* Hero */}
        <div className="card p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${CRM_COLOR}12, transparent)` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CRM_COLOR }}><Ruler size={22} className="text-white" /></div>
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Cotiza productos por medida (m²) o por unidad</p>
            <p className="text-xs text-muted mt-0.5">Ingresa largo × ancho × cantidad y el sistema calcula el área, el precio y el peso automáticamente.</p>
          </div>
        </div>

        {/* Cliente */}
        <div className="card p-5">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Cliente</label>
          {clienteSel ? (
            <div className="flex items-center justify-between rounded-xl px-4 py-2.5 surface-2">
              <div><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{clienteSel.nombre}</p>{clienteSel.empresa && <p className="text-xs text-muted">{clienteSel.empresa}</p>}</div>
              <button onClick={() => { setClienteId(""); setClienteBusq(""); }} className="text-muted hover:text-red-500"><X size={14} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input pl-9" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente por nombre o empresa..." />
              {clientes.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 card z-10 overflow-hidden max-h-48 overflow-y-auto">
                  {clientes.map(c => <button key={c.id} type="button" onClick={() => { setClienteId(c.id); setClienteBusq(""); }} className="w-full text-left px-4 py-2.5 hover:surface-2"><p className="text-sm font-medium text-soft">{c.nombre}</p>{c.empresa && <p className="text-xs text-muted">{c.empresa}</p>}</button>)}
                </div>
              )}
              <Link href="/crm/clientes/nuevo" className="text-xs font-semibold mt-2 inline-flex items-center gap-1" style={{ color: CRM_COLOR }}><UserPlus size={11} /> Crear cliente nuevo</Link>
            </div>
          )}
        </div>

        {/* Productos a medida */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted">Productos</label>
          </div>
          {/* Buscar producto */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9" value={prodBusq} onChange={e => setProdBusq(e.target.value)} placeholder="Buscar producto para agregar..." />
            {productos.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 card z-10 overflow-hidden max-h-48 overflow-y-auto">
                {productos.map(p => (
                  <button key={p.id} type="button" onClick={() => addProducto(p)} className="w-full text-left px-4 py-2.5 hover:surface-2 flex justify-between gap-3">
                    <span><span className="text-sm font-medium text-soft">{p.nombre}</span> <span className="sku-tag ml-1">{p.sku}</span></span>
                    <span className="text-sm text-muted">{formatCOP(p.precioNormal ?? 0)}/m²</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Líneas */}
          {lineas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted"><Package size={24} className="mx-auto mb-2" />Agrega productos para cotizar a medida</div>
          ) : lineas.map((l, i) => {
            const { m2, subtotal, peso } = calc(l);
            return (
              <div key={i} className="rounded-xl p-4 surface-2 border divider">
                <div className="flex items-center justify-between mb-3">
                  <div><p className="text-sm font-bold text-gray-800 dark:text-gray-100">{l.nombre}</p><span className="sku-tag">{l.sku}</span></div>
                  <button onClick={() => del(i)} className="text-muted hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                {/* Modo */}
                <div className="flex gap-1.5 mb-3">
                  {(["m2", "unidad"] as const).map(m => (
                    <button key={m} onClick={() => upd(i, "modo", m)} className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={l.modo === m ? { backgroundColor: CRM_COLOR, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                      {m === "m2" ? "Por medida (m²)" : "Por unidad"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {l.modo === "m2" && <>
                    <div><label className="text-[10px] text-muted uppercase font-bold">Largo (m)</label><input type="number" step="0.01" className="input py-1.5 text-sm" value={l.largo} onChange={e => upd(i, "largo", parseFloat(e.target.value) || 0)} /></div>
                    <div><label className="text-[10px] text-muted uppercase font-bold">Ancho (m)</label><input type="number" step="0.01" className="input py-1.5 text-sm" value={l.ancho} onChange={e => upd(i, "ancho", parseFloat(e.target.value) || 0)} /></div>
                  </>}
                  <div><label className="text-[10px] text-muted uppercase font-bold">{l.modo === "m2" ? "Cantidad (paños)" : "Cantidad"}</label><input type="number" step="1" className="input py-1.5 text-sm" value={l.cantidad} onChange={e => upd(i, "cantidad", parseFloat(e.target.value) || 0)} /></div>
                  <div><label className="text-[10px] text-muted uppercase font-bold">Precio/{l.modo === "m2" ? "m²" : "und"}</label><input type="number" className="input py-1.5 text-sm" value={l.precioUnit} onChange={e => upd(i, "precioUnit", parseFloat(e.target.value) || 0)} /></div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t divider text-xs">
                  {l.modo === "m2" && <span className="text-muted flex items-center gap-1"><Calculator size={12} /> {m2.toFixed(2)} m²</span>}
                  {peso > 0 && <span className="text-muted flex items-center gap-1"><Weight size={12} /> {peso.toFixed(1)} kg</span>}
                  <span className="ml-auto text-sm font-bold text-soft">{formatCOP(subtotal)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Opciones + Totales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-1.5">Descuento global (%)</label>
              <input type="number" className="input" value={descuentoGlobal} onChange={e => setDescuentoGlobal(parseFloat(e.target.value) || 0)} />
            </div>
            <button type="button" onClick={() => setTieneInstalacion(v => !v)} className="flex items-center gap-3 w-full">
              <span className="w-11 h-6 rounded-full relative transition-all" style={{ backgroundColor: tieneInstalacion ? CRM_COLOR : "var(--surface-3)" }}>
                <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: tieneInstalacion ? "translateX(22px)" : "translateX(2px)" }} />
              </span>
              <span className="text-sm text-soft">Incluye instalación</span>
            </button>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-1.5">Notas</label>
              <textarea className="input resize-none" rows={3} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Condiciones, tiempos de entrega..." />
            </div>
          </div>
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Resumen</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-soft"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
              {descuentoGlobal > 0 && <div className="flex justify-between text-soft"><span>Descuento ({descuentoGlobal}%)</span><span>- {formatCOP(dv)}</span></div>}
              <div className="flex justify-between text-soft"><span>IVA (19%)</span><span>{formatCOP(base * IVA)}</span></div>
              {pesoTotal > 0 && <div className="flex justify-between text-muted text-xs"><span>Peso estimado</span><span>{pesoTotal.toFixed(1)} kg</span></div>}
              <div className="flex justify-between font-bold text-lg pt-2 border-t divider" style={{ color: CRM_COLOR }}><span>Total</span><span>{formatCOP(total)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><CotizadorContent /></Suspense>; }
