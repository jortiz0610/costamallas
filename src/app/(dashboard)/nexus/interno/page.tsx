"use client";

// ============================================================
// Chat interno del equipo.
//
// Se maneja como WhatsApp: en el teléfono se ve la lista, se toca un
// chat y ocupa la pantalla entera. En escritorio, las dos columnas.
//
// Lo nuevo se pide cada 2 segundos con `?desde=<último>`, así que casi
// siempre la respuesta es una lista vacía. Es lo que hace que escribir
// aquí no se sienta como recargar una página.
// ============================================================

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Send, Search, Plus, ChevronLeft, Loader2, Users, MessagesSquare, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { timeAgoCO } from "@/lib/timezone";
import { useBrand } from "@/contexts/BrandContext";
import { sonarMensaje } from "@/lib/nexus-preferencias";

interface Companero { id: string; nombre: string; email: string; rol: string }
interface ChatItem {
  id: string; tipo: string; nombre: string;
  participantes: { id: string; nombre: string; rol: string }[];
  ultimoMensaje: { contenido: string; createdAt: string; mio: boolean } | null;
  sinLeer: number;
}
interface Mensaje {
  id: string; contenido: string; tipo: string; adjuntoUrl: string | null;
  createdAt: string; autor: { id: string; nombre: string };
}

const NEXUS_COLOR = "#7c3aed";

/** Color estable a partir del nombre, para el avatar. */
function colorDe(nombre: string) {
  const colores = ["#7c3aed", "#185FA5", "#BA7517", "#059669", "#dc2626", "#0891b2"];
  return colores[(nombre?.charCodeAt(0) ?? 0) % colores.length];
}

function Avatar({ nombre, size = 38 }: { nombre: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: colorDe(nombre), fontSize: size * 0.38 }}
    >
      {nombre.charAt(0).toUpperCase()}
    </div>
  );
}

function NuevoChat({ companeros, onAbrir, onClose }: {
  companeros: Companero[];
  onAbrir: (id: string) => void;
  onClose: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const filtro = busqueda.trim().toLowerCase();
  const lista = companeros.filter(c =>
    !filtro || c.nombre.toLowerCase().includes(filtro) || c.rol.toLowerCase().includes(filtro),
  );

  const abrir = async (usuarioId: string) => {
    setAbriendo(usuarioId);
    try {
      const res = await fetch("/api/nexus/interno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo abrir el chat");
      onAbrir(json.data.id);
      onClose();
    } catch { toast.error("Error de conexión"); }
    finally { setAbriendo(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="card w-full sm:max-w-md max-h-[80vh] flex flex-col overflow-hidden rounded-b-none sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="card-header flex-shrink-0">
          <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Hablar con…</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 pt-3 flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="input pl-9 py-2 text-sm" placeholder="Buscar por nombre o rol…" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 mt-1">
          {lista.length === 0 ? (
            <p className="p-6 text-center text-[12.5px] text-gray-400">Nadie coincide con la búsqueda.</p>
          ) : lista.map(c => (
            <button key={c.id} onClick={() => abrir(c.id)} disabled={abriendo !== null}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left disabled:opacity-40">
              <Avatar nombre={c.nombre} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{c.nombre}</p>
                <p className="text-[11px] text-gray-400 truncate">{c.rol}</p>
              </div>
              {abriendo === c.id && <Loader2 size={14} className="animate-spin text-gray-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Conversacion({ chat, miId, onVolver }: { chat: ChatItem; miId: string; onVolver: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const finRef = useRef<HTMLDivElement>(null);
  const vistos = useRef<Set<string>>(new Set());

  // Carga inicial y, a partir de ahí, solo lo nuevo. El servidor devuelve
  // una lista vacía casi siempre, así que preguntar cada 2 s es barato.
  const ultimaFecha = mensajes.length ? mensajes[mensajes.length - 1].createdAt : null;

  const { data } = useQuery<{ data: Mensaje[]; incremental: boolean }>({
    queryKey: ["chat-interno", chat.id, ultimaFecha],
    queryFn: async () => {
      const qs = ultimaFecha ? `?desde=${encodeURIComponent(ultimaFecha)}` : "";
      const res = await fetch(`/api/nexus/interno/${chat.id}${qs}`);
      return res.json();
    },
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const nuevos = (data?.data ?? []).filter(m => !vistos.current.has(m.id));
    if (!nuevos.length) return;
    nuevos.forEach(m => vistos.current.add(m.id));
    setMensajes(prev => (data?.incremental ? [...prev, ...nuevos] : nuevos));
    // Solo suena si lo escribió otro. Que suene lo que uno mismo acaba de
    // mandar es la forma más rápida de que alguien apague el sonido.
    if (nuevos.some(m => m.autor.id !== miId)) {
      sonarMensaje();
      qc.invalidateQueries({ queryKey: ["chats-internos"] });
    }
  }, [data, miId, qc]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  const enviar = async () => {
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    setEnviando(true);
    // Se limpia la caja ANTES de que responda el servidor: si se espera,
    // escribir seguido se siente lento aunque tarde 200 ms.
    setTexto("");
    try {
      const res = await fetch(`/api/nexus/interno/${chat.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setTexto(contenido); // devolver lo escrito, que no se pierda
        return toast.error(json.error ?? "No se pudo enviar");
      }
      if (!vistos.current.has(json.data.id)) {
        vistos.current.add(json.data.id);
        setMensajes(prev => [...prev, json.data]);
      }
      qc.invalidateQueries({ queryKey: ["chats-internos"] });
    } catch {
      setTexto(contenido);
      toast.error("Error de conexión");
    } finally { setEnviando(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b divider surface flex-shrink-0">
        <button onClick={onVolver} aria-label="Volver a los chats"
          className="lg:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-lg text-muted hover:surface-2 flex-shrink-0">
          <ChevronLeft size={18} />
        </button>
        <Avatar nombre={chat.nombre} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{chat.nombre}</p>
          <p className="text-[10.5px] text-muted truncate">
            {chat.tipo === "GRUPO"
              ? `${chat.participantes.length + 1} personas`
              : (chat.participantes[0]?.rol ?? "")}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1.5 page-bg">
        {mensajes.length === 0 && (
          <p className="text-center text-[12px] text-muted py-8">
            Todavía no se han escrito. Empieza tú.
          </p>
        )}
        {mensajes.map((m, i) => {
          const mio = m.autor.id === miId;
          const mismoAutor = i > 0 && mensajes[i - 1].autor.id === m.autor.id;
          return (
            <div key={m.id} className={cn("flex", mio ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-2xl",
                  mio ? "rounded-br-sm text-white" : "rounded-bl-sm surface border divider",
                )}
                style={mio ? { backgroundColor: NEXUS_COLOR } : {}}
              >
                {!mio && chat.tipo === "GRUPO" && !mismoAutor && (
                  <p className="text-[10.5px] font-bold mb-0.5" style={{ color: colorDe(m.autor.nombre) }}>
                    {m.autor.nombre}
                  </p>
                )}
                <p className="text-[13px] whitespace-pre-wrap break-words">{m.contenido}</p>
                <p className={cn("text-[9.5px] mt-0.5", mio ? "text-white/70 text-right" : "text-muted")}>
                  {timeAgoCO(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      <div className="flex items-end gap-2 px-3 py-2.5 border-t divider surface flex-shrink-0">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
          }}
          rows={1}
          className="input resize-none py-2 text-sm max-h-28"
          placeholder="Escribe un mensaje…"
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          aria-label="Enviar"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40"
          style={{ backgroundColor: NEXUS_COLOR }}
        >
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

function InternoContent() {
  const { brand } = useBrand();
  const [activo, setActivo] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const { data, isLoading } = useQuery<{
    chats: ChatItem[]; companeros: Companero[]; sinLeerTotal: number;
  }>({
    queryKey: ["chats-internos"],
    queryFn: async () => (await (await fetch("/api/nexus/interno")).json()).data ?? { chats: [], companeros: [], sinLeerTotal: 0 },
    refetchInterval: 5000,
  });

  const { data: yo } = useQuery<{ id: string }>({
    queryKey: ["auth", "me"],
    queryFn: async () => (await (await fetch("/api/auth/me")).json()).data,
    staleTime: 5 * 60 * 1000,
  });

  const chats = data?.chats ?? [];
  const filtro = busqueda.trim().toLowerCase();
  const lista = useMemo(
    () => chats.filter(c => !filtro || c.nombre.toLowerCase().includes(filtro)),
    [chats, filtro],
  );
  const chatActivo = chats.find(c => c.id === activo) ?? null;

  return (
    <>
      <Topbar
        title="Chat del equipo"
        actions={
          <button onClick={() => setNuevo(true)} className="btn-primary btn-sm">
            <Plus size={13} /> <span className="hidden sm:inline">Nuevo chat</span>
          </button>
        }
      />

      <div className="flex-1 overflow-hidden flex">
        <div
          className={cn(
            "w-full lg:w-80 flex-shrink-0 flex-col surface",
            chatActivo ? "hidden lg:flex" : "flex",
          )}
          style={{ borderRight: "1px solid var(--border)" }}
        >
          <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="input pl-9 py-1.5 text-xs" placeholder="Buscar un chat…" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 size={18} className="animate-spin mx-auto text-muted" /></div>
            ) : lista.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full">
                <MessagesSquare size={28} className="text-muted" />
                <p className="text-[13px] font-medium text-soft">
                  {chats.length === 0 ? "Todavía no tienes chats" : "Ningún chat coincide"}
                </p>
                {chats.length === 0 && (
                  <button onClick={() => setNuevo(true)} className="btn-primary btn-sm">
                    <Users size={13} /> Hablar con alguien
                  </button>
                )}
              </div>
            ) : lista.map(c => (
              <button key={c.id} onClick={() => setActivo(c.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-l-2 hover:surface-2"
                style={c.id === activo
                  ? { backgroundColor: brand.brandColor + "12", borderLeftColor: brand.brandColor }
                  : { borderLeftColor: "transparent" }}>
                <Avatar nombre={c.nombre} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 truncate flex-1">{c.nombre}</p>
                    {c.ultimoMensaje && (
                      <span className="text-[9.5px] text-muted flex-shrink-0">{timeAgoCO(c.ultimoMensaje.createdAt)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted truncate">
                    {c.ultimoMensaje
                      ? `${c.ultimoMensaje.mio ? "Tú: " : ""}${c.ultimoMensaje.contenido}`
                      : "Sin mensajes"}
                  </p>
                </div>
                {c.sinLeer > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: NEXUS_COLOR }}>
                    {c.sinLeer > 9 ? "9+" : c.sinLeer}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("flex-1 overflow-hidden", chatActivo ? "flex" : "hidden lg:flex")}>
          {chatActivo && yo ? (
            <Conversacion chat={chatActivo} miId={yo.id} onVolver={() => setActivo(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 page-bg p-8 text-center">
              <MessagesSquare size={30} className="text-muted" />
              <p className="text-[13px] text-muted">Elige un chat para empezar</p>
            </div>
          )}
        </div>
      </div>

      {nuevo && (
        <NuevoChat
          companeros={data?.companeros ?? []}
          onAbrir={id => setActivo(id)}
          onClose={() => setNuevo(false)}
        />
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><InternoContent /></Suspense>;
}
