"use client";

// ============================================================
// La barra de abajo cuando se está en Nexus, en el teléfono.
//
// La barra normal del portal ofrece ERP · CRM · Nexus · Marketing. Eso
// sirve para moverse ENTRE módulos, pero quien está contestando chats no
// quiere irse a otro módulo: quiere ver los sin leer, cambiar de filtro
// o pasarse al chat del equipo. Cuatro botones que llevan lejos, en el
// sitio más accesible del teléfono, es tirar la mejor barra de la
// pantalla.
//
// Así que dentro de Nexus la barra cambia y ofrece lo de Nexus. Salir a
// otro módulo sigue estando, en "Más", que abre el menú completo — un
// toque más para lo que se hace tres veces al día, y un toque menos para
// lo que se hace treinta.
// ============================================================

import { Inbox, BellDot, Users, SlidersHorizontal, Menu } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";

const NEXUS_COLOR = "#7c3aed";

interface Props {
  /** Cuántas sin leer hay ahora mismo. */
  sinLeer: number;
  /** Cuántas sin leer en el chat del equipo. */
  internoSinLeer?: number;
  /** true = el filtro "no leídas" está puesto. */
  soloNoLeidas: boolean;
  onTodas: () => void;
  onSoloNoLeidas: () => void;
  onFiltrar: () => void;
  puedeInterno?: boolean;
}

export function BarraNexus({
  sinLeer, internoSinLeer = 0, soloNoLeidas,
  onTodas, onSoloNoLeidas, onFiltrar, puedeInterno,
}: Props) {
  const { setSidebarOpen } = useBrand();

  const Boton = ({
    Icon, label, activo, badge, onClick, href,
  }: {
    Icon: React.ElementType;
    label: string;
    activo?: boolean;
    badge?: number;
    onClick?: () => void;
    href?: string;
  }) => {
    const contenido = (
      <>
        {activo && <span className="absolute top-0 w-10 h-1 rounded-full" style={{ backgroundColor: NEXUS_COLOR }} />}
        <span className="relative">
          <Icon size={20} style={{ color: activo ? NEXUS_COLOR : "var(--text-muted)" }} />
          {badge ? (
            <span
              className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
              style={{ backgroundColor: "#e11d48" }}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </span>
        <span className="text-[10px] font-semibold" style={{ color: activo ? NEXUS_COLOR : "var(--text-muted)" }}>
          {label}
        </span>
      </>
    );

    const clases = "flex-1 flex flex-col items-center justify-center gap-1 relative min-h-[56px]";
    return href
      ? <a href={href} className={clases}>{contenido}</a>
      : <button onClick={onClick} className={clases}>{contenido}</button>;
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 topbar-bg border-t divider"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around h-16">
        <Boton Icon={Inbox} label="Bandeja" activo={!soloNoLeidas} onClick={onTodas} />
        <Boton Icon={BellDot} label="Sin leer" activo={soloNoLeidas} badge={sinLeer} onClick={onSoloNoLeidas} />
        {puedeInterno && (
          <Boton Icon={Users} label="Equipo" badge={internoSinLeer} href="/nexus/interno" />
        )}
        <Boton Icon={SlidersHorizontal} label="Filtrar" onClick={onFiltrar} />
        {/* La salida al resto del portal. No desaparece: solo deja de
            ocupar cuatro de los cinco botones. */}
        <Boton Icon={Menu} label="Más" onClick={() => setSidebarOpen(true)} />
      </div>
    </nav>
  );
}
