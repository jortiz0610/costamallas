"use client";

// ============================================================
// "Mandar esto a un chat" — desde cualquier pantalla del portal.
//
// Nace para las imágenes del catálogo: el vendedor encuentra la foto,
// y hasta ahora tenía que copiar la URL, irse a Nexus, buscar la
// conversación y pegarla. Sirve igual para un texto: la ficha de un
// producto, un enlace de cotización.
//
// Manda por el MISMO camino que el inbox (`POST /api/nexus/mensajes`),
// así que se entrega de verdad por el canal y queda en el historial. Si
// el canal no está conectado —hoy WhatsApp no lo está— el mensaje se
// guarda con el error real y esta ventana lo dice. No se hace el que
// salió.
// ============================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { X, Loader2, Send, MessageSquare, Search } from "lucide-react";

interface Conversacion {
  id: string;
  canal: string;
  remitente: string;
  telRemit: string | null;
  emailRemit: string | null;
  estado: string;
  cliente?: { id: string; nombre: string; empresa: string | null } | null;
  conexion?: { nombre: string; canal: string } | null;
}

interface Props {
  /** Lo que se va a mandar: una URL de imagen o un texto. */
  contenido: string;
  /** `imagen` pinta la miniatura en el chat; `texto` es texto plano. */
  tipo?: "texto" | "imagen";
  titulo?: string;
  onClose: () => void;
}

const ETIQUETA_CANAL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  WEB: "Web",
  EMAIL: "Correo",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
};

export function EnviarANexus({ contenido, tipo = "texto", titulo = "Enviar a un chat", onClose }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);

  const { data: conversaciones = [], isLoading } = useQuery<Conversacion[]>({
    queryKey: ["nexus-conversaciones-envio"],
    queryFn: async () => {
      const res = await fetch("/api/nexus/conversaciones?estado=ABIERTA");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const filtro = busqueda.trim().toLowerCase();
  const lista = conversaciones.filter(c => {
    if (!filtro) return true;
    return [c.remitente, c.telRemit, c.emailRemit, c.cliente?.nombre, c.cliente?.empresa]
      .some(v => v?.toLowerCase().includes(filtro));
  });

  const enviar = async (conversacionId: string) => {
    setEnviando(conversacionId);
    try {
      const res = await fetch("/api/nexus/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId, contenido, tipo }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo enviar");
        return;
      }
      // El endpoint guarda el mensaje incluso si el canal lo rechazó, y
      // devuelve el motivo. Decirlo es lo único honesto.
      if (json.data?.errorEnvio || json.envio?.ok === false) {
        toast(
          `Quedó guardado en el chat, pero el canal no lo entregó: ${json.data?.errorEnvio ?? json.envio?.error ?? "motivo desconocido"}`,
          { icon: "⚠️", duration: 9000 },
        );
      } else {
        toast.success("Enviado al chat");
      }
      onClose();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="card-header flex-shrink-0">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare size={15} className="text-gray-400" /> {titulo}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3 flex-shrink-0">
          {tipo === "imagen" ? (
            <img src={contenido} alt="" className="w-full max-h-32 object-contain rounded-lg bg-gray-50 dark:bg-slate-800" />
          ) : (
            <pre className="text-[11px] whitespace-pre-wrap bg-gray-50 dark:bg-slate-800 rounded-lg p-2.5 max-h-28 overflow-y-auto text-gray-600 dark:text-slate-300">
              {contenido}
            </pre>
          )}
          <div className="relative mt-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="input pl-9 py-1.5 text-xs"
              placeholder="Buscar el chat por nombre, teléfono o correo…"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 mt-2">
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 size={18} className="animate-spin mx-auto text-gray-400" /></div>
          ) : lista.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={24} className="mx-auto mb-2 text-gray-300" />
              <p className="text-[12.5px] text-gray-500 dark:text-slate-400">
                {conversaciones.length === 0
                  ? "No hay conversaciones abiertas todavía."
                  : "Ningún chat coincide con la búsqueda."}
              </p>
              {conversaciones.length === 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Aparecerán aquí en cuanto entre un mensaje por la web o por WhatsApp.
                </p>
              )}
            </div>
          ) : lista.map(c => (
            <button
              key={c.id}
              onClick={() => enviar(c.id)}
              disabled={enviando !== null}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left disabled:opacity-40"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {c.cliente?.nombre || c.remitente || c.telRemit || c.emailRemit || "Sin nombre"}
                </p>
                <p className="text-[10.5px] text-gray-400 truncate">
                  {ETIQUETA_CANAL[c.canal] ?? c.canal}
                  {c.cliente?.empresa ? ` · ${c.cliente.empresa}` : ""}
                  {c.telRemit ? ` · ${c.telRemit}` : ""}
                </p>
              </div>
              {enviando === c.id
                ? <Loader2 size={14} className="animate-spin text-gray-400 flex-shrink-0" />
                : <Send size={14} className="text-gray-300 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
