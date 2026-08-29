"use client";

// ============================================================
// Órdenes de compra: armarlas, revisarlas y mandárselas al proveedor.
//
// El backend ya sabía hacer todo esto (autoarmado por mínimos y envío
// por correo); lo que faltaba era desde dónde dispararlo.
// ============================================================

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Send, X, ShoppingBag, Search, Trash2, Zap, AlertTriangle,
  CheckCircle2, Clock, FileText, PackageCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatCOP, formatDate, cn } from "@/lib/utils";

const ERP_COLOR = "#185FA5";

interface ItemOrden {
  productoId: string | null; sku: string; descripcion: string;
  referenciaProveedor?: string | null; cantidad: number;
  precioUnitario: number; subtotal: number;
}

interface Orden {
  id: string; numero: string; estado: string; total: number; notas: string | null;
  items: ItemOrden[]; fechaEsperada: string | null; enviadaEn: string | null;
  enviadaAEmail: string | null; errorEnvio: string | null; createdAt: string;
  proveedor: { id: string; nombre: string; email: string | null };
}

export interface ProveedorOpcion {
  id: string; nombre: string; email?: string | null; esPropio?: boolean;
}

const ESTADOS: Record<string, { label: string; clase: string }> = {
  BORRADOR:         { label: "Borrador",  clase: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  ENVIADA:          { label: "Enviada",   clase: "bg-blue-50 text-blue-600 dark:bg-blue-500/15" },
  RECIBIDA_PARCIAL: { label: "Parcial",   clase: "bg-amber-50 text-amber-600 dark:bg-amber-500/15" },
  RECIBIDA:         { label: "Recibida",  clase: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15" },
  CANCELADA:        { label: "Cancelada", clase: "bg-red-50 text-red-600 dark:bg-red-500/15" },
};

// ── Modal: nueva orden ──────────────────────────────────────
function NuevaOrden({
  proveedores, onClose, onCreada,
}: { proveedores: ProveedorOpcion[]; onClose: () => void; onCreada: () => void }) {
  const externos = proveedores.filter(p => !p.esPropio);
  const [proveedorId, setProveedorId] = useState(externos[0]?.id ?? "");
  const [modo, setModo] = useState<"auto" | "manual">("auto");
  const [items, setItems] = useState<ItemOrden[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { data: resultados = [] } = useQuery<{ id: string; sku: string; nombre: string }[]>({
    queryKey: ["buscar-producto-orden", busqueda],
    enabled: modo === "manual" && busqueda.trim().length >= 2,
    queryFn: async () =>
      (await (await fetch(`/api/productos?busqueda=${encodeURIComponent(busqueda)}&limit=8`)).json()).data ?? [],
  });

  const agregarItem = (p: { id: string; sku: string; nombre: string }) => {
    if (items.some(i => i.productoId === p.id)) return;
    setItems(prev => [...prev, {
      productoId: p.id, sku: p.sku, descripcion: p.nombre,
      cantidad: 1, precioUnitario: 0, subtotal: 0,
    }]);
    setBusqueda("");
  };

  const cambiarItem = (idx: number, campo: "cantidad" | "precioUnitario", valor: string) => {
    setItems(prev => prev.map((i, n) => {
      if (n !== idx) return i;
      const actualizado = { ...i, [campo]: Number(valor) || 0 };
      actualizado.subtotal = Number((actualizado.cantidad * actualizado.precioUnitario).toFixed(2));
      return actualizado;
    }));
  };

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  const crear = async () => {
    if (!proveedorId) return toast.error("Elige un proveedor");
    if (modo === "manual" && items.length === 0) return toast.error("La orden no tiene productos");
    setGuardando(true);
    try {
      const res = await fetch("/api/compras/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedorId,
          autoarmar: modo === "auto",
          items: modo === "manual" ? items : undefined,
          notas: notas || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo crear la orden");
      toast.success(`Orden ${j.data.numero} creada`);
      onCreada();
    } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl my-4 animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <ShoppingBag size={16} style={{ color: ERP_COLOR }} /> Nueva orden de compra
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {externos.length === 0 ? (
            <div className="p-6 text-center surface-2 rounded-xl">
              <p className="text-xs text-muted">No hay proveedores externos registrados.</p>
              <p className="text-[11px] text-muted mt-1">Los de fabricación propia no reciben órdenes de compra.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Proveedor</label>
                <select className="input" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
                  {externos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}{p.email ? ` — ${p.email}` : " (sin correo)"}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setModo("auto")}
                  className={cn("p-3 rounded-xl text-left border transition-all", modo === "auto" ? "border-transparent text-white" : "surface-2 border-transparent")}
                  style={modo === "auto" ? { backgroundColor: ERP_COLOR } : undefined}
                >
                  <p className="text-xs font-bold flex items-center gap-1.5"><Zap size={12} /> Armar automáticamente</p>
                  <p className={cn("text-[10px] mt-0.5", modo === "auto" ? "text-white/80" : "text-muted")}>
                    Toma sus productos bajo mínimo y calcula cuánto pedir.
                  </p>
                </button>
                <button
                  onClick={() => setModo("manual")}
                  className={cn("p-3 rounded-xl text-left border transition-all", modo === "manual" ? "border-transparent text-white" : "surface-2 border-transparent")}
                  style={modo === "manual" ? { backgroundColor: ERP_COLOR } : undefined}
                >
                  <p className="text-xs font-bold flex items-center gap-1.5"><FileText size={12} /> A mano</p>
                  <p className={cn("text-[10px] mt-0.5", modo === "manual" ? "text-white/80" : "text-muted")}>
                    Eliges los productos y las cantidades.
                  </p>
                </button>
              </div>

              {modo === "manual" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input className="input pl-9 py-1.5 text-xs" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto…" />
                    {resultados.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 card p-1 max-h-48 overflow-y-auto">
                        {resultados.map(p => (
                          <button key={p.id} onClick={() => agregarItem(p)} className="w-full text-left p-2 rounded-lg hover:brand-bg-10">
                            <p className="text-xs font-semibold text-soft truncate">{p.nombre}</p>
                            <p className="text-[10px] text-muted font-mono">{p.sku}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {items.map((i, idx) => (
                    <div key={i.productoId ?? idx} className="flex items-center gap-2 p-2 rounded-xl surface-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-soft truncate">{i.descripcion}</p>
                        <p className="text-[10px] text-muted font-mono">{i.sku}</p>
                      </div>
                      <input type="number" min={1} className="input py-1 text-xs w-16" value={i.cantidad} onChange={e => cambiarItem(idx, "cantidad", e.target.value)} />
                      <input type="number" min={0} className="input py-1 text-xs w-28" value={i.precioUnitario} onChange={e => cambiarItem(idx, "precioUnitario", e.target.value)} placeholder="Precio" />
                      <button onClick={() => setItems(prev => prev.filter((_, n) => n !== idx))} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  ))}

                  {items.length > 0 && (
                    <p className="text-xs text-right text-soft">Total: <b>{formatCOP(total)}</b></p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Observaciones (opcional)</label>
                <textarea className="input resize-none" rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Instrucciones de entrega, referencias de despacho…" />
              </div>
            </>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={crear}
            disabled={guardando || externos.length === 0}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: ERP_COLOR }}
          >
            {guardando && <Loader2 size={13} className="animate-spin" />} Crear orden
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: detalle y envío ──────────────────────────────────
function DetalleOrden({ orden, onClose, onCambio }: { orden: Orden; onClose: () => void; onCambio: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState(orden.errorEnvio);

  const cambiarEstado = async (estado: string, aviso?: string) => {
    if (aviso && !confirm(aviso)) return;
    setCambiando(true);
    try {
      const res = await fetch(`/api/compras/ordenes/${orden.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo actualizar");
      toast.success(j.mensaje ?? "Orden actualizada");
      onCambio();
      if (estado === "RECIBIDA" || estado === "CANCELADA") onClose();
    } finally { setCambiando(false); }
  };

  const cancelar = async () => {
    if (!confirm(`¿Cancelar la orden ${orden.numero}? Queda en el historial, no se borra.`)) return;
    setCambiando(true);
    try {
      const res = await fetch(`/api/compras/ordenes/${orden.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo cancelar");
      toast.success("Orden cancelada");
      onCambio();
      onClose();
    } finally { setCambiando(false); }
  };

  const recibida = orden.estado === "RECIBIDA";
  const cancelada = orden.estado === "CANCELADA";

  const enviar = async () => {
    if (!confirm(`¿Enviar la orden ${orden.numero} a ${orden.proveedor.email}?`)) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/compras/ordenes/${orden.id}/enviar`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.success) {
        setError(j.error ?? "No se pudo enviar");
        toast.error("No se pudo enviar");
        onCambio();
        return;
      }
      toast.success(j.mensaje ?? "Orden enviada");
      onCambio();
      onClose();
    } finally { setEnviando(false); }
  };

  const estado = ESTADOS[orden.estado] ?? { label: orden.estado, clase: "surface-2 text-soft" };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl my-4 animate-fade-up">
        <div className="card-header">
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{orden.numero}</h2>
            <p className="text-xs text-muted mt-0.5">{orden.proveedor.nombre} · {formatDate(orden.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg", estado.clase)}>{estado.label}</span>
            <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            {orden.items.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl surface-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-soft truncate">{i.descripcion}</p>
                  <p className="text-[10px] text-muted font-mono">
                    {i.sku}{i.referenciaProveedor ? ` · ref. ${i.referenciaProveedor}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">{i.cantidad} ×</span>
                <span className="text-xs text-soft w-24 text-right">{i.precioUnitario ? formatCOP(i.precioUnitario) : "—"}</span>
                <span className="text-xs font-bold text-soft w-28 text-right">{i.subtotal ? formatCOP(i.subtotal) : "—"}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3 border-t divider">
            <span className="text-xs text-muted">Total</span>
            <span className="text-base font-bold" style={{ color: ERP_COLOR }}>{orden.total ? formatCOP(orden.total) : "A convenir"}</span>
          </div>

          {orden.notas && (
            <div className="p-3 rounded-xl surface-2 text-xs text-soft whitespace-pre-line">{orden.notas}</div>
          )}

          {orden.fechaEsperada && (
            <p className="text-xs text-muted flex items-center gap-1.5"><Clock size={12} /> Entrega esperada: {formatDate(orden.fechaEsperada)}</p>
          )}

          {orden.enviadaEn && (
            <p className="text-xs text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Enviada el {formatDate(orden.enviadaEn)} a {orden.enviadaAEmail}
            </p>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-xs text-red-600">
              <p className="font-bold flex items-center gap-1.5 mb-1"><AlertTriangle size={12} /> El último envío falló</p>
              <p>{error}</p>
            </div>
          )}

          {!orden.proveedor.email && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-600">
              {orden.proveedor.nombre} no tiene correo registrado. Agrégalo en su ficha para poder enviarle el pedido.
            </div>
          )}
        </div>

        {/* Recepción de mercancía */}
        {!recibida && !cancelada && (
          <div className="px-5 pb-4">
            <div className="p-4 rounded-xl surface-2">
              <p className="text-xs font-bold text-soft mb-1">¿Ya llegó la mercancía?</p>
              <p className="text-[11px] text-muted mb-3">
                Al marcarla recibida, las cantidades de esta orden entran al stock. Se hace una sola vez.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => cambiarEstado("RECIBIDA_PARCIAL")}
                  disabled={cambiando}
                  className="btn-secondary btn-sm flex-1 justify-center"
                >
                  Llegó parcial
                </button>
                <button
                  onClick={() => cambiarEstado("RECIBIDA", `¿Confirmas que llegó completa la orden ${orden.numero}? Se sumará el stock de ${orden.items.length} producto(s).`)}
                  disabled={cambiando}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ backgroundColor: "#16a34a" }}
                >
                  {cambiando ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />} Recibida — sumar stock
                </button>
              </div>
            </div>
          </div>
        )}

        {recibida && (
          <div className="px-5 pb-4">
            <div className="p-3 rounded-xl text-xs text-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              Mercancía recibida y sumada al stock.
            </div>
          </div>
        )}

        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cerrar</button>
          {!recibida && !cancelada && (
            <button onClick={cancelar} disabled={cambiando} className="btn-secondary text-red-600">Cancelar orden</button>
          )}
          <button
            onClick={enviar}
            disabled={enviando || !orden.proveedor.email || cancelada || recibida}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: ERP_COLOR }}
          >
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {orden.enviadaEn ? "Reenviar" : "Enviar al proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lista ───────────────────────────────────────────────────
export function Ordenes({ proveedores }: { proveedores: ProveedorOpcion[] }) {
  const qc = useQueryClient();
  const [nueva, setNueva] = useState(false);
  const [abierta, setAbierta] = useState<Orden | null>(null);

  const { data: ordenes = [], isLoading } = useQuery<Orden[]>({
    queryKey: ["ordenes-compra"],
    queryFn: async () => (await (await fetch("/api/compras/ordenes")).json()).data ?? [],
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["ordenes-compra"] });
    qc.invalidateQueries({ queryKey: ["proveedores"] });
    // Al recibir mercancía cambia el stock: el bloque de reabastecimiento
    // de arriba tiene que reflejarlo sin que haya que recargar la página.
    qc.invalidateQueries({ queryKey: ["productos-reabastecer"] });
    qc.invalidateQueries({ queryKey: ["stock"] });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {ordenes.length} orden{ordenes.length === 1 ? "" : "es"}
        </p>
        <button
          onClick={() => setNueva(true)}
          className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ backgroundColor: ERP_COLOR }}
        >
          <Plus size={13} /> Nueva orden
        </button>
      </div>

      {isLoading ? (
        <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: ERP_COLOR }} /></div>
      ) : ordenes.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingBag size={28} className="mx-auto mb-2 text-muted" />
          <p className="text-sm text-muted">Todavía no hay órdenes de compra</p>
          <p className="text-xs text-muted mt-1">
            Asigna productos a un proveedor en su ficha y el sistema puede armar el pedido solo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordenes.map(o => {
            const estado = ESTADOS[o.estado] ?? { label: o.estado, clase: "surface-2 text-soft" };
            return (
              <button key={o.id} onClick={() => setAbierta(o)} className="card card-hover p-4 w-full text-left flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ERP_COLOR + "18" }}>
                  <ShoppingBag size={16} style={{ color: ERP_COLOR }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {o.numero}
                    {o.errorEnvio && <AlertTriangle size={12} className="inline ml-2 text-red-500" />}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {o.proveedor.nombre} · {o.items.length} producto{o.items.length === 1 ? "" : "s"} · {formatDate(o.createdAt)}
                  </p>
                </div>
                <span className="text-sm font-bold text-soft flex-shrink-0">{o.total ? formatCOP(o.total) : "—"}</span>
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0", estado.clase)}>{estado.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {nueva && (
        <NuevaOrden
          proveedores={proveedores}
          onClose={() => setNueva(false)}
          onCreada={() => { setNueva(false); refrescar(); }}
        />
      )}
      {abierta && (
        <DetalleOrden
          orden={ordenes.find(o => o.id === abierta.id) ?? abierta}
          onClose={() => setAbierta(null)}
          onCambio={refrescar}
        />
      )}
    </>
  );
}
