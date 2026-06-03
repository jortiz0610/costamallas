"use client";

import { Suspense, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import {
  Zap, MessageSquare, GitBranch, Clock, Tag, UserPlus, Webhook, Bot,
  Plus, Play, Sparkles, ArrowDown, Settings2,
} from "lucide-react";
import Link from "next/link";

const NEXUS_COLOR = "#7c3aed";

const BLOQUES = [
  { id: "trigger",   l: "Disparador",       d: "Inicia el flujo (mensaje, palabra clave)", Icon: Zap,         c: "#16a34a" },
  { id: "mensaje",   l: "Enviar mensaje",   d: "Responde con texto, imagen o botones",     Icon: MessageSquare,c: "#185FA5" },
  { id: "condicion", l: "Condición",        d: "Ramifica según la respuesta del usuario",  Icon: GitBranch,    c: "#d97706" },
  { id: "espera",    l: "Esperar",          d: "Pausa el flujo un tiempo determinado",     Icon: Clock,        c: "#0891b2" },
  { id: "etiqueta",  l: "Etiquetar",        d: "Añade etiquetas al contacto",              Icon: Tag,          c: "#7c3aed" },
  { id: "crm",       l: "Crear/actualizar cliente", d: "Guarda el contacto en el CRM",     Icon: UserPlus,     c: "#BA7517" },
  { id: "ia",        l: "Respuesta IA",     d: "Genera respuesta con inteligencia artificial", Icon: Bot,      c: "#db2777" },
  { id: "webhook",   l: "Webhook",          d: "Conecta con sistemas externos",            Icon: Webhook,      c: "#64748b" },
];

// Flujo de ejemplo (demostración del lienzo)
const FLUJO_DEMO = [
  { tipo: "trigger",   titulo: "Mensaje nuevo recibido", detalle: "Cuando llega un mensaje en cualquier canal", c: "#16a34a", Icon: Zap },
  { tipo: "mensaje",   titulo: "Saludo automático",      detalle: "\"¡Hola {nombre}! Gracias por escribir a Costamallas\"", c: "#185FA5", Icon: MessageSquare },
  { tipo: "condicion", titulo: "¿Pregunta por precios?", detalle: "Detecta palabras: precio, cotización, valor", c: "#d97706", Icon: GitBranch },
  { tipo: "crm",       titulo: "Guardar como prospecto", detalle: "Crea el contacto en el CRM con estado INTERESADO", c: "#BA7517", Icon: UserPlus },
];

function FlujosContent() {
  const [seleccionado] = useState("demo");

  return (
    <>
      <Topbar title="Flujos & Automatización" actions={
        <button disabled className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 opacity-60 cursor-not-allowed" style={{ backgroundColor: NEXUS_COLOR }}>
          <Plus size={13} /> Nuevo flujo
        </button>
      } />
      <div className="flex-1 overflow-hidden flex page-bg">

        {/* Paleta de bloques */}
        <div className="w-72 flex-shrink-0 border-r divider surface flex flex-col">
          <div className="p-4 border-b divider">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Bloques disponibles</p>
            <p className="text-[11px] text-muted mt-1">Arrastra bloques al lienzo para construir tu automatización</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {BLOQUES.map(b => {
              const Icon = b.Icon;
              return (
                <div key={b.id} className="card p-3 flex items-start gap-3 cursor-grab opacity-90 hover:opacity-100 hover:shadow-md transition-all">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: b.c + "18" }}>
                    <Icon size={17} style={{ color: b.c }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{b.l}</p>
                    <p className="text-[10px] text-muted">{b.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lienzo */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Banner en construcción */}
          <div className="sticky top-0 z-10 m-4 card p-4 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${NEXUS_COLOR}15, transparent)` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: NEXUS_COLOR }}>
              <Sparkles size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Constructor de flujos estilo ManyChat</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">En construcción</span>
              </div>
              <p className="text-xs text-muted mt-0.5">El motor de automatización está listo. Solo falta conectar cada canal (WhatsApp, Instagram, etc.) desde <Link href="/configuracion?tab=canales" className="font-semibold underline" style={{ color: NEXUS_COLOR }}>Configuración → Canales</Link> para activar los flujos.</p>
            </div>
          </div>

          {/* Lienzo con flujo de ejemplo */}
          <div className="p-8 flex flex-col items-center"
            style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
            <div className="flex items-center gap-2 mb-6">
              <Play size={14} style={{ color: NEXUS_COLOR }} />
              <span className="text-sm font-bold text-soft">Flujo de ejemplo: Atención automática</span>
            </div>

            {FLUJO_DEMO.map((nodo, i) => {
              const Icon = nodo.Icon;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="card p-4 w-80 glow-brand" style={{ borderTop: `3px solid ${nodo.c}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: nodo.c + "18" }}>
                        <Icon size={18} style={{ color: nodo.c }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{nodo.titulo}</p>
                        <p className="text-[11px] text-muted">{nodo.detalle}</p>
                      </div>
                      <Settings2 size={14} className="text-muted" />
                    </div>
                  </div>
                  {i < FLUJO_DEMO.length - 1 && (
                    <div className="flex flex-col items-center py-1">
                      <div className="w-0.5 h-4" style={{ backgroundColor: "var(--border-strong)" }} />
                      <ArrowDown size={14} className="text-muted -my-1" />
                      <div className="w-0.5 h-4" style={{ backgroundColor: "var(--border-strong)" }} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Botón agregar (deshabilitado) */}
            <div className="flex flex-col items-center py-1">
              <div className="w-0.5 h-4" style={{ backgroundColor: "var(--border-strong)" }} />
              <ArrowDown size={14} className="text-muted -my-1" />
              <div className="w-0.5 h-4" style={{ backgroundColor: "var(--border-strong)" }} />
            </div>
            <button disabled className="w-80 card p-4 border-2 border-dashed divider flex items-center justify-center gap-2 text-muted opacity-70 cursor-not-allowed">
              <Plus size={16} /> <span className="text-sm font-semibold">Agregar bloque</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FlujosPage() {
  return <Suspense><FlujosContent /></Suspense>;
}
