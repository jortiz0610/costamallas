"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ArrowLeft, Loader2, Plus, Trash2, Search, X, FileText } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";

const ERP_COLOR = "#185FA5";

interface PedidoOpt { id: string; numero: string; total: number; cliente: { nombre: string }; }
interface Cliente { id: string; nombre: string; empresa?: string; }
interface Item { descripcion: string; cantidad: number; precioUnitario: number; ivaPct: number; }

function NuevaFacturaContent() {
  const router = useRouter();
  const [modo, setModo] = useState<"pedido" | "manual">("pedido");
  const [pedidoId, setPedidoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteBusq, setClienteBusq] = useState("");
  const [items, setItems] = useState<Item[]>([{ descripcion: "", cantidad: 1, precioUnitario: 0, ivaPct: 19 }]);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: pedidos = [] } = useQuery<PedidoOpt[]>({
    queryKey: ["pedidos-fact"], queryFn: async () => (await (await fetch("/api/crm/pedidos")).json()).data ?? [],
  });
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["clientes-fact", clienteBusq],
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(clienteBusq)}`)).json()).data ?? [],
    enabled: clienteBusq.length > 1,
  });
  const clienteSel = clientes.find(c => c.id === clienteId);

  const updItem = (i: number, k: keyof Item, v: unknown) => setItems(p => { const n = [...p]; n[i] = { ...n[i], [k]: v }; return n; });
  const subtotal = items.reduce((a, it) => a + it.cantidad * it.precioUnitario, 0);
  const iva = items.reduce((a, it) => a + it.cantidad * it.precioUnitario * (it.ivaPct / 100), 0);

  const crear = async () => {
    setSaving(true);
    try {
      const body = modo === "pedido" ? { pedidoId, notas } : { clienteId, items, notas };
      if (modo === "pedido" && !pedidoId) { setSaving(false); return toast.error("Selecciona un pedido"); }
      if (modo === "manual" && !clienteId) { setSaving(false); return toast.error("Selecciona un cliente"); }
      const res = await fetch("/api/facturacion/facturas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success("Factura creada");
      router.push(`/facturacion/${json.data.id}`);
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <>
      <Topbar title="Nueva factura" actions={
        <div className="flex items-center gap-2">
          <Link href="/facturacion" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
          <button onClick={crear} disabled={saving} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: ERP_COLOR }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Crear factura
          </button>
        </div>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5 max-w-3xl mx-auto w-full">
        {/* Modo */}
        <div className="flex gap-2">
          {([["pedido", "Desde un pedido"], ["manual", "Manual"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setModo(v)} className="pill" style={modo === v ? { backgroundColor: ERP_COLOR, color: "white" } : {}}>{l}</button>
          ))}
        </div>

        {modo === "pedido" ? (
          <div className="card p-5">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Pedido a facturar</label>
            <select className="input" value={pedidoId} onChange={e => setPedidoId(e.target.value)}>
              <option value="">Selecciona un pedido…</option>
              {pedidos.map(p => <option key={p.id} value={p.id}>{p.numero} · {p.cliente.nombre} · {formatCOP(Number(p.total))}</option>)}
            </select>
            <p className="text-[11px] text-muted mt-2">Se generará la factura con los ítems del pedido seleccionado.</p>
          </div>
        ) : (
          <>
            <div className="card p-5">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Cliente</label>
              {clienteSel ? (
                <div className="flex items-center justify-between rounded-xl px-4 py-2.5 surface-2">
                  <span className="text-sm font-semibold text-soft">{clienteSel.nombre}</span>
                  <button onClick={() => { setClienteId(""); setClienteBusq(""); }} className="text-muted hover:text-red-500"><X size={14} /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input className="input pl-9" value={clienteBusq} onChange={e => setClienteBusq(e.target.value)} placeholder="Buscar cliente…" />
                  {clientes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 card z-10 max-h-44 overflow-y-auto">
                      {clientes.map(c => <button key={c.id} onClick={() => { setClienteId(c.id); setClienteBusq(""); }} className="w-full text-left px-4 py-2 hover:surface-2 text-sm text-soft">{c.nombre}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card p-5 space-y-3">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider">Ítems</label>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-6 py-1.5 text-sm" placeholder="Descripción" value={it.descripcion} onChange={e => updItem(i, "descripcion", e.target.value)} />
                  <input type="number" className="input col-span-2 py-1.5 text-sm" placeholder="Cant" value={it.cantidad} onChange={e => updItem(i, "cantidad", parseFloat(e.target.value) || 0)} />
                  <input type="number" className="input col-span-3 py-1.5 text-sm" placeholder="Precio" value={it.precioUnitario} onChange={e => updItem(i, "precioUnitario", parseFloat(e.target.value) || 0)} />
                  <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="text-muted hover:text-red-500 col-span-1"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => setItems(p => [...p, { descripcion: "", cantidad: 1, precioUnitario: 0, ivaPct: 19 }])} className="text-xs font-semibold flex items-center gap-1" style={{ color: ERP_COLOR }}><Plus size={12} /> Agregar ítem</button>
              <div className="flex justify-end pt-3 border-t divider text-sm">
                <div className="text-right space-y-0.5">
                  <p className="text-muted text-xs">Subtotal {formatCOP(subtotal)} · IVA {formatCOP(iva)}</p>
                  <p className="font-bold" style={{ color: ERP_COLOR }}>Total {formatCOP(subtotal + iva)}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="card p-5">
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Notas</label>
          <textarea className="input resize-none" rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Condiciones, forma de pago…" />
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><NuevaFacturaContent /></Suspense>; }
