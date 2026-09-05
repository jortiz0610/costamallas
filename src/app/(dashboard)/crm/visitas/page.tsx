"use client";

// ============================================================
// Visitas técnicas — la pantalla que faltaba.
//
// El proceso ya estaba escrito entero (lib/visitas.ts, la pantalla de
// campo, la firma, los correos) pero **no se llegaba a él desde ningún
// sitio**: la API existía sin pantalla y `/campo/[id]` solo se abría
// escribiendo la dirección a mano. Esto es la puerta.
//
// Quién usa qué:
//
//   · El ASESOR agenda, y cuando la visita vuelve firmada pulsa
//     «Cotizar esto». Ahí está el valor de toda la pantalla: hoy recibe
//     el formato por correo y copia las medidas a mano, que es
//     exactamente donde se pierden.
//   · PRODUCCIÓN abre «Formato de campo», que es la pantalla del
//     teléfono.
//
// Lo que NO se hace aquí, a propósito: mostrar precios. La visita va
// antes de que exista una oferta, así que no hay ningún valor que
// enseñar, y la lista la mira también quien va a medir.
// ============================================================

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import toast from "react-hot-toast";
import {
  Ruler, Calendar, MapPin, User, Loader2, Plus, X, ClipboardList,
  Search, Smartphone, PenLine, FlaskConical, CheckCircle2, ArrowRight,
} from "lucide-react";
import { CIUDADES } from "@/lib/colombia";

const CRM_COLOR = "#BA7517";

interface Recomendado { nombre: string; cantidad?: number; unidad?: string; nota?: string }

interface Visita {
  id: string;
  estado: string;
  fechaAgendada: string | null;
  fechaRealizada: string | null;
  direccion: string | null;
  ciudad: string | null;
  notas: string | null;
  esPrueba: boolean;
  medidas: string | null;
  condicionesSitio: string | null;
  recomendados: Recomendado[];
  firmadoEn: string | null;
  firmaNombre: string | null;
  cotizacionId: string | null;
  cliente: { id: string; nombre: string; empresa: string | null; telefono: string | null; ciudad: string | null } | null;
  tecnico: { id: string; nombre: string } | null;
  cotizacion: { id: string; numero: string; estado: string } | null;
}

interface ClienteOpt { id: string; nombre: string; empresa?: string; direccion?: string; ciudad?: string }
interface TecnicoOpt { id: string; nombre: string }

const ESTADOS: Record<string, { bg: string; text: string; l: string }> = {
  PENDIENTE:  { bg: "#fef3c7", text: "#92400e", l: "Sin fecha" },
  AGENDADA:   { bg: "#dbeafe", text: "#1d4ed8", l: "Agendada" },
  EN_PROCESO: { bg: "#ede9fe", text: "#6d28d9", l: "En el sitio" },
  COMPLETADA: { bg: "#d1fae5", text: "#065f46", l: "Hecha" },
  CANCELADA:  { bg: "#f1f5f9", text: "#475569", l: "Cancelada" },
};

const fecha = (v: string | null) =>
  v ? new Date(v).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// ─────────────────────────────────────────────

/** Agendar una visita nueva. El cliente se busca; no hay lista completa. */
function NuevaVisita({ onCerrar, onListo }: { onCerrar: () => void; onListo: () => void }) {
  const [busq, setBusq] = useState("");
  const [cliente, setCliente] = useState<ClienteOpt | null>(null);
  const [fechaHora, setFechaHora] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { data: clientes = [] } = useQuery<ClienteOpt[]>({
    queryKey: ["visita-clientes", busq],
    enabled: busq.length > 1,
    queryFn: async () => (await (await fetch(`/api/crm/clientes?busqueda=${encodeURIComponent(busq)}`)).json()).data ?? [],
  });

  const { data: tecnicos = [] } = useQuery<TecnicoOpt[]>({
    queryKey: ["tecnicos-opt"],
    queryFn: async () => (await (await fetch("/api/usuarios")).json()).data ?? [],
  });

  // Al elegir cliente se traen su dirección y su ciudad. Muchas visitas
  // son a una obra que no es la de facturación, así que se pueden
  // cambiar: lo que no puede ser es tener que escribirlas siempre.
  const elegir = (c: ClienteOpt) => {
    setCliente(c);
    setBusq("");
    if (!direccion) setDireccion(c.direccion ?? "");
    if (!ciudad) setCiudad(c.ciudad ?? "");
  };

  const guardar = async () => {
    if (!cliente) { toast.error("Elige el cliente."); return; }
    setGuardando(true);
    try {
      const r = await fetch("/api/crm/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.id,
          fecha: fechaHora || null,
          tecnicoId: tecnicoId || null,
          direccion: direccion || null,
          ciudad: ciudad || null,
          notas: notas || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) { toast.error(j.error ?? "No se pudo agendar"); return; }
      toast.success(fechaHora ? "Visita agendada" : "Visita pedida. Ponle fecha cuando la cuadres.");
      onListo();
    } catch {
      toast.error("Sin conexión.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-lg my-4 animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Ruler size={16} style={{ color: CRM_COLOR }} /> Agendar visita técnica
          </h2>
          <button onClick={onCerrar} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Cliente *</label>
            {cliente ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--surface-3)" }}>
                <User size={13} className="text-muted" />
                <span className="text-[13px] font-semibold flex-1 truncate">{cliente.empresa || cliente.nombre}</span>
                <button onClick={() => setCliente(null)} className="text-muted"><X size={13} /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className="input pl-8" value={busq} onChange={e => setBusq(e.target.value)}
                    placeholder="Escribe el nombre o el NIT…"
                  />
                </div>
                {clientes.length > 0 && (
                  <div className="mt-1.5 rounded-lg border divider overflow-hidden max-h-44 overflow-y-auto">
                    {clientes.map(c => (
                      <button
                        key={c.id} onClick={() => elegir(c)}
                        className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 dark:hover:bg-slate-800/40"
                      >
                        {c.empresa || c.nombre}
                        {c.ciudad && <span className="text-muted"> · {c.ciudad}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Fecha y hora</label>
              <input type="datetime-local" className="input" value={fechaHora} onChange={e => setFechaHora(e.target.value)} />
              <p className="text-[10.5px] text-muted mt-1">Sin fecha queda pedida y no le sale a producción.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Quién va</label>
              <select className="input" value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}>
                <option value="">Sin asignar</option>
                {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Ciudad</label>
              <select className="input" value={ciudad} onChange={e => setCiudad(e.target.value)}>
                <option value="">Selecciona…</option>
                {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Dirección de la visita</label>
              <input className="input" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Cra 15 #98-23" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Qué hay que mirar</label>
            <textarea
              className="input resize-none" rows={2} value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Lo que el cliente pidió: cerca eléctrica, malla en balcón, ampliación…"
            />
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onCerrar} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={guardar} disabled={guardando}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: CRM_COLOR }}
          >
            {guardando && <Loader2 size={13} className="animate-spin" />} Agendar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────

/** Ponerle fecha a una visita que se pidió sin cuadrar. */
function PonerFecha({ visita, onListo }: { visita: Visita; onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!valor) { toast.error("Falta la fecha."); return; }
    setGuardando(true);
    try {
      const r = await fetch(`/api/crm/trabajos/${visita.id}/agendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: valor }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) { toast.error(j.error ?? "No se pudo agendar"); return; }
      toast.success("Agendada. Ya le sale a producción.");
      setAbierto(false);
      onListo();
    } catch {
      toast.error("Sin conexión.");
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="btn-secondary btn-sm">
        <Calendar size={12} /> Ponerle fecha
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input type="datetime-local" className="input py-1 text-xs w-auto" value={valor} onChange={e => setValor(e.target.value)} />
      <button onClick={guardar} disabled={guardando} className="btn-primary btn-sm">
        {guardando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Guardar
      </button>
      <button onClick={() => setAbierto(false)} className="text-muted p-1"><X size={13} /></button>
    </div>
  );
}

// ─────────────────────────────────────────────

function Ficha({ visita, onCambio }: { visita: Visita; onCambio: () => void }) {
  const est = ESTADOS[visita.estado] ?? ESTADOS.PENDIENTE;
  const quien = visita.cliente?.empresa || visita.cliente?.nombre || "Cliente";
  const donde = [visita.direccion, visita.ciudad].filter(Boolean).join(", ");
  const hecha = Boolean(visita.firmadoEn);
  const recomendados = visita.recomendados ?? [];

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-gray-800 dark:text-gray-100 truncate">{quien}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px] text-muted">
            {donde && <span className="flex items-center gap-1"><MapPin size={11} /> {donde}</span>}
            {visita.fechaAgendada && <span className="flex items-center gap-1"><Calendar size={11} /> {fecha(visita.fechaAgendada)}</span>}
            {visita.tecnico && <span className="flex items-center gap-1"><User size={11} /> {visita.tecnico.nombre}</span>}
          </div>
        </div>
        {visita.esPrueba && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
            <FlaskConical size={10} /> Prueba
          </span>
        )}
        <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: est.bg, color: est.text }}>
          {est.l}
        </span>
      </div>

      {visita.notas && !hecha && (
        <p className="text-[12px] text-soft mt-3 whitespace-pre-wrap">{visita.notas}</p>
      )}

      {/* Lo que trajo producción. Sale solo cuando la visita está hecha:
          antes de eso está vacío y ocupa media pantalla para nada. */}
      {hecha && (
        <div className="mt-3 rounded-xl p-3 space-y-2.5" style={{ backgroundColor: "var(--surface-3)" }}>
          {visita.medidas && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Medidas</p>
              <p className="text-[12px] text-soft whitespace-pre-wrap">{visita.medidas}</p>
            </div>
          )}
          {visita.condicionesSitio && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Cómo está el sitio</p>
              <p className="text-[12px] text-soft whitespace-pre-wrap">{visita.condicionesSitio}</p>
            </div>
          )}
          {recomendados.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Recomienda producción</p>
              <ul className="text-[12px] text-soft space-y-0.5">
                {recomendados.map((r, i) => (
                  <li key={i}>
                    · {r.nombre}
                    {r.cantidad ? ` — ${r.cantidad} ${r.unidad ?? ""}`.trimEnd() : ""}
                    {r.nota ? <span className="text-muted"> ({r.nota})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {visita.firmaNombre && (
            <p className="text-[11px] text-muted flex items-center gap-1">
              <PenLine size={10} /> Firmó {visita.firmaNombre}
              {visita.fechaRealizada ? ` · ${fecha(visita.fechaRealizada)}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3.5">
        {visita.estado === "PENDIENTE" && !hecha && <PonerFecha visita={visita} onListo={onCambio} />}

        {!hecha && (
          <Link href={`/campo/${visita.id}`} className="btn-secondary btn-sm">
            <Smartphone size={12} /> Formato de campo
          </Link>
        )}

        {/* El botón que justifica la pantalla. */}
        {hecha && (
          visita.cotizacion ? (
            <Link href={`/crm/cotizaciones/${visita.cotizacion.id}`} className="btn-secondary btn-sm">
              <ClipboardList size={12} /> {visita.cotizacion.numero}
            </Link>
          ) : (
            <Link
              href={`/crm/cotizaciones/nueva?visita=${visita.id}`}
              className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ backgroundColor: CRM_COLOR }}
            >
              <ArrowRight size={12} /> Cotizar esto
            </Link>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────

const FILTROS = [
  { k: "", l: "Todas" },
  { k: "PENDIENTE", l: "Sin fecha" },
  { k: "AGENDADA", l: "Agendadas" },
  { k: "COMPLETADA", l: "Hechas" },
] as const;

function Contenido() {
  const [filtro, setFiltro] = useState<string>("");
  const [nueva, setNueva] = useState(false);

  const { data: visitas = [], isLoading, refetch } = useQuery<Visita[]>({
    queryKey: ["crm-visitas"],
    queryFn: async () => (await (await fetch("/api/crm/visitas")).json()).data ?? [],
  });

  const lista = useMemo(
    () => (filtro ? visitas.filter(v => v.estado === filtro) : visitas),
    [visitas, filtro],
  );

  // Las hechas y sin cotizar son las que se pierden: la visita se
  // queda en el portal y el cliente llama a preguntar por su oferta.
  const sinCotizar = visitas.filter(v => v.firmadoEn && !v.cotizacionId).length;

  return (
    <>
      {nueva && <NuevaVisita onCerrar={() => setNueva(false)} onListo={() => { setNueva(false); refetch(); }} />}

      <Topbar
        title="Visitas técnicas"
        actions={
          <button
            onClick={() => setNueva(true)}
            className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ backgroundColor: CRM_COLOR }}
          >
            <Plus size={13} /> Agendar visita
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">
        <p className="text-[12px] text-gray-500 dark:text-slate-400">
          Alguien va, mide y llena el formato en el sitio; con eso se arma la oferta.
          {sinCotizar > 0 && (
            <> Hay <strong>{sinCotizar}</strong> visita{sinCotizar === 1 ? "" : "s"} hecha{sinCotizar === 1 ? "" : "s"} sin cotizar.</>
          )}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map(f => (
            <button
              key={f.k} onClick={() => setFiltro(f.k)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={filtro === f.k
                ? { backgroundColor: CRM_COLOR, color: "white" }
                : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}
            >
              {f.l}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto text-gray-400" /></div>
        ) : lista.length === 0 ? (
          <div className="card p-10 text-center">
            <Ruler size={26} className="mx-auto mb-2 text-gray-300" />
            <p className="text-[13px] text-gray-500 dark:text-slate-400">
              {filtro ? "Nada con ese filtro." : "Todavía no hay visitas."}
            </p>
            <p className="text-[11.5px] text-gray-400 mt-1">
              Agenda una cuando el cliente pida un cerramiento que haya que medir antes de cotizar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(v => <Ficha key={v.id} visita={v} onCambio={() => refetch()} />)}
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Contenido /></Suspense>;
}
