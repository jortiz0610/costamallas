"use client";

// ============================================================
// Flujos & Automatización.
//
// Antes era una maqueta: un lienzo de ejemplo con el sello "En
// construcción" y un botón deshabilitado, mientras el motor real sí
// existía y guardaba flujos que la IA usaba de verdad.
//
// Ahora la pantalla muestra los flujos reales, deja editarlos, y dice
// canal por canal qué está encendido y qué falta. Si algo no funciona,
// se ve por qué en vez de esconderse tras un cartel.
// ============================================================

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Zap, MessageSquare, Bot, Plus, Sparkles, Loader2, X, Check, Trash2,
  AlertTriangle, CheckCircle2, ArrowRight, Settings2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const NEXUS_COLOR = "#7c3aed";

interface NodoFlujo { id: string; tipo: string; config: Record<string, unknown> }
interface Flujo {
  id: string; nombre: string; disparador: string[]; objetivo: string;
  accion: string; transferirSiComplejo: boolean; canal: string; activo: boolean;
  nodos?: NodoFlujo[]; createdAt: string;
}
interface Canal { id: string; canal: string; nombre: string; activo: boolean; puedeEnviar: boolean; motivo?: string }
interface Estado {
  ia: { configurada: boolean; modelo: string };
  canales: Canal[];
  puedenResponder: number;
  flujosActivos: number;
  conversaciones: number;
  sinLeer: number;
}

function FlujosContent() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Partial<Flujo> | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data: flujos = [], isLoading } = useQuery<Flujo[]>({
    queryKey: ["nexus-flujos"],
    queryFn: async () => (await (await fetch("/api/nexus/flujos")).json()).data ?? [],
  });

  const { data: estado } = useQuery<Estado>({
    queryKey: ["nexus-estado"],
    queryFn: async () => (await (await fetch("/api/nexus/estado")).json()).data,
    refetchInterval: 60_000,
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["nexus-flujos"] });
    qc.invalidateQueries({ queryKey: ["nexus-estado"] });
  };

  const guardar = async () => {
    if (!editando?.nombre?.trim()) return toast.error("Ponle un nombre al flujo");
    setGuardando(true);
    try {
      const esNuevo = !editando.id;
      const res = await fetch("/api/nexus/flujos", {
        method: esNuevo ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editando,
          disparador: Array.isArray(editando.disparador)
            ? editando.disparador
            : String(editando.disparador ?? "").split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success(esNuevo ? "Flujo creado" : "Flujo actualizado");
      setEditando(null);
      refrescar();
    } finally { setGuardando(false); }
  };

  const alternar = async (f: Flujo) => {
    await fetch("/api/nexus/flujos", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, activo: !f.activo }),
    });
    refrescar();
  };

  const eliminar = async (f: Flujo) => {
    if (!confirm(`¿Eliminar el flujo "${f.nombre}"?`)) return;
    await fetch(`/api/nexus/flujos?id=${f.id}`, { method: "DELETE" });
    toast.success("Flujo eliminado");
    refrescar();
  };

  const iaLista = estado?.ia.configurada;

  return (
    <>
      <Topbar title="Flujos & Automatización" actions={
        <button
          onClick={() => setEditando({ accion: "responder_ia", canal: "todos", activo: true, transferirSiComplejo: true })}
          className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ backgroundColor: NEXUS_COLOR }}
        >
          <Plus size={13} /> Nuevo flujo
        </button>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Estado del motor */}
          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: NEXUS_COLOR }}>
                <Bot size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Motor de automatización</p>
                  {iaLista ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={10} /> IA activa · {estado?.ia.modelo}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-600">
                      IA sin configurar
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">
                  {iaLista
                    ? "El bot clasifica cada mensaje que entra (producto, ciudad, urgencia) y redacta la respuesta sugerida según el flujo que coincida."
                    : <>La IA no está configurada. Cárgala en <Link href="/configuracion?tab=ia" className="font-semibold underline" style={{ color: NEXUS_COLOR }}>Configuración → IA</Link> para que el bot califique y sugiera.</>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { l: "Flujos activos", v: estado?.flujosActivos ?? 0 },
                { l: "Canales que responden", v: estado?.puedenResponder ?? 0 },
                { l: "Conversaciones", v: estado?.conversaciones ?? 0 },
                { l: "Sin leer", v: estado?.sinLeer ?? 0 },
              ].map(k => (
                <div key={k.l} className="p-3 rounded-xl surface-2">
                  <p className="text-[11px] text-muted">{k.l}</p>
                  <p className="text-xl font-bold" style={{ color: NEXUS_COLOR }}>{k.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Canales: qué puede responder de verdad */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Canales</p>
              <Link href="/configuracion?tab=canales" className="text-xs font-semibold flex items-center gap-1" style={{ color: NEXUS_COLOR }}>
                <Settings2 size={12} /> Configurar
              </Link>
            </div>

            {!estado?.canales.length ? (
              <p className="text-xs text-muted p-4 surface-2 rounded-xl text-center">
                Sin canales conectados. Los flujos no tienen por dónde actuar.
              </p>
            ) : (
              <div className="space-y-1.5">
                {estado.canales.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl surface-2">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0")} style={{ backgroundColor: c.activo ? "#16a34a" : "#9ca3af" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-soft truncate">{c.nombre}</p>
                      <p className="text-[10px] text-muted">{c.canal}</p>
                    </div>
                    {c.puedeEnviar ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded">
                        Recibe y responde
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded" title={c.motivo}>
                        Solo recibe
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {estado && estado.canales.length > 0 && estado.puedenResponder === 0 && (
              <p className="text-[11px] text-muted mt-3 flex items-start gap-1.5">
                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                Ningún canal puede responder todavía. Los mensajes entran y se clasifican, pero las respuestas del
                asesor no salen hasta cargar las credenciales del canal.
              </p>
            )}
          </div>

          {/* Flujos */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Flujos</p>

            {isLoading ? (
              <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: NEXUS_COLOR }} /></div>
            ) : flujos.length === 0 ? (
              <div className="card p-10 text-center">
                <Zap size={26} className="mx-auto mb-2 text-muted" />
                <p className="text-sm text-muted">Sin flujos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {flujos.map(f => (
                  <div key={f.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: NEXUS_COLOR + "18" }}>
                        <Zap size={16} style={{ color: NEXUS_COLOR }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{f.nombre}</p>
                          {f.transferirSiComplejo && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded surface-3 text-muted">transfiere si se complica</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted mt-1 line-clamp-2">{f.objetivo}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(f.disparador ?? []).slice(0, 8).map((d, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded surface-3 text-muted font-mono">{d}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => alternar(f)} title={f.activo ? "Desactivar" : "Activar"}
                          className="w-10 h-5 rounded-full relative transition-all"
                          style={{ backgroundColor: f.activo ? "#16a34a" : "#cbd5e1" }}>
                          <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all", f.activo ? "right-0.5" : "left-0.5")} />
                        </button>
                        <button onClick={() => setEditando(f)} className="text-xs font-semibold" style={{ color: NEXUS_COLOR }}>Editar</button>
                        <button onClick={() => eliminar(f)} className="text-muted hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Qué hace hoy cada cosa, sin adornos */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Qué pasa cuando entra un mensaje</p>
            <div className="space-y-2.5">
              {[
                { Icon: MessageSquare, t: "Entra el mensaje", d: "Por el webhook del canal. Si el contacto ya tiene una conversación abierta, se suma a ella.", ok: true },
                { Icon: Sparkles, t: "El bot lo califica", d: "Producto, ciudad, urgencia e intención. Queda como etiquetas y define la prioridad.", ok: iaLista },
                { Icon: ArrowRight, t: "Se asigna por turno", d: "Al asesor con menos conversaciones abiertas. Si ya es cliente con vendedor, va con el suyo.", ok: true },
                { Icon: Bot, t: "El asesor pide sugerencia", d: "El flujo que coincida define el objetivo de la respuesta. El asesor la revisa antes de enviar.", ok: iaLista },
                { Icon: Check, t: "Se envía al canal", d: "Requiere credenciales del canal. Si falla, el mensaje queda marcado como no enviado.", ok: (estado?.puedenResponder ?? 0) > 0 },
              ].map((p, i) => {
                const Icon = p.Icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: p.ok ? "#16a34a18" : "#f59e0b18" }}>
                      <Icon size={13} style={{ color: p.ok ? "#16a34a" : "#f59e0b" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-soft">
                        {p.t}
                        {!p.ok && <span className="text-amber-600 font-normal"> · pendiente de configurar</span>}
                      </p>
                      <p className="text-[11px] text-muted">{p.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted mt-4">
              La respuesta automática sin asesor todavía no está: hoy el flujo prepara la respuesta y una persona la
              aprueba. Se activará cuando el canal lleve tiempo respondiendo bien.
            </p>
          </div>
        </div>
      </div>

      {/* Editor */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-lg my-4 animate-fade-up">
            <div className="card-header">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {editando.id ? "Editar flujo" : "Nuevo flujo"}
              </h2>
              <button onClick={() => setEditando(null)} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre *</label>
                <input className="input" value={editando.nombre ?? ""} onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))} placeholder="Consulta de precio" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Palabras que lo disparan</label>
                <input
                  className="input"
                  value={Array.isArray(editando.disparador) ? editando.disparador.join(", ") : (editando.disparador ?? "")}
                  onChange={e => setEditando(p => ({ ...p, disparador: e.target.value.split(",").map(s => s.trim()) }))}
                  placeholder="precio, cotizar, cuánto vale"
                />
                <p className="text-[11px] text-muted mt-1">Separadas por coma. Se buscan dentro del mensaje del cliente.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Qué debe lograr la respuesta</label>
                <textarea className="input resize-none" rows={4} value={editando.objetivo ?? ""} onChange={e => setEditando(p => ({ ...p, objetivo: e.target.value }))}
                  placeholder="Ayudar al cliente a entender qué necesita: tipo de malla, medidas, ciudad e instalación. Preguntar una o dos cosas a la vez." />
                <p className="text-[11px] text-muted mt-1">Esto es lo que se le dice a la IA. Entre más concreto, mejor sale la sugerencia.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-soft">
                <input type="checkbox" checked={editando.transferirSiComplejo ?? true} onChange={e => setEditando(p => ({ ...p, transferirSiComplejo: e.target.checked }))} />
                Ofrecer pasar a un asesor humano si se complica
              </label>
              <label className="flex items-center gap-2 text-xs text-soft">
                <input type="checkbox" checked={editando.activo ?? true} onChange={e => setEditando(p => ({ ...p, activo: e.target.checked }))} />
                Activo
              </label>
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button onClick={() => setEditando(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: NEXUS_COLOR }}>
                {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() { return <Suspense><FlujosContent /></Suspense>; }
