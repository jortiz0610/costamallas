"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  ArrowLeft, Printer, Loader2, Save, CheckCircle2, Link2, Send, Eye, Mail, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useBrand } from "@/contexts/BrandContext";
import { CotizacionDoc, type CotizacionDocData } from "@/components/crm/CotizacionDoc";
import { PanelSeguimiento } from "@/components/crm/PanelSeguimiento";
import { PanelPolitica } from "@/components/crm/PanelPolitica";
import { DEFAULTS, type ConfigCotizacion } from "@/lib/cotizacion-textos";
import { formatDate, cn } from "@/lib/utils";

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
  const qc = useQueryClient();
  const { brand } = useBrand();
  const [estado, setEstado] = useState("");
  const [plantilla, setPlantilla] = useState<"EXPRESS" | "PROPUESTA">("EXPRESS");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: async () => (await (await fetch(`/api/crm/cotizaciones/${id}`)).json()).data,
  });

  const { data: config } = useQuery<ConfigCotizacion>({
    queryKey: ["cot-config-doc"],
    queryFn: async () => (await (await fetch("/api/configuracion/cotizacion")).json()).data ?? DEFAULTS,
  });

  useEffect(() => {
    if (data) {
      setEstado(data.estado);
      setNotas(data.notas ?? "");
      setPlantilla(data.plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS");
    }
  }, [data]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, notas, plantilla }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "Error");
      toast.success(estado === "APROBADA" ? "Aprobada — pedido creado" : "Cotización actualizada");
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] });
    } finally { setGuardando(false); }
  };

  const enlace = data?.publicId ? `${window.location.origin}/cotizacion/${data.publicId}` : "";

  const copiarEnlace = async () => {
    if (!enlace) return toast.error("Esta cotización no tiene enlace público");
    await navigator.clipboard.writeText(enlace);
    toast.success("Enlace copiado — pégalo en WhatsApp");
  };

  const enviarCorreo = async () => {
    if (!data?.cliente?.email) return toast.error(`${data?.cliente?.nombre ?? "El cliente"} no tiene correo en el CRM`);
    if (!confirm(`¿Enviar la cotización ${data.numero} a ${data.cliente.email}?`)) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${id}/enviar`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo enviar");
      toast.success(j.mensaje ?? "Cotización enviada");
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    } finally { setEnviando(false); }
  };

  if (isLoading) return <><Topbar title="Cotización" /><div className="flex-1 flex items-center justify-center page-bg"><Loader2 size={22} className="animate-spin" style={{ color: CRM_COLOR }} /></div></>;
  if (!data) return <><Topbar title="Cotización" /><div className="flex-1 flex items-center justify-center page-bg"><p className="text-sm text-muted">No se encontró la cotización</p></div></>;

  const doc: CotizacionDocData = {
    numero: data.numero,
    createdAt: data.createdAt,
    validezDias: data.validezDias,
    notas,
    subtotal: Number(data.subtotal),
    descuento: Number(data.descuento ?? 0),
    iva: Number(data.iva ?? 0),
    total: Number(data.total),
    anticipoPct: data.anticipoPct == null ? null : Number(data.anticipoPct),
    plantilla,
    ciudadInstalacion: data.ciudadInstalacion,
    direccionInstalacion: data.direccionInstalacion,
    cliente: data.cliente,
    vendedor: data.vendedor,
    items: (data.items ?? []).map((i: Record<string, unknown>) => ({
      descripcion: String(i.descripcion),
      detalle: i.detalle as string | null,
      cantidad: Number(i.cantidad),
      precioUnitario: Number(i.precioUnitario),
      subtotal: Number(i.subtotal),
      unidad: i.unidad as string | null,
      tipo: i.tipo as string | null,
      imagenUrl: i.imagenUrl as string | null,
    })),
  };

  return (
    <>
      <Topbar title={`Cotización ${data.numero}`} actions={
        <div className="flex items-center gap-2 no-print">
          <Link href="/crm/cotizaciones" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>
          <button onClick={copiarEnlace} className="btn-secondary btn-sm"><Link2 size={13} /> Enlace</button>
          <button onClick={enviarCorreo} disabled={enviando} className="btn-secondary btn-sm">
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Enviar
          </button>
          <button onClick={() => window.print()} className="btn-secondary btn-sm"><Printer size={13} /> Imprimir / PDF</button>
        </div>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto items-start">

          {/* Panel */}
          <div className="lg:col-span-1 space-y-4 no-print">
            {/* Seguimiento */}
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Seguimiento</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Send size={13} className={data.enviadaEn ? "text-emerald-500" : "text-muted"} />
                  <span className={data.enviadaEn ? "text-soft" : "text-muted"}>
                    {data.enviadaEn ? `Enviada el ${formatDate(data.enviadaEn)}` : "Sin enviar"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Eye size={13} className={data.vistas > 0 ? "text-emerald-500" : "text-muted"} />
                  <span className={data.vistas > 0 ? "text-soft" : "text-muted"}>
                    {data.vistas > 0
                      ? `Abierta ${data.vistas} ${data.vistas === 1 ? "vez" : "veces"} · última ${formatDate(data.vistaUltimaEn)}`
                      : "El cliente aún no la abre"}
                  </span>
                </div>
                {data.errorEnvio && (
                  <div className="flex items-start gap-2 text-xs text-red-600 p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>{data.errorEnvio}</span>
                  </div>
                )}
              </div>
              {enlace && (
                <div className="mt-3 pt-3 border-t divider">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Enlace para el cliente</p>
                  <p className="text-[10px] font-mono text-muted break-all">{enlace}</p>
                </div>
              )}
            </div>

            {/* Descuento, anticipo y visto bueno */}
            <PanelPolitica
              cotizacionId={id}
              datos={{
                descuentoPct: Number(data.descuentoPct ?? 0),
                anticipoPct: data.anticipoPct == null ? null : Number(data.anticipoPct),
                aprobacionEstado: data.aprobacionEstado ?? "NO_REQUIERE",
                aprobacionMotivo: data.aprobacionMotivo ?? null,
                aprobadaPorNombre: data.aprobadaPorNombre ?? null,
                aprobadaEn: data.aprobadaEn ?? null,
                aprobacionNota: data.aprobacionNota ?? null,
                total: Number(data.total),
                esBorrador: data.estado === "BORRADOR",
              }}
            />

            {/* Los tres toques posteriores al envío */}
            <PanelSeguimiento cotizacionId={id} />

            {/* Plantilla */}
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Documento</p>
              <div className="grid grid-cols-2 gap-2">
                {(["EXPRESS", "PROPUESTA"] as const).map(p => (
                  <button key={p} onClick={() => setPlantilla(p)}
                    className={cn("py-2 rounded-lg text-xs font-semibold transition-all", plantilla === p ? "text-white" : "surface-3 text-muted")}
                    style={plantilla === p ? { backgroundColor: CRM_COLOR } : undefined}>
                    {p === "EXPRESS" ? "Express" : "Propuesta"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted mt-2">
                Express es 1-2 hojas. Propuesta arma el dossier con portada y carta.
              </p>
            </div>

            {/* Estado */}
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
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Observaciones de esta oferta</p>
              <textarea className="input resize-none" rows={4} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Lo particular de este negocio…" />
              <p className="text-[11px] text-muted mt-2">
                Las condiciones fijas (garantía, entrega, políticas) salen solas desde Configuración → Cotización.
              </p>
            </div>

            <button onClick={guardar} disabled={guardando} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: CRM_COLOR }}>
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar cambios
            </button>
          </div>

          {/* Documento */}
          <div className="lg:col-span-2 print-area">
            <div className="shadow-2xl print:shadow-none">
              <CotizacionDoc data={doc} brand={brand} config={config ?? DEFAULTS} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><DetalleContent /></Suspense>; }
