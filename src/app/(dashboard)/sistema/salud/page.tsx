"use client";

// ============================================================
// Estado del sistema.
//
// La pantalla que faltaba. Hasta hoy, para saber si el seguimiento
// estaba saliendo había que abrir GitHub Actions, leer un log y saber
// qué es un cron. Nadie lo hacía, y por eso el reloj de 15 minutos
// llevaba fallando en el 100% de sus corridas sin que nadie se enterara.
//
// Cada línea dice tres cosas, y las tres importan: QUÉ se miró, QUÉ pasa
// si está mal, y DÓNDE se arregla. Un semáforo rojo que no dice qué se
// rompe no sirve para priorizar nada.
// ============================================================

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2, AlertTriangle, XCircle, PowerOff, RefreshCw, Loader2, ArrowRight,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import type { Salud, Nivel, Comprobacion } from "@/lib/salud";

const ESTILO: Record<Nivel, { Icon: React.ElementType; color: string; bg: string; l: string }> = {
  ok:       { Icon: CheckCircle2,  color: "#16a34a", bg: "#dcfce7", l: "Todo bien" },
  aviso:    { Icon: AlertTriangle, color: "#d97706", bg: "#fef3c7", l: "Revisar" },
  problema: { Icon: XCircle,       color: "#dc2626", bg: "#fee2e2", l: "Roto" },
  apagado:  { Icon: PowerOff,      color: "#64748b", bg: "#f1f5f9", l: "Apagado" },
};

const TITULAR: Record<Nivel, string> = {
  ok: "Todo funcionando",
  aviso: "Funciona, con cosas por revisar",
  problema: "Hay algo roto",
  apagado: "Funciona, con módulos apagados",
};

function Fila({ c }: { c: Comprobacion }) {
  const e = ESTILO[c.nivel];
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b divider last:border-0">
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: e.bg }}
      >
        <e.Icon size={15} style={{ color: e.color }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{c.titulo}</p>
        <p className="text-[11.5px] text-gray-500 dark:text-slate-400 mt-0.5">{c.detalle}</p>
        {c.consecuencia && (
          <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: e.color }}>
            <strong>Qué deja de funcionar:</strong> {c.consecuencia}
          </p>
        )}
        {c.arreglo && (
          <p className="text-[11px] text-gray-400 mt-1">Qué hacer: {c.arreglo}</p>
        )}
      </div>
      {c.enlace && (
        <Link
          href={c.enlace}
          className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:opacity-80"
          style={{ backgroundColor: "var(--brand-color-10)", color: "var(--brand-color)" }}
        >
          Ir <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

function SaludContent() {
  const { data, isLoading, refetch, isFetching } = useQuery<Salud>({
    queryKey: ["salud"],
    queryFn: async () => {
      const res = await fetch("/api/sistema/salud");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "No se pudo consultar");
      return json.data;
    },
    // Sin refresco automático: se mira cuando uno quiere mirarlo, y cada
    // consulta son diez conteos contra la base.
    staleTime: 60_000,
  });

  const e = data ? ESTILO[data.resumen] : ESTILO.ok;

  return (
    <>
      <Topbar
        title="Estado del sistema"
        actions={
          <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary btn-sm disabled:opacity-50">
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Volver a revisar</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {isLoading || !data ? (
            <div className="card p-10 text-center">
              <Loader2 size={20} className="animate-spin mx-auto text-gray-400" />
            </div>
          ) : (
            <>
              <div className="card p-5 flex items-center gap-4">
                <span
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: e.bg }}
                >
                  <e.Icon size={24} style={{ color: e.color }} />
                </span>
                <div className="min-w-0">
                  <p className="text-[16px] font-bold" style={{ color: e.color }}>
                    {TITULAR[data.resumen]}
                  </p>
                  <p className="text-[11.5px] text-gray-400 mt-0.5">
                    {data.comprobaciones.filter(c => c.nivel === "ok").length} de{" "}
                    {data.comprobaciones.length} comprobaciones en verde ·{" "}
                    revisado {new Date(data.generadoEn).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
              </div>

              {/* Lo roto primero: es lo que hay que mirar hoy. */}
              {(["problema", "aviso", "apagado", "ok"] as Nivel[]).map(nivel => {
                const grupo = data.comprobaciones.filter(c => c.nivel === nivel);
                if (!grupo.length) return null;
                const meta = ESTILO[nivel];
                return (
                  <div key={nivel} className="card overflow-hidden">
                    <div className="px-4 py-2.5 flex items-center gap-2 surface-2">
                      <meta.Icon size={13} style={{ color: meta.color }} />
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                        {meta.l} · {grupo.length}
                      </span>
                    </div>
                    {grupo.map(c => <Fila key={c.clave} c={c} />)}
                  </div>
                );
              })}

              <p className="text-[11px] text-gray-400 leading-relaxed px-1">
                Esta pantalla mira la configuración y los datos, no la red. Que la corrida diaria
                salga en verde significa que dejó rastro en las últimas 36 horas — no que cada
                correo concreto haya llegado a su destinatario.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><SaludContent /></Suspense>;
}
