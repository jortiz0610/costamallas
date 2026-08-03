"use client";

// ============================================================
// Embudo comercial: en cuánto va la tasa de cierre.
//
// La gerencia fijó la meta de pasar del 10% al 28%. Hasta ahora no se
// medía en ninguna parte, así que no había forma de saber si algo de lo
// que se hacía servía. Esta pantalla es el marcador.
// ============================================================

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Loader2, Target, TrendingUp, Clock, Eye, DollarSign, AlertTriangle,
} from "lucide-react";
import { formatCOP, cn } from "@/lib/utils";

const CRM_COLOR = "#BA7517";

interface Asesor {
  id: string; nombre: string; ofertadas: number; aprobadas: number; tasaCierre: number;
  valorOfertado: number; valorGanado: number; ticketPromedio: number; tiempoRespuesta: number | null;
}
interface Embudo {
  periodoDias: number;
  embudo: { borradores: number; ofertadas: number; abiertas: number; aprobadas: number; rechazadas: number; vencidas: number };
  tasaCierre: number; metaCierre: number;
  valorOfertado: number; valorGanado: number; ticketPromedio: number;
  tiempos: { respuesta: number | null; apertura: number | null; cierre: number | null; metaRespuestaHoras: number };
  sinAbrir: number;
  asesores: Asesor[];
}

const horas = (h: number | null) => (h === null ? "—" : h < 24 ? `${h} h` : `${Math.round((h / 24) * 10) / 10} días`);

function EmbudoContent() {
  const [dias, setDias] = useState(90);

  const { data, isLoading } = useQuery<Embudo>({
    queryKey: ["embudo", dias],
    queryFn: async () => (await (await fetch(`/api/crm/embudo?dias=${dias}`)).json()).data,
  });

  return (
    <>
      <Topbar title="Embudo comercial" actions={
        <select className="input py-1 text-xs w-auto" value={dias} onChange={e => setDias(Number(e.target.value))}>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={180}>Últimos 6 meses</option>
          <option value={365}>Último año</option>
        </select>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        {isLoading || !data ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: CRM_COLOR }} /></div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-5">

            {/* Tasa de cierre contra la meta */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                    <Target size={13} /> Tasa de cierre
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    De {data.embudo.ofertadas} cotizaciones ofertadas, {data.embudo.aprobadas} se cerraron.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black leading-none" style={{ color: data.tasaCierre >= data.metaCierre ? "#16a34a" : CRM_COLOR }}>
                    {data.tasaCierre}%
                  </p>
                  <p className="text-[11px] text-muted mt-1">meta {data.metaCierre}%</p>
                </div>
              </div>

              {/* Barra con la marca de la meta */}
              <div className="relative h-3 rounded-full surface-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(data.tasaCierre, 100)}%`,
                    backgroundColor: data.tasaCierre >= data.metaCierre ? "#16a34a" : CRM_COLOR,
                  }}
                />
              </div>
              <div className="relative h-4">
                <div className="absolute top-0" style={{ left: `${Math.min(data.metaCierre, 100)}%` }}>
                  <div className="w-px h-2" style={{ backgroundColor: "#16a34a" }} />
                  <p className="text-[9px] font-bold -translate-x-1/2 mt-0.5" style={{ color: "#16a34a" }}>meta</p>
                </div>
              </div>

              {data.embudo.ofertadas === 0 && (
                <p className="text-xs text-muted mt-3">
                  No hay cotizaciones ofertadas en este periodo. Los borradores no cuentan: nadie los ha visto.
                </p>
              )}
            </div>

            {/* Embudo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "Ofertadas", v: data.embudo.ofertadas, c: "#64748b" },
                { l: "Las abrió el cliente", v: data.embudo.abiertas, c: "#185FA5" },
                { l: "Cerradas", v: data.embudo.aprobadas, c: "#16a34a" },
                { l: "Perdidas o vencidas", v: data.embudo.rechazadas + data.embudo.vencidas, c: "#dc2626" },
              ].map(e => (
                <div key={e.l} className="card p-4">
                  <p className="text-[11px] text-muted">{e.l}</p>
                  <p className="text-2xl font-black" style={{ color: e.c }}>{e.v}</p>
                </div>
              ))}
            </div>

            {data.sinAbrir > 0 && (
              <div className="card p-4 flex items-start gap-3" style={{ borderLeft: "4px solid #f59e0b" }}>
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-600">
                    {data.sinAbrir} cotización{data.sinAbrir === 1 ? "" : "es"} enviada{data.sinAbrir === 1 ? "" : "s"} que el cliente nunca abrió
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Cuando esto es alto, el problema no suele ser el precio: la oferta no está llegando. Vale la pena
                    revisar los correos y confirmar por WhatsApp que la recibieron.
                  </p>
                </div>
              </div>
            )}

            {/* Plata y tiempos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="card p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-1.5">
                  <DollarSign size={13} /> Plata
                </p>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs"><span className="text-muted">Ofertado</span><span className="font-bold text-soft">{formatCOP(data.valorOfertado)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted">Ganado</span><span className="font-bold" style={{ color: "#16a34a" }}>{formatCOP(data.valorGanado)}</span></div>
                  <div className="flex justify-between text-xs pt-2 border-t divider"><span className="text-muted">Ticket promedio</span><span className="font-bold text-soft">{formatCOP(data.ticketPromedio)}</span></div>
                </div>
              </div>

              <div className="card p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-1.5">
                  <Clock size={13} /> Tiempos
                </p>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">En cotizar</span>
                    <span className={cn("font-bold", data.tiempos.respuesta !== null && data.tiempos.respuesta > data.tiempos.metaRespuestaHoras ? "text-red-600" : "text-soft")}>
                      {horas(data.tiempos.respuesta)}
                      <span className="text-muted font-normal"> · meta {data.tiempos.metaRespuestaHoras} h</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted flex items-center gap-1"><Eye size={11} /> En abrirla el cliente</span>
                    <span className="font-bold text-soft">{horas(data.tiempos.apertura)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">En decidir</span>
                    <span className="font-bold text-soft">{horas(data.tiempos.cierre)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted mt-3">
                  Los tiempos solo cuentan cotizaciones enviadas desde el portal. Las que se mandan por fuera no dejan marca.
                </p>
              </div>
            </div>

            {/* Por asesor */}
            <div className="card overflow-hidden">
              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                  <TrendingUp size={13} /> Por asesor
                </p>
              </div>
              {data.asesores.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted">Sin datos en este periodo.</p>
              ) : (
                <div className="table-wrapper" style={{ border: "none" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Asesor</th>
                        <th className="text-right">Ofertadas</th>
                        <th className="text-right">Cerradas</th>
                        <th className="text-right">Cierre</th>
                        <th className="text-right">Ganado</th>
                        <th className="text-right">Ticket</th>
                        <th className="text-right">En cotizar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.asesores.map(a => (
                        <tr key={a.id}>
                          <td className="font-medium text-gray-800 dark:text-gray-100">{a.nombre}</td>
                          <td className="text-right">{a.ofertadas}</td>
                          <td className="text-right">{a.aprobadas}</td>
                          <td className="text-right font-bold" style={{ color: a.tasaCierre >= data.metaCierre ? "#16a34a" : CRM_COLOR }}>
                            {a.tasaCierre}%
                          </td>
                          <td className="text-right font-semibold">{formatCOP(a.valorGanado)}</td>
                          <td className="text-right text-muted">{formatCOP(a.ticketPromedio)}</td>
                          <td className="text-right text-muted">{horas(a.tiempoRespuesta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted">
              El embudo se mide sobre cotizaciones, no sobre pedidos: empieza cuando se hace una oferta y se cierra
              cuando el cliente la aprueba. Los borradores ({data.embudo.borradores} en este periodo) no cuentan.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><EmbudoContent /></Suspense>; }
