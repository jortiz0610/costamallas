"use client";

import { Bell, Search, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { NotificationsPanel } from "./NotificationsPanel";
import { cn, timeAgo } from "@/lib/utils";

interface TopbarProps {
  title: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, actions }: TopbarProps) {
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { noLeidas } = useNotificaciones();

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
    <header className="h-14 flex items-center gap-4 px-6 border-b border-gray-100 bg-white flex-shrink-0">
      <h1 className="text-[15px] font-semibold text-gray-800 flex-1">{title}</h1>

      {/* Acciones de la página */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* Notificaciones */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotif((v) => !v)}
          className={cn(
            "relative w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200",
            "text-gray-500 hover:bg-gray-50 transition-colors",
            showNotif && "bg-gray-50 border-gray-300"
          )}
        >
          <Bell size={16} />
          {noLeidas > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {showNotif && (
          <NotificationsPanel onClose={() => setShowNotif(false)} />
        )}
      </div>
    </header>
  );
}
