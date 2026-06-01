"use client";

import { Bell, Check, AlertTriangle, CheckCircle, Info, RefreshCw } from "lucide-react";
import { useNotificaciones } from "@/hooks/useNotificaciones";
import { timeAgo, cn } from "@/lib/utils";
import type { TipoNotificacion } from "@/types";

const tipoConfig: Record<TipoNotificacion, { icon: React.ElementType; className: string }> = {
  STOCK_CRITICO:        { icon: AlertTriangle, className: "text-red-600 bg-red-100" },
  STOCK_BAJO:           { icon: AlertTriangle, className: "text-orange-600 bg-orange-100" },
  ERROR_VALIDACION:     { icon: AlertTriangle, className: "text-red-600 bg-red-100" },
  EXPORTACION_COMPLETA: { icon: CheckCircle,   className: "text-green-600 bg-green-100" },
  SYNC_WOOCOMMERCE:     { icon: RefreshCw,     className: "text-blue-600 bg-blue-100" },
  SISTEMA:              { icon: Info,          className: "text-gray-600 bg-gray-100" },
};

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { notificaciones, noLeidas, isLoading, marcarTodasLeidas } = useNotificaciones();

  return (
    <div className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-gray-500" />
          <span className="text-[13px] font-semibold text-gray-800">Notificaciones</span>
          {noLeidas > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-600 text-white rounded-full">
              {noLeidas}
            </span>
          )}
        </div>
        {noLeidas > 0 && (
          <button
            onClick={marcarTodasLeidas}
            className="text-[11px] text-cm-yellow hover:text-cm-yellow-dark font-medium flex items-center gap-1"
          >
            <Check size={12} /> Marcar todas
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-6 text-center text-[12px] text-gray-400">Cargando…</div>
        ) : notificaciones.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-gray-400">Sin notificaciones</div>
        ) : (
          notificaciones.map((n) => {
            const config = tipoConfig[n.tipo];
            const Icon = config.icon;
            return (
              <div
                key={n.id}
                className={cn("flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors", !n.leida && "bg-blue-50/50")}
              >
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", config.className)}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 leading-snug">{n.titulo}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.mensaje}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.leida && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
