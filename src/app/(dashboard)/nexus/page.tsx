"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  MessageSquare, Settings2, Search, Send, RefreshCw,
  Globe, Smartphone, Instagram, CheckCheck,
  X, Mail, MessageSquareText,
  Inbox, PlugZap, Facebook, Sparkles, Loader2, StickyNote, ChevronLeft,
  Archive, UserPlus, Trash2, Check,
} from "lucide-react";
import Link from "next/link";
import { useBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/hooks/useAuth";
import { esAdmin } from "@/lib/permisos";
import { timeAgoCO } from "@/lib/timezone";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { CostoIA } from "@/components/ia/CostoIA";
import { BotonFiltros } from "@/components/nexus/FiltrosInbox";
import { Adjuntar, type Adjunto } from "@/components/nexus/Adjuntar";
import { ContenidoMensaje } from "@/components/nexus/ContenidoMensaje";
import { MenuComandos } from "@/components/nexus/MenuComandos";
import { leerEntrada, sugerir, sinMencion, MENCION_IA, type Comando } from "@/lib/nexus/comandos";
import { PanelContexto } from "@/components/nexus/PanelContexto";
import {
  leerPrefs, guardarPrefs, sonarMensaje, temaDe, normalizarCanal,
  type PrefsNexus, PREFS_POR_DEFECTO,
} from "@/lib/nexus-preferencias";

// ── Tipos ────────────────────────────────────────────────────────

interface NexusConexion {
  id: string; canal: string; nombre: string; descripcion?: string;
  activo: boolean; webhookUrl?: string; config: Record<string, string>;
}

interface NexusMensaje {
  id: string; origen: "contacto" | "agente" | "nota"; contenido: string;
  tipo: string; createdAt: string; agente?: { nombre: string } | null;
  /** RECIBIDO · ENVIADO · ERROR · NOTA. Sin esto, un mensaje que no salió
   *  se veía igual que uno entregado. */
  estadoEnvio?: string; errorEnvio?: string | null;
}

interface Conversacion {
  id: string; canal: string; remitente: string; emailRemit?: string;
  telRemit?: string; asunto?: string; estado: string; prioridad: string;
  asignadoId?: string | null;
  leida: boolean; createdAt: string; updatedAt: string;
  conexion: { nombre: string; canal: string };
  mensajes: NexusMensaje[];
  _count: { mensajes: number };
  /** Lo que dedujo el bot: producto, ciudad, urgencia, intención. */
  etiquetas?: string[];
  /** Si el que escribe ya está en el CRM. */
  cliente?: { id: string; nombre: string; empresa?: string | null } | null;
  asignado?: { nombre: string } | null;
  primeraRespuestaEn?: string | null;
}
interface UsuarioLista { id: string; nombre: string; rol: string; }

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

function ConversacionItem({ conv, activa, onClick, nombreAsignado, prefs, marcado, onMarcar }: {
  conv: Conversacion; activa: boolean; onClick: () => void; nombreAsignado?: string;
  prefs: PrefsNexus;
  /** Marcado para borrar. `onMarcar` ausente = quien mira no puede borrar. */
  marcado?: boolean;
  onMarcar?: () => void;
}) {
  const { brand } = useBrand();
  const ultimo = conv.mensajes[0];
  // El color y el nombre del canal salen de lo que configuró ESTA
  // persona, no de una tabla fija: es lo que le permite distinguir de un
  // vistazo un WhatsApp de un correo sin leer la etiqueta.
  const canal = normalizarCanal(conv.canal);
  const color = prefs.colores[canal] ?? "#6b7280";
  const etiqueta = prefs.etiquetas[canal] ?? canal;
  return (
    <div onClick={onClick}
      className={cn("flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b",
        activa ? "border-l-2" : "border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900/40",
        "border-b-slate-50 dark:border-b-slate-800/50")}
      style={activa ? { borderLeftColor: brand.brandColor, backgroundColor: brand.brandColor + "08" } : {}}>
      {/* La casilla ocupa el sitio del avatar y solo aparece al pasar el
          cursor o cuando ya hay algo marcado: una bandeja llena de
          casillas se lee peor, y borrar no es lo que se hace aquí a
          diario. */}
      {onMarcar ? (
        <button
          onClick={e => { e.stopPropagation(); onMarcar(); }}
          aria-label={marcado ? "Quitar la marca" : "Marcar para borrar"}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white transition-colors group/marca"
          style={marcado ? { backgroundColor: "#dc2626" } : { backgroundColor: color }}
        >
          {marcado
            ? <Check size={16} />
            : <span className="group-hover/marca:hidden">{conv.remitente.charAt(0).toUpperCase()}</span>}
          {!marcado && <Check size={16} className="hidden group-hover/marca:block" />}
        </button>
      ) : (
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
          style={{ backgroundColor: color }}>
          {conv.remitente.charAt(0).toUpperCase()}
        </div>
      )}
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

        {/* Lo que el bot dedujo del primer mensaje. Es la diferencia entre
            abrir una conversación a ciegas y saber de qué se trata antes. */}
        {conv.etiquetas && conv.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {conv.etiquetas.slice(0, 3).map((e, i) => {
              const urgente = e === "urgencia:alta";
              return (
                <span key={i}
                  className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded", urgente ? "text-white" : "surface-3 text-muted")}
                  style={urgente ? { backgroundColor: "#dc2626" } : {}}>
                  {urgente ? "URGENTE" : e}
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: color + "1f", color }}>
            {etiqueta}
          </span>
          {conv.cliente && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600">
              Ya es cliente
            </span>
          )}
          {nombreAsignado && (
            <span className="text-[9px] text-slate-400 truncate">· {nombreAsignado.split(" ")[0]}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vista de mensajes (der) ──────────────────────────────────────

function ChatView({ conv, onMarcarResuelta, onVolver, prefs }: {
  conv: Conversacion; onMarcarResuelta: () => void; onVolver: () => void; prefs: PrefsNexus;
}) {
  const tema = temaDe(prefs);
  const { brand } = useBrand();
  const { user, puedeVer } = useAuth();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [sugiriendo, setSugiriendo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const admin = esAdmin(user?.rol);
  const puedeIA = puedeVer("nexus.ia");
  const puedeTransferir = admin || conv.asignadoId === user?.id;
  const { data: usuarios = [] } = useQuery<UsuarioLista[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await (await fetch("/api/usuarios/lista")).json()).data ?? [],
    enabled: puedeTransferir,
  });
  const asignado = usuarios.find(u => u.id === conv.asignadoId);

  const transferir = async (asignadoId: string) => {
    const res = await fetch("/api/nexus/conversaciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: conv.id, asignadoId }) });
    const json = await res.json();
    if (json.success) { toast.success("Conversación transferida"); qc.invalidateQueries({ queryKey: ["nexus-conversaciones"] }); }
    else toast.error(json.error ?? "Error");
  };

  const sugerirIA = async (instruccion?: string) => {
    setSugiriendo(true);
    try {
      const res = await fetch("/api/ai/nexus-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId: conv.id, instruccion }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.sinClave ? "Configura la IA en Configuración → IA" : (json.error ?? "Error"), { duration: 7000 });
        return;
      }
      setTexto(json.data.respuesta);
      if (json.data.transferir) toast("Mallita sugiere pasarlo con una persona", { icon: "🤝" });
      // El cupo se avisa cuando queda poco, no en cada uso: un aviso que
      // sale siempre deja de leerse.
      const cupo = json.data.cupo;
      if (cupo && cupo.quedan <= 3) {
        toast(`Te quedan ${cupo.quedan} ayudas de IA hoy.`, { icon: "⏳", duration: 6000 });
      }
    } catch { toast.error("Error al sugerir"); } finally { setSugiriendo(false); }
  };

  const { data: mensajes = [], isLoading } = useQuery<NexusMensaje[]>({
    queryKey: ["nexus-mensajes", conv.id],
    queryFn: async () => (await (await fetch(`/api/nexus/mensajes?conversacionId=${conv.id}`)).json()).data ?? [],
    // Cada 3 s, no cada 10: un cliente esperando por WhatsApp nota la
    // diferencia entre contestar al momento y contestar diez segundos
    // tarde. Solo corre con la pestaña delante.
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });

  // Sonido cuando entra algo que no escribimos nosotros. La primera
  // carga NO suena: abrir una conversación con veinte mensajes viejos y
  // que pite es la forma más rápida de que alguien apague el sonido.
  const vistosRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!mensajes.length) return;
    if (vistosRef.current === null) {
      vistosRef.current = new Set(mensajes.map(m => m.id));
      return;
    }
    const nuevos = mensajes.filter(m => !vistosRef.current!.has(m.id));
    nuevos.forEach(m => vistosRef.current!.add(m.id));
    if (nuevos.some(m => m.origen === "contacto")) sonarMensaje();
  }, [mensajes]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes.length]);

  const sendMutation = useMutation({
    mutationFn: async ({ contenido, soloNota }: { contenido: string; soloNota?: boolean }) => {
      const res = await fetch("/api/nexus/mensajes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversacionId: conv.id, contenido, soloNota }),
      });
      const json = await res.json();
      // El servidor guarda el mensaje aunque el envío falle: se refresca
      // igual para que el asesor vea el error marcado en su burbuja.
      if (!json.success) {
        qc.invalidateQueries({ queryKey: ["nexus-mensajes", conv.id] });
        throw new Error(json.error ?? "No se pudo enviar");
      }
      return json.data;
    },
    onSuccess: () => {
      setTexto("");
      qc.invalidateQueries({ queryKey: ["nexus-mensajes", conv.id] });
      qc.invalidateQueries({ queryKey: ["nexus-conversaciones"] });
    },
    onError: (e: Error) => toast.error(e.message, { duration: 6000 }),
  });

  // ── Comandos y menciones ──
  const entrada = leerEntrada(texto);
  const [menuAbierto, setMenuAbierto] = useState(true);
  const comandosVisibles = entrada.esComando && menuAbierto && !entrada.argumento
    ? sugerir(entrada.nombre, true)
    : [];

  // Al cambiar lo escrito, el menú vuelve a estar disponible: cerrarlo
  // con Escape no debe dejarlo cerrado para siempre.
  useEffect(() => { setMenuAbierto(true); }, [entrada.esComando, entrada.nombre]);

  const [guardandoCliente, setGuardandoCliente] = useState(false);

  /** Guardar a quien escribe como cliente del CRM, sin salir del chat. */
  const guardarComoCliente = async () => {
    if (conv.cliente) { toast("Ya está en el CRM", { icon: "✅" }); return; }
    setGuardandoCliente(true);
    try {
      const res = await fetch(`/api/nexus/conversaciones/${conv.id}/cliente`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo guardar");
      toast.success(`${json.data.nombre} quedó en el CRM`);
      qc.invalidateQueries({ queryKey: ["nexus-conversaciones"] });
      qc.invalidateQueries({ queryKey: ["crm-clientes"] });
    } catch { toast.error("Error de conexión"); }
    finally { setGuardandoCliente(false); }
  };

  /** Lo que hace cada comando al elegirlo. */
  const ejecutar = (c: Comando) => {
    setMenuAbierto(false);
    if (c.nombre === "ia") { setTexto(`${MENCION_IA} `); return; }
    if (c.nombre === "cliente") { setTexto(""); void guardarComoCliente(); return; }
    // Los que llevan argumento dejan la barra escrita esperando el dato.
    setTexto(`/${c.nombre} `);
  };

  const handleSend = () => {
    const crudo = texto.trim();
    if (!crudo) return;

    // Un comando NO se manda al cliente. Es una orden para el portal, y
    // mandarle "/cliente" a alguien por WhatsApp es de las cosas que uno
    // no puede deshacer.
    const e = leerEntrada(crudo);
    if (e.esComando) {
      const c = sugerir(e.nombre, true).find(x => x.nombre === e.nombre);
      if (!c) return toast.error(`No existe el comando /${e.nombre}`);
      ejecutar(c);
      return;
    }

    // @mallita redacta en vez de enviar: la IA propone y la persona
    // decide. Que un modelo escriba directo al cliente no está sobre la
    // mesa.
    if (e.llamaALaIA) { void sugerirIA(sinMencion(crudo)); return; }

    sendMutation.mutate({ contenido: crudo });
  };

  /** Adjuntar: se manda como un mensaje aparte, con su URL. */
  const mandarAdjunto = (a: Adjunto) => {
    sendMutation.mutate({ contenido: a.url });
  };
  const handleNota = () => { if (texto.trim()) sendMutation.mutate({ contenido: texto.trim(), soloNota: true }); };

  const meta = CANAL_META[conv.canal];
  const Icon = meta?.Icon ?? MessageSquare;

  return (
    // Tres columnas en escritorio: lista · chat · con quién hablo.
    // La tercera solo desde 1280 px; por debajo, el chat se queda con
    // todo el ancho, que es lo correcto en un portátil.
    <div className="flex h-full w-full min-w-0">
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* Header del chat */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
        {/* Volver a la lista. Solo en móvil: en escritorio la lista nunca
            se fue de la pantalla. */}
        <button
          onClick={onVolver}
          className="lg:hidden w-8 h-8 -ml-1 flex items-center justify-center rounded-lg text-muted hover:surface-2 transition-colors flex-shrink-0"
          aria-label="Volver a la bandeja"
        >
          <ChevronLeft size={18} />
        </button>
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
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {puedeTransferir && (
            <select value={conv.asignadoId ?? ""} onChange={e => transferir(e.target.value)}
              title="Asignar / transferir a"
              className="input py-1 text-xs w-36 hidden sm:block">
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          )}
          {!puedeTransferir && asignado && <span className="text-[10px] text-muted hidden sm:inline">Asignado: {asignado.nombre}</span>}
          {/* Ya no hay botón de "resolver": todos son chats, y lo único
              que los diferencia es el canal. Archivar sigue existiendo
              —una bandeja que solo crece no se puede atender— pero es una
              acción secundaria, no el botón más grande de la cabecera. */}
          {conv.estado === "ABIERTA" && (
            <button onClick={onMarcarResuelta}
              title="Archivar: sale de la bandeja y se puede volver a abrir desde el filtro"
              aria-label="Archivar la conversación"
              className="w-9 h-9 rounded-lg flex items-center justify-center border divider text-muted hover:surface-2 transition-colors flex-shrink-0">
              <Archive size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Lectura del bot y vínculo con el CRM. Sale siempre: cuando NO
          hay cliente es justo cuando hace falta el botón de guardarlo. */}
      <div className="px-3 sm:px-5 py-2.5 flex items-center gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          <Sparkles size={12} className="text-muted flex-shrink-0" />
          {conv.cliente ? (
            <Link href={`/crm/clientes/${conv.cliente.id}`}
              className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 hover:underline">
              {conv.cliente.empresa || conv.cliente.nombre} · ver en CRM
            </Link>
          ) : (
            /* Guardarlo desde aquí. Antes había que copiar el teléfono,
               abrir Clientes, pegar y volver: seis pasos con alguien
               esperando al otro lado, así que no se hacía. */
            <button onClick={guardarComoCliente} disabled={guardandoCliente}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-color-10)", color: "var(--brand-color)" }}>
              {guardandoCliente ? <Loader2 size={10} className="animate-spin" /> : <UserPlus size={10} />}
              Guardar en el CRM
            </button>
          )}
          {(conv.etiquetas ?? []).map((e, i) => {
            const urgente = e === "urgencia:alta";
            return (
              <span key={i}
                className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", urgente ? "text-white" : "surface-3 text-muted")}
                style={urgente ? { backgroundColor: "#dc2626" } : {}}>
                {urgente ? "URGENTE" : e}
              </span>
            );
          })}
          {conv.primeraRespuestaEn && (
            <span className="text-[10px] text-emerald-600 ml-auto">Respondida</span>
          )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3" style={{ backgroundColor: tema.fondo }}>
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
                  style={{ backgroundColor: prefs.colores[normalizarCanal(conv.canal)] ?? "#6366f1" }}>
                  {conv.remitente.charAt(0)}
                </div>
              )}
              <div className="max-w-[80%] sm:max-w-[75%] lg:max-w-[68%] xl:max-w-[58%]">
                {/* Los colores salen del tema que eligió esta persona. */}
                <div className={cn("px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                  m.origen === "agente" ? "text-white rounded-br-sm" : "rounded-bl-sm border divider"
                )}
                  style={
                    m.origen === "nota"
                      ? { backgroundColor: "#fef3c7", color: "#78350f" }
                      : m.origen === "agente"
                        ? { backgroundColor: tema.mia }
                        : { backgroundColor: tema.suya, color: tema.textoSuya }
                  }>
                  {m.origen === "nota" && <span className="block text-[9px] font-bold uppercase tracking-wider mb-0.5 opacity-70">Nota interna</span>}
                  {/* Fotos, audios, archivos y enlaces se pintan como lo
                      que son, no como una ristra de 120 caracteres. */}
                  <ContenidoMensaje contenido={m.contenido} tipo={m.tipo} claro={m.origen === "agente"} />
                </div>
                <div className={cn("mt-0.5 text-[10px] text-slate-400", m.origen === "agente" ? "text-right" : "text-left")}>
                  {timeAgoCO(m.createdAt)}
                  {m.origen === "agente" && m.agente && ` · ${m.agente.nombre}`}
                  {/* Un mensaje que no salió tiene que verse distinto: antes
                      quedaba idéntico a uno entregado y el asesor daba por
                      hecho que el cliente lo había recibido. */}
                  {m.estadoEnvio === "ENVIADO" && <span className="text-emerald-500"> · entregado</span>}
                  {m.estadoEnvio === "ERROR" && <span className="text-red-500 font-semibold"> · NO SE ENVIÓ</span>}
                </div>
                {m.estadoEnvio === "ERROR" && m.errorEnvio && (
                  <p className="mt-1 text-[10px] text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-2 py-1 max-w-xs">
                    {m.errorEnvio}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input de respuesta */}
      {conv.estado === "ABIERTA" ? (
        <div className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          {comandosVisibles.length > 0 && (
            <MenuComandos
              comandos={comandosVisibles}
              onElegir={ejecutar}
              onCerrar={() => setMenuAbierto(false)}
            />
          )}

          <Adjuntar onAdjunto={mandarAdjunto} deshabilitado={sendMutation.isPending} />

          {/* El asistente cuesta dinero cada vez que se usa, así que va
              detrás de `nexus.ia`: el administrador lo activa persona por
              persona desde Usuarios y Roles. También responde a @mallita
              escrito en el mensaje. */}
          {puedeIA && (
            <div className="relative flex-shrink-0 hidden sm:block">
              <button onClick={() => sugerirIA()} disabled={sugiriendo} title="Que Mallita redacte la respuesta (o escribe @mallita)"
                className="w-10 h-10 rounded-xl flex items-center justify-center border divider text-muted hover:surface-2 transition-all disabled:opacity-50">
                {sugiriendo ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} style={{ color: brand.brandColor }} />}
              </button>
              <span className="absolute -top-2 left-1/2 -translate-x-1/2">
                <CostoIA tarea="nexus" />
              </span>
            </div>
          )}
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => {
              // Con el menú de comandos abierto, Enter lo elige él: si no,
              // el primer Enter mandaría "/plan" como mensaje.
              if (comandosVisibles.length > 0) return;
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            className="input flex-1 min-w-0 py-2 text-sm"
            placeholder={puedeIA ? "Escribe, / para atajos, @mallita para ayuda…" : "Escribe una respuesta… (/ para atajos)"}
          />
          {/* Nota interna: queda en el hilo para quien retome la
              conversación, pero NO se le manda al cliente. */}
          <button onClick={handleNota} disabled={!texto.trim() || sendMutation.isPending} title="Guardar como nota interna (no se envía al cliente)"
            className="w-10 h-10 rounded-xl flex items-center justify-center border divider text-muted hover:surface-2 transition-all disabled:opacity-50 flex-shrink-0">
            <StickyNote size={16} />
          </button>
          <button onClick={handleSend} disabled={!texto.trim() || sendMutation.isPending}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 flex-shrink-0"
            style={{ backgroundColor: brand.brandColor }}>
            {sendMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 bg-white dark:bg-slate-900">
          Conversación archivada · solo lectura
        </div>
      )}
    </div>

    {/* Lo que hay que saber ANTES de contestar: quién es, si ya compró,
        qué le cotizamos. Antes eso obligaba a abrir el CRM en otra
        pestaña y perder el hilo. */}
    <PanelContexto
      conv={conv}
      onGuardarCliente={guardarComoCliente}
      guardando={guardandoCliente}
    />
    </div>
  );
}

// ── Página principal Nexus ───────────────────────────────────────

const ESTADOS_CONV = [
  { v: "ABIERTA",   l: "Abiertas",  c: "#16a34a", Icon: Inbox },
  { v: "RESUELTA",  l: "Resueltas", c: "#185FA5", Icon: CheckCheck },
  { v: "ARCHIVADA", l: "Archivadas",c: "#64748b", Icon: X },
];

function AsignarLineas({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: conexiones = [] } = useQuery<{ id: string; nombre: string; canal: string; asignadoId?: string | null }[]>({
    queryKey: ["nexus-conexiones-lineas"],
    queryFn: async () => (await (await fetch("/api/nexus/conexiones")).json()).data ?? [],
  });
  const { data: usuarios = [] } = useQuery<UsuarioLista[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await (await fetch("/api/usuarios/lista")).json()).data ?? [],
  });
  const asignar = async (id: string, asignadoId: string) => {
    await fetch("/api/nexus/conexiones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, asignadoId }) });
    toast.success("Línea asignada");
    qc.invalidateQueries({ queryKey: ["nexus-conexiones-lineas"] });
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-lg my-4 animate-fade-up" onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Settings2 size={16} /> Asignar líneas a usuarios</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted">Cada línea/canal se atiende por el usuario asignado. Las conversaciones nuevas de esa línea le llegan automáticamente.</p>
          {conexiones.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No hay líneas conectadas. Conéctalas en Configuración → Canales.</p>
          ) : conexiones.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl p-3 surface-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-soft truncate">{c.nombre}</p>
                <p className="text-[10px] text-muted">{c.canal}</p>
              </div>
              <select value={c.asignadoId ?? ""} onChange={e => asignar(c.id, e.target.value)} className="input py-1.5 text-xs w-40">
                <option value="">Sin asignar</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="p-5 pt-0"><button onClick={onClose} className="btn-secondary w-full justify-center">Cerrar</button></div>
      </div>
    </div>
  );
}

function NexusContent() {
  const { brand } = useBrand();
  const { user, puedeVer } = useAuth();
  const qc = useQueryClient();
  const [convActiva, setConvActiva] = useState<Conversacion | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("ABIERTA");
  const [filtroCanal, setFiltroCanal] = useState("");
  const [showLineas, setShowLineas] = useState(false);

  // Los gustos de esta persona: colores, etiquetas y sonido. Se leen del
  // navegador después de montar, no durante: en el servidor no hay
  // localStorage y leerlo ahí rompería el render.
  const [prefs, setPrefs] = useState<PrefsNexus>(PREFS_POR_DEFECTO);
  useEffect(() => { setPrefs(leerPrefs()); }, []);
  const guardar = (p: PrefsNexus) => { guardarPrefs(p); setPrefs(p); };

  const { data: result, isLoading, refetch } = useQuery({
    queryKey: ["nexus-conversaciones", filtroEstado, filtroCanal],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroCanal) params.set("canal", filtroCanal);
      return (await (await fetch(`/api/nexus/conversaciones?${params}`)).json());
    },
    // Cada 5 s, no cada 15: una conversación de WhatsApp que tarda un
    // cuarto de minuto en aparecer se siente rota. La consulta es
    // barata y solo corre con la pestaña delante.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  // Para mostrar de quién es cada conversación sin pedirle al servidor
  // una relación que el modelo no tiene.
  const { data: usuariosBandeja = [] } = useQuery<UsuarioLista[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await (await fetch("/api/usuarios/lista")).json()).data ?? [],
    staleTime: 300_000,
  });

  const conversaciones: Conversacion[] = result?.data ?? [];
  const noLeidas: number = result?.noLeidas ?? 0;

  // La búsqueda incluye las etiquetas del bot: escribir "santa marta" o
  // "balcones" encuentra la conversación aunque el cliente no lo haya
  // escrito con esas palabras exactas.
  const filtradas = conversaciones.filter(c => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return c.remitente.toLowerCase().includes(q)
      || (c.asunto ?? "").toLowerCase().includes(q)
      || (c.etiquetas ?? []).some(e => e.toLowerCase().includes(q))
      || (c.cliente?.empresa ?? "").toLowerCase().includes(q);
  });

  const marcarResuelta = async () => {
    if (!convActiva) return;
    await fetch("/api/nexus/conversaciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: convActiva.id, estado: "RESUELTA" }) });
    toast.success("Conversación resuelta");
    qc.invalidateQueries({ queryKey: ["nexus-conversaciones"] });
    setConvActiva(null);
  };

  const CANALES = Object.entries(CANAL_META);

  // ── Borrar chats ──
  // La bandeja se llena sola: el chat de la web abre una conversación por
  // cada visita, y la mayoría no pasa de "¿hacen mallas para gatos?".
  // Archivarlas de una en una no lo hace nadie, así que la bandeja deja
  // de servir para lo que sirve.
  const puedeBorrar = puedeVer("nexus.borrar");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [borrando, setBorrando] = useState(false);

  const alternarMarca = (id: string) =>
    setMarcados(m => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const borrar = async (cuerpo: Record<string, unknown>, aviso: string) => {
    if (!confirm(aviso)) return;
    setBorrando(true);
    try {
      const res = await fetch("/api/nexus/conversaciones/borrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.error ?? "No se pudo borrar"); return; }
      toast.success(`${json.data.borradas} chat(s) borrados.`);
      setMarcados(new Set());
      setConvActiva(null);
      refetch();
    } catch { toast.error("Error de conexión"); }
    finally { setBorrando(false); }
  };

  return (
    <>
      <Topbar title="Nexus · Inbox" actions={
        <div className="flex items-center gap-2">
          {noLeidas > 0 && (
            <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: brand.brandColor }}>
              {noLeidas} sin leer
            </span>
          )}
          {/* En el teléfono solo queda lo que se usa contestando. Lo de
              configurar se hace sentado. */}
          <Link href="/nexus/plantillas" className="btn-secondary btn-sm hidden sm:inline-flex">
            <MessageSquareText size={13} /> Plantillas
          </Link>
          {esAdmin(user?.rol) && (
            <button onClick={() => setShowLineas(true)} className="btn-secondary btn-sm hidden sm:inline-flex">
              <Settings2 size={13} /> Líneas
            </button>
          )}
          <Link href="/configuracion?tab=canales" className="btn-secondary btn-sm hidden sm:inline-flex">
            <Settings2 size={13} /> Conexiones
          </Link>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      } />

      <div className="flex-1 overflow-hidden flex">
        {/* Panel izq: lista de conversaciones.
            En móvil ocupa TODO el ancho y desaparece al abrir un chat.
            En escritorio son las dos columnas de siempre. */}
        <div
          className={cn(
            "w-full lg:w-80 flex-shrink-0 flex-col surface",
            convActiva ? "hidden lg:flex" : "flex",
          )}
          style={{ borderRight: "1px solid var(--border)" }}
        >
          {/* Buscador y UN botón de filtrar.
              Antes había aquí tres botones de estado y una fila de chips
              de canal: media pantalla del teléfono gastada en controles
              que se tocan una vez al día, justo encima de la lista, que
              es lo que se mira todo el rato. Ahora los filtros están
              detrás del botón —con un contador de cuántos hay puestos— y
              lo que diferencia una conversación de otra en la lista es su
              etiqueta de color. */}
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative flex-1 min-w-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="input pl-9 py-1.5 text-xs" placeholder="Buscar…" />
            </div>
            <BotonFiltros
              filtros={{ estado: filtroEstado, canal: filtroCanal }}
              onCambiar={f => { setFiltroEstado(f.estado); setFiltroCanal(f.canal); }}
              prefs={prefs}
              onPrefs={guardar}
            />
          </div>

          {/* Con chats marcados, la cabecera de la lista cambia. */}
          {puedeBorrar && marcados.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
              style={{ backgroundColor: "#fee2e2", borderBottom: "1px solid var(--border)" }}>
              <span className="text-[11.5px] font-semibold text-red-700 flex-1">
                {marcados.size} marcado{marcados.size === 1 ? "" : "s"}
              </span>
              <button onClick={() => setMarcados(new Set())}
                className="text-[11px] font-semibold text-red-700 hover:underline">
                Quitar
              </button>
              <button
                onClick={() => borrar(
                  { ids: [...marcados] },
                  `Se borran ${marcados.size} chat(s) con todos sus mensajes. No se puede deshacer. ¿Sigo?`,
                )}
                disabled={borrando}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-red-600 disabled:opacity-50">
                {borrando ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Borrar
              </button>
            </div>
          )}

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
                  nombreAsignado={usuariosBandeja.find(u => u.id === c.asignadoId)?.nombre}
                  prefs={prefs}
                  onClick={() => setConvActiva(c)}
                  marcado={marcados.has(c.id)}
                  onMarcar={puedeBorrar ? () => alternarMarca(c.id) : undefined} />
              ))
            )}
          </div>

          {/* Vaciar lo que nunca llegó a nada. Al pie y en letra pequeña:
              se usa de vez en cuando, no todos los días. */}
          {puedeBorrar && filtradas.length > 0 && (
            <button
              onClick={() => borrar(
                { sinCliente: true },
                "Se borran TODOS los chats que nunca llegaron a cliente y que nadie contestó.\n\n" +
                "Los que tienen ficha en el CRM y los que ya se respondieron se quedan.\n\nNo se puede deshacer. ¿Sigo?",
              )}
              disabled={borrando}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] text-muted hover:text-red-600 transition-colors flex-shrink-0 disabled:opacity-50"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <Trash2 size={11} />
              Borrar los chats que no llegaron a cliente
            </button>
          )}
        </div>

        {/* Centro: chat */}
        <div className={cn("flex-1 min-w-0 overflow-hidden", convActiva ? "flex" : "hidden lg:flex")}>
          {convActiva ? (
            <ChatView conv={convActiva} onMarcarResuelta={marcarResuelta} onVolver={() => setConvActiva(null)} prefs={prefs} />
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
      {showLineas && <AsignarLineas onClose={() => setShowLineas(false)} />}
    </>
  );
}

export default function NexusPage() {
  return <Suspense><NexusContent /></Suspense>;
}
