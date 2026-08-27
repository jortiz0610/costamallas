"use client";

// ============================================================
// El agente que atiende en costamallas.com.
//
// Nace APAGADO a propósito. Encenderlo pone a un modelo a hablarle a
// clientes reales a nombre de la empresa: eso lo prende una persona
// después de leer lo que dice, no un valor por defecto.
// ============================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Check, Bot, Copy, ExternalLink, AlertTriangle, MessageCircle, Plus, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

interface Cfg {
  activo: boolean; nombre: string; saludo: string; modelo: string;
  topeDiarioUSD: number; topeConversacionUSD: number; maxMensajes: number;
  whatsapp: string; dominios: string[];
}
interface Estado {
  gastoHoyUSD: number; iaConfigurada: boolean; conversaciones: number; embed: string;
}

export function TabAgenteWeb() {
  const [f, setF] = useState<Cfg | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data, refetch, isLoading, error } = useQuery<{ data: Cfg; estado: Estado }>({
    queryKey: ["cfg-agente-web"],
    queryFn: async () => {
      const res = await fetch("/api/configuracion/agente-web");
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error ?? `El servidor respondió ${res.status}`);
      setF(j.data);
      return j;
    },
  });

  const u = (k: keyof Cfg, v: unknown) => setF(p => (p ? { ...p, [k]: v } as Cfg : p));

  const guardar = async () => {
    if (!f) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion/agente-web", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success(f.activo ? "Agente encendido" : "Cambios guardados");
      refetch();
    } finally { setGuardando(false); }
  };

  if (error) {
    return (
      <div className="card p-6 max-w-2xl" style={{ borderLeft: "4px solid #dc2626" }}>
        <p className="text-sm font-bold text-soft">No se pudo cargar la configuración del agente</p>
        <p className="text-xs text-muted mt-2 break-words">{error instanceof Error ? error.message : ""}</p>
        <button onClick={() => refetch()} className="btn-secondary btn-sm mt-4">Reintentar</button>
      </div>
    );
  }
  if (isLoading || !f || !data) {
    return <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: "var(--brand-color)" }} /></div>;
  }

  const e = data.estado;
  const listo = e.iaConfigurada;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, var(--brand-color-10), transparent)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-color)" }}>
          <Bot size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Agente de la página web</h2>
          <p className="text-xs text-muted mt-0.5">
            Atiende en costamallas.com. Cada conversación entra a Nexus para que un asesor la vea y la conteste.
          </p>
        </div>
        <span
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg"
          style={f.activo
            ? { backgroundColor: "#16a34a22", color: "#16a34a" }
            : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}
        >
          {f.activo ? "Encendido" : "Apagado"}
        </span>
      </div>

      {!listo && (
        <div className="card p-4 flex gap-3" style={{ borderLeft: "4px solid #dc2626" }}>
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="text-xs font-bold text-soft">Falta la API key de Claude</p>
            <p className="text-[11px] text-muted mt-1">
              Sin ella el agente no puede responder. Se carga en Configuración → IA,
              <strong> desde el portal en producción</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Encendido */}
      <div className="card p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox" checked={f.activo} disabled={!listo}
            onChange={ev => u("activo", ev.target.checked)}
            className="mt-0.5 accent-[var(--brand-color)]"
          />
          <span>
            <span className="block text-sm font-bold text-soft">Atender a los clientes en la web</span>
            <span className="block text-[11px] text-muted mt-1 leading-relaxed">
              Mientras esté apagado, el widget no aparece en la tienda aunque el código esté pegado.
              Enciéndalo cuando haya leído el saludo y cargado el WhatsApp de escalamiento.
            </span>
          </span>
        </label>
      </div>

      {/* Cómo se presenta */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Cómo se presenta</p>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre</label>
          <input className="input max-w-xs" value={f.nombre} onChange={ev => u("nombre", ev.target.value)} />
          <p className="text-[11px] text-muted mt-1">Sale en la cabecera del chat. No dice ser una persona: si le preguntan, responde que es el asistente de la página.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Saludo</label>
          <textarea className="input resize-none text-[13px]" rows={4} value={f.saludo} onChange={ev => u("saludo", ev.target.value)} />
          <p className="text-[11px] text-muted mt-1">Lo primero que ve el cliente al abrir el chat. No cuesta nada: se muestra sin llamar a la IA.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">WhatsApp para escalar</label>
          <input className="input max-w-xs" placeholder="573001234567" value={f.whatsapp} onChange={ev => u("whatsapp", ev.target.value)} />
          <p className="text-[11px] text-muted mt-1">
            Con indicativo del país y sin signos. Si está vacío, el chat no muestra el botón de WhatsApp —
            un botón que lleve a un número equivocado es peor que no tenerlo.
          </p>
        </div>
      </div>

      {/* Gasto */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Cuánto puede gastar</p>
          <span className="text-[11px] text-muted">
            Hoy lleva <strong className="text-soft">US$ {e.gastoHoyUSD.toFixed(4)}</strong> · {e.conversaciones} conversación(es) en total
          </span>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">
          Esto no es una comodidad: es lo que impide que una dirección pública que llama a la IA se convierta
          en una factura. Al llegar al tope, el agente deja de responder y le ofrece al cliente dejar sus datos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Tope del día (US$)</label>
            <input type="number" step="0.5" min="0.1" className="input" value={f.topeDiarioUSD} onChange={ev => u("topeDiarioUSD", Number(ev.target.value))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Tope por conversación (US$)</label>
            <input type="number" step="0.05" min="0.01" className="input" value={f.topeConversacionUSD} onChange={ev => u("topeConversacionUSD", Number(ev.target.value))} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Máx. mensajes</label>
            <input type="number" min="4" max="200" className="input" value={f.maxMensajes} onChange={ev => u("maxMensajes", Number(ev.target.value))} />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Modelo</label>
          <select className="input max-w-xs" value={f.modelo} onChange={ev => u("modelo", ev.target.value)}>
            <option value="claude-sonnet-5">Sonnet 5 — mejor respuesta (recomendado)</option>
            <option value="claude-haiku-4-5">Haiku 4.5 — más barato y más rápido</option>
          </select>
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            Aquí del otro lado hay un cliente que no conoce la empresa, así que viene en Sonnet: una respuesta
            floja no es una molestia interna, es una venta que no se hizo. El grueso del costo se ahorra con la
            caché del contexto, no bajando de modelo.
          </p>
        </div>
      </div>

      {/* Dominios */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Desde qué páginas responde</p>
          <button
            onClick={() => u("dominios", [...f.dominios, ""])}
            className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ backgroundColor: "var(--brand-color)" }}
          >
            <Plus size={13} /> Agregar
          </button>
        </div>
        <p className="text-[11px] text-muted mb-3">
          Solo estas direcciones pueden usar el agente. Sin esta lista, cualquier página de internet podría
          usar la IA de Costamallas por su cuenta y con su cuenta.
        </p>
        <div className="space-y-2">
          {f.dominios.map((d, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="input flex-1 font-mono text-xs" value={d} placeholder="https://costamallas.com"
                onChange={ev => u("dominios", f.dominios.map((x, n) => (n === i ? ev.target.value : x)))}
              />
              <button onClick={() => u("dominios", f.dominios.filter((_, n) => n !== i))} className="text-muted hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!f.dominios.length && <p className="text-xs text-muted p-4 surface-2 rounded-xl text-center">Sin dominios: el agente no va a responder a nadie.</p>}
        </div>
      </div>

      {/* Instalación en WordPress */}
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Cómo se pone en la tienda</p>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">
          Pegue esta línea en WordPress, antes de <code>&lt;/body&gt;</code> (Apariencia → Editor de temas, o el
          bloque de código personalizado del tema). Es lo único que hay que tocar allá: el saludo, el modelo y
          los topes se cambian desde aquí sin volver a WordPress.
          <br />
          <strong>Ojo:</strong> quite antes el chat viejo, o van a aparecer dos burbujas.
        </p>
        <div className="flex gap-2 items-start">
          <code className="flex-1 text-[11px] font-mono p-3 rounded-xl surface-2 break-all">{e.embed}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(e.embed); toast.success("Copiado"); }}
            className="btn-secondary btn-sm flex-shrink-0"
          >
            <Copy size={13} /> Copiar
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <a href="/nexus" className="btn-secondary btn-sm flex items-center gap-1.5">
            <MessageCircle size={12} /> Ver las conversaciones
          </a>
          <a href="/nexus/tiempos" className="btn-secondary btn-sm flex items-center gap-1.5">
            <ExternalLink size={12} /> Tiempo de respuesta
          </a>
        </div>
      </div>

      <button onClick={guardar} disabled={guardando} className="btn-primary w-full justify-center">
        {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
      </button>
    </div>
  );
}
