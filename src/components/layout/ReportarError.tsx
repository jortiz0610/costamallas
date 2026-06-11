"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, X, Loader2, Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import toast from "react-hot-toast";

export function ReportarError() {
  const [open, setOpen] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [accion, setAccion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const enviar = async () => {
    setEnviando(true);
    try {
      const res = await fetch("/api/reportes-error", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modulo: pathname, accion, descripcion,
          url: typeof window !== "undefined" ? window.location.href : pathname,
        }),
      });
      if ((await res.json()).success) { setEnviado(true); setAccion(""); setDescripcion(""); }
      else toast.error("No se pudo enviar el reporte");
    } catch { toast.error("Error al enviar"); } finally { setEnviando(false); }
  };

  const cerrar = () => { setOpen(false); setTimeout(() => setEnviado(false), 300); };

  return (
    <>
      {/* Ícono sutil de advertencia (en Topbar) */}
      <button onClick={() => setOpen(true)} title="Reportar un problema"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 dark:text-gray-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors">
        <AlertTriangle size={15} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={cerrar}>
          <div className="card w-full max-w-md animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Reportar un problema</h2>
              <button onClick={cerrar} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
            </div>

            {enviado ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={28} className="text-emerald-600" /></div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">¡Reporte enviado!</p>
                <p className="text-xs text-muted mt-1">Gracias. El equipo de administración lo revisará.</p>
                <button onClick={cerrar} className="btn-secondary btn-sm mt-4">Cerrar</button>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-4">
                  {/* Datos capturados automáticamente */}
                  <div className="rounded-xl p-3 surface-2 text-xs space-y-1">
                    <p className="text-muted">Se registrará automáticamente:</p>
                    <p className="text-soft"><b>Usuario:</b> {user?.nombre} ({user?.rol})</p>
                    <p className="text-soft"><b>Ubicación:</b> {pathname}</p>
                    <p className="text-soft"><b>Fecha:</b> {new Date().toLocaleString("es-CO")}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">¿Qué estabas haciendo?</label>
                    <input className="input" value={accion} onChange={e => setAccion(e.target.value)} placeholder="Ej: Guardando un producto" autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Descripción del problema (opcional)</label>
                    <textarea className="input resize-none" rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Describe qué salió mal…" />
                  </div>
                </div>
                <div className="p-5 pt-0 flex gap-3">
                  <button onClick={cerrar} className="btn-secondary flex-1">Cancelar</button>
                  <button onClick={enviar} disabled={enviando} className="btn-primary flex-1 justify-center">
                    {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar reporte
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
