"use client";

// ============================================================
// Credenciales de un canal de Nexus.
//
// Sin esto, "responder" en Nexus no puede salir a ningún lado. La
// pantalla dice explícitamente si el canal está en condiciones de
// enviar, porque antes se podía tener el canal "activo" y verde sin que
// pudiera entregar un solo mensaje.
// ============================================================

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Copy, KeyRound, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export interface ConexionCanal {
  id: string; canal: string; nombre: string; activo: boolean; webhookUrl: string | null;
  config: Record<string, unknown>;
}

/** Qué pide cada canal para poder enviar. */
const CAMPOS: Record<string, { k: string; label: string; ayuda?: string; secreto?: boolean }[]> = {
  whatsapp: [
    { k: "phoneNumberId", label: "Phone Number ID", ayuda: "Meta → WhatsApp → API Setup. Es un número largo, no el teléfono." },
    { k: "token", label: "Token permanente", secreto: true, ayuda: "El token de acceso del usuario del sistema. Se guarda cifrado." },
    { k: "verifyToken", label: "Verify token", ayuda: "Lo inventas tú y lo pegas igual en Meta al registrar el webhook." },
  ],
  instagram: [
    { k: "urlSalida", label: "URL de salida", ayuda: "Endpoint del puente que entrega el mensaje (n8n, Make, propio)." },
    { k: "apiKey", label: "API key del puente", secreto: true },
  ],
  tiktok: [
    { k: "urlSalida", label: "URL de salida" },
    { k: "apiKey", label: "API key del puente", secreto: true },
  ],
};

const GENERICO = [
  { k: "urlSalida", label: "URL de salida", ayuda: "A dónde se hace POST para entregar la respuesta." },
  { k: "apiKey", label: "API key", secreto: true },
];

export function CredencialesCanal({ conexion }: { conexion: ConexionCanal }) {
  const qc = useQueryClient();
  const campos = CAMPOS[conexion.canal] ?? GENERICO;
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.filter(c => !c.secreto).map(c => [c.k, String(conexion.config?.[c.k] ?? "")])),
  );
  const [guardando, setGuardando] = useState(false);

  const tiene = (c: { k: string; secreto?: boolean }) =>
    c.secreto ? Boolean(conexion.config?.[`tiene_${c.k}`]) : Boolean(conexion.config?.[c.k]);

  const listo = campos.every(c => tiene(c) || valores[c.k]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/nexus/conexiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conexion.id, config: valores }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) return toast.error(j.error ?? "No se pudo guardar");
      toast.success("Credenciales guardadas");
      // Los secretos se limpian del formulario: ya están en el servidor.
      setValores(v => Object.fromEntries(
        Object.entries(v).filter(([k]) => !campos.find(c => c.k === k)?.secreto),
      ));
      qc.invalidateQueries({ queryKey: ["nexus-conexiones"] });
    } finally { setGuardando(false); }
  };

  const copiarWebhook = async () => {
    if (!conexion.webhookUrl) return;
    await navigator.clipboard.writeText(conexion.webhookUrl);
    toast.success("URL del webhook copiada");
  };

  return (
    <div className="p-4 surface-2 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <KeyRound size={13} className="text-muted" />
        <p className="text-xs font-bold text-soft flex-1">Credenciales de envío</p>
        {listo ? (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded">
            Puede responder
          </span>
        ) : (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded">
            Solo recibe
          </span>
        )}
      </div>

      {!listo && (
        <p className="text-[11px] text-muted flex items-start gap-1.5">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
          Mientras falten estos datos, los mensajes entran pero las respuestas del asesor no salen.
        </p>
      )}

      {conexion.webhookUrl && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">URL del webhook (entrada)</p>
          <div className="flex gap-2">
            <input className="input py-1 text-[11px] font-mono flex-1" value={conexion.webhookUrl} readOnly />
            <button onClick={copiarWebhook} className="btn-secondary btn-sm"><Copy size={12} /></button>
          </div>
          <p className="text-[11px] text-muted mt-1">Pégala en Meta (o en tu puente) para que los mensajes lleguen aquí.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {campos.map(c => (
          <div key={c.k}>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
              {c.label}
              {c.secreto && tiene(c) && <span className="text-emerald-500 normal-case ml-1">(guardado — vacío = no cambiar)</span>}
            </label>
            <input
              className="input py-1.5 text-xs font-mono"
              type={c.secreto ? "password" : "text"}
              value={valores[c.k] ?? ""}
              onChange={e => setValores(v => ({ ...v, [c.k]: e.target.value }))}
              placeholder={c.secreto ? "••••••••" : ""}
            />
            {c.ayuda && <p className="text-[11px] text-muted mt-0.5">{c.ayuda}</p>}
          </div>
        ))}
      </div>

      <button onClick={guardar} disabled={guardando} className="btn-primary btn-sm w-full justify-center">
        {guardando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar credenciales
      </button>
    </div>
  );
}
