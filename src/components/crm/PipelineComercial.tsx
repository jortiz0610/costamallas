"use client";

// ============================================================
// El tablero comercial: dónde está cada oferta.
//
// Los nombres de las etapas los decidió gerencia y describen LO QUE
// PASÓ. La única con nombre imperativo —"Para llamar"— es a propósito:
// es la única donde el vendedor tiene que hacer algo.
//
// Dos cosas que este tablero hace y el de pedidos no podía:
//
//   · **La vuelta de producción grita.** Cuando la visita técnica se
//     entrega, la oferta vuelve a estar en manos del vendedor. Esas
//     tarjetas se pintan en color llamativo, suben al principio de su
//     columna y se cuentan en un aviso arriba del tablero. Sin eso, la
//     visita se queda hecha y nadie vuelve a cotizar.
//   · **Vencidas nace plegada.** Son historia y llenan la pantalla, pero
//     no se esconden: hay un ojito para abrirlas.
// ============================================================

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Loader2, Eye, EyeOff, Phone, Clock, AlertTriangle, ClipboardCheck,
  FlaskConical, MessageCircle, TrendingUp, CalendarPlus, HardHat,
} from "lucide-react";
import { formatCOP, cn } from "@/lib/utils";
import { ETAPAS, type EtapaPipeline } from "@/lib/pipeline";
import { ModalAplazar } from "@/components/crm/ModalAplazar";

interface Tarjeta {
  id: string; numero: string; estado: string; etapa: EtapaPipeline;
  total: number; esPrueba: boolean;
  cliente: { id: string; nombre: string; empresa: string | null; telefono: string | null; whatsapp: string | null };
  vendedor: { id: string; nombre: string } | null;
  creadaEn: string; enviadaEn: string | null; actualizadaEn: string;
  venceEl: string; diasParaVencer: number; prorrogas: number;
  vistas: number; vistaPrimeraEn: string | null;
  pedido: { id: string; numero: string; estado: string } | null;
  requiereVisita: boolean; requiereSgsst: boolean;
  visitaLista: boolean;
  tareaLlamada: string | null;
}

const DIA = 86_400_000;

function diasDesde(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DIA));
}

export function PipelineComercial() {
  const [ocultas, setOcultas] = useState<Record<string, boolean>>(
    Object.fromEntries(ETAPAS.filter(e => e.ocultaPorDefecto).map(e => [e.v, true])),
  );
  const [aplazando, setAplazando] = useState<Tarjeta | null>(null);

  const { data: tarjetas = [], isLoading, refetch } = useQuery<Tarjeta[]>({
    queryKey: ["crm-pipeline"],
    queryFn: async () => (await (await fetch("/api/crm/pipeline")).json()).data ?? [],
  });

  const porEtapa = useMemo(() => {
    const m: Record<string, Tarjeta[]> = {};
    for (const e of ETAPAS) m[e.v] = [];
    for (const t of tarjetas) (m[t.etapa] ??= []).push(t);
    // Lo que espera al vendedor va primero en su columna.
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => Number(b.visitaLista) - Number(a.visitaLista) ||
        new Date(a.venceEl).getTime() - new Date(b.venceEl).getTime());
    }
    return m;
  }, [tarjetas]);

  const conVisitaLista = tarjetas.filter(t => t.visitaLista);

  const marcarLlamado = async (t: Tarjeta) => {
    if (!t.tareaLlamada) return toast.error("Esta oferta no tiene tarea de llamada.");
    // La tarea del toque 2 se cierra por el mismo camino que en la
    // pantalla de tareas: PATCH con el id en el cuerpo.
    const res = await fetch("/api/crm/tareas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.tareaLlamada, estado: "COMPLETADA" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo marcar");
    toast.success(`${t.numero}: llamada marcada`);
    refetch();
  };

  const wa = (t: Tarjeta) => {
    const n = (t.cliente.whatsapp ?? t.cliente.telefono ?? "").replace(/\D/g, "");
    if (!n) return null;
    return `https://wa.me/${n.length === 10 ? "57" + n : n}`;
  };

  if (isLoading) {
    return <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* El aviso que hace que la vuelta de producción no se pierda. */}
      {conVisitaLista.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: "#fff7ed", border: "2px solid #f97316" }}
        >
          <ClipboardCheck size={18} style={{ color: "#c2410c" }} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-bold" style={{ color: "#9a3412" }}>
              {conVisitaLista.length} oportunidad{conVisitaLista.length === 1 ? "" : "es"} con la visita técnica lista
            </p>
            <p className="text-[11.5px]" style={{ color: "#c2410c" }}>
              Producción ya entregó las medidas y la requisición. Te toca cotizar en firme:{" "}
              {conVisitaLista.slice(0, 4).map(t => t.numero).join(", ")}
              {conVisitaLista.length > 4 && ` y ${conVisitaLista.length - 4} más`}.
            </p>
          </div>
        </div>
      )}

      {/* En escritorio, un tablero de columnas que se desliza. En el
          teléfono, las etapas UNA DEBAJO DE OTRA: un kanban horizontal en
          375 px obliga a arrastrar de lado para saber cuántos negocios
          hay en cada etapa, que es justamente lo único que se mira. */}
      <div className="flex flex-col lg:flex-row gap-3 lg:overflow-x-auto pb-3">
        {ETAPAS.map(e => {
          const lista = porEtapa[e.v] ?? [];
          const plegada = ocultas[e.v];
          const plata = lista.reduce((s, t) => s + t.total, 0);

          return (
            <div key={e.v} className={cn("lg:flex-shrink-0 w-full", plegada ? "lg:w-14" : "lg:w-[280px]")}>
              <div
                className="rounded-t-xl px-3 py-2.5"
                style={{ backgroundColor: e.bg, borderBottom: `3px solid ${e.color}` }}
              >
                <div className="flex items-center gap-2">
                  {!plegada && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-bold uppercase tracking-wide truncate" style={{ color: e.color }}>
                        {e.l}
                      </p>
                      <p className="text-[10px] leading-snug mt-0.5" style={{ color: e.color, opacity: 0.75 }}>
                        {e.descripcion}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setOcultas(o => ({ ...o, [e.v]: !o[e.v] }))}
                    title={plegada ? `Mostrar ${e.l}` : `Ocultar ${e.l}`}
                    className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ color: e.color }}
                  >
                    {plegada ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-[15px] font-bold" style={{ color: e.color }}>{lista.length}</span>
                  {!plegada && plata > 0 && (
                    <span className="text-[10.5px]" style={{ color: e.color, opacity: 0.8 }}>{formatCOP(plata)}</span>
                  )}
                </div>
                {plegada && (
                  <p className="text-[9px] font-bold uppercase mt-1 [writing-mode:vertical-rl] rotate-180 max-h-24 overflow-hidden" style={{ color: e.color }}>
                    {e.l}
                  </p>
                )}
              </div>

              {!plegada && (
                <div className="space-y-2 p-2 rounded-b-xl min-h-[80px]" style={{ backgroundColor: "var(--surface-3)" }}>
                  {lista.length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-4">Vacía</p>
                  ) : lista.map(t => {
                    const urgente = t.diasParaVencer <= 2 && t.diasParaVencer >= 0;
                    const waLink = wa(t);
                    return (
                      <div
                        key={t.id}
                        className="rounded-lg p-2.5 bg-white dark:bg-slate-900 transition-shadow hover:shadow-md"
                        style={t.visitaLista
                          ? { border: "2px solid #f97316", backgroundColor: "#fff7ed" }
                          : { border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-start gap-2">
                          <Link href={`/crm/cotizaciones/${t.id}`} className="flex-1 min-w-0">
                            <p className="text-[11px] font-mono font-bold text-gray-500">{t.numero}</p>
                            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate">
                              {t.cliente.nombre}
                            </p>
                            {t.cliente.empresa && (
                              <p className="text-[10px] text-gray-400 truncate">{t.cliente.empresa}</p>
                            )}
                          </Link>
                          {t.esPrueba && <FlaskConical size={12} style={{ color: "#b45309" }} className="flex-shrink-0" />}
                        </div>

                        {t.visitaLista && (
                          <p className="text-[10px] font-bold mt-1.5 flex items-center gap-1" style={{ color: "#c2410c" }}>
                            <ClipboardCheck size={10} /> Visita lista — te toca cotizar
                          </p>
                        )}

                        <p className="text-[13px] font-bold mt-1.5 text-gray-900 dark:text-gray-50">
                          {formatCOP(t.total)}
                        </p>

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] text-gray-400">
                          {t.etapa !== "EN_PRODUCCION" && t.etapa !== "COMPLETADOS" && (
                            <span className={cn("flex items-center gap-1", urgente && "font-bold")}
                              style={urgente ? { color: "#c2410c" } : {}}>
                              <Clock size={9} />
                              {t.diasParaVencer < 0
                                ? `venció hace ${-t.diasParaVencer}d`
                                : t.diasParaVencer === 0 ? "vence hoy" : `vence en ${t.diasParaVencer}d`}
                            </span>
                          )}
                          {t.vistas > 0 && (
                            <span className="flex items-center gap-1" title={`El cliente la abrió ${t.vistas} veces`}>
                              <Eye size={9} /> {t.vistas}
                            </span>
                          )}
                          {t.prorrogas > 0 && (
                            <span className="flex items-center gap-1" title={`Aplazada ${t.prorrogas} veces`}>
                              <CalendarPlus size={9} /> {t.prorrogas}
                            </span>
                          )}
                          {t.requiereSgsst && <HardHat size={9} />}
                          {t.pedido && <span className="font-mono">{t.pedido.numero}</span>}
                        </div>

                        {t.vendedor && (
                          <p className="text-[10px] text-gray-400 mt-1 truncate">{t.vendedor.nombre}</p>
                        )}

                        {/* Acciones: solo las que tienen sentido en ESTA etapa. */}
                        <div className="flex items-center gap-1 mt-2">
                          {t.etapa === "PARA_LLAMAR" && (
                            <button
                              onClick={() => marcarLlamado(t)}
                              className="flex-1 py-1 rounded-lg text-[10.5px] font-bold text-white"
                              style={{ backgroundColor: "#b45309" }}
                            >
                              <Phone size={10} className="inline mr-1" /> Ya llamé
                            </button>
                          )}
                          {t.etapa === "VENCIDAS" && (
                            <button
                              onClick={() => setAplazando(t)}
                              className="flex-1 py-1 rounded-lg text-[10.5px] font-semibold surface-2 text-muted"
                            >
                              <CalendarPlus size={10} className="inline mr-1" /> Aplazar
                            </button>
                          )}
                          {waLink && (
                            <a
                              href={waLink} target="_blank" rel="noreferrer"
                              className="w-7 h-6 flex items-center justify-center rounded-lg"
                              style={{ backgroundColor: "#25D36618", color: "#1fae5b" }}
                              title="Escribirle por WhatsApp"
                            >
                              <MessageCircle size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tarjetas.length === 0 && (
        <div className="card p-10 text-center">
          <TrendingUp size={26} className="mx-auto mb-2 text-gray-300" />
          <p className="text-[13px] text-gray-500 dark:text-slate-400">No hay ofertas en juego.</p>
          <p className="text-[11.5px] text-gray-400 mt-1">
            El tablero se llena cuando una cotización se ENVÍA: los borradores no cuentan
            porque nadie los ha visto.
          </p>
        </div>
      )}

      {aplazando && (
        <ModalAplazar
          cotizacion={{
            id: aplazando.id, numero: aplazando.numero, estado: aplazando.estado,
            createdAt: aplazando.creadaEn,
          }}
          onClose={() => setAplazando(null)}
          onHecho={() => { setAplazando(null); refetch(); }}
        />
      )}
    </div>
  );
}
