"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  MessageSquare, Settings2, Search, Send, RefreshCw,
  Globe, Smartphone, Instagram, CheckCheck,
  X, Mail, MessageSquareText,
  Inbox, PlugZap, Facebook,
} from "lucide-react";
import Link from "next/link";
import { useBrand } from "@/contexts/BrandContext";
import { timeAgoCO } from "@/lib/timezone";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

// ── Tipos ────────────────────────────────────────────────────────

interface NexusConexion {
  id: string; canal: string; nombre: string; descripcion?: string;
  activo: boolean; webhookUrl?: string; config: Record<string, string>;
}

interface NexusMensaje {
  id: string; origen: "contacto" | "agente"; contenido: string;
  tipo: string; createdAt: string; agente?: { nombre: string } | null;
}

interface Conversacion {
  id: string; canal: string; remitente: string; emailRemit?: string;
  telRemit?: string; asunto?: string; estado: string; prioridad: string;
  leida: boolean; createdAt: string; updatedAt: string;
  conexion: { nombre: string; canal: string };
  mensajes: NexusMensaje[];
  _count: { mensajes: number };
}

// ── Helpers de canal ─────────────────────────────────────────────

const CANAL_META: Record<string, { label: string; color: string; bgColor: string; Icon: React.ElementType }> = {
  wordpress_form: { label: "WordPress",    color: "#21759b", bgColor: "#e8f4fb", Icon: Globe },
  whatsapp:       { label: "WhatsApp",     color: "#25d366", bgColor: "#e8fdf0", Icon: Smartphone },
  instagram:      { label: "Instagram",    color: "#e1306c", bgColor: "#fce8f0", Icon: Instagram },
  facebook:       { label: "Facebook",     color: "#1877f2", bgColor: "#e8f0fe", Icon: Facebook },
  tiktok:         { label: "TikTok",       color: "#000000", bgColor: "#f0f0f0", Icon: MessageSquare },
  email:          { label: "Email",        color: "#6366f1", bgColor: "#eef0ff", Icon: Mail },
};

function CanalBadge({ canal, size = "sm" }: { canal: string; size?: "sm" | "md" }) {
  const meta = CANAL_META[canal] ?? { label: canal, color: "#6b7280", bgColor: "#f3f4f6", Icon: MessageSquare };
  const Icon = meta.Icon;
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full ${px}`}
      style={{ backgroundColor: meta.bgColor, color: meta.color }}>
      <Icon size={size === "sm" ? 10 : 12} />
      {meta.label}
    </span>
  );
}

function PrioridadDot({ prioridad }: { prioridad: string }) {
  const colors: Record<string, string> = { URGENTE: "#dc2626", ALTA: "#d97706", NORMAL: "#6b7280", BAJA: "#9ca3af" };
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[prioridad] ?? "#9ca3af" }} />;
}

// ── Panel de conversaciones (izq) ────────────────────────────────

function ConversacionItem({ conv, activa, onClick }: { conv: Conversacion; activa: boolean; onClick: () => void }) {
  const { brand } = useBrand();
  const ultimo = conv.mensajes[0];
  const meta = CANAL_META[conv.canal];
  return (
    <div onClick={onClick}
      className={cn("flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b",
        activa ? "border-l-2" : "border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40",
        "border-b-slate-50 dark:border-b-slate-800/50")}
      style={activa ? { borderLeftColor: brand.brandColor, backgroundColor: brand.brandColor + "08" } : {}}>
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
        style={{ backgroundColor: meta?.color ?? "#6366f1" }}>
        {conv.remitente.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-xs font-semibold truncate", conv.leida ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-slate-100")}>
            {conv.remitente}
          </p>
          <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgoCO(conv.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <PrioridadDot prioridad={conv.prioridad} />
          <p className="text-[11px] text-slate-400 truncate flex-1">{conv.asunto ?? ultimo?.contenido ?? "…"}</p>
          {!conv.leida && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: brand.brandColor }} />}
        </div>
        <div className="mt-1">
          <CanalBadge canal={conv.canal} />
        </div>
      </div>
    </div>
  );
}

// ── Vista de mensajes (der) ──────────────────────────────────────

function ChatView({ conv, onMarcarResuelta }: { conv: Conversacion; onMarcarResuelta: () => void }) {
  const { brand } = useBrand();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: mensajes = [], isLoading } = useQuery<NexusMensaje[]>({
    queryKey: ["nexus-mensajes", conv.id],
    queryFn: async () => (await (await fetch(`/api/nexus/mensajes?conversacionId=${conv.id}`)).json()).data ?? [],
    refetchInterval: 10_000,
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes.length]);

  const sendMutation = useMutation({
    mutationFn: async (contenido: string) => {
      const res = await fetch("/api/nexus/mensajes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId: conv.id, contenido }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => { setTexto(""); qc.invalidateQueries({ queryKey: ["nexus-mensajes", conv.id] }); qc.invalidateQueries({ queryKey: ["nexus-conversaciones"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = () => { if (texto.trim()) sendMutation.mutate(texto.trim()); };

  const meta = CANAL_META[conv.canal];
  const Icon = meta?.Icon ?? MessageSquare;

  return (
    <div className="flex flex-col h-full">
      {/* Header del chat */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: meta?.color ?? "#6366f1" }}>
          {conv.remitente.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{conv.remitente}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <CanalBadge canal={conv.canal} />
            {conv.emailRemit && <span className="text-[10px] text-slate-400">{conv.emailRemit}</span>}
            {conv.telRemit && <span className="text-[10px] text-slate-400">{conv.telRemit}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conv.estado === "ABIERTA" && (
            <button onClick={onMarcarResuelta}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ backgroundColor: "#16a34a" }}>
              <CheckCheck size={12} className="inline mr-1" /> Resolver
            </button>
          )}
          <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold",
            conv.estado === "ABIERTA" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
            {conv.estado}
          </span>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Cargando mensajes…</div>
        ) : mensajes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <MessageSquare size={28} />
            <p className="text-sm">Sin mensajes aún</p>
          </div>
        ) : (
          mensajes.map(m => (
            <div key={m.id} className={cn("flex", m.origen === "agente" ? "justify-end" : "justify-start")}>
              {m.origen === "contacto" && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold mr-2 mt-0.5 flex-shrink-0"
                  style={{ backgroundColor: meta?.color ?? "#6366f1" }}>
                  {conv.remitente.charAt(0)}
                </div>
              )}
              <div className={cn("max-w-xs lg:max-w-md")}>
                <div className={cn("px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                  m.origen === "agente"
                    ? "text-white rounded-br-sm"
                    : "text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 rounded-bl-sm border border-slate-100 dark:border-slate-700"
                )}
                  style={m.origen === "agente" ? { backgroundColor: brand.brandColor } : {}}>
                  {m.contenido}
                </div>
                <div className={cn("mt-0.5 text-[10px] text-slate-400", m.origen === "agente" ? "text-right" : "text-left")}>
                  {timeAgoCO(m.createdAt)}
                  {m.origen === "agente" && m.agente && ` · ${m.agente.nombre}`}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input de respuesta */}
      {conv.estado === "ABIERTA" ? (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="input flex-1 py-2 text-sm"
            placeholder="Escribe una respuesta… (Enter para enviar)"
          />
          <button onClick={handleSend} disabled={!texto.trim() || sendMutation.isPending}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: brand.brandColor }}>
            <Send size={16} />
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 bg-white dark:bg-slate-900">
          Conversación resuelta · Solo lectura
        </div>
      )}
    </div>
  );
}

// ── Página principal Nexus ───────────────────────────────────────

const ESTADOS_CONV = [
  { v: "ABIERTA",   l: "Abiertas",  c: "#16a34a", Icon: Inbox },
  { v: "RESUELTA",  l: "Resueltas", c: "#185FA5", Icon: CheckCheck },
  { v: "ARCHIVADA", l: "Archivadas",c: "#64748b", Icon: X },
];

function NexusContent() {
  const { brand } = useBrand();
  const qc = useQueryClient();
  const [convActiva, setConvActiva] = useState<Conversacion | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("ABIERTA");
  const [filtroCanal, setFiltroCanal] = useState("");

  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ["nexus-conversaciones", filtroEstado, filtroCanal],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroCanal) params.set("canal", filtroCanal);
      return (await (await fetch(`/api/nexus/conversaciones?${params}`)).json());
    },
    refetchInterval: 15_000,
  });

  const conversaciones: Conversacion[] = result?.data ?? [];
  const noLeidas: number = result?.noLeidas ?? 0;

  const filtradas = conversaciones.filter(c =>
    !busqueda || c.remitente.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.asunto ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const marcarResuelta = async () => {
    if (!convActiva) return;
    await fetch("/api/nexus/conversaciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: convActiva.id, estado: "RESUELTA" }) });
    toast.success("Conversación resuelta");
    qc.invalidateQueries({ queryKey: ["nexus-conversaciones"] });
    setConvActiva(null);
  };

  const CANALES = Object.entries(CANAL_META);

  return (
    <>
      <Topbar title="Nexus · Inbox" actions={
        <div className="flex items-center gap-2">
          {noLeidas > 0 && (
            <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: brand.brandColor }}>
              {noLeidas} sin leer
            </span>
          )}
          <Link href="/nexus/plantillas" className="btn-secondary btn-sm">
            <MessageSquareText size={13} /> Plantillas
          </Link>
          <Link href="/configuracion?tab=canales" className="btn-secondary btn-sm">
            <Settings2 size={13} /> Conexiones
          </Link>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      } />

      <div className="flex-1 overflow-hidden flex">
        {/* Panel izq: lista de conversaciones */}
        <div className="w-80 flex-shrink-0 flex flex-col surface" style={{ borderRight: "1px solid var(--border)" }}>
          {/* Búsqueda + filtros */}
          <div className="px-3 py-3 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="input pl-9 py-1.5 text-xs" placeholder="Buscar conversación…" />
            </div>

            {/* Filtro estado — segmentado amigable (#9) */}
            <div className="flex gap-1 p-1 rounded-xl surface-2">
              {ESTADOS_CONV.map(e => {
                const Icon = e.Icon; const active = filtroEstado === e.v;
                return (
                  <button key={e.v} onClick={() => setFiltroEstado(e.v)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                    style={active ? { backgroundColor: e.c, color: "white", boxShadow: `0 2px 6px ${e.c}40` } : { color: "var(--text-muted)" }}>
                    <Icon size={12} /> {e.l}
                  </button>
                );
              })}
            </div>

            {/* Filtro canal */}
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              <button onClick={() => setFiltroCanal("")}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                style={!filtroCanal ? { backgroundColor: brand.brandColor, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                Todos
              </button>
              {CANALES.map(([key, meta]) => {
                const Icon = meta.Icon;
                return (
                  <button key={key} onClick={() => setFiltroCanal(filtroCanal === key ? "" : key)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                    style={filtroCanal === key ? { backgroundColor: meta.color, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                    <Icon size={10} /> {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-muted">Cargando inbox…</div>
            ) : filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <Inbox size={28} className="text-muted" />
                <p className="text-sm font-medium text-soft">Bandeja vacía</p>
                <p className="text-xs text-muted">Los mensajes de tus canales conectados aparecerán aquí</p>
              </div>
            ) : (
              filtradas.map(c => (
                <ConversacionItem key={c.id} conv={c} activa={convActiva?.id === c.id}
                  onClick={() => setConvActiva(c)} />
              ))
            )}
          </div>
        </div>

        {/* Centro: chat */}
        <div className="flex-1 flex overflow-hidden">
          {convActiva ? (
            <ChatView conv={convActiva} onMarcarResuelta={marcarResuelta} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 page-bg">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: brand.brandColor + "18" }}>
                <MessageSquare size={28} style={{ color: brand.brandColor }} />
              </div>
              <div>
                <p className="text-base font-semibold text-soft">Selecciona una conversación</p>
                <p className="text-sm text-muted mt-1">O conecta un canal para empezar a recibir mensajes</p>
              </div>
              <Link href="/configuracion?tab=canales"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: brand.brandColor }}>
                <PlugZap size={15} /> Conectar canal
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function NexusPage() {
  return <Suspense><NexusContent /></Suspense>;
}
