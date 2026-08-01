"use client";

// ============================================================
// Cartera por antigüedad
//
// "Cuánto nos deben" ya se veía en Facturación. Lo que hacía falta para
// cobrar es "desde cuándo" y "a quién llamar primero": eso es esta
// pantalla. El cálculo vive en /api/facturacion/cartera.
// ============================================================

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Loader2, AlertTriangle, Clock, Users, DollarSign, Mail, Phone, Send, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP, formatDate, cn } from "@/lib/utils";

const ERP_COLOR = "#185FA5";

interface ClienteDeuda {
  clienteId: string; nombre: string; empresa: string | null;
  email: string | null; telefono: string | null;
  saldo: number; facturas: number; diasMax: number;
}

interface FacturaCartera {
  id: string; numero: string; estado: string; total: number; saldoPendiente: number;
  fechaVence: string | null; diasVencida: number; vencida: boolean; tramo: string;
  sinFechaVencimiento: boolean;
  cliente: { id: string; nombre: string; empresa: string | null; email: string | null; telefono: string | null };
}

interface Cartera {
  resumen: {
    totalPorCobrar: number; totalVencido: number; totalCorriente: number;
    facturasPendientes: number; facturasVencidas: number; clientesConDeuda: number;
    diasPromedioPonderado: number; sinFechaVencimiento: number;
  };
  tramos: Record<string, { monto: number; facturas: number }>;
  clientes: ClienteDeuda[];
  facturas: FacturaCartera[];
}

const TRAMOS = [
  { id: "corriente", label: "Al día",      color: "#16a34a" },
  { id: "d1_30",     label: "1 a 30 días", color: "#d97706" },
  { id: "d31_60",    label: "31 a 60",     color: "#ea580c" },
  { id: "d61_90",    label: "61 a 90",     color: "#dc2626" },
  { id: "d90_mas",   label: "Más de 90",   color: "#991b1b" },
];

function CarteraContent() {
  const [tramo, setTramo] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<Cartera>({
    queryKey: ["cartera"],
    queryFn: async () => (await (await fetch("/api/facturacion/cartera")).json()).data,
  });

  const recordar = async (f: FacturaCartera) => {
    const destino = f.cliente.email;
    if (!destino) return toast.error(`${f.cliente.nombre} no tiene correo en el CRM`);
    if (!confirm(`¿Enviar recordatorio de la factura ${f.numero} a ${destino}?`)) return;

    setEnviando(f.id);
    try {
      const res = await fetch(`/api/facturacion/facturas/${f.id}/recordatorio`, { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo enviar");
      toast.success(j.mensaje ?? "Recordatorio enviado");
      refetch();
    } finally { setEnviando(null); }
  };

  const resumen = data?.resumen;
  const facturas = (data?.facturas ?? []).filter(f => !tramo || f.tramo === tramo);

  return (
    <>
      <Topbar title="Cartera" actions={
        <Link href="/facturacion" className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 surface-2 text-soft">
          <ArrowLeft size={13} /> Facturas
        </Link>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5">
        {isLoading || !resumen ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: ERP_COLOR }} /></div>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l: "Por cobrar", v: formatCOP(resumen.totalPorCobrar), c: ERP_COLOR, Icon: DollarSign, sub: `${resumen.facturasPendientes} facturas` },
                { l: "Vencido", v: formatCOP(resumen.totalVencido), c: "#dc2626", Icon: AlertTriangle, sub: `${resumen.facturasVencidas} facturas` },
                { l: "Días promedio", v: `${resumen.diasPromedioPonderado}`, c: "#d97706", Icon: Clock, sub: "ponderado por monto" },
                { l: "Clientes deben", v: `${resumen.clientesConDeuda}`, c: "#7c3aed", Icon: Users, sub: "con saldo pendiente" },
              ].map(k => {
                const Icon = k.Icon;
                return (
                  <div key={k.l} className="card p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: k.c + "18" }}>
                      <Icon size={18} style={{ color: k.c }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{k.l}</p>
                      <p className="text-lg font-bold truncate" style={{ color: k.c }}>{k.v}</p>
                      <p className="text-[10px] text-muted">{k.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {resumen.sinFechaVencimiento > 0 && (
              <div className="card p-4 text-xs" style={{ borderLeft: "4px solid #f59e0b" }}>
                <p className="font-bold text-amber-600 mb-0.5">
                  {resumen.sinFechaVencimiento} factura{resumen.sinFechaVencimiento === 1 ? "" : "s"} sin fecha de vencimiento
                </p>
                <p className="text-muted">
                  Se les calculó la antigüedad con la fecha de emisión para no dejarlas fuera del análisis.
                  Corrígelas para que el cobro sea exacto.
                </p>
              </div>
            )}

            {/* Tramos */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {TRAMOS.map(t => {
                const dato = data.tramos[t.id] ?? { monto: 0, facturas: 0 };
                const activo = tramo === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTramo(activo ? "" : t.id)}
                    className={cn("card p-4 text-left transition-all", activo && "ring-2")}
                    style={{ borderLeft: `3px solid ${t.color}`, ...(activo ? { "--tw-ring-color": t.color } as React.CSSProperties : {}) }}
                  >
                    <p className="text-xs text-muted">{t.label}</p>
                    <p className="text-base font-bold truncate" style={{ color: t.color }}>{formatCOP(dato.monto)}</p>
                    <p className="text-[10px] text-muted">{dato.facturas} factura{dato.facturas === 1 ? "" : "s"}</p>
                  </button>
                );
              })}
            </div>

            {/* Clientes con más deuda */}
            {data.clientes.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">Quién debe más</h2>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {data.clientes.map(c => (
                    <div key={c.clienteId} className="flex items-center gap-3 p-2.5 rounded-xl surface-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-soft truncate">{c.empresa || c.nombre}</p>
                        <div className="flex gap-3 mt-0.5">
                          {c.email && <span className="text-[10px] text-muted flex items-center gap-1 truncate"><Mail size={9} />{c.email}</span>}
                          {c.telefono && <span className="text-[10px] text-muted flex items-center gap-1"><Phone size={9} />{c.telefono}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-soft">{formatCOP(c.saldo)}</p>
                        <p className="text-[10px] text-muted">
                          {c.facturas} factura{c.facturas === 1 ? "" : "s"}
                          {c.diasMax > 0 && <span className="text-red-500 font-semibold"> · hasta {c.diasMax}d</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Facturas */}
            <div className="card overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  Facturas pendientes {tramo && <span className="text-xs font-normal text-muted">· {TRAMOS.find(t => t.id === tramo)?.label}</span>}
                </h2>
                <span className="text-xs text-muted">{facturas.length}</span>
              </div>
              {facturas.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted">
                  {tramo ? "No hay facturas en este tramo." : "No hay nada pendiente de cobro."}
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: "none" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Número</th><th>Cliente</th><th>Vence</th>
                        <th className="text-right">Saldo</th><th className="text-right">Días</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturas.map(f => (
                        <tr key={f.id}>
                          <td className="font-mono text-xs font-bold">
                            <Link href={`/facturacion/${f.id}`} style={{ color: ERP_COLOR }}>{f.numero}</Link>
                          </td>
                          <td className="font-medium text-gray-800 dark:text-gray-100">
                            {f.cliente.empresa || f.cliente.nombre}
                            {!f.cliente.email && <span className="ml-2 text-[10px] text-amber-600">sin correo</span>}
                          </td>
                          <td className="text-xs text-muted">
                            {f.fechaVence ? formatDate(f.fechaVence) : <span className="text-amber-600">sin fecha</span>}
                          </td>
                          <td className="text-right font-semibold">{formatCOP(f.saldoPendiente)}</td>
                          <td className="text-right text-xs" style={{ color: f.vencida ? "#dc2626" : "#16a34a" }}>
                            {f.vencida ? `${f.diasVencida}` : "al día"}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => recordar(f)}
                              disabled={enviando === f.id || !f.cliente.email}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
                              style={{ backgroundColor: ERP_COLOR + "18", color: ERP_COLOR }}
                            >
                              {enviando === f.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Recordar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted">
              El recordatorio se envía por correo con el saldo pendiente y cambia de tono según la antigüedad.
              Necesita el correo saliente configurado en Configuración → Correo.
            </p>
          </>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><CarteraContent /></Suspense>; }
