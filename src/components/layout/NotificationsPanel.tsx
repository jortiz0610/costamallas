"use client";
import { Bell, Check, AlertTriangle, CheckCircle, Info, RefreshCw } from "lucide-react";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { timeAgo, cn } from "@/lib/utils";
import type { TipoNotificacion } from "@/types";

const tipoConfig: Record<TipoNotificacion, { icon: React.ElementType; className: string }> = {
  STOCK_CRITICO:        { icon: AlertTriangle, className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  STOCK_BAJO:           { icon: AlertTriangle, className: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  ERROR_VALIDACION:     { icon: AlertTriangle, className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  EXPORTACION_COMPLETA: { icon: CheckCircle,   className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  SYNC_WOOCOMMERCE:     { icon: RefreshCw,     className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  SISTEMA:              { icon: Info,          className: "text-gray-600 bg-gray-100 dark:bg-gray-800" },
  NEXUS_MENSAJE:        { icon: Bell,          className: "text-violet-600 bg-violet-100 dark:bg-violet-900/30" },
};

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { notificaciones, noLeidas, isLoading, marcarTodasLeidas } = useNotificaciones();

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Notificaciones</p>
          {noLeidas > 0 && <p className="text-[11px] text-gray-400">{noLeidas} sin leer</p>}
        </div>
        {noLeidas > 0 && (
          <button onClick={marcarTodasLeidas} className="text-[11px] text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
            <Check size={11} /> Marcar leidas
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {isLoading ? (
          <div className="p-4 text-center text-[12px] text-gray-400">Cargando...</div>
        ) : notificaciones.length === 0 ? (
          <div className="p-6 text-center">
            <Bell size={20} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[12px] text-gray-400">Sin notificaciones</p>
          </div>
        ) : notificaciones.map(n => {
          const cfg = tipoConfig[n.tipo] ?? tipoConfig.SISTEMA;
          const Icon = cfg.icon;
          return (
            <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3 transition-colors", !n.leida && "bg-blue-50/50 dark:bg-blue-900/10")}>
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", cfg.className)}>
                <Icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate">{n.titulo}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.mensaje}</p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.leida && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
