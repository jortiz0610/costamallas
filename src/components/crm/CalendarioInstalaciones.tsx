"use client";

// ============================================================
// El calendario de instalaciones.
//
// Tres vistas, porque son tres preguntas distintas:
//   MES     ¿cómo viene el mes? — para prometerle una fecha a un cliente
//   SEMANA  ¿qué hay esta semana? — es la vista de la reunión del lunes
//   DÍA     ¿qué hay hoy? — con las horas, para la cuadrilla
//
// **La semana NO tiene domingo**, a propósito y por pedido de gerencia:
// en Costamallas no se instala en domingo, y una columna vacía cada siete
// días le roba un séptimo del ancho a los días en los que sí se trabaja.
//
// El MES sí lo enseña, porque un mes sin domingos deja de parecer un mes
// y nadie sabría contar las semanas.
// ============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, CalendarDays, Wrench, MapPin, User, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InstalacionCal {
  id: string;
  estado: string;
  fechaAgendada: string | null;
  ciudad: string | null;
  direccion: string | null;
  tecnico?: { nombre: string } | null;
  pedido: { id: string; numero: string; cliente: { nombre: string; empresa?: string | null } };
}

type Vista = "mes" | "semana" | "dia";

const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "#d97706",
  AGENDADA: "#1d4ed8",
  EN_PROCESO: "#7c3aed",
  COMPLETADA: "#16a34a",
  CANCELADA: "#dc2626",
};

const clave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const mismoDia = (a: Date, b: Date) => clave(a) === clave(b);

/** El lunes de la semana de `d`. La semana empieza en lunes, no en domingo. */
function lunesDe(d: Date): Date {
  const x = new Date(d);
  const dia = x.getDay(); // 0 = domingo
  const resta = dia === 0 ? 6 : dia - 1;
  x.setDate(x.getDate() - resta);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function CalendarioInstalaciones({
  instalaciones,
  vistaInicial = "semana",
}: {
  instalaciones: InstalacionCal[];
  vistaInicial?: Vista;
}) {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [ancla, setAncla] = useState(() => {
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    return h;
  });

  const hoy = useMemo(() => {
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    return h;
  }, []);

  /** Instalaciones agrupadas por día. Las que no tienen fecha van aparte. */
  const { porDia, sinFecha } = useMemo(() => {
    const m: Record<string, InstalacionCal[]> = {};
    const sin: InstalacionCal[] = [];
    for (const i of instalaciones) {
      if (!i.fechaAgendada) { sin.push(i); continue; }
      const k = clave(new Date(i.fechaAgendada));
      (m[k] ??= []).push(i);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) =>
        new Date(a.fechaAgendada!).getTime() - new Date(b.fechaAgendada!).getTime());
    }
    return { porDia: m, sinFecha: sin };
  }, [instalaciones]);

  const mover = (n: number) => {
    const x = new Date(ancla);
    if (vista === "mes") x.setMonth(x.getMonth() + n);
    else if (vista === "semana") x.setDate(x.getDate() + n * 7);
    else x.setDate(x.getDate() + n);
    setAncla(x);
  };

  const titulo = useMemo(() => {
    if (vista === "mes") return `${MESES[ancla.getMonth()]} de ${ancla.getFullYear()}`;
    if (vista === "dia") {
      return `${DIAS_LARGOS[ancla.getDay()]} ${ancla.getDate()} de ${MESES[ancla.getMonth()]}`;
    }
    const l = lunesDe(ancla);
    const s = new Date(l);
    s.setDate(s.getDate() + 5); // lunes a sábado
    const mismoMes = l.getMonth() === s.getMonth();
    return mismoMes
      ? `${l.getDate()} – ${s.getDate()} de ${MESES[l.getMonth()]}`
      : `${l.getDate()} de ${MESES[l.getMonth()]} – ${s.getDate()} de ${MESES[s.getMonth()]}`;
  }, [vista, ancla]);

  function Tarjeta({ i, conHora = true }: { i: InstalacionCal; conHora?: boolean }) {
    const color = COLOR_ESTADO[i.estado] ?? "#64748b";
    const f = i.fechaAgendada ? new Date(i.fechaAgendada) : null;
    const hora = f && (f.getHours() || f.getMinutes())
      ? f.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      : null;
    return (
      <Link
        href={`/crm/instalaciones/${i.id}`}
        className="block rounded-lg px-2 py-1.5 text-left transition-shadow hover:shadow-sm"
        style={{ backgroundColor: color + "14", borderLeft: `3px solid ${color}` }}
      >
        <p className="text-[10.5px] font-bold truncate" style={{ color }}>
          {conHora && hora ? `${hora} · ` : ""}{i.pedido.cliente.nombre}
        </p>
        <p className="text-[9.5px] text-gray-400 truncate">
          {i.pedido.numero}{i.ciudad ? ` · ${i.ciudad}` : ""}
        </p>
      </Link>
    );
  }

  // ── MES ──
  const celdasMes = useMemo(() => {
    if (vista !== "mes") return [];
    const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const inicio = lunesDe(primero);
    const celdas: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      celdas.push(d);
    }
    // Se recortan las semanas enteras que ya no son de este mes.
    while (celdas.length > 28 && celdas[celdas.length - 7].getMonth() !== ancla.getMonth()) {
      celdas.splice(-7, 7);
    }
    return celdas;
  }, [vista, ancla]);

  // ── SEMANA: lunes a sábado, sin domingo ──
  const diasSemana = useMemo(() => {
    if (vista !== "semana") return [];
    const l = lunesDe(ancla);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(l);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [vista, ancla]);

  return (
    <div className="space-y-3">
      {/* Barra de control */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-xl p-0.5 gap-0.5" style={{ backgroundColor: "var(--surface-3)" }}>
          {(["mes", "semana", "dia"] as const).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all"
              style={vista === v
                ? { backgroundColor: "#BA7517", color: "white" }
                : { color: "var(--text-muted)" }}
            >
              {v === "dia" ? "Día" : v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => mover(-1)} className="w-7 h-7 flex items-center justify-center rounded-lg surface-2 text-muted">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setAncla(hoy)} className="px-2.5 py-1 rounded-lg surface-2 text-[11px] font-semibold text-soft">
            Hoy
          </button>
          <button onClick={() => mover(1)} className="w-7 h-7 flex items-center justify-center rounded-lg surface-2 text-muted">
            <ChevronRight size={14} />
          </button>
        </div>

        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 capitalize">{titulo}</p>

        {vista === "semana" && (
          <span className="text-[10.5px] text-gray-400 ml-auto">
            Sin domingo: no se instala en domingo.
          </span>
        )}
      </div>

      {/* ── MES ── */}
      {vista === "mes" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7">
            {DIAS_CORTOS.map((d, i) => (
              <div key={d} className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-center"
                style={{ color: i === 0 ? "#94a3b8" : "var(--text-muted)", backgroundColor: "var(--surface-3)" }}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celdasMes.map((d, i) => {
              const delMes = d.getMonth() === ancla.getMonth();
              const esHoy = mismoDia(d, hoy);
              const lista = porDia[clave(d)] ?? [];
              return (
                <button
                  key={i}
                  onClick={() => { setAncla(d); setVista("dia"); }}
                  className={cn(
                    "min-h-[86px] p-1.5 text-left border-t border-r border-gray-100 dark:border-slate-800 align-top",
                    !delMes && "opacity-35",
                  )}
                  style={esHoy ? { backgroundColor: "#BA751710" } : {}}
                >
                  <span
                    className={cn("text-[11px] font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full",
                      esHoy && "text-white")}
                    style={esHoy ? { backgroundColor: "#BA7517" } : { color: "var(--text-muted)" }}
                  >
                    {d.getDate()}
                  </span>
                  <div className="space-y-1 mt-1">
                    {lista.slice(0, 2).map(i2 => <Tarjeta key={i2.id} i={i2} />)}
                    {lista.length > 2 && (
                      <p className="text-[9.5px] text-gray-400 pl-1">+{lista.length - 2} más</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SEMANA (lunes a sábado) ── */}
      {vista === "semana" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-6">
            {diasSemana.map(d => {
              const esHoy = mismoDia(d, hoy);
              return (
                <div key={clave(d)} className="px-2 py-2 text-center border-r border-gray-100 dark:border-slate-800"
                  style={{ backgroundColor: esHoy ? "#BA751714" : "var(--surface-3)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {DIAS_CORTOS[d.getDay()]}
                  </p>
                  <p className="text-[15px] font-bold" style={{ color: esHoy ? "#BA7517" : undefined }}>
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-6 min-h-[220px]">
            {diasSemana.map(d => {
              const lista = porDia[clave(d)] ?? [];
              return (
                <div key={clave(d)} className="p-1.5 space-y-1.5 border-r border-t border-gray-100 dark:border-slate-800">
                  {lista.length === 0
                    ? <p className="text-[10px] text-gray-300 text-center pt-3">—</p>
                    : lista.map(i => <Tarjeta key={i.id} i={i} />)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DÍA ── */}
      {vista === "dia" && (
        <div className="card p-4">
          {(porDia[clave(ancla)] ?? []).length === 0 ? (
            <div className="py-10 text-center">
              <CalendarDays size={24} className="mx-auto mb-2 text-gray-300" />
              <p className="text-[12.5px] text-gray-400">Nada agendado este día.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(porDia[clave(ancla)] ?? []).map(i => {
                const color = COLOR_ESTADO[i.estado] ?? "#64748b";
                const f = new Date(i.fechaAgendada!);
                const hora = (f.getHours() || f.getMinutes())
                  ? f.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
                  : "Sin hora";
                return (
                  <Link key={i.id} href={`/crm/instalaciones/${i.id}`}
                    className="flex items-start gap-3 p-3 rounded-xl transition-shadow hover:shadow-sm"
                    style={{ backgroundColor: color + "0f", borderLeft: `4px solid ${color}` }}>
                    <div className="w-16 flex-shrink-0">
                      <p className="text-[12px] font-bold flex items-center gap-1" style={{ color }}>
                        <Clock size={11} /> {hora}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
                        {i.pedido.cliente.nombre}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {i.pedido.numero}
                        {i.pedido.cliente.empresa ? ` · ${i.pedido.cliente.empresa}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                        {i.direccion && <span className="flex items-center gap-1"><MapPin size={10} />{i.direccion}{i.ciudad ? `, ${i.ciudad}` : ""}</span>}
                        {i.tecnico && <span className="flex items-center gap-1"><User size={10} />{i.tecnico.nombre}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color + "1f", color }}>
                      {i.estado}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lo que no tiene fecha no puede desaparecer solo porque no cabe
          en el calendario: es justo lo que hay que agendar. */}
      {sinFecha.length > 0 && (
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
            <Wrench size={12} /> Sin fecha ({sinFecha.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sinFecha.map(i => <Tarjeta key={i.id} i={i} conHora={false} />)}
          </div>
        </div>
      )}
    </div>
  );
}
