"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ImageIcon, Tag, Archive,
  FileOutput, FileInput, AlertTriangle, ScrollText, Settings,
  LogOut, Users, UserCircle, ClipboardList, ShoppingCart, Wrench, Kanban,
  ChevronDown,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/contexts/BrandContext";
import Image from "next/image";
import { useState } from "react";

const ERP_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { section: "Catálogo" },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/imagenes", label: "Imágenes", icon: ImageIcon },
  { href: "/categorias", label: "Categorías", icon: Tag },
  { section: "Operaciones" },
  { href: "/stock", label: "Stock", icon: Archive, alertKey: "stock" },
  { href: "/importar", label: "Importar desde WC", icon: FileInput },
  { href: "/exportar", label: "Exportar a WC", icon: FileOutput },
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
  { href: "/logs", label: "Logs de auditoría", icon: ScrollText },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

interface SidebarProps {
  stockCriticos?: number;
  erroresPendientes?: number;
  crmPendientes?: number;
}

export function Sidebar({ stockCriticos = 0, erroresPendientes = 0, crmPendientes = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { brand, mode, setMode } = useBrand();
  const [sysOpen, setSysOpen] = useState(false);

  const badges: Record<string, number> = {
    stock: stockCriticos,
    errores: erroresPendientes,
  };

  const navItems = mode === "ERP" ? ERP_ITEMS : CRM_ITEMS;

  function NavItem({ item }: { item: typeof ERP_ITEMS[number] }) {
    if ("section" in item) {
      return (
        <p className="px-4 pt-5 pb-1 text-[9px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest">
          {item.section}
        </p>
      );
    }
    const Icon = item.icon!;
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href!);
    const badgeCount = (item as { alertKey?: string }).alertKey ? badges[(item as { alertKey?: string }).alertKey!] ?? 0 : 0;

    return (
      <Link
        href={item.href!}
        className={cn(
          "flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 group",
          isActive
            ? "text-white font-medium"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
        )}
        style={isActive ? { backgroundColor: brand.brandColor } : {}}
      >
        <Icon size={15} className={isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"} />
        <span className="flex-1">{item.label}</span>
        {badgeCount > 0 && (
          <span className={cn(
            "px-1.5 py-0.5 text-[9px] font-bold rounded-full",
            isActive ? "bg-white/30 text-white" : "bg-red-500 text-white"
          )}>
            {badgeCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside className="w-[220px] min-w-[220px] flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
      {/* Logo / empresa */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.companyName} className="h-8 object-contain max-w-[160px]" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: brand.brandColor }}>
              {brand.companyName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{brand.companyName}</span>
          </div>
        )}
      </div>

      {/* ERP / CRM toggle */}
      <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1">
          <button
            onClick={() => setMode("ERP")}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all", mode === "ERP" ? "text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}
            style={mode === "ERP" ? { backgroundColor: brand.brandColor } : {}}
          >
            ERP
          </button>
          <button
            onClick={() => setMode("CRM")}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all relative", mode === "CRM" ? "text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}
            style={mode === "CRM" ? { backgroundColor: brand.brandColor } : {}}
          >
            CRM
            {crmPendientes > 0 && (
              <span className={cn("absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-gray-100 dark:border-gray-800", mode === "CRM" ? "bg-white text-gray-800" : "bg-red-500 text-white")}>
                {crmPendientes > 9 ? "9+" : crmPendientes}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item, i) => <NavItem key={i} item={item as typeof ERP_ITEMS[number]} />)}
      </nav>

      {/* Sistema (colapsable) */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setSysOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-[12px] text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <Settings size={13} />
          <span className="flex-1 text-left">Sistema</span>
          <ChevronDown size={13} className={cn("transition-transform", sysOpen && "rotate-180")} />
        </button>
        {sysOpen && (
          <div className="pb-1">
            {SYSTEM_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}
                  className={cn("flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-[12px] transition-all",
                    isActive ? "text-white font-medium" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                  style={isActive ? { backgroundColor: brand.brandColor } : {}}>
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Usuario */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{ backgroundColor: brand.brandColor }}>
            {user ? getInitials(user.nombre) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200 truncate">{user?.nombre ?? "…"}</p>
            <p className="text-[10px] text-gray-400 truncate">{user?.rol ?? ""}</p>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Cerrar sesión">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
