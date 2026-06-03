"use client";

import { Bell, Sun, Moon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { NotificationsPanel } from "./NotificationsPanel";
import { useBrand } from "@/contexts/BrandContext";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, actions }: TopbarProps) {
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { noLeidas } = useNotificaciones();
  const { darkMode, toggleDark, brand } = useBrand();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 flex items-center gap-3 px-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
      {/* Línea de acento izquierda con color corporativo */}
      <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: brand.brandColor }} />
      <h1 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 flex-1">{title}</h1>

      {/* Acciones de la página */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* Dark mode toggle */}
      <button
        onClick={toggleDark}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        title={darkMode ? "Modo claro" : "Modo oscuro"}
      >
        {darkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Notificaciones */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotif((v) => !v)}
          className={cn(
            "relative w-9 h-9 flex items-center justify-center rounded-lg border transition-colors",
            showNotif
              ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          )}
        >
          <Bell size={15} />
          {noLeidas > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: brand.brandColor }} />
          )}
        </button>

        {showNotif && (
          <NotificationsPanel onClose={() => setShowNotif(false)} />
        )}
      </div>
    </header>
  );
}
