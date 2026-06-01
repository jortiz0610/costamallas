"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Image, Tag, Archive,
  FileOutput, AlertTriangle, ScrollText, Settings,
  LogOut, ChevronDown,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { section: "Catálogo" },
  { href: "/productos", label: "Productos", icon: Package, badge: null },
  { href: "/imagenes", label: "Imágenes", icon: Image },
  { href: "/categorias", label: "Categorías", icon: Tag },
  { section: "Operaciones" },
  { href: "/stock", label: "Stock", icon: Archive, alertKey: "stock" },
  { href: "/exportar", label: "Exportar a WC", icon: FileOutput },
  { href: "/errores", label: "Errores", icon: AlertTriangle, alertKey: "errores" },
  { section: "Sistema" },
  { href: "/logs", label: "Logs de auditoría", icon: ScrollText },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

interface SidebarProps {
  stockCriticos?: number;
  erroresPendientes?: number;
}

export function Sidebar({ stockCriticos = 0, erroresPendientes = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const badges: Record<string, number> = {
    stock: stockCriticos,
    errores: erroresPendientes,
  };

  return (
    <aside className="w-[220px] min-w-[220px] flex flex-col h-full bg-cm-black text-white">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="inline-block px-2 py-1 bg-cm-yellow text-cm-black text-[10px] font-bold rounded tracking-widest uppercase">
          Costamallas
        </div>
        <p className="mt-2 text-white text-[13px] font-medium">Portal ERP</p>
        <p className="text-white/40 text-[10px] mt-0.5">v1.0 · WooCommerce</p>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item, i) => {
          if ("section" in item) {
            return (
              <p key={i} className="px-5 pt-4 pb-1 text-[9px] font-semibold text-white/30 uppercase tracking-widest">
                {item.section}
              </p>
            );
          }

          const Icon = item.icon!;
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href!);
          const badgeCount = item.alertKey ? badges[item.alertKey] : 0;

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex items-center gap-3 px-5 py-2.5 text-[13px] border-l-2 transition-all duration-150",
                isActive
                  ? "text-cm-yellow border-cm-yellow bg-cm-yellow/10"
                  : "text-white/60 border-transparent hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={15} />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-600 text-white rounded-full">
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cm-yellow text-cm-black flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {user ? getInitials(user.nombre) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[12px] font-medium truncate">{user?.nombre ?? "…"}</p>
            <p className="text-white/40 text-[10px] truncate">{user?.rol ?? ""}</p>
          </div>
          <button
            onClick={logout}
            className="text-white/40 hover:text-red-400 transition-colors p-1"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
