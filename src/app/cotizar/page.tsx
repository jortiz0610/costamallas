"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ruler, Calculator, CheckCircle2, Loader2, Send } from "lucide-react";

const BRAND = "#185FA5";

interface Prod { id: string; nombre: string; sku: string; precio: number; categoria: string; }

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function CotizarContent() {
  const sp = useSearchParams();
  const [productos, setProductos] = useState<Prod[]>([]);
  const [prodId, setProdId] = useState("");
  const [largo, setLargo] = useState(1);
  const [ancho, setAncho] = useState(1);
  const [cantidad, setCantidad] = useState(1);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", ciudad: "", mensaje: "" });
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    fetch("/api/public/productos").then(r => r.json()).then(j => setProductos(j.data ?? [])).catch(() => {});
  }, []);

  const prod = productos.find(p => p.id === prodId);
  const m2 = largo * ancho * cantidad;
  const estimado = prod ? m2 * prod.precio : 0;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || (!form.email && !form.telefono)) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          producto: prod ? `${prod.nombre} (${prod.sku})` : "",
          dimensiones: prod ? `${largo}m × ${ancho}m × ${cantidad} = ${m2.toFixed(2)} m²` : "",
          utm_source: sp.get("utm_source"), utm_medium: sp.get("utm_medium"),
          utm_campaign: sp.get("utm_campaign"), utm_content: sp.get("utm_content"), utm_term: sp.get("utm_term"),
        }),
      });
      if ((await res.json()).success) setOk(true);
    } finally { setEnviando(false); }
  };

  if (ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-emerald-600" /></div>
          <h1 className="text-xl font-bold text-slate-800">¡Solicitud enviada!</h1>
          <p className="text-sm text-slate-500 mt-2">Gracias por tu interés. Nuestro equipo te contactará muy pronto con tu cotización.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND}cc)` }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center"><Ruler size={22} /></div>
            <div>
              <h1 className="text-lg font-bold">Cotiza tu malla a medida</h1>
              <p className="text-white/80 text-xs">Calcula al instante y recibe asesoría gratis</p>
            </div>
          </div>
        </div>

        <form onSubmit={enviar} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Producto</label>
            <select className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm" value={prodId} onChange={e => setProdId(e.target.value)}>
              <option value="">Selecciona un producto…</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          {prod && (
            <div className="rounded-xl p-4 bg-slate-50 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Largo (m)</label><input type="number" step="0.1" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm" value={largo} onChange={e => setLargo(parseFloat(e.target.value) || 0)} /></div>
                <div><label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Ancho (m)</label><input type="number" step="0.1" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm" value={ancho} onChange={e => setAncho(parseFloat(e.target.value) || 0)} /></div>
                <div><label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Cantidad</label><input type="number" className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm" value={cantidad} onChange={e => setCantidad(parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500 flex items-center gap-1"><Calculator size={13} /> {m2.toFixed(2)} m²</span>
                <span className="text-sm font-bold" style={{ color: BRAND }}>Estimado: {formatCOP(estimado)}</span>
              </div>
              <p className="text-[10px] text-slate-400">*Valor referencial sin IVA. La cotización final puede variar según especificaciones.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input required className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm col-span-2" placeholder="Tu nombre *" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
            <input type="email" className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" placeholder="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <input className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" placeholder="Teléfono / WhatsApp" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
            <input className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" placeholder="Ciudad" value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} />
            <input className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm" placeholder="Mensaje (opcional)" value={form.mensaje} onChange={e => setForm(p => ({ ...p, mensaje: e.target.value }))} />
          </div>

          <button type="submit" disabled={enviando || !form.nombre || (!form.email && !form.telefono)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: BRAND }}>
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Solicitar cotización
          </button>
          <p className="text-[10px] text-slate-400 text-center">Al enviar aceptas ser contactado por nuestro equipo comercial.</p>
        </form>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><CotizarContent /></Suspense>; }
