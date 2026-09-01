"use client";

// ============================================================
// Lo que contestan los clientes.
//
// La encuesta se venía mandando desde hace semanas y no había ninguna
// pantalla para leerla: las respuestas entraban a la base y ahí se
// quedaban. Esta es esa pantalla.
//
// Dos decisiones sobre qué se enseña primero:
//
//   1. La TASA DE RESPUESTA va antes que el NPS, y en grande. Un NPS de
//      80 con un 15 % de respuesta no dice que la gente esté encantada:
//      dice que contestaron los contentos. Poner la nota primero invita
//      a celebrar un número que todavía no significa nada.
//   2. Los DETRACTORES van arriba del todo y con nombre. Un cliente que
//      puso 4 es una llamada que hay que hacer esta semana, no una
//      celda de una tabla. El promedio se puede mirar el mes que viene;
//      él, no.
// ============================================================

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import {
  Loader2, ArrowLeft, MessageSquareQuote, PhoneCall, Inbox, ThumbsUp,
} from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";

interface Resumen {
  enviadas: number; respondidas: number; tasaRespuesta: number;
  nps: number | null; promotores: number; pasivos: number; detractores: number;
  promedios: Record<string, number | null>;
}
interface Respuesta {
  id: string;
  cliente: string | null; pedido: string | null; vendedor: string | null;
  nps: number | null;
  grupo: "promotor" | "pasivo" | "detractor" | null;
  destacaria: string | null; recomendaciones: string | null;
  respondidaEn: string | null; enviadaEn: string | null;
}
interface Datos {
  resumen: Resumen;
  respuestas: Respuesta[];
  preguntas: { campo: string; texto: string }[];
}

const COLOR_GRUPO = {
  promotor: "#16a34a",
  pasivo: "#d97706",
  detractor: "#dc2626",
} as const;

const NOMBRE_GRUPO = {
  promotor: "Promotor",
  pasivo: "Pasivo",
  detractor: "Detractor",
} as const;

function fecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/** Un número grande con su explicación debajo. */
function Dato({ valor, titulo, ayuda, color }: {
  valor: string; titulo: string; ayuda: string; color?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-[32px] font-bold leading-none tabular-nums" style={{ color: color ?? "var(--text-soft)" }}>
        {valor}
      </p>
      <p className="text-[13px] font-semibold text-soft mt-2">{titulo}</p>
      <p className="text-[11.5px] text-muted mt-1 leading-relaxed">{ayuda}</p>
    </div>
  );
}

/** Un promedio de 0 a 10, con su barra. */
function Barra({ texto, valor }: { texto: string; valor: number | null }) {
  const pct = valor === null ? 0 : (valor / 10) * 100;
  // Verde de 8 en adelante, ámbar de 6 a 8, rojo por debajo. No es
  // decoración: en una lista de siete promedios parecidos, el color es
  // lo único que hace saltar el que está mal.
  const color = valor === null ? "#cbd5e1" : valor >= 8 ? "#16a34a" : valor >= 6 ? "#d97706" : "#dc2626";
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-[12.5px] text-soft flex-1 min-w-0">{texto}</span>
      <div className="w-28 sm:w-40 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] font-bold tabular-nums w-9 text-right flex-shrink-0"
        style={{ color: valor === null ? "var(--text-muted)" : color }}>
        {valor === null ? "—" : valor.toFixed(1)}
      </span>
    </div>
  );
}

function Ficha({ r }: { r: Respuesta }) {
  const color = r.grupo ? COLOR_GRUPO[r.grupo] : "#94a3b8";
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-[15px] tabular-nums"
          style={{ backgroundColor: color + "1f", color }}>
          {r.nps ?? "—"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-soft truncate">{r.cliente ?? "Cliente sin nombre"}</p>
          <p className="text-[11.5px] text-muted mt-0.5">
            {[r.pedido, r.vendedor, fecha(r.respondidaEn)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {r.grupo && (
          <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg flex-shrink-0"
            style={{ backgroundColor: color + "1f", color }}>
            {NOMBRE_GRUPO[r.grupo]}
          </span>
        )}
      </div>

      {(r.destacaria || r.recomendaciones) && (
        <div className="mt-3 space-y-2.5">
          {r.destacaria && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1">Qué destacaría</p>
              <p className="text-[13px] text-soft leading-relaxed">{r.destacaria}</p>
            </div>
          )}
          {r.recomendaciones && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1">Qué mejorar</p>
              <p className="text-[13px] text-soft leading-relaxed">{r.recomendaciones}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Contenido() {
  const { brand } = useBrand();
  const [dias, setDias] = useState(0);

  const { data, isLoading, error } = useQuery<Datos>({
    queryKey: ["encuestas-resumen", dias],
    queryFn: async () => {
      const res = await fetch(`/api/encuestas/resumen${dias ? `?dias=${dias}` : ""}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "No se pudo cargar");
      return json.data as Datos;
    },
  });

  const contestadas = (data?.respuestas ?? []).filter(r => r.respondidaEn);
  const detractores = contestadas.filter(r => r.grupo === "detractor");
  const conComentario = contestadas.filter(r => r.destacaria || r.recomendaciones);
  const sinContestar = (data?.respuestas ?? []).filter(r => !r.respondidaEn).length;

  return (
    <>
      <Topbar title="Resultados de la encuesta" actions={
        <div className="flex items-center gap-2">
          <select value={dias} onChange={e => setDias(Number(e.target.value))} className="input btn-sm max-w-[9rem]">
            <option value={0}>Desde el principio</option>
            <option value={90}>Últimos 3 meses</option>
            <option value={30}>Último mes</option>
          </select>
          <Link href="/postventa" className="btn-secondary btn-sm">
            <ArrowLeft size={13} /> Postventa
          </Link>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-4 sm:p-6">
        {isLoading ? (
          <div className="card p-10 text-center">
            <Loader2 size={18} className="animate-spin mx-auto" style={{ color: brand.brandColor }} />
          </div>
        ) : error ? (
          <div className="card p-8 max-w-lg mx-auto text-center">
            <p className="text-sm font-bold text-soft">No se pudo cargar</p>
            <p className="text-xs text-muted mt-2">{(error as Error).message}</p>
          </div>
        ) : !data || data.resumen.enviadas === 0 ? (
          <div className="card p-10 max-w-lg mx-auto text-center">
            <Inbox size={26} className="mx-auto mb-3 text-muted" />
            <p className="text-sm font-bold text-soft">Todavía no se ha mandado ninguna encuesta</p>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Sale sola cuando se cierra una instalación. En cuanto termines la primera obra, aquí aparece.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-5">

            {/* Lo primero: cuánta gente contesta. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Dato
                valor={`${data.resumen.tasaRespuesta}%`}
                titulo="Contestan"
                ayuda={`${data.resumen.respondidas} de ${data.resumen.enviadas} encuestas. Mire esto antes que la nota: con poca respuesta, los promedios no representan a sus clientes.`}
                color={data.resumen.tasaRespuesta >= 30 ? "#16a34a" : data.resumen.tasaRespuesta >= 15 ? "#d97706" : "#dc2626"}
              />
              <Dato
                valor={data.resumen.nps === null ? "—" : String(data.resumen.nps)}
                titulo="NPS"
                ayuda="Promotores menos detractores, de −100 a 100. Por encima de 50 se considera muy bueno."
                color={data.resumen.nps === null ? undefined
                  : data.resumen.nps >= 50 ? "#16a34a" : data.resumen.nps >= 0 ? "#d97706" : "#dc2626"}
              />
              <div className="card p-5">
                <p className="text-[13px] font-semibold text-soft mb-3">Cómo se reparten</p>
                {([
                  ["promotor", "Promotores", data.resumen.promotores, "9 y 10"],
                  ["pasivo", "Pasivos", data.resumen.pasivos, "7 y 8"],
                  ["detractor", "Detractores", data.resumen.detractores, "0 a 6"],
                ] as const).map(([g, label, n, rango]) => (
                  <div key={g} className="flex items-center gap-2 py-1">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_GRUPO[g] }} />
                    <span className="text-[12.5px] text-soft flex-1">{label}</span>
                    <span className="text-[11px] text-muted">{rango}</span>
                    <span className="text-[13px] font-bold tabular-nums w-6 text-right">{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Los que hay que llamar. */}
            {detractores.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <PhoneCall size={15} className="text-red-600" />
                  <h2 className="text-[15px] font-bold text-soft">Llame a estos {detractores.length}</h2>
                </div>
                <p className="text-[12px] text-muted mb-3 leading-relaxed">
                  Puntuaron 6 o menos. Un cliente molesto al que llaman a los tres días suele volver;
                  al que no, no se le vuelve a ver y además lo cuenta.
                </p>
                <div className="space-y-3">
                  {detractores.map(r => <Ficha key={r.id} r={r} />)}
                </div>
              </div>
            )}

            {/* Los promedios del formato. */}
            <div className="card p-5">
              <h2 className="text-[15px] font-bold text-soft mb-1">Promedios</h2>
              <p className="text-[11.5px] text-muted mb-3">
                De 0 a 10, sobre las {data.resumen.respondidas} respuestas.
              </p>
              <div className="divide-y divider">
                {data.preguntas
                  .filter(p => p.campo !== "recomendaria")
                  .map(p => (
                    <Barra key={p.campo} texto={p.texto} valor={data.resumen.promedios[p.campo] ?? null} />
                  ))}
              </div>
            </div>

            {/* Lo que escribieron. */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquareQuote size={15} style={{ color: brand.brandColor }} />
                <h2 className="text-[15px] font-bold text-soft">
                  Lo que escribieron {conComentario.length > 0 && <span className="text-muted font-medium">({conComentario.length})</span>}
                </h2>
              </div>
              {conComentario.length === 0 ? (
                <div className="card p-6 text-center">
                  <p className="text-[13px] text-muted">
                    Nadie ha escrito nada todavía. Los dos campos de texto son opcionales.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conComentario
                    .filter(r => r.grupo !== "detractor")
                    .map(r => <Ficha key={r.id} r={r} />)}
                </div>
              )}
            </div>

            {/* Las que siguen sin respuesta. */}
            {sinContestar > 0 && (
              <div className="card p-4 flex items-start gap-3">
                <ThumbsUp size={15} className="text-muted mt-0.5 flex-shrink-0" />
                <p className="text-[12.5px] text-muted leading-relaxed">
                  Hay <strong className="text-soft">{sinContestar}</strong> encuestas mandadas que nadie ha contestado.
                  Es normal: en este tipo de encuesta contesta entre el 15 % y el 30 %. Si baja mucho de ahí,
                  suele ser que el correo llega tarde, no que el servicio esté mal.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Contenido /></Suspense>;
}
