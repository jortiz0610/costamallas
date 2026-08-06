"use client";

// ============================================================
// Los tres toques posteriores al envío de una cotización.
//
// Aquí se define QUÉ dice y CUÁNDO sale. Los textos por defecto no
// prometen nada que el sistema no sepa: solo el número de la oferta, su
// total, cuándo vence y el enlace. Todo lo demás ya va en la cotización.
//
// El correo saliente y WhatsApp se muestran con su estado real: si algo
// no está listo, se ve aquí y no cuando el cliente no recibe nada.
// ============================================================

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, Route, Mail, Phone, AlertTriangle, PlayCircle } from "lucide-react";
import toast from "react-hot-toast";
import { SEGUIMIENTO_DEFAULTS, MARCADORES, type ConfigSeguimiento } from "@/lib/seguimiento-textos";

interface Respuesta {
  data: ConfigSeguimiento;
  listo: { correo: boolean; whatsapp: boolean };
}

export function TabSeguimiento() {
  const [cfg, setCfg] = useState<ConfigSeguimiento>(SEGUIMIENTO_DEFAULTS);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<Respuesta>({
    queryKey: ["config-seguimiento"],
    queryFn: async () => (await (await fetch("/api/configuracion/seguimiento")).json()),
  });

  useEffect(() => { if (data?.data) setCfg(data.data); }, [data]);

  const set = <K extends keyof ConfigSeguimiento>(k: K, v: ConfigSeguimiento[K]) =>
    setCfg(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/seguimiento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Seguimiento guardado");
      refetch();
    } finally { setGuardando(false); }
  };

  // Simulacro: dice qué haría hoy la corrida diaria, sin mandar ni
  // escribir nada. Es la única forma de mirar esto sin tocar la base.
  const simular = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      const j = await (await fetch("/api/cron/diario?dry=1", { method: "POST" })).json();
      if (!j.success) return toast.error(j.error ?? "No se pudo simular");
      const s = j.data.seguimiento;
      const v = j.data.vencimientos;
      const lineas = [
        `Se vencerían: ${v.cotizaciones.vencidas.length} cotización(es) y ${v.facturas.vencidas.length} factura(s)`,
        ...v.cotizaciones.vencidas.map((n: string) => `· ${n} → VENCIDA`),
        ...v.facturas.vencidas.map((n: string) => `· factura ${n} → VENCIDA`),
        "",
        `Cotizaciones en seguimiento: ${s.revisadas}`,
        ...s.acciones.map((a: { cotizacion: string; toque: number; detalle: string }) =>
          `· ${a.cotizacion} — toque ${a.toque}: ${a.detalle}`),
        ...s.omitidas.map((o: string) => `· ${o}`),
      ];
      setPrueba(lineas.join("\n").trim() || "Hoy no habría nada que hacer.");
    } finally { setProbando(false); }
  };

  if (isLoading) {
    return <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>;
  }

  const listo = data?.listo ?? { correo: false, whatsapp: false };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}>
          <Route size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Seguimiento post-cotización</h2>
          <p className="text-xs text-muted mt-0.5">
            Tres toques después de enviar una oferta. Dos los manda el sistema; el del medio lo hace una persona.
          </p>
        </div>
      </div>

      {/* Estado real de lo que hace falta */}
      <div className="card p-4 space-y-2">
        <Estado ok={listo.correo}
          bien="Correo saliente configurado: los toques 1 y 3 salen."
          mal="Falta el correo saliente (pestaña Correo). Los toques quedan en espera y salen solos en cuanto se cargue; no se dan por enviados." />
        <Estado ok={listo.whatsapp}
          bien="WhatsApp conectado."
          mal="WhatsApp pendiente de la aprobación de Meta. Los textos están escritos y guardados; el envío se registra como fallido con el motivo, no se simula." />
        <div className="flex items-start gap-2 text-[11px] text-muted pt-2 border-t divider">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            La corrida es <b>una vez al día</b> (el plan de Vercel no permite más). Cada toque sale en la primera
            corrida posterior a su hora, no exactamente a la hora.
          </span>
        </div>
      </div>

      {/* Interruptores y tiempos */}
      <div className="card p-5 space-y-4">
        <label className="flex items-center gap-2 text-xs text-soft font-semibold">
          <input type="checkbox" checked={cfg.activo} onChange={e => set("activo", e.target.checked)} />
          Seguimiento automático activo
        </label>
        <label className="flex items-center gap-2 text-xs text-soft">
          <input type="checkbox" checked={cfg.porWhatsapp} onChange={e => set("porWhatsapp", e.target.checked)} />
          Mandar también por WhatsApp cuando esté aprobado
        </label>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t divider">
          <Numero label="Toque 1 (horas)" valor={cfg.t1Horas} set={v => set("t1Horas", v)} pista="Tras enviar" />
          <Numero label="Toque 2 (horas)" valor={cfg.t2Horas} set={v => set("t2Horas", v)} pista="Se crea la tarea" />
          <Numero label="Plazo toque 2" valor={cfg.t2LimiteHoras} set={v => set("t2LimiteHoras", v)} pista="Antes de alertar" />
          <Numero label="Toque 3 (días)" valor={cfg.t3DiasAntes} set={v => set("t3DiasAntes", v)} pista="Antes de vencer" />
        </div>
        <p className="text-[11px] text-muted">
          Si el asesor no marca la llamada dentro del plazo, se le avisa a los administradores del portal
          (notificación adentro y correo). El aviso se manda una sola vez: uno que se repite a diario se deja de leer.
        </p>
      </div>

      {/* Textos */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
          <Mail size={12} /> Toque 1 · confirmar que le llegó
        </p>
        <Campo label="Asunto" valor={cfg.t1Asunto} set={v => set("t1Asunto", v)} />
        <Campo label="Cuerpo del correo" valor={cfg.t1Cuerpo} set={v => set("t1Cuerpo", v)} filas={7} />
        <Campo label="Texto de WhatsApp" valor={cfg.t1Whatsapp} set={v => set("t1Whatsapp", v)} filas={3} />
      </div>

      <div className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
          <Phone size={12} /> Toque 2 · la llamada del asesor
        </p>
        <p className="text-[11px] text-muted -mt-2">
          Esto no se le manda al cliente: es la tarea que le aparece al asesor, con el guion de qué preguntar.
        </p>
        <Campo label="Título de la tarea" valor={cfg.t2Titulo} set={v => set("t2Titulo", v)} />
        <Campo label="Guion de la llamada" valor={cfg.t2Guion} set={v => set("t2Guion", v)} filas={10} />
      </div>

      <div className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
          <Mail size={12} /> Toque 3 · un día antes de vencer
        </p>
        <Campo label="Asunto" valor={cfg.t3Asunto} set={v => set("t3Asunto", v)} />
        <Campo label="Cuerpo del correo" valor={cfg.t3Cuerpo} set={v => set("t3Cuerpo", v)} filas={7} />
        <Campo label="Texto de WhatsApp" valor={cfg.t3Whatsapp} set={v => set("t3Whatsapp", v)} filas={3} />
      </div>

      {/* Marcadores */}
      <div className="card p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Marcadores que puedes usar</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {MARCADORES.map(m => (
            <p key={m.clave} className="text-[11px] text-muted">
              <code className="surface-3 px-1 rounded font-mono">{m.clave}</code> {m.descripcion}
            </p>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={simular} disabled={probando} className="btn-secondary flex-1 justify-center">
          {probando ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />} Ver qué haría hoy
        </button>
        <button onClick={guardar} disabled={guardando} className="btn-primary flex-1 justify-center">
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
        </button>
      </div>

      {prueba && (
        <pre className="card p-4 text-[11px] text-muted whitespace-pre-wrap font-mono leading-relaxed">{prueba}</pre>
      )}
    </div>
  );
}

function Estado({ ok, bien, mal }: { ok: boolean; bien: string; mal: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px] leading-snug">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span className={ok ? "text-muted" : "text-amber-700 dark:text-amber-400"}>{ok ? bien : mal}</span>
    </div>
  );
}

function Numero({ label, valor, set, pista }: { label: string; valor: number; set: (v: number) => void; pista: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">{label}</label>
      <input type="number" className="input" value={valor} onChange={e => set(Number(e.target.value))} />
      <p className="text-[10px] text-muted mt-0.5">{pista}</p>
    </div>
  );
}

function Campo({ label, valor, set, filas }: { label: string; valor: string; set: (v: string) => void; filas?: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      {filas ? (
        <textarea className="input resize-none text-xs leading-relaxed" rows={filas} value={valor} onChange={e => set(e.target.value)} />
      ) : (
        <input className="input" value={valor} onChange={e => set(e.target.value)} />
      )}
    </div>
  );
}
