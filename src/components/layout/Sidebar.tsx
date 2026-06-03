"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ImageIcon, Tag, Archive, FileOutput, FileInput, AlertTriangle, ScrollText, Settings, LogOut, Users, UserCircle, ClipboardList, ShoppingCart, Wrench, Kanban, ChevronDown, ShieldCheck, BarChart2, MessageSquare } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/contexts/BrandContext";
import { useState } from "react";

const ERP_COLOR = "#185FA5";
const CRM_COLOR = "#BA7517";

const ERP_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { section: "Catalogo" },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/imagenes", label: "Imagenes", icon: ImageIcon },
  { href: "/categorias", label: "Categorias", icon: Tag },
  { section: "Operaciones" },
  { href: "/stock", label: "Stock", icon: Archive, alertKey: "stock" },
  { href: "/importar", label: "Importar WC", icon: FileInput },
  { href: "/exportar", label: "Exportar WC", icon: FileOutput },
  { href: "/errores", label: "Errores", icon: AlertTriangle, alertKey: "errores" },
];
const CRM_ITEMS = [
  { href: "/crm/clientes", label: "Clientes", icon: UserCircle },
  { href: "/crm/cotizaciones", label: "Cotizaciones", icon: ClipboardList },
  { href: "/crm/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/crm/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/crm/instalaciones", label: "Instalaciones", icon: Wrench },
];
const SYSTEM_ITEMS = [
  { href: "/usuarios", label: "Usuarios y Roles", icon: Users },
  { href: "/reportes", label: "Reportes", icon: BarChart2 },
  { href: "/sistema/seguridad", label: "Seguridad", icon: ShieldCheck },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
];

interface SidebarProps { stockCriticos?: number; erroresPendientes?: number; crmPendientes?: number; nexusSinLeer?: number; }

export function Sidebar({ stockCriticos = 0, erroresPendientes = 0, crmPendientes = 0, nexusSinLeer = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { brand, mode, setMode } = useBrand();
  const [sysOpen, setSysOpen] = useState(false);
  const modeColor = mode === "ERP" ? ERP_COLOR : CRM_COLOR;
  const badges: Record<string, number> = { stock: stockCriticos, errores: erroresPendientes };
  const navItems = mode === "ERP" ? ERP_ITEMS : CRM_ITEMS;

  function NavItem({ item }: { item: typeof ERP_ITEMS[number] }) {
    if ("section" in item) {
      return <p className="px-4 pt-4 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: modeColor + "80" }}>{item.section}</p>;
    }
    const Icon = item.icon!;
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href!);
    const badgeCount = (item as { alertKey?: string }).alertKey ? badges[(item as { alertKey?: string }).alertKey!] ?? 0 : 0;
    return (
      <Link href={item.href!}
        className={cn("flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-[12.5px] transition-all group")}
        style={isActive ? { backgroundColor: modeColor + "18", color: modeColor } : {}}>
        <Icon size={14} className={!isActive ? "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" : ""} />
        <span className={cn("flex-1 font-medium", !isActive && "text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200")}>{item.label}</span>
        {isActive && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: modeColor }} />}
        {badgeCount > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full">{badgeCount}</span>}
      </Link>
    );
  }

  return (
    <aside className="w-[210px] min-w-[210px] flex flex-col h-full sidebar-bg">
      <div className="px-4 py-4" style={{ borderBottom: `1px solid ${modeColor}20` }}>
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.companyName} className="h-7 object-contain max-w-[150px]" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: modeColor }}>
              {brand.companyName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{brand.companyName}</span>
          </div>
        )}
      </div>

      <div className="px-3 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: "#f1f5f9" }}>
          {(["ERP", "CRM"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative"
              style={mode === m ? { backgroundColor: m === "ERP" ? ERP_COLOR : CRM_COLOR, color: "white" } : { color: "#9ca3af" }}>
              {m}
              {m === "CRM" && crmPendientes > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center border border-white bg-red-500 text-white">
                  {crmPendientes > 9 ? "9+" : crmPendientes}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item, i) => <NavItem key={i} item={item as typeof ERP_ITEMS[number]} />)}
        <p className="px-4 pt-4 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "#7c3aed80" }}>Nexus</p>
        {(() => {
          const isActive = pathname.startsWith("/nexus");
          return (
            <Link href="/nexus"
              className={cn("flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-[12.5px] transition-all group")}
              style={isActive ? { backgroundColor: "#7c3aed18", color: "#7c3aed" } : {}}>
              <MessageSquare size={14} className={!isActive ? "text-gray-400 group-hover:text-violet-500 transition-colors" : ""} />
              <span className={cn("flex-1 font-medium", !isActive && "text-gray-600 dark:text-gray-400")}>Inbox Nexus</span>
              {nexusSinLeer > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold text-white rounded-full" style={{ backgroundColor: "#7c3aed" }}>{nexusSinLeer}</span>}
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
            </Link>
          );
        })()}
      </nav>

      <div style={{ borderTop: "1px solid #f1f5f9" }}>
        <button onClick={() => setSysOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <Settings size={12} /><span className="flex-1 text-left font-medium">Sistema</span>
          <ChevronDown size={11} className={cn("transition-transform", sysOpen && "rotate-180")} />
        </button>
        {sysOpen && (
          <div className="pb-1">
            {SYSTEM_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 mx-2 px-3 py-1.5 rounded-lg text-[11.5px] transition-all"
                  style={isActive ? { backgroundColor: "#6b728018", color: "#374151" } : {}}>
                  <Icon size={13} className="text-gray-400" />
                  <span className={cn("text-gray-500 dark:text-gray-400", isActive && "font-medium text-gray-700 dark:text-gray-200")}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3" style={{ borderTop: "1px solid #f1f5f9" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: modeColor }}>
            {user ? getInitials(user.nombre) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate">{user?.nombre ?? "..."}</p>
            <p className="text-[10px] text-gray-400 truncate">{user?.rol ?? ""}</p>
          </div>
          <button onClick={logout} className="text-gray-300 hover:text-red-500 transition-colors p-1" title="Cerrar sesion"><LogOut size={14} /></button>
        </div>
      </div>
    </aside>
  );
}
