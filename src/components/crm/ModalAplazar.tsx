"use client";

// ============================================================
// Aplazar el vencimiento de una oferta.
//
// El caso real: la oferta venció, el cliente todavía la está pensando y
// pide unos días. Hasta ahora la única salida era rehacerla, lo que
// quemaba un consecutivo y perdía el historial de seguimiento.
//
// Los topes del vendedor —15 días, dos veces— se muestran ANTES de
// pulsar, no como un error después. El servidor los vuelve a comprobar.
// ============================================================

import { useState } from "react";
import toast from "react-hot-toast";
import { X, Loader2, CalendarPlus } from "lucide-react";
import { DIAS_MAX_VENDEDOR, PRORROGAS_MAX_VENDEDOR } from "@/lib/politica-comercial";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  cotizacion: {
    id: string;
    numero: string;
    estado: string;
    createdAt: string;
    validezDias?: number;
    prorrogaDias?: number;
    prorrogas?: number;
  };
  onClose: () => void;
  onHecho: () => void;
}

const DIA = 86_400_000;

export function ModalAplazar({ cotizacion, onClose, onHecho }: Props) {
  const { isAdmin } = useAuth();
  const [dias, setDias] = useState(String(DIAS_MAX_VENDEDOR));
  const [guardando, setGuardando] = useState(false);

  const usadas = cotizacion.prorrogas ?? 0;
  const sinCupo = !isAdmin && usadas >= PRORROGAS_MAX_VENDEDOR;

  const n = Number(dias);
  const valido = Number.isInteger(n) && n >= 1 && n <= 365 && (isAdmin || n <= DIAS_MAX_VENDEDOR);

  const venceActual = new Date(
    new Date(cotizacion.createdAt).getTime() +
      ((cotizacion.validezDias ?? 30) + (cotizacion.prorrogaDias ?? 0)) * DIA,
  );
  const venceNuevo = new Date(venceActual.getTime() + (Number.isFinite(n) ? n : 0) * DIA);
  const fmt = (d: Date) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  const aplazar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${cotizacion.id}/aplazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias: n }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo aplazar");
      toast.success(`${cotizacion.numero} vence ahora el ${fmt(new Date(json.data.venceEl))}`);
      onHecho();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="card w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CalendarPlus size={15} className="text-gray-400" /> Aplazar {cotizacion.numero}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {sinCupo ? (
            <p className="text-[12.5px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Esta oferta ya se aplazó {usadas} veces, que es el tope para un vendedor.
              A partir de aquí lo tiene que hacer un administrador.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Días más
                </label>
                <input
                  type="number" min={1} max={isAdmin ? 365 : DIAS_MAX_VENDEDOR}
                  className="input" value={dias} onChange={e => setDias(e.target.value)} autoFocus
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {isAdmin
                    ? "Como administrador no tienes tope."
                    : `Hasta ${DIAS_MAX_VENDEDOR} días, máximo ${PRORROGAS_MAX_VENDEDOR} veces. Llevas ${usadas}.`}
                </p>
              </div>

              <div className="rounded-xl p-3 text-[12px] space-y-1" style={{ backgroundColor: "var(--surface-3)" }}>
                <p className="text-gray-500 dark:text-slate-400">
                  Vence hoy: <span className="font-semibold">{fmt(venceActual)}</span>
                </p>
                {valido && (
                  <p className="text-gray-800 dark:text-gray-100">
                    Pasaría a: <span className="font-bold">{fmt(venceNuevo)}</span>
                  </p>
                )}
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                La validez que dice el documento no cambia: se le ofreció al cliente
                {cotizacion.validezDias ? ` ${cotizacion.validezDias} días` : ""} y así queda.
                La prórroga se guarda aparte y se ve en la lista.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-secondary btn-sm">Cerrar</button>
          {!sinCupo && (
            <button onClick={aplazar} disabled={!valido || guardando} className="btn-primary btn-sm disabled:opacity-40">
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
              Aplazar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
