"use client";
import { Bell, Sun, Moon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { NotificationsPanel } from "./NotificationsPanel";
import { useBrand } from "@/contexts/BrandContext";
import { cn } from "@/lib/utils";

const ERP_COLOR = "#185FA5";
const CRM_COLOR = "#BA7517";

interface TopbarProps { title: string; actions?: React.ReactNode; }

export function Topbar({ title, actions }: TopbarProps) {
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { noLeidas } = useNotificaciones();
  const { darkMode, toggleDark, mode } = useBrand();
  const modeColor = mode === "ERP" ? ERP_COLOR : CRM_COLOR;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 flex items-center gap-3 px-5 flex-shrink-0 topbar-bg z-10 relative">
      <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: modeColor }} />
      <h1 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 flex-1">{title}</h1>
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white hidden sm:inline-flex items-center" style={{ backgroundColor: modeColor }}>{mode}</span>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      <button onClick={toggleDark}
        className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700"
        title={darkMode ? "Modo claro" : "Modo oscuro"}>
        {darkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <div className="relative" ref={notifRef}>
        <button onClick={() => setShowNotif(v => !v)}
          className={cn("relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors border border-gray-200 dark:border-slate-700",
            showNotif ? "bg-gray-100 dark:bg-slate-800" : "hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400")}>
          <Bell size={15} />
          {noLeidas > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: modeColor }} />}
        </button>
        {showNotif && <NotificationsPanel onClose={() => setShowNotif(false)} />}
      </div>
    </header>
  );
}
