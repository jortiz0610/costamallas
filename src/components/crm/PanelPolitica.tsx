"use client";

// ============================================================
// Descuento, anticipo y visto bueno, en la ficha de la cotización.
//
// El asesor ve contra qué se está comparando y si su oferta se pasó. El
// administrador aprueba o rechaza desde aquí mismo, sin abrir otra
// pantalla: si aprobar cuesta trabajo, se termina aprobando por WhatsApp
// y no queda registro de nada.
// ============================================================

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Percent, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { esAdmin } from "@/lib/permisos";
import { formatCOP, formatDate } from "@/lib/utils";

interface Politica { descuentoMaxPct: number; anticipoMinPct: number; exigirAprobacion: boolean }

export interface DatosPolitica {
  descuentoPct: number;
  anticipoPct: number | null;
  aprobacionEstado: string;
  aprobacionMotivo: string | null;
  aprobadaPorNombre: string | null;
  aprobadaEn: string | null;
  aprobacionNota: string | null;
  total: number;
  esBorrador: boolean;
}

const CRM_COLOR = "#BA7517";

export function PanelPolitica({ cotizacionId, datos }: { cotizacionId: string; datos: DatosPolitica }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const admin = esAdmin(user?.rol);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState("");
  const [anticipo, setAnticipo] = useState<string>(datos.anticipoPct == null ? "" : String(datos.anticipoPct));

  const { data: politica } = useQuery<Politica>({
    queryKey: ["config-comercial-lectura"],
    queryFn: async () => (await (await fetch("/api/configuracion/comercial")).json()).data,
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["cotizacion", cotizacionId] });
    qc.invalidateQueries({ queryKey: ["crm-cotizaciones"] });
  };

  const decidir = async (aprobar: boolean) => {
    setOcupado(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${cotizacionId}/aprobacion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprobar, nota }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo");
      toast.success(j.mensaje);
      setNota("");
      refrescar();
    } finally { setOcupado(false); }
  };

  const guardarAnticipo = async () => {
    setOcupado(true);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${cotizacionId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anticipoPct: anticipo === "" ? null : Number(anticipo) }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo");
      if (j.aviso) toast(j.aviso, { icon: "⚠️", duration: 6000 });
      else toast.success("Anticipo guardado");
      refrescar();
    } finally { setOcupado(false); }
  };

  const estado = datos.aprobacionEstado;
  const pendiente = estado === "PENDIENTE";
  const rechazada = estado === "RECHAZADA";
  const aprobada = estado === "APROBADA";

  const Icono = pendiente ? ShieldAlert : rechazada ? ShieldX : ShieldCheck;
  const color = pendiente ? "#d97706" : rechazada ? "#dc2626" : "#16a34a";

  const anticipoEfectivo = datos.anticipoPct ?? politica?.anticipoMinPct ?? null;

  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-1.5">
        <Percent size={12} /> Condiciones
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Descuento</p>
          <p className="text-sm font-bold" style={{ color: pendiente ? "#d97706" : "var(--text-soft)" }}>
            {datos.descuentoPct}%
          </p>
          {politica && (
            <p className="text-[10px] text-muted">tope sin aprobar: {politica.descuentoMaxPct}%</p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">Anticipo</p>
          <p className="text-sm font-bold text-soft">
            {anticipoEfectivo != null ? `${anticipoEfectivo}%` : "—"}
            {datos.anticipoPct == null && anticipoEfectivo != null && (
              <span className="text-[10px] font-normal text-muted"> (el mínimo)</span>
            )}
          </p>
          {anticipoEfectivo != null && (
            <p className="text-[10px] text-muted">{formatCOP((datos.total * anticipoEfectivo) / 100)}</p>
          )}
        </div>
      </div>

      {/* Cambiar el anticipo: es una condición de pago, se puede tocar
          sin rehacer los ítems. */}
      {datos.esBorrador && (
        <div className="flex items-end gap-2 mb-3 pb-3 border-b divider">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Anticipo pactado (%)</label>
            <input
              type="number" className="input py-1.5 text-xs" value={anticipo}
              onChange={e => setAnticipo(e.target.value)}
              placeholder={politica ? String(politica.anticipoMinPct) : "50"}
            />
          </div>
          <button onClick={guardarAnticipo} disabled={ocupado}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: CRM_COLOR }}>
            Guardar
          </button>
        </div>
      )}

      {/* Estado de la aprobación */}
      <div className="flex items-start gap-2">
        <Icono size={14} style={{ color }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color }}>
            {pendiente ? "Necesita visto bueno" : rechazada ? "Condiciones rechazadas" : aprobada ? "Condiciones aprobadas" : "Dentro de la política"}
          </p>
          {datos.aprobacionMotivo && (
            <p className="text-[11px] text-muted mt-0.5">{datos.aprobacionMotivo}</p>
          )}
          {(aprobada || rechazada) && datos.aprobadaPorNombre && (
            <p className="text-[10px] text-muted mt-0.5">
              {datos.aprobadaPorNombre} · {formatDate(datos.aprobadaEn)}
              {datos.aprobacionNota ? ` · "${datos.aprobacionNota}"` : ""}
            </p>
          )}
          {pendiente && !admin && (
            <p className="text-[10px] text-muted mt-1">
              No se puede enviar ni convertir en pedido hasta que un administrador la autorice.
            </p>
          )}
        </div>
      </div>

      {/* Decisión del administrador */}
      {admin && (pendiente || rechazada) && (
        <div className="mt-3 pt-3 border-t divider space-y-2">
          <input
            className="input py-1.5 text-xs" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Por qué se autoriza (opcional, queda guardado)"
          />
          <div className="flex gap-2">
            <button onClick={() => decidir(false)} disabled={ocupado}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold surface-3 text-muted flex items-center justify-center gap-1 disabled:opacity-50">
              <X size={11} /> Rechazar
            </button>
            <button onClick={() => decidir(true)} disabled={ocupado}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
              style={{ backgroundColor: "#16a34a" }}>
              {ocupado ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aprobar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
