"use client";

// ============================================================
// Contenido de la cotización: los textos que antes cada asesor escribía
// a mano en el campo de notas, más las imágenes del dossier y los QR de
// pago. Se define una vez y sale igual en todas las ofertas.
// ============================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, FileText, Plus, Trash2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import type { ConfigCotizacion } from "@/lib/cotizacion-textos";

const CAMPOS: { k: keyof ConfigCotizacion; label: string; ayuda?: string; filas: number }[] = [
  { k: "carta", label: "Carta de presentación", ayuda: "Abre la propuesta. Quiénes somos y por qué confiar.", filas: 5 },
  { k: "infoPago", label: "Información de pago", ayuda: "Cuentas y llaves. Sale en la oferta y en el resumen de pago.", filas: 5 },
  { k: "formaPago", label: "Forma de pago", filas: 2 },
  { k: "tiempoEntrega", label: "Tiempo de entrega", filas: 2 },
  { k: "sitioEntrega", label: "Sitio de entrega", filas: 5 },
  { k: "garantia", label: "Garantía", filas: 4 },
  { k: "instalacionIncluye", label: "La instalación incluye", ayuda: "Se muestra como viñetas en la propuesta.", filas: 4 },
  { k: "instalacionRequiere", label: "El cliente debe suministrar", filas: 3 },
  { k: "observaciones", label: "Observaciones", filas: 4 },
  { k: "politicas", label: "Políticas de compra y devolución", filas: 5 },
  { k: "vigencia", label: "Vigencia", filas: 2 },
];

const IMAGENES: { k: keyof ConfigCotizacion; label: string; ayuda: string }[] = [
  { k: "imgPortada", label: "Portada", ayuda: "Vertical. Ocupa la mitad inferior de la primera hoja." },
  { k: "imgBanda", label: "Banda de la carta", ayuda: "Panorámica. Va bajo la firma del asesor." },
  { k: "imgInstalacion", label: "Cabecera de instalación", ayuda: "Horizontal. Solo sale si la oferta lleva instalación." },
  { k: "imgContraportada", label: "Contraportada", ayuda: "Vertical. Última hoja, con el cierre y el contacto." },
];

export function TabCotizacion() {
  const [f, setF] = useState<ConfigCotizacion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { refetch } = useQuery({
    queryKey: ["cot-config"],
    queryFn: async () => {
      const j = await (await fetch("/api/configuracion/cotizacion")).json();
      if (j.success) setF(j.data);
      return j;
    },
  });

  const u = (k: keyof ConfigCotizacion, v: unknown) => setF(p => (p ? { ...p, [k]: v } as ConfigCotizacion : p));

  const guardar = async () => {
    if (!f) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/cotizacion", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Cotización actualizada");
      refetch();
    } finally { setGuardando(false); }
  };

  if (!f) {
    return <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}>
          <FileText size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Contenido de la cotización</h2>
          <p className="text-xs text-muted mt-0.5">
            Condiciones comerciales, garantía y políticas. Se escriben una vez y salen iguales en todas las ofertas.
          </p>
        </div>
        <a href="/cotizacion/demo" target="_blank" rel="noreferrer" className="btn-secondary btn-sm flex items-center gap-1.5">
          <ExternalLink size={12} /> Ver muestra
        </a>
      </div>

      <div className="card p-5">
        <div className="mb-4">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Validez por defecto (días)</label>
          <input type="number" className="input max-w-[140px]" value={f.validezDias} onChange={e => u("validezDias", Number(e.target.value))} />
        </div>

        <div className="space-y-4">
          {CAMPOS.map(c => (
            <div key={c.k}>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{c.label}</label>
              <textarea
                className="input resize-none text-[13px]"
                rows={c.filas}
                value={String(f[c.k] ?? "")}
                onChange={e => u(c.k, e.target.value)}
              />
              {c.ayuda && <p className="text-[11px] text-muted mt-1">{c.ayuda}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Imágenes del dossier */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Imágenes de la propuesta</p>
        <p className="text-[11px] text-muted mb-4">
          Súbelas en el módulo de Imágenes y pega aquí la URL. Si están vacías, la cotización usa un patrón de malla de
          marca en vez de dejar el espacio en blanco.
        </p>
        <div className="space-y-4">
          {IMAGENES.map(i => (
            <div key={i.k}>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{i.label}</label>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <input className="input font-mono text-xs" value={String(f[i.k] ?? "")} onChange={e => u(i.k, e.target.value)} placeholder="https://catalogo.costamallas.com/…" />
                  <p className="text-[11px] text-muted mt-1">{i.ayuda}</p>
                </div>
                {f[i.k] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(f[i.k])} alt="" className="w-20 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
                ) : (
                  <div className="w-20 h-14 rounded-lg flex-shrink-0 surface-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR de pago */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">QR de pago</p>
          <button
            onClick={() => u("qrPagos", [...f.qrPagos, { etiqueta: "", url: "" }])}
            className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ backgroundColor: "var(--brand-color)" }}
          >
            <Plus size={13} /> Agregar
          </button>
        </div>
        <p className="text-[11px] text-muted mb-3">Las llaves de Nequi, Daviplata o Bancolombia como imagen. Salen en la hoja de pago.</p>

        {f.qrPagos.length === 0 ? (
          <p className="text-xs text-muted p-4 surface-2 rounded-xl text-center">Sin QR cargados.</p>
        ) : (
          <div className="space-y-2">
            {f.qrPagos.map((q, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="input flex-1 text-xs" value={q.etiqueta} placeholder="Llave Davivienda"
                  onChange={e => u("qrPagos", f.qrPagos.map((x, n) => n === i ? { ...x, etiqueta: e.target.value } : x))}
                />
                <input
                  className="input flex-[2] font-mono text-xs" value={q.url} placeholder="https://catalogo.costamallas.com/qr-davi.png"
                  onChange={e => u("qrPagos", f.qrPagos.map((x, n) => n === i ? { ...x, url: e.target.value } : x))}
                />
                {q.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.url} alt="" className="w-9 h-9 object-contain flex-shrink-0" />
                )}
                <button onClick={() => u("qrPagos", f.qrPagos.filter((_, n) => n !== i))} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={guardar} disabled={guardando} className="btn-primary w-full justify-center">
        {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar contenido
      </button>
    </div>
  );
}
