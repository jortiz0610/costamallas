"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ArrowLeft, Printer, Loader2, Send, DollarSign, Ban, X } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useBrand } from "@/contexts/BrandContext";
import { FacturaPDF, type FacturaPDFData } from "@/components/facturacion/FacturaPDF";
import { formatCOP } from "@/lib/utils";

const ERP_COLOR = "#185FA5";

function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { brand } = useBrand();
  const [emitiendo, setEmitiendo] = useState(false);
  const [modalPago, setModalPago] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["factura", id],
    queryFn: async () => (await (await fetch(`/api/facturacion/facturas/${id}`)).json()).data,
  });

  const emitir = async () => {
    setEmitiendo(true);
    try {
      const res = await fetch(`/api/facturacion/facturas/${id}/emitir`, { method: "POST" });
      const json = await res.json();
      if (json.success) toast.success("Factura emitida");
      else toast(json.error ?? "Revisa la configuración", { icon: "ℹ️" });
      qc.invalidateQueries({ queryKey: ["factura", id] });
    } catch { toast.error("Error"); } finally { setEmitiendo(false); }
  };

  const anular = async () => {
    if (!confirm("¿Anular esta factura? No se puede deshacer.")) return;
    await fetch(`/api/facturacion/facturas/${id}`, { method: "DELETE" });
    toast.success("Factura anulada");
    qc.invalidateQueries({ queryKey: ["factura", id] });
  };

  if (isLoading) return <><Topbar title="Factura" /><div className="flex-1 flex items-center justify-center page-bg"><Loader2 size={22} className="animate-spin" style={{ color: ERP_COLOR }} /></div></>;
  if (!data) return <><Topbar title="Factura" /><div className="flex-1 flex items-center justify-center page-bg"><p className="text-sm text-muted">No se encontró la factura</p></div></>;

  const pdf: FacturaPDFData = {
    numero: data.numero, prefijo: data.prefijo, consecutivo: data.consecutivo, createdAt: data.createdAt,
    fechaVence: data.fechaVence, estado: data.estado, estadoDian: data.estadoDian, cufe: data.cufe,
    subtotal: Number(data.subtotal), descuento: Number(data.descuento), iva: Number(data.iva), total: Number(data.total),
    saldoPendiente: Number(data.saldoPendiente), notas: data.notas, cliente: data.cliente, items: data.items,
  };

  return (
    <>
      <Topbar title={`Factura ${data.numero}`} actions={
        <div className="flex items-center gap-2 no-print">
          <Link href="/facturacion" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
          <button onClick={() => window.print()} className="btn-secondary btn-sm"><Printer size={13} /> Imprimir</button>
        </div>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
          {/* Acciones */}
          <div className="lg:col-span-1 space-y-4 no-print">
            <div className="card p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Acciones</p>
              {data.estado === "BORRADOR" && (
                <button onClick={emitir} disabled={emitiendo} className="btn-primary w-full justify-center">{emitiendo ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Emitir factura</button>
              )}
              {data.estado !== "ANULADA" && Number(data.saldoPendiente) > 0 && (
                <button onClick={() => setModalPago(true)} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: "#16a34a" }}><DollarSign size={14} /> Registrar pago</button>
              )}
              {data.estado !== "ANULADA" && (
                <button onClick={anular} className="btn-secondary w-full justify-center text-red-500"><Ban size={14} /> Anular</button>
              )}
            </div>

            {/* Resumen pago */}
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Cartera</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-soft"><span>Total</span><span className="font-semibold">{formatCOP(Number(data.total))}</span></div>
                <div className="flex justify-between text-soft"><span>Pagado</span><span>{formatCOP(Number(data.total) - Number(data.saldoPendiente))}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t divider" style={{ color: Number(data.saldoPendiente) > 0 ? "#dc2626" : "#16a34a" }}><span>Saldo</span><span>{formatCOP(Number(data.saldoPendiente))}</span></div>
              </div>
              {data.pagos?.length > 0 && (
                <div className="mt-3 pt-3 border-t divider space-y-1">
                  {data.pagos.map((p: { id: string; monto: number; metodo: string; fecha: string }) => (
                    <div key={p.id} className="flex justify-between text-xs text-muted"><span>{new Date(p.fecha).toLocaleDateString("es-CO")} · {p.metodo}</span><span>{formatCOP(Number(p.monto))}</span></div>
                  ))}
                </div>
              )}
            </div>

            {data.estadoDian !== "NO_APLICA" && (
              <div className="card p-4 text-xs">
                <p className="font-bold text-muted uppercase tracking-widest mb-1">DIAN</p>
                <p className="text-soft">Estado: {data.estadoDian}</p>
                {data.mensajeDian && <p className="text-muted mt-1">{data.mensajeDian}</p>}
              </div>
            )}
          </div>

          {/* PDF */}
          <div className="lg:col-span-2 print-area">
            <FacturaPDF data={pdf} brand={brand} />
          </div>
        </div>
      </div>

      {modalPago && <ModalPago facturaId={id} saldo={Number(data.saldoPendiente)} onClose={() => setModalPago(false)} onSaved={() => { setModalPago(false); qc.invalidateQueries({ queryKey: ["factura", id] }); }} />}
    </>
  );
}

function ModalPago({ facturaId, saldo, onClose, onSaved }: { facturaId: string; saldo: number; onClose: () => void; onSaved: () => void }) {
  const [monto, setMonto] = useState(String(saldo));
  const [metodo, setMetodo] = useState("TRANSFERENCIA");
  const [referencia, setReferencia] = useState("");
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/facturacion/facturas/${facturaId}/pago`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monto, metodo, referencia }) });
      const json = await res.json();
      if (!json.success) return toast.error(json.error ?? "Error");
      toast.success("Pago registrado");
      onSaved();
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><DollarSign size={16} className="text-emerald-500" /> Registrar pago</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Monto</label>
            <input type="number" className="input" value={monto} onChange={e => setMonto(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Método</label>
            <select className="input" value={metodo} onChange={e => setMetodo(e.target.value)}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Referencia (opcional)</label>
            <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="N° de transacción" />
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: "#16a34a" }}>{saving && <Loader2 size={13} className="animate-spin" />} Registrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><FacturaDetalle /></Suspense>; }
