"use client";
import {
  Bell, Sun, Moon, Zap, Package, ImageIcon, Archive, UserPlus, ClipboardList,
  CheckSquare, Wrench, MessageSquareText, Settings, Inbox, Truck, FileInput,
  Megaphone, Target, Menu, RefreshCw,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { NotificationsPanel } from "./NotificationsPanel";
import { ReportarError } from "./ReportarError";
import { useBrand } from "@/contexts/BrandContext";
import { cn } from "@/lib/utils";
import { BuscadorGlobal } from "./BuscadorGlobal";

const ERP_COLOR = "#185FA5";
const CRM_COLOR = "#BA7517";
const NEXUS_COLOR = "#7c3aed";

type QuickTask = { label: string; href: string; Icon: React.ElementType };
const QUICK_TASKS: Record<string, QuickTask[]> = {
  ERP: [
    { label: "Nuevo producto", href: "/productos/nuevo", Icon: Package },
    { label: "Subir imágenes", href: "/imagenes", Icon: ImageIcon },
    { label: "Ver stock crítico", href: "/stock", Icon: Archive },
    { label: "Nuevo proveedor", href: "/compras", Icon: Truck },
    { label: "Importar de WooCommerce", href: "/importar", Icon: FileInput },
  ],
  CRM: [
    { label: "Nuevo cliente", href: "/crm/clientes/nuevo", Icon: UserPlus },
    { label: "Nueva cotización", href: "/crm/cotizaciones/nueva", Icon: ClipboardList },
    { label: "Agendar instalación", href: "/crm/instalaciones", Icon: Wrench },
    { label: "Ver pipeline", href: "/crm/pipeline", Icon: ClipboardList },
  ],
  NEXUS: [
    { label: "Ir al inbox", href: "/nexus", Icon: Inbox },
    { label: "Nueva plantilla", href: "/nexus/plantillas", Icon: MessageSquareText },
    { label: "Flujos y automatización", href: "/nexus/flujos", Icon: Zap },
    { label: "Conexiones de canales", href: "/configuracion?tab=canales", Icon: Settings },
  ],
  MARKETING: [
    { label: "Ver dashboard", href: "/marketing", Icon: Inbox },
    { label: "Nueva campaña", href: "/marketing/campanas", Icon: Megaphone },
    { label: "Atribución de leads", href: "/marketing/atribucion", Icon: Target },
    { label: "Conectar Ads", href: "/configuracion?tab=marketing", Icon: Settings },
  ],
};

function QuickTaskButton({ mode, color }: { mode: string; color: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tasks = QUICK_TASKS[mode] ?? QUICK_TASKS.ERP;
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
        style={{ backgroundColor: color }}>
        <Zap size={14} /> <span className="hidden md:inline">Tarea rápida</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 card overflow-hidden z-50 animate-fade-up">
          <div className="px-4 py-2.5 border-b divider">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Acciones rápidas · {mode}</p>
          </div>
          <div className="p-1.5">
            {tasks.map(t => {
              const Icon = t.Icon;
              return (
                <Link key={t.href + t.label} href={t.href} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:surface-2 transition-colors">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <span className="text-sm font-medium text-soft">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Botón de recargar.
 *
 * No hace `location.reload()`: eso descarta la página y vuelve a bajar todo
 * el bundle. En vez de eso invalida la caché de React Query (todos los
 * `useQuery` se vuelven a pedir al servidor) y refresca los componentes de
 * servidor con `router.refresh()`. Resultado: datos frescos, sin parpadeo
 * y sin perder la posición del scroll ni lo que haya escrito en un formulario.
 */
function BotonRecargar({ color }: { color: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [girando, setGirando] = useState(false);

  const recargar = async () => {
    if (girando) return;
    setGirando(true);

    // Si el service worker tiene páginas cacheadas, que las suelte también.
    navigator.serviceWorker?.controller?.postMessage({ tipo: "LIMPIAR_CACHE" });

    router.refresh();
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      // Mínimo de giro visible, para que se note que algo pasó.
      setTimeout(() => setGirando(false), 400);
    }
  };

  return (
    <button
      onClick={recargar}
      disabled={girando}
      className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 disabled:opacity-60"
      title="Actualizar la información de esta pantalla"
      aria-label="Actualizar información"
    >
      <RefreshCw size={15} className={cn(girando && "animate-spin")} style={girando ? { color } : undefined} />
    </button>
  );
}

interface TopbarProps { title: string; actions?: React.ReactNode; }

/**
 * La campana de notificaciones.
 *
 * Es un componente propio porque en el teléfono y en el escritorio se
 * pinta en sitios distintos de la barra. Compartir un `ref` y un estado
 * entre las dos copias hacía que el panel no se cerrara al tocar fuera:
 * el `ref` se quedaba apuntando a la copia oculta.
 */
function Campana({ color }: { color: string }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const { noLeidas } = useNotificaciones();

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  return (
    <div className="relative" ref={caja}>
      <button onClick={() => setAbierto(v => !v)}
        className={cn("relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors border border-gray-200 dark:border-slate-700",
          abierto ? "bg-gray-100 dark:bg-slate-800" : "hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400")}>
        <Bell size={15} />
        {noLeidas > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
      </button>
      {abierto && <NotificationsPanel onClose={() => setAbierto(false)} />}
    </div>
  );
}

export function Topbar({ title, actions }: TopbarProps) {
  const { darkMode, toggleDark, mode, setSidebarOpen } = useBrand();
  const modeColor = mode === "ERP" ? ERP_COLOR : mode === "NEXUS" ? NEXUS_COLOR : mode === "MARKETING" ? "#db2777" : CRM_COLOR;


  return (
    // ── Dos filas en el teléfono, una sola desde 640 px ──
    //
    // Antes todo iba en la misma línea de 56 px: menú, título, los
    // botones de la pantalla, el buscador, recargar y la campana. En un
    // teléfono de 375 px eso no cabe — el título se truncaba a tres
    // letras y los botones de la pantalla quedaban apretujados contra el
    // borde. Es lo que se sentía como "se sale todo".
    //
    // Ahora las acciones propias de cada pantalla bajan a su propia fila
    // en móvil, con el ancho entero para ellas. En escritorio no cambia
    // nada: sigue siendo una sola línea.
    <header className="flex flex-col sm:flex-row sm:items-center sm:h-14 flex-shrink-0 topbar-bg z-10 relative">
      <div className="h-14 flex items-center gap-3 px-4 sm:px-5 sm:flex-1 sm:min-w-0">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800" title="Menú">
          <Menu size={18} />
        </button>
        <div className="w-1 h-5 rounded-full flex-shrink-0 hidden sm:block" style={{ backgroundColor: modeColor }} />
        <h1 className="text-[14px] sm:text-[15px] font-semibold text-gray-800 dark:text-gray-100 flex-1 truncate">{title}</h1>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white hidden sm:inline-flex items-center" style={{ backgroundColor: modeColor }}>{mode}</span>
        {/* En móvil los iconos de la derecha se quedan arriba, con el
            título. Abajo van solo las acciones de la pantalla. */}
        <div className="flex items-center gap-2 sm:hidden">
          <BuscadorGlobal />
          <BotonRecargar color={modeColor} />
          <Campana color={modeColor} />
        </div>
      </div>

      {/* La fila de acciones. `overflow-x-auto` y no `flex-wrap`: si una
          pantalla trae cuatro botones, deslizarlos de lado es mejor que
          empujar el contenido hacia abajo en cada carga. */}
      {actions && (
        <div className="flex sm:hidden items-center gap-2 px-4 pb-2.5 overflow-x-auto [&>*]:flex-shrink-0">
          {actions}
        </div>
      )}

      {/* ── Todo lo de la derecha, solo en escritorio ──
          En el teléfono el buscador, recargar y la campana ya salieron
          arriba junto al título, y las tareas rápidas, el reporte de
          error y el modo oscuro están a un toque en el menú. Apretujar
          nueve botones en 375 px deja el título en tres letras. */}
      <div className="hidden sm:flex items-center gap-3 px-5">
        {actions && <div className="flex items-center gap-2 min-w-0">{actions}</div>}
        <QuickTaskButton mode={mode} color={modeColor} />
        {/* El buscador va antes que todo lo demás: es lo que más se usa. */}
        <BuscadorGlobal />
        <BotonRecargar color={modeColor} />
        <ReportarError />
        <button onClick={toggleDark}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700"
          title={darkMode ? "Modo claro" : "Modo oscuro"}>
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <Campana color={modeColor} />
      </div>
    </header>
  );
}
