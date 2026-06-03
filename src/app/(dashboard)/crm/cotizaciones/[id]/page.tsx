"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { ArrowLeft, Printer, Loader2, Save, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useBrand } from "@/contexts/BrandContext";
import { CotizacionPDF, type CotizacionPDFData } from "@/components/crm/CotizacionPDF";

const CRM_COLOR = "#BA7517";
const ESTADOS = [
  { v: "BORRADOR", l: "Borrador", c: "#64748b" },
  { v: "ENVIADA", l: "Enviada", c: "#185FA5" },
  { v: "APROBADA", l: "Aprobada", c: "#16a34a" },
  { v: "RECHAZADA", l: "Rechazada", c: "#dc2626" },
  { v: "VENCIDA", l: "Vencida", c: "#d97706" },
];

function DetalleContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { brand } = useBrand();
  const [estado, setEstado] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: async () => (await (await fetch(`/api/crm/cotizaciones/${id}`)).json()).data,
  });

  useEffect(() => {
    if (data) { setEstado(data.estado); setNotas(data.notas ?? ""); }
  }, [data]);

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado, notas }) });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success(estado === "APROBADA" ? "Aprobada — pedido creado ✓" : "Cotización actualizada");
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] });
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  if (isLoading) return <><Topbar title="Cotización" /><div className="flex-1 flex items-center justify-center page-bg"><Loader2 size={22} className="animate-spin" style={{ color: CRM_COLOR }} /></div></>;
  if (!data) return <><Topbar title="Cotización" /><div className="flex-1 flex items-center justify-center page-bg"><p className="text-sm text-muted">No se encontró la cotización</p></div></>;

  const pdfData: CotizacionPDFData = {
    numero: data.numero, createdAt: data.createdAt, validezDias: data.validezDias,
    estado: data.estado, notas, subtotal: Number(data.subtotal), descuento: Number(data.descuento ?? 0),
    iva: Number(data.iva ?? 0), total: Number(data.total), tieneInstalacion: data.tieneInstalacion,
    cliente: data.cliente, items: data.items, vendedor: data.vendedor,
  };

  return (
    <>
      <Topbar title={`Cotización ${data.numero}`} actions={
        <div className="flex items-center gap-2 no-print">
          <Link href="/crm/cotizaciones" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
          <button onClick={() => window.print()} className="btn-secondary btn-sm"><Printer size={13} /> Imprimir / PDF</button>
        </div>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
          {/* Panel edición */}
          <div className="lg:col-span-1 space-y-4 no-print">
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Estado</p>
              <div className="grid grid-cols-2 gap-2">
                {ESTADOS.map(e => (
                  <button key={e.v} onClick={() => setEstado(e.v)}
                    className="py-2 rounded-lg text-xs font-semibold transition-all"
                    style={estado === e.v ? { backgroundColor: e.c, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                    {e.l}
                  </button>
                ))}
              </div>
              {estado === "APROBADA" && data.estado !== "APROBADA" && (
                <p className="text-[11px] text-emerald-600 mt-3 flex items-center gap-1"><CheckCircle2 size={12} /> Al guardar se creará un pedido automáticamente.</p>
              )}
            </div>
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Notas y condiciones</p>
              <textarea className="input resize-none" rows={5} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Condiciones comerciales, garantías, tiempos de entrega…" />
            </div>
            <button onClick={guardar} disabled={saving} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar cambios
            </button>
          </div>

          {/* PDF */}
          <div className="lg:col-span-2 print-area">
            <CotizacionPDF data={pdfData} brand={brand} />
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><DetalleContent /></Suspense>; }
