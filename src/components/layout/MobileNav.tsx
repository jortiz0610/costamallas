"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/hooks/useAuth";
import { modulosVisibles } from "@/lib/permisos";
import {
  LayoutDashboard, Package, UserCircle, MessageSquare, Megaphone, Menu,
} from "lucide-react";

const ERP_COLOR = "#185FA5";
const CRM_COLOR = "#BA7517";
const NEXUS_COLOR = "#7c3aed";
const MKT_COLOR = "#db2777";

// Destino principal según el módulo activo
const MODULOS: Record<string, { label: string; href: string; Icon: React.ElementType; color: string }> = {
  ERP:       { label: "ERP",     href: "/",                Icon: Package,        color: ERP_COLOR },
  CRM:       { label: "CRM",     href: "/crm",             Icon: UserCircle,     color: CRM_COLOR },
  NEXUS:     { label: "Nexus",   href: "/nexus",           Icon: MessageSquare,  color: NEXUS_COLOR },
  MARKETING: { label: "Mkt",     href: "/marketing",       Icon: Megaphone,      color: MKT_COLOR },
};

export function MobileNav() {
  const pathname = usePathname();
  const { mode, setMode, setSidebarOpen } = useBrand();
  const { permisos } = useAuth();

  // Los mismos módulos que el menú de escritorio, filtrados por lo mismo.
  // Antes esta barra los mostraba los cuatro siempre, así que en el
  // teléfono un vendedor veía "Mkt" y al tocarlo caía en una pantalla que
  // no le corresponde.
  // Nexus va PRIMERO en el teléfono porque en el celular lo que más se
  // hace es contestar. Pero ya no se entra ahí a la fuerza: la primera
  // pantalla de la visita es el tablero de módulos (LanzadorMovil) y
  // la persona elige. Los demás módulos siguen aquí al lado y en "Más".
  const visibles = modulosVisibles(permisos);
  const items = ([
    { key: "NEXUS" as const, ...MODULOS.NEXUS },
    { key: "CRM" as const, ...MODULOS.CRM },
    { key: "ERP" as const, ...MODULOS.ERP },
    { key: "MARKETING" as const, ...MODULOS.MARKETING },
  ]).filter(i => visibles.includes(i.key));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 topbar-bg border-t divider"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch justify-around h-16">
        {items.map(it => {
          const Icon = it.Icon;
          const active = mode === it.key;
          return (
            <Link key={it.key} href={it.href}
              onClick={() => setMode(it.key)}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-all relative">
              {active && <span className="absolute top-0 w-10 h-1 rounded-full" style={{ backgroundColor: it.color }} />}
              <Icon size={20} style={{ color: active ? it.color : "var(--text-muted)" }} />
              <span className="text-[10px] font-semibold" style={{ color: active ? it.color : "var(--text-muted)" }}>{it.label}</span>
            </Link>
          );
        })}
        {/* Más (abre el menú completo) */}
        <button onClick={() => setSidebarOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1">
          <Menu size={20} className="text-muted" />
          <span className="text-[10px] font-semibold text-muted">Más</span>
        </button>
      </div>
    </nav>
  );
}
