"use client";

// ============================================================
// Ficha de una instalación: evidencia y cierre.
//
// Las fotos del antes y el después son el respaldo cuando un cliente
// reclama garantía por algo que ya estaba dañado, o dice que no se hizo
// lo que sí se hizo. El checklist evita que una obra se dé por terminada
// de memoria: el servidor no deja cerrarla con puntos sin marcar.
// ============================================================

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X, Loader2, Camera, Check, Plus, Trash2, MapPin, User, Phone, CheckCircle2, FileSignature,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP, formatDate, cn } from "@/lib/utils";

const CRM_COLOR = "#BA7517";

export interface FotoObra { url: string; titulo?: string; momento: "ANTES" | "DESPUES" }
export interface PuntoChecklist { texto: string; hecho: boolean }

export interface InstalacionFicha {
  id: string; estado: string; fechaAgendada?: string | null; fechaRealizada?: string | null;
  direccion?: string | null; ciudad?: string | null; notas?: string | null;
  fotos?: FotoObra[]; checklist?: PuntoChecklist[];
  pedido: { id?: string; numero: string; total: number; cliente: { nombre: string; empresa?: string | null; telefono?: string | null } };
  tecnico?: { id?: string; nombre: string } | null;
}

/** Lo mínimo que hay que verificar antes de cerrar una obra. */
const CHECKLIST_BASE: PuntoChecklist[] = [
  { texto: "Material instalado según lo cotizado", hecho: false },
  { texto: "Tensado y anclajes revisados", hecho: false },
  { texto: "Sitio de trabajo limpio", hecho: false },
  { texto: "Cliente recibió a conformidad", hecho: false },
];

export function FichaInstalacion({ inst, onClose }: { inst: InstalacionFicha; onClose: () => void }) {
  const qc = useQueryClient();
  const inputFoto = useRef<HTMLInputElement>(null);
  const [momento, setMomento] = useState<"ANTES" | "DESPUES">("ANTES");
  const [fotos, setFotos] = useState<FotoObra[]>(inst.fotos ?? []);
  const [checklist, setChecklist] = useState<PuntoChecklist[]>(
    inst.checklist?.length ? inst.checklist : CHECKLIST_BASE,
  );
  const [nuevoPunto, setNuevoPunto] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const refrescar = () => qc.invalidateQueries({ queryKey: ["instalaciones"] });

  const guardar = async (extra: Record<string, unknown> = {}) => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/instalaciones/${inst.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotos, checklist, ...extra }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) { toast.error(j.error ?? "No se pudo guardar"); return false; }
      toast.success("Guardado");
      refrescar();
      return true;
    } finally { setGuardando(false); }
  };

  const subirFoto = async (file: File) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/imagenes/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo subir la foto");
      setFotos(prev => [...prev, { url: j.data.url, momento, titulo: file.name }]);
      if (j.aviso) toast(j.aviso, { icon: "⚠️", duration: 9000 });
      else toast.success(`Foto de ${momento.toLowerCase()} agregada`);
    } finally { setSubiendo(false); }
  };

  const pendientes = checklist.filter(c => !c.hecho).length;
  const cerrada = inst.estado === "COMPLETADA";

  const cerrar = async () => {
    if (pendientes > 0) return toast.error(`Faltan ${pendientes} punto(s) del checklist`);
    if (!confirm("¿Dar la instalación por terminada? El pedido pasará a INSTALADO.")) return;
    if (await guardar({ estado: "COMPLETADA" })) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-lg h-full overflow-y-auto card rounded-none animate-fade-up" onClick={e => e.stopPropagation()}>
        <div className="card-header sticky top-0 z-10">
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{inst.pedido.numero}</h2>
            <p className="text-xs text-muted">{inst.pedido.cliente.empresa || inst.pedido.cliente.nombre}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Datos */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-soft"><User size={13} className="text-muted" /> {inst.tecnico?.nombre ?? "Sin técnico asignado"}</div>
            {inst.fechaAgendada && <div className="flex items-center gap-2 text-soft"><CheckCircle2 size={13} className="text-muted" /> Agendada: {formatDate(inst.fechaAgendada)}</div>}
            {(inst.direccion || inst.ciudad) && (
              <div className="flex items-center gap-2 text-soft"><MapPin size={13} className="text-muted" /> {[inst.direccion, inst.ciudad].filter(Boolean).join(", ")}</div>
            )}
            {inst.pedido.cliente.telefono && (
              <div className="flex items-center gap-2 text-soft"><Phone size={13} className="text-muted" /> {inst.pedido.cliente.telefono}</div>
            )}
            <div className="flex items-center gap-2 text-soft">
              <span className="text-muted">Valor:</span> <span className="font-bold">{formatCOP(Number(inst.pedido.total))}</span>
            </div>
          </div>

          {inst.notas && (
            <div className="p-3 rounded-xl surface-2 text-xs text-soft whitespace-pre-line">{inst.notas}</div>
          )}

          {/* Evidencia */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Evidencia</p>
              <div className="flex gap-1">
                {(["ANTES", "DESPUES"] as const).map(m => (
                  <button key={m} onClick={() => setMomento(m)}
                    className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase", momento === m ? "text-white" : "surface-3 text-muted")}
                    style={momento === m ? { backgroundColor: CRM_COLOR } : undefined}>
                    {m === "ANTES" ? "Antes" : "Después"}
                  </button>
                ))}
              </div>
            </div>

            <input
              ref={inputFoto} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }}
            />
            <button
              onClick={() => inputFoto.current?.click()}
              disabled={subiendo || cerrada}
              className="w-full py-2.5 rounded-xl surface-2 text-xs font-semibold text-soft flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {subiendo ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              Tomar o subir foto de {momento.toLowerCase()}
            </button>

            {fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {fotos.map((f, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.titulo ?? ""} className="w-full h-20 object-cover rounded-lg" />
                    <span className="absolute top-1 left-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: f.momento === "ANTES" ? "#64748b" : "#16a34a", color: "#fff" }}>
                      {f.momento === "ANTES" ? "Antes" : "Después"}
                    </span>
                    {!cerrada && (
                      <button
                        onClick={() => setFotos(prev => prev.filter((_, n) => n !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Checklist de cierre</p>
              {pendientes > 0 && <span className="text-[10px] font-bold text-amber-600">{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span>}
            </div>
            <div className="space-y-1.5">
              {checklist.map((c, i) => (
                <label key={i} className="flex items-start gap-2 p-2.5 rounded-xl surface-2 cursor-pointer">
                  <input
                    type="checkbox" checked={c.hecho} disabled={cerrada}
                    onChange={e => setChecklist(prev => prev.map((x, n) => n === i ? { ...x, hecho: e.target.checked } : x))}
                    className="mt-0.5"
                  />
                  <span className={cn("text-xs flex-1", c.hecho ? "text-muted line-through" : "text-soft")}>{c.texto}</span>
                  {!cerrada && (
                    <button onClick={e => { e.preventDefault(); setChecklist(prev => prev.filter((_, n) => n !== i)); }} className="text-muted hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </label>
              ))}
            </div>

            {!cerrada && (
              <div className="flex gap-2 mt-2">
                <input
                  className="input py-1.5 text-xs flex-1" value={nuevoPunto} onChange={e => setNuevoPunto(e.target.value)}
                  placeholder="Agregar un punto…"
                  onKeyDown={e => {
                    if (e.key === "Enter" && nuevoPunto.trim()) {
                      setChecklist(prev => [...prev, { texto: nuevoPunto.trim(), hecho: false }]);
                      setNuevoPunto("");
                    }
                  }}
                />
                <button
                  onClick={() => { if (nuevoPunto.trim()) { setChecklist(prev => [...prev, { texto: nuevoPunto.trim(), hecho: false }]); setNuevoPunto(""); } }}
                  className="btn-secondary btn-sm"
                ><Plus size={13} /></button>
              </div>
            )}
          </div>

          {/* El acta de entrega. Se puede imprimir en blanco y llenar a
              mano en la obra: el técnico casi nunca lleva computador. */}
          <Link
            href={`/crm/instalaciones/${inst.id}/acta`}
            className="w-full py-2.5 rounded-xl surface-2 text-xs font-semibold text-soft flex items-center justify-center gap-2"
          >
            <FileSignature size={13} /> Acta de entrega
          </Link>

          {/* Acciones */}
          {!cerrada ? (
            <div className="space-y-2">
              <button onClick={() => guardar()} disabled={guardando} className="btn-secondary w-full justify-center">
                {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar avance
              </button>
              <button
                onClick={cerrar} disabled={guardando || pendientes > 0}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ backgroundColor: "#16a34a" }}
              >
                <CheckCircle2 size={14} /> Dar por terminada
              </button>
              {pendientes > 0 && (
                <p className="text-[11px] text-muted text-center">
                  Marca los {pendientes} punto(s) que faltan para poder cerrarla.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl text-xs text-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              Instalación terminada{inst.fechaRealizada ? ` el ${formatDate(inst.fechaRealizada)}` : ""}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
