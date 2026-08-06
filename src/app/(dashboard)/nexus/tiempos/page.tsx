"use client";

// ============================================================
// Tiempo de respuesta de Nexus — el compromiso de la hora.
//
// Gerencia se comprometió a responder en una hora. El dato se venía
// guardando desde la Fase 4 y no lo miraba nadie.
//
// Lo primero de la pantalla NO es el promedio del mes: son las
// conversaciones que están esperando AHORA. Un informe que solo cuenta lo
// que ya pasó se lee una vez al mes; uno que dice a quién hay que
// contestar ya se abre todos los días.
// ============================================================

import { Suspense, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Loader2, ArrowLeft, Clock, AlertTriangle, CheckCircle2, Users, Timer, Settings, Check,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { esAdmin } from "@/lib/permisos";
import { cn, formatDate } from "@/lib/utils";

const NEXUS_COLOR = "#7c3aed";

interface Informe {
  config: { compromisoMin: number; horaInicio: number; horaFin: number; dias: number[] };
  ventanaDias: number;
  resumen: {
    total: number; respondidas: number; sinResponder: number; enPlazo: number;
    pctEnPlazo: number; medianaMin: number; medianaCorridaMin: number; peorMin: number;
    vencidasAhora: number; fueraDeHorario: number;
  };
  tramos: { id: string; label: string; cantidad: number }[];
  asesores: {
    usuarioId: string | null; nombre: string; atendidas: number; enPlazo: number;
    pct: number; medianaMin: number; sinResponder: number;
  }[];
  pendientes: {
    id: string; canal: string; remitente: string; asunto: string | null;
    asignado: string | null; esperandoMin: number; esperandoCorridoMin: number;
    vencido: boolean; createdAt: string; etiquetas: string[];
  }[];
}

const DIAS = [
  { v: 1, l: "L" }, { v: 2, l: "M" }, { v: 3, l: "X" }, { v: 4, l: "J" },
  { v: 5, l: "V" }, { v: 6, l: "S" }, { v: 0, l: "D" },
];

/** Minutos → algo que se lee de un vistazo. */
function dur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

function Contenido() {
  const { user } = useAuth();
  const admin = esAdmin(user?.rol);
  const [dias, setDias] = useState(30);
  const [ajustes, setAjustes] = useState(false);
  const [cfg, setCfg] = useState({ compromisoMin: 60, horaInicio: 8, horaFin: 17, dias: [1, 2, 3, 4, 5, 6] });
  const [guardando, setGuardando] = useState(false);

  const { data, isLoading, refetch } = useQuery<Informe>({
    queryKey: ["nexus-tiempos", dias],
    queryFn: async () => (await (await fetch(`/api/nexus/tiempos?dias=${dias}`)).json()).data,
  });

  useEffect(() => { if (data?.config) setCfg(data.config); }, [data]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/nexus/tiempos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Compromiso actualizado");
      setAjustes(false);
      refetch();
    } finally { setGuardando(false); }
  };

  if (isLoading || !data) {
    return (
      <>
        <Topbar title="Tiempo de respuesta" />
        <div className="flex-1 flex items-center justify-center page-bg">
          <Loader2 size={20} className="animate-spin" style={{ color: NEXUS_COLOR }} />
        </div>
      </>
    );
  }

  const r = data.resumen;
  const meta = data.config.compromisoMin;
  const cumple = r.pctEnPlazo >= 80;

  return (
    <>
      <Topbar title="Tiempo de respuesta" actions={
        <div className="flex items-center gap-2">
          <select className="input py-1.5 text-xs w-auto" value={dias} onChange={e => setDias(Number(e.target.value))}>
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          {admin && (
            <button onClick={() => setAjustes(v => !v)} className="btn-secondary btn-sm">
              <Settings size={13} /> Compromiso
            </button>
          )}
          <Link href="/nexus" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Bandeja</Link>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5">
        {/* Ajustes del compromiso */}
        {ajustes && admin && (
          <div className="card p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">El compromiso</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Responder en (minutos)</label>
                <input type="number" className="input py-1.5 text-xs" value={cfg.compromisoMin}
                  onChange={e => setCfg(p => ({ ...p, compromisoMin: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Abre (hora)</label>
                <input type="number" className="input py-1.5 text-xs" value={cfg.horaInicio}
                  onChange={e => setCfg(p => ({ ...p, horaInicio: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Cierra (hora)</label>
                <input type="number" className="input py-1.5 text-xs" value={cfg.horaFin}
                  onChange={e => setCfg(p => ({ ...p, horaFin: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">Días de atención</label>
              <div className="flex gap-1.5">
                {DIAS.map(d => {
                  const activo = cfg.dias.includes(d.v);
                  return (
                    <button key={d.v}
                      onClick={() => setCfg(p => ({
                        ...p,
                        dias: activo ? p.dias.filter(x => x !== d.v) : [...p.dias, d.v],
                      }))}
                      className={cn("w-9 h-9 rounded-lg text-xs font-bold", activo ? "text-white" : "surface-3 text-muted")}
                      style={activo ? { backgroundColor: NEXUS_COLOR } : undefined}>
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px] text-muted">
              El tiempo se cuenta <b>solo dentro del horario de atención</b>. Un mensaje que entra a las 8 de la noche y
              se contesta a las 8 de la mañana son 0 minutos, no 12 horas. Medirlo a reloj corrido pondría el informe en
              rojo todos los lunes y nadie se lo creería.
            </p>
            <button onClick={guardar} disabled={guardando} className="btn-primary w-full justify-center">
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
            </button>
          </div>
        )}

        {data.resumen.total === 0 ? (
          <div className="card p-10 text-center">
            <Timer size={26} className="mx-auto mb-3 text-muted" />
            <p className="text-sm font-semibold text-soft">Todavía no hay conversaciones en esta ventana</p>
            <p className="text-xs text-muted mt-2 max-w-md mx-auto leading-relaxed">
              Este informe se llena solo, a medida que entren mensajes por Nexus. Hoy el canal de WhatsApp está
              pendiente de la aprobación de Meta, así que lo único que puede entrar son los formularios de la web.
            </p>
          </div>
        ) : (
          <>
            {/* Lo que hay que hacer AHORA */}
            {data.pendientes.length > 0 && (
              <div className="card overflow-hidden" style={{ borderLeft: `4px solid ${r.vencidasAhora ? "#dc2626" : "#d97706"}` }}>
                <div className="px-5 py-3.5 flex items-center gap-2 border-b divider">
                  <AlertTriangle size={15} style={{ color: r.vencidasAhora ? "#dc2626" : "#d97706" }} />
                  <p className="text-sm font-bold text-soft">
                    {data.pendientes.length} esperando respuesta
                    {r.vencidasAhora > 0 && (
                      <span className="text-red-600"> · {r.vencidasAhora} ya pasaron de {dur(meta)}</span>
                    )}
                  </p>
                </div>
                <div className="divide-y divider max-h-80 overflow-y-auto">
                  {data.pendientes.map(p => (
                    <Link key={p.id} href="/nexus" className="flex items-center gap-3 px-5 py-2.5 hover:surface-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-soft truncate">
                          {p.remitente}
                          <span className="text-muted font-normal"> · {p.canal}</span>
                        </p>
                        <p className="text-[11px] text-muted truncate">
                          {p.asunto || p.etiquetas.join(" · ") || "Sin asunto"}
                          {p.asignado ? ` · ${p.asignado}` : " · sin asignar"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold" style={{ color: p.vencido ? "#dc2626" : "var(--text-soft)" }}>
                          {dur(p.esperandoMin)}
                        </p>
                        <p className="text-[10px] text-muted">entró {formatDate(p.createdAt)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Cumplimiento */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi
                label="Dentro del compromiso" valor={`${r.pctEnPlazo}%`}
                sub={`${r.enPlazo} de ${r.respondidas} · meta ${dur(meta)}`}
                color={cumple ? "#16a34a" : "#dc2626"} Icon={cumple ? CheckCircle2 : AlertTriangle}
              />
              <Kpi
                label="Mediana de respuesta" valor={dur(r.medianaMin)}
                sub={`a reloj corrido: ${dur(r.medianaCorridaMin)}`}
                color={NEXUS_COLOR} Icon={Clock}
              />
              <Kpi
                label="La peor" valor={dur(r.peorMin)}
                sub="tiempo hábil hasta responder" color="#d97706" Icon={Timer}
              />
              <Kpi
                label="Entraron" valor={String(r.total)}
                sub={`${r.fueraDeHorario} fuera de horario`} color="#64748b" Icon={Users}
              />
            </div>

            {/* Barra de cumplimiento */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">
                  Cumplimiento del compromiso de {dur(meta)}
                </p>
                <p className="text-sm font-black" style={{ color: cumple ? "#16a34a" : "#dc2626" }}>{r.pctEnPlazo}%</p>
              </div>
              <div className="h-3 rounded-full overflow-hidden surface-3">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${r.pctEnPlazo}%`, backgroundColor: cumple ? "#16a34a" : "#dc2626" }} />
              </div>
              <p className="text-[11px] text-muted mt-2">
                Se cuenta solo el tiempo dentro del horario de atención
                ({data.config.horaInicio}:00 a {data.config.horaFin}:00,{" "}
                {DIAS.filter(d => data.config.dias.includes(d.v)).map(d => d.l).join(" ")}).
              </p>
            </div>

            {/* Dónde se va el tiempo */}
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Cuánto se tardó</p>
              <div className="space-y-2">
                {data.tramos.map(t => {
                  const pct = r.respondidas ? Math.round((t.cantidad / r.respondidas) * 100) : 0;
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className="text-xs text-muted w-32 flex-shrink-0">{t.label}</span>
                      <div className="flex-1 h-5 surface-3 rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: NEXUS_COLOR }} />
                      </div>
                      <span className="text-xs font-semibold text-soft w-16 text-right flex-shrink-0">
                        {t.cantidad} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Por asesor */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b divider">
                <p className="text-sm font-bold text-soft">Por asesor</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="surface-2">
                      <th className="text-left px-5 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Asesor</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Atendidas</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">En plazo</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Mediana</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-muted uppercase tracking-wider text-[10px]">Esperando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.asesores.map(a => (
                      <tr key={a.usuarioId ?? "sin"} className="border-t divider">
                        <td className="px-5 py-2.5 font-semibold text-soft">{a.nombre}</td>
                        <td className="px-3 py-2.5 text-right text-soft">{a.atendidas}</td>
                        <td className="px-3 py-2.5 text-right font-bold"
                          style={{ color: a.atendidas === 0 ? "var(--text-muted)" : a.pct >= 80 ? "#16a34a" : "#dc2626" }}>
                          {a.atendidas ? `${a.pct}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-soft">{a.atendidas ? dur(a.medianaMin) : "—"}</td>
                        <td className="px-5 py-2.5 text-right">
                          {a.sinResponder > 0
                            ? <span className="font-bold text-amber-600">{a.sinResponder}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-muted">
              Se mide desde que entra la conversación hasta la primera respuesta de una persona. Las notas internas no
              cuentan como respuesta, y un mensaje que la API del canal rechazó tampoco: si el cliente no lo recibió, no
              se le respondió.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, valor, sub, color, Icon }: {
  label: string; valor: string; sub: string; color: string; Icon: typeof Clock;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "18" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold truncate" style={{ color }}>{valor}</p>
        <p className="text-[10px] text-muted truncate">{sub}</p>
      </div>
    </div>
  );
}

export default function Page() { return <Suspense><Contenido /></Suspense>; }
