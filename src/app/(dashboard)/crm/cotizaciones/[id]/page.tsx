"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  ArrowLeft, Printer, Loader2, Save, CheckCircle2, Link2, Send, Eye, Mail, AlertTriangle, Pencil } from "lucide-react";
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
  // Vacío = se usa el texto general de Configuración. El general promete
  // "de 2 a 5 días hábiles" y hay obras que se demoran 15.
  const [tiempoEntrega, setTiempoEntrega] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);

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
      setTiempoEntrega(data.tiempoEntrega ?? "");
      setPlantilla(data.plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS");
    }
  }, [data]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, notas, plantilla, tiempoEntrega }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "Error");
      toast.success(estado === "APROBADA" ? "Aprobada — pedido creado" : "Cotización actualizada");
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] });
    } finally { setGuardando(false); }
  };

  const enlace = data?.publicId ? `${window.location.origin}/cotizacion/${data.publicId}` : "";
  // Mientras es BORRADOR, el enlace existe pero NO abre: la página
  // pública hace notFound() para que no se filtre una oferta a medio
  // armar. Copiarlo tal cual era mandarle un 404 al cliente.
  const enlaceAbre = data?.estado !== "BORRADOR";

  /**
   * Compartir el enlace ES entregar la oferta, así que hace lo mismo que
   * enviarla por correo menos el correo: pasa a ENVIADA y arranca el
   * reloj del seguimiento. Antes esto solo se lograba con /enviar, que
   * exige SMTP y el correo del cliente — y aquí se trabaja por WhatsApp.
   */
  const compartirEnlace = async () => {
    if (!data) return;
    if (data.estado === "BORRADOR" && !confirm(
      [
        `El enlace de ${data.numero} no abre mientras sea borrador.`,
        "",
        "Al compartirlo, la cotización pasa a ENVIADA: el cliente va a poder verla",
        "y arrancan los tres toques del seguimiento.",
        "",
        "¿Compartirla?",
      ].join("\n"),
    )) return;

    setCompartiendo(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${id}/compartir`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo compartir");

      await navigator.clipboard.writeText(j.enlace).catch(() => undefined);
      toast.success(
        j.cambioDeEstado
          ? "Enlace copiado. La cotización quedó como ENVIADA."
          : "Enlace copiado — pégalo en WhatsApp",
      );
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] });
    } finally { setCompartiendo(false); }
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
    // AIU. Sin esto el documento no enseña el desglose y la oferta de
    // una obra sale con un IVA que no se explica solo.
    aiuActivo: Boolean(data.aiuActivo),
    aiuAdminPct: Number(data.aiuAdminPct ?? 0),
    aiuImprevPct: Number(data.aiuImprevPct ?? 0),
    aiuUtilidadPct: Number(data.aiuUtilidadPct ?? 0),
    aiuAdmin: Number(data.aiuAdmin ?? 0),
    aiuImprev: Number(data.aiuImprev ?? 0),
    aiuUtilidad: Number(data.aiuUtilidad ?? 0),
    ivaUtilidad: Number(data.ivaUtilidad ?? 0),
    tiempoEntrega,
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
          {(data.estado === "BORRADOR" || data.estado === "ENVIADA") && (
            <Link href={`/crm/cotizaciones/${id}/editar`} className="btn-secondary btn-sm">
              <Pencil size={13} /> Editar
            </Link>
          )}
          <button onClick={compartirEnlace} disabled={compartiendo} className="btn-secondary btn-sm">
            {compartiendo ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            {data.estado === "BORRADOR" ? "Compartir enlace" : "Enlace"}
          </button>
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
                  {!enlaceAbre && (
                    <p className="text-[11px] mt-2 leading-snug" style={{ color: "#d97706" }}>
                      ⚠️ Todavía <strong>no abre</strong>: mientras la cotización sea borrador, quien entre
                      ve un 404. Es a propósito, para que no se filtre una oferta a medio armar.
                      Usa <strong>Compartir enlace</strong> y pasa a Enviada.
                    </p>
                  )}
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

            {/* El plazo de ESTA oferta. El texto general promete 2-5 días
                hábiles y hay obras que se demoran 15: prometer mal un
                plazo cuesta la siguiente compra, no solo esta. */}
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Tiempo de entrega</p>
              <input
                className="input text-xs"
                value={tiempoEntrega}
                onChange={e => setTiempoEntrega(e.target.value)}
                placeholder={config?.tiempoEntrega ?? DEFAULTS.tiempoEntrega}
              />
              <p className="text-[11px] text-muted mt-2">
                {tiempoEntrega
                  ? "Este plazo reemplaza al general solo en esta cotización."
                  : "Vacío = sale el plazo general de Configuración → Cotización."}
              </p>
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
