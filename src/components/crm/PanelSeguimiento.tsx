"use client";

// ============================================================
// Los tres toques de una oferta, en la ficha de la cotización.
//
// Muestra la agenda completa aunque todavía no haya pasado nada: el
// asesor tiene que poder ver qué va a ocurrir y cuándo, no solo el
// rastro de lo que ya ocurrió.
//
// Lo que NO está listo se dice aquí, en pantalla, con el motivo. Un
// seguimiento que parece armado y no manda nada es peor que no tenerlo:
// el asesor deja de llamar creyendo que el sistema lo hace.
// ============================================================

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Loader2, Mail, Phone, AlertTriangle, CheckCircle2, Clock, BellOff, Bell,
  Send, MessageSquare, XCircle,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const CRM_COLOR = "#BA7517";

interface ToqueEstado {
  toque: 1 | 2 | 3;
  automatico: boolean;
  programadoPara: string | null;
  estado: string;
  canal: string;
  ejecutadoEn: string | null;
  destino: string | null;
  mensaje: string | null;
  error: string | null;
  tareaId: string | null;
  alertaEnviadaEn: string | null;
}

interface Seguimiento {
  activo: boolean;
  enviadaEn: string | null;
  venceEl: string;
  vencida: boolean;
  vistas: number;
  clienteTieneCorreo: boolean;
  toques: ToqueEstado[];
  config: {
    activoGlobal: boolean;
    t1Horas: number; t2Horas: number; t2LimiteHoras: number; t3DiasAntes: number;
    porWhatsapp: boolean;
  };
  listo: { correo: boolean; whatsapp: boolean };
}

const TITULOS: Record<number, string> = {
  1: "Confirmar que le llegó",
  2: "Tu llamada",
  3: "Aviso de vencimiento",
};

const ESTILO_ESTADO: Record<string, { texto: string; color: string; Icono: typeof Clock }> = {
  SIN_ENVIAR:  { texto: "La oferta no se ha enviado", color: "#94a3b8", Icono: Clock },
  PROGRAMADO:  { texto: "Programado",                 color: "#64748b", Icono: Clock },
  PENDIENTE:   { texto: "Pendiente",                  color: "#d97706", Icono: Clock },
  ENVIADO:     { texto: "Enviado",                    color: "#16a34a", Icono: CheckCircle2 },
  HECHO:       { texto: "Hecho",                      color: "#16a34a", Icono: CheckCircle2 },
  ERROR:       { texto: "No salió",                   color: "#dc2626", Icono: XCircle },
  OMITIDO:     { texto: "Omitido",                    color: "#94a3b8", Icono: XCircle },
};

export function PanelSeguimiento({ cotizacionId }: { cotizacionId: string }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [notaAbierta, setNotaAbierta] = useState(false);
  const [nota, setNota] = useState("");

  const { data, isLoading } = useQuery<Seguimiento>({
    queryKey: ["cot-seguimiento", cotizacionId],
    queryFn: async () =>
      (await (await fetch(`/api/crm/cotizaciones/${cotizacionId}/seguimiento`)).json()).data,
  });

  const accion = async (cuerpo: Record<string, unknown>, etiqueta: string) => {
    setOcupado(etiqueta);
    try {
      const res = await fetch(`/api/crm/cotizaciones/${cotizacionId}/seguimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo");
      toast.success(j.mensaje ?? "Listo");
      setNotaAbierta(false);
      setNota("");
      qc.invalidateQueries({ queryKey: ["cot-seguimiento", cotizacionId] });
      qc.invalidateQueries({ queryKey: ["cotizacion", cotizacionId] });
    } finally {
      setOcupado(null);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="card p-5 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin" style={{ color: CRM_COLOR }} />
      </div>
    );
  }

  const sinEnviar = !data.enviadaEn;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Secuencia de 3 toques</p>
        <button
          onClick={() => accion({ accion: data.activo ? "apagar" : "encender" }, "toggle")}
          disabled={ocupado === "toggle"}
          className="text-[10px] font-semibold flex items-center gap-1 disabled:opacity-50"
          style={{ color: data.activo ? "#dc2626" : "#16a34a" }}
          title={data.activo ? "Dejar de contactar al cliente por esta oferta" : "Volver a activar el seguimiento"}
        >
          {ocupado === "toggle"
            ? <Loader2 size={11} className="animate-spin" />
            : data.activo ? <BellOff size={11} /> : <Bell size={11} />}
          {data.activo ? "Apagar" : "Activar"}
        </button>
      </div>

      {/* Avisos de por qué esto puede no funcionar todavía */}
      <div className="space-y-1.5 mb-3">
        {!data.activo && (
          <Aviso tono="neutro">
            Seguimiento apagado para esta oferta: no se le manda nada más al cliente.
          </Aviso>
        )}
        {!data.config.activoGlobal && (
          <Aviso tono="alerta">
            El seguimiento automático está apagado para todo el portal (Configuración → Seguimiento).
          </Aviso>
        )}
        {!data.listo.correo && (
          <Aviso tono="alerta">
            Falta cargar el correo saliente (Configuración → Correo). Los toques quedan en espera y salen
            solos en cuanto se carguen las credenciales; no se dan por enviados.
          </Aviso>
        )}
        {!data.clienteTieneCorreo && (
          <Aviso tono="alerta">Este cliente no tiene correo en el CRM: los toques 1 y 3 no tienen a dónde ir.</Aviso>
        )}
        {data.config.porWhatsapp && (
          <Aviso tono="neutro">
            El envío por WhatsApp está activado pero la cuenta de Meta no está aprobada: el texto queda
            preparado y el intento se registra como fallido. El correo sí sale.
          </Aviso>
        )}
        {sinEnviar && (
          <Aviso tono="neutro">El reloj arranca cuando se envíe la oferta.</Aviso>
        )}
        {data.vencida && (
          <Aviso tono="neutro">La oferta ya venció: no se disparan más toques.</Aviso>
        )}
      </div>

      <div className="space-y-3">
        {data.toques.map(t => {
          const est = ESTILO_ESTADO[t.estado] ?? ESTILO_ESTADO.PROGRAMADO;
          const { Icono } = est;
          return (
            <div key={t.toque} className="pl-3 border-l-2" style={{ borderColor: est.color }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-soft flex items-center gap-1.5">
                  {t.toque === 2 ? <Phone size={11} /> : <Mail size={11} />}
                  Toque {t.toque} · {TITULOS[t.toque]}
                </p>
                <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: est.color }}>
                  <Icono size={10} /> {est.texto}
                </span>
              </div>

              <p className="text-[11px] text-muted mt-0.5">
                {t.automatico ? "Automático" : "Lo hace una persona"}
                {t.programadoPara ? ` · ${formatDate(t.programadoPara)}` : ""}
                {t.ejecutadoEn ? ` · salió ${formatDate(t.ejecutadoEn)}` : ""}
              </p>

              {t.destino && t.estado === "ENVIADO" && (
                <p className="text-[10px] text-muted mt-0.5">→ {t.destino}</p>
              )}

              {t.error && (
                <p className="text-[10px] text-red-600 mt-1 flex items-start gap-1">
                  <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" /> {t.error}
                </p>
              )}

              {t.alertaEnviadaEn && (
                <p className="text-[10px] text-red-600 mt-0.5">
                  Gerencia avisada el {formatDate(t.alertaEnviadaEn)}
                </p>
              )}

              {/* Acciones */}
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {t.automatico && !sinEnviar && !data.vencida && (
                  <button
                    onClick={() => accion({ accion: "enviar", toque: t.toque }, `t${t.toque}`)}
                    disabled={ocupado === `t${t.toque}` || !data.clienteTieneCorreo}
                    className="text-[10px] font-semibold flex items-center gap-1 disabled:opacity-40"
                    style={{ color: CRM_COLOR }}
                  >
                    {ocupado === `t${t.toque}`
                      ? <Loader2 size={10} className="animate-spin" />
                      : <Send size={10} />}
                    {t.estado === "ENVIADO" ? "Volver a enviar" : "Enviar ahora"}
                  </button>
                )}

                {t.toque === 2 && t.tareaId && (
                  <Link href="/crm/tareas" className="text-[10px] font-semibold text-muted hover:underline">
                    Ver la tarea
                  </Link>
                )}

                {t.toque === 2 && t.estado === "PENDIENTE" && (
                  <button
                    onClick={() => setNotaAbierta(v => !v)}
                    className="text-[10px] font-semibold flex items-center gap-1"
                    style={{ color: CRM_COLOR }}
                  >
                    <MessageSquare size={10} /> Registrar la llamada
                  </button>
                )}
              </div>

              {t.toque === 2 && notaAbierta && (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    className="input resize-none text-xs"
                    rows={3}
                    value={nota}
                    onChange={e => setNota(e.target.value)}
                    placeholder="¿Qué dijo el cliente? Esto es lo que va a leer quien retome el negocio."
                  />
                  <button
                    onClick={() => accion({ accion: "marcar-hecho", nota }, "hecho")}
                    disabled={ocupado === "hecho"}
                    className="w-full py-1.5 rounded-lg text-[11px] font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ backgroundColor: CRM_COLOR }}
                  >
                    {ocupado === "hecho"
                      ? <Loader2 size={11} className="animate-spin" />
                      : <CheckCircle2 size={11} />}
                    Guardar y cerrar la tarea
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Aviso({ tono, children }: { tono: "alerta" | "neutro"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 text-[10px] leading-snug p-2 rounded-lg",
        tono === "alerta"
          ? "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10"
          : "text-muted surface-2",
      )}
    >
      <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
