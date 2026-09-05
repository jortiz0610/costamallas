"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ImageIcon, Tag, Archive, Factory, FileOutput, FileInput,
  AlertTriangle, Settings, LogOut, Users, UserCircle, ClipboardList,
  ShoppingCart, Wrench, Kanban, ChevronDown, ShieldCheck, BarChart2,
  MessageSquare, Truck, CheckSquare, MessageSquareText, Zap,
  Megaphone, Target, TrendingUp, Radio, Receipt, PieChart, Star, Timer,
  Sparkles, HardHat, PanelLeftClose, PanelLeftOpen, MessagesSquare, Activity, FlaskConical,
  Ruler,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/contexts/BrandContext";
import { useEffect, useState } from "react";
import { modulosVisibles } from "@/lib/permisos";

const ERP_COLOR   = "#185FA5";
const CRM_COLOR   = "#BA7517";
const NEXUS_COLOR = "#7c3aed";
const MKT_COLOR   = "#db2777";

const MARKETING_ITEMS = [
  { href: "/marketing", label: "Dashboard", icon: LayoutDashboard, perm: "mkt.dashboard" },
  { section: "Análisis" },
  { href: "/marketing/campanas", label: "Campañas", icon: Megaphone, perm: "mkt.campanas" },
  { href: "/marketing/atribucion", label: "Atribución de leads", icon: Target, perm: "mkt.atribucion" },
  { href: "/marketing/retorno", label: "Retorno real", icon: TrendingUp, perm: "mkt.retorno" },
  { href: "/marketing/reportes", label: "Reportes", icon: TrendingUp, perm: "mkt.reportes" },
  { section: "Conecta tus cuentas" },
  { href: "/configuracion?tab=marketing", label: "Conexiones de Ads", icon: Radio, perm: "mkt.conexiones" },
];

// Cada entrada declara su PERMISO. Quién lo tiene se decide en
// lib/permisos.ts (juego por defecto del rol) y en la tabla
// permisos_usuario (excepciones de cada persona). Ya no hay banderas
// "soloAdmin" sueltas aquí: el criterio vivía en dos sitios y se
// desincronizaba.
const ERP_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, perm: "erp.dashboard" },
  { section: "Catálogo" },
  { href: "/productos", label: "Productos", icon: Package, perm: "erp.productos" },
  { href: "/productos/seo", label: "SEO con IA", icon: Sparkles, perm: "erp.seo" },
  { href: "/imagenes", label: "Imágenes", icon: ImageIcon, perm: "erp.imagenes" },
  { href: "/categorias", label: "Catálogos", icon: Tag, perm: "erp.catalogos" },
  { section: "Operaciones" },
  // La orden de producción. Va en Operaciones y no en Catálogo: es lo
  // que se HACE, no lo que se vende.
  { href: "/produccion", label: "Orden de producción", icon: Factory, perm: "erp.ordenes_produccion" },
  { href: "/stock", label: "Stock", icon: Archive, alertKey: "stock", perm: "erp.stock" },
  { href: "/compras", label: "Compras", icon: Truck, perm: "erp.compras" },
  { href: "/facturacion", label: "Facturación", icon: Receipt, perm: "erp.facturacion" },
  { href: "/facturacion/cartera", label: "Cartera", icon: PieChart, perm: "erp.cartera" },
  { href: "/woocommerce", label: "Sincronización WC", icon: FileInput, perm: "erp.woocommerce" },
  // Antes había además un "Errores" (validación) que era una pantalla vacía.
  // Se dejó un único módulo: el reporte de errores que sí reportan los usuarios.
  { href: "/sistema/reportes", label: "Reporte de errores", icon: AlertTriangle, alertKey: "errores", perm: "erp.errores" },
];

const CRM_ITEMS = [
  { href: "/crm", label: "Resumen", icon: LayoutDashboard, perm: "crm.resumen" },
  { href: "/crm/embudo", label: "Embudo", icon: Target, perm: "crm.embudo" },
  { section: "Gestión" },
  { href: "/crm/clientes", label: "Clientes", icon: UserCircle, perm: "crm.clientes" },
  { href: "/crm/cotizaciones", label: "Cotizaciones", icon: ClipboardList, perm: "crm.cotizaciones" },
  { href: "/crm/pedidos", label: "Pedidos", icon: ShoppingCart, perm: "crm.pedidos" },
  { section: "Producción" },
  { href: "/crm/pipeline", label: "Pipeline", icon: Kanban, perm: "crm.pipeline" },
  // Va ANTES de instalaciones porque ese es el orden real: se mide, se
  // cotiza, se vende y entonces se instala.
  { href: "/crm/visitas", label: "Visitas técnicas", icon: Ruler, perm: "crm.instalaciones" },
  { href: "/crm/instalaciones", label: "Instalaciones", icon: Wrench, perm: "crm.instalaciones" },
  { href: "/crm/trabajos", label: "Trabajos", icon: HardHat, alertKey: "trabajos", perm: "crm.trabajos" },
  { section: "Postventa" },
  { href: "/postventa", label: "Encuesta y políticas", icon: Star, perm: "crm.postventa" },
];

const NEXUS_ITEMS = [
  { href: "/nexus", label: "Inbox", icon: MessageSquare, alertKey: "nexus", perm: "nexus.inbox" },
  { href: "/nexus/interno", label: "Chat del equipo", icon: MessagesSquare, alertKey: "interno", perm: "nexus.interno" },
  { href: "/nexus/plantillas", label: "Plantillas", icon: MessageSquareText, perm: "nexus.plantillas" },
  { href: "/nexus/flujos", label: "Flujos & Automatización", icon: Zap, perm: "nexus.flujos" },
  { href: "/nexus/tiempos", label: "Tiempo de respuesta", icon: Timer, perm: "nexus.tiempos" },
  { section: "Configura tus canales" },
  { href: "/configuracion?tab=canales", label: "Conexiones", icon: Settings, perm: "nexus.conexiones" },
];

const SYSTEM_ITEMS = [
  // Primero: es lo que hay que mirar cuando algo "no funciona".
  { href: "/sistema/salud", label: "Estado del sistema", icon: Activity, perm: "sistema.salud" },
  { href: "/sistema/ensayo", label: "Ensayo general", icon: FlaskConical, perm: "sistema.ensayo" },
  { href: "/usuarios", label: "Usuarios y Roles", icon: Users, perm: "sistema.usuarios" },
  { href: "/reportes", label: "Reportes y logs", icon: BarChart2, perm: "sistema.reportes" },
  { href: "/sistema/seguridad", label: "Seguridad", icon: ShieldCheck, perm: "sistema.seguridad" },
  // Sin `perm`: la ve todo el mundo, pero cada quien ve dentro lo suyo.
  // Ver "Configuración" y que te rebote es peor que no verla; y no verla
  // dejaba a un asesor sin poder activar sus avisos ni instalar la app.
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

// Rutas de todo el menu, para resolver cual se ilumina.
const RUTAS_MENU = [...MARKETING_ITEMS, ...ERP_ITEMS, ...CRM_ITEMS, ...NEXUS_ITEMS, ...SYSTEM_ITEMS]
  .map(i => (i as { href?: string }).href?.split("?")[0])
  .filter((h): h is string => Boolean(h));

/**
 * Cual enlace del menu corresponde a la URL actual.
 *
 * Con `startsWith` a secas, estando en la cartera se encendian
 * "Facturacion" y "Cartera" a la vez. Gana la coincidencia mas larga, asi
 * que agregar una subruta al menu no vuelve ambiguo al padre.
 */
function rutaActiva(pathname: string): string | null {
  let mejor: string | null = null;
  for (const ruta of RUTAS_MENU) {
    const coincide = ruta === "/" ? pathname === "/" : pathname === ruta || pathname.startsWith(ruta + "/");
    if (coincide && (!mejor || ruta.length > mejor.length)) mejor = ruta;
  }
  return mejor;
}
type Mode = "ERP" | "CRM" | "NEXUS" | "MARKETING";

interface SidebarProps {
  stockCriticos?: number;
  erroresPendientes?: number;
  crmPendientes?: number;
  nexusSinLeer?: number;
  /** Visitas técnicas y documentos SG-SST esperando al coordinador. */
  trabajosPendientes?: number;
  /** Mensajes sin leer del chat del equipo. */
  internoSinLeer?: number;
}

export function Sidebar({
  stockCriticos = 0,
  erroresPendientes = 0,
  crmPendientes = 0,
  nexusSinLeer = 0,
  trabajosPendientes = 0,
  internoSinLeer = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, permisos } = useAuth();
  const { brand, mode, setMode, setSidebarOpen } = useBrand();
  const [sysOpen, setSysOpen] = useState(false);
  // Plegado del menú en escritorio. Se recuerda entre visitas: quien lo
  // pliega es porque necesita el ancho, y volvérselo a abrir en cada
  // carga es una pelea diaria contra la aplicación.
  const [plegado, setPlegado] = useState(false);
  useEffect(() => {
    setPlegado(localStorage.getItem("cm_menu_plegado") === "1");
  }, []);
  const alternarPlegado = () => {
    setPlegado(v => {
      localStorage.setItem("cm_menu_plegado", v ? "0" : "1");
      return !v;
    });
  };
  const closeMobile = () => setSidebarOpen(false);

  const modeColor =
    mode === "ERP" ? ERP_COLOR : mode === "CRM" ? CRM_COLOR : mode === "MARKETING" ? MKT_COLOR : NEXUS_COLOR;

  const badges: Record<string, number> = {
    stock: stockCriticos,
    errores: erroresPendientes,
    nexus: nexusSinLeer,
    trabajos: trabajosPendientes,
    interno: internoSinLeer,
  };

  const navItems =
    mode === "ERP" ? ERP_ITEMS : mode === "CRM" ? CRM_ITEMS : mode === "MARKETING" ? MARKETING_ITEMS : NEXUS_ITEMS;

  const activa = rutaActiva(pathname);

  function NavItem({ item }: { item: (typeof ERP_ITEMS)[number] }) {
    if ("section" in item) {
      if (plegado) {
        return <div className="mx-4 my-2 border-t" style={{ borderColor: modeColor + "30" }} />;
      }
      return (
        <p className="px-4 pt-4 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: modeColor + "80" }}>
          {item.section}
        </p>
      );
    }
    // Ocultar el enlace es SOLO presentación: la ruta y su API validan
    // el permiso por su cuenta con exigirPermiso().
    const requiere = (item as { perm?: string }).perm;
    if (requiere && !permisos.has(requiere)) return null;

    const Icon = item.icon!;
    const href = (item as { href: string }).href;
    const base = href.split("?")[0];
    const isActive = base === "/crm" ? pathname === base : base === activa;
    const alertKey = (item as { alertKey?: string }).alertKey;
    const badgeCount = alertKey ? (badges[alertKey] ?? 0) : 0;

    return (
      <Link
        href={href}
        onClick={closeMobile}
        title={plegado ? item.label : undefined}
        className={cn(
          "flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-[12.5px] transition-all group relative",
          plegado && "justify-center px-0",
        )}
        style={isActive ? { backgroundColor: modeColor + "18", color: modeColor } : {}}
      >
        <Icon size={14} className={!isActive ? "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" : ""} />
        {!plegado && (
          <span className={cn("flex-1 font-medium", !isActive && "text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200")}>
            {item.label}
          </span>
        )}
        {isActive && !plegado && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: modeColor }} />}
        {badgeCount > 0 && (
          <span
            className={cn(
              "text-[9px] font-bold bg-red-500 text-white rounded-full",
              plegado ? "absolute top-0.5 right-1 w-3.5 h-3.5 flex items-center justify-center" : "px-1.5 py-0.5",
            )}
          >
            {plegado && badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </Link>
    );
  }

  const MODES = ([
    { key: "ERP",       label: "ERP",    color: ERP_COLOR },
    { key: "CRM",       label: "CRM",    color: CRM_COLOR,   badge: crmPendientes },
    { key: "NEXUS",     label: "Nexus",  color: NEXUS_COLOR, badge: nexusSinLeer },
    { key: "MARKETING", label: "Growth", color: MKT_COLOR },
  ] as { key: Mode; label: string; color: string; badge?: number }[])
    .filter(m => modulosVisibles(permisos).includes(m.key));

  const verSistema = modulosVisibles(permisos).includes("SISTEMA");

  /**
   * Qué cabe en esta sección para esta persona.
   *
   * Antes la sección entera dependía de tener el módulo SISTEMA, así que
   * un asesor no veía Configuración —y ahí es donde ahora están sus
   * avisos y cómo instalar la app en el teléfono—. Ahora la sección se
   * pinta si hay al menos una cosa dentro, que es la regla que debió ser
   * desde el principio.
   */
  const itemsSistema = SYSTEM_ITEMS.filter(i => !i.perm || permisos.has(i.perm));
  // Y cambia de nombre: a quien solo tiene su cuenta, "Sistema" le suena
  // a algo que no le corresponde y no lo abre.
  const tituloSistema = verSistema ? "Sistema" : "Ajustes";

  return (
    <aside
      className={cn(
        "flex flex-col h-full sidebar-bg transition-[width] duration-200",
        plegado ? "w-[62px] min-w-[62px]" : "w-[210px] min-w-[210px]",
      )}
    >
      {/* Logo y plegado */}
      <div
        className={cn("px-4 py-4 flex items-center gap-2", plegado && "px-2 justify-center")}
        style={{ borderBottom: `1px solid ${modeColor}20` }}
      >
        {!plegado && (brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.companyName} className="h-7 object-contain max-w-[150px] flex-1 min-w-0" />
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: modeColor }}>
              {brand.companyName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{brand.companyName}</span>
          </div>
        ))}
        {/* Solo en escritorio: en móvil el menú es un cajón que se cierra
            entero, y un botón de plegar ahí no significa nada. */}
        <button
          onClick={alternarPlegado}
          title={plegado ? "Desplegar el menú" : "Plegar el menú"}
          aria-label={plegado ? "Desplegar el menú" : "Plegar el menú"}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
        >
          {plegado ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Mode selector — ERP · CRM · Nexus */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(100,116,139,0.12)" }}>
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: "rgba(100,116,139,0.1)" }}>
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all relative"
              style={
                mode === m.key
                  ? { backgroundColor: m.color, color: "white", boxShadow: `0 2px 6px ${m.color}55` }
                  : { color: m.color, opacity: 0.55 }
              }
            >
              {plegado ? m.label.charAt(0) : m.label}
              {(m.badge ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-800 bg-red-500 text-white">
                  {(m.badge ?? 0) > 9 ? "9+" : m.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item, i) => (
          <NavItem key={i} item={item as (typeof ERP_ITEMS)[number]} />
        ))}
      </nav>

      {/* Sistema (collapsible) — solo admin/superadmin */}
      {itemsSistema.length > 0 && (
      <div style={{ borderTop: "1px solid rgba(100,116,139,0.12)" }}>
        <button
          onClick={() => setSysOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Settings size={12} />
          {!plegado && <span className="flex-1 text-left font-medium">{tituloSistema}</span>}
          {!plegado && <ChevronDown size={11} className={cn("transition-transform", sysOpen && "rotate-180")} />}
        </button>
        {sysOpen && (
          <div className="pb-1">
            {itemsSistema.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === activa;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 mx-2 px-3 py-1.5 rounded-lg text-[11.5px] transition-all"
                  style={isActive ? { backgroundColor: "#6b728018", color: "#374151" } : {}}
                >
                  <Icon size={13} className="text-gray-400" />
                  {!plegado && (
                    <span className={cn("text-gray-500 dark:text-gray-400", isActive && "font-medium text-gray-700 dark:text-gray-200")}>
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* User */}
      <div className="p-3" style={{ borderTop: "1px solid rgba(100,116,139,0.12)" }}>
        <div className={cn("flex items-center gap-2.5", plegado && "justify-center")}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: modeColor }}
            title={plegado ? `${user?.nombre ?? ""} · ${user?.rol ?? ""}` : undefined}
          >
            {user ? getInitials(user.nombre) : "?"}
          </div>
          <div className={cn("flex-1 min-w-0", plegado && "hidden")}>
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate">{user?.nombre ?? "..."}</p>
            <p className="text-[10px] text-gray-400 truncate">{user?.rol ?? ""}</p>
          </div>
          <button onClick={logout} className={cn("text-gray-300 hover:text-red-500 transition-colors p-1", plegado && "hidden")} title="Cerrar sesión">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Sembla — marca discreta (by ESEK) */}
      <a
        href="https://sembla.co"
        target="_blank"
        rel="noopener noreferrer"
        title="Hecho con Sembla · by ESEK"
        className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
        style={{ borderTop: "1px solid rgba(100,116,139,0.12)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor" />
          <rect x="13" y="2" width="9" height="9" rx="2" fill="currentColor" />
          <rect x="2" y="13" width="9" height="9" rx="2" fill="currentColor" />
          <rect x="13" y="13" width="9" height="9" rx="2" fill="#6366F1" />
        </svg>
        {!plegado && <span>Sembla · by ESEK</span>}
      </a>
    </aside>
  );
}
