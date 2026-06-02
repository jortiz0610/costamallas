"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Bell, AlertTriangle, CheckCircle, Info, Package } from "lucide-react";
import type { NotificacionDTO } from "@/types";

async function fetchKPIs() {
  const res = await fetch("/api/dashboard/kpis");
  if (!res.ok) return null;
  return (await res.json()).data;
}

async function fetchNotificaciones() {
  const res = await fetch("/api/notificaciones?limit=10");
  if (!res.ok) return { data: [], noLeidas: 0 };
  return res.json();
}

// ── Toast flotante de notificación ───────────────────────────

function NotifToast({ notif, onClose }: { notif: NotificacionDTO; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const icons: Record<string, React.ReactNode> = {
    STOCK_CRITICO:       <AlertTriangle size={16} className="text-red-500" />,
    STOCK_BAJO:          <Package size={16} className="text-orange-500" />,
    EXPORTACION_COMPLETA:<CheckCircle size={16} className="text-green-500" />,
    SYNC_WOOCOMMERCE:    <CheckCircle size={16} className="text-blue-500" />,
    ERROR_VALIDACION:    <AlertTriangle size={16} className="text-yellow-500" />,
    SISTEMA:             <Info size={16} className="text-gray-500" />,
  };

  return (
    <div className="flex items-start gap-3 bg-white border border-gray-100 rounded-2xl shadow-lg px-4 py-3 w-80 animate-slide-in-right">
      <div className="flex-shrink-0 mt-0.5">{icons[notif.tipo] ?? <Bell size={16} />}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 truncate">{notif.titulo}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{notif.mensaje}</p>
      </div>
      <button onClick={onClose} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors">
        <X size={13} />
      </button>
    </div>
  );
}

// ── Gestor de toasts de notificaciones ───────────────────────

function NotifToastManager() {
  const [toasts, setToasts] = useState<NotificacionDTO[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const isFirst = useRef(true);

  const { data } = useQuery({
    queryKey: ["notificaciones"],
    queryFn: fetchNotificaciones,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!data?.data) return;
    // En el primer fetch solo registrar IDs sin mostrar toasts
    if (isFirst.current) {
      data.data.forEach((n: NotificacionDTO) => seenIds.current.add(n.id));
      isFirst.current = false;
      return;
    }
    // Mostrar toasts solo para notificaciones nuevas no leídas
    const nuevas = data.data.filter(
      (n: NotificacionDTO) => !n.leida && !seenIds.current.has(n.id)
    );
    nuevas.forEach((n: NotificacionDTO) => seenIds.current.add(n.id));
    if (nuevas.length > 0) setToasts(prev => [...prev, ...nuevas].slice(-5));
  }, [data]);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <NotifToast key={t.id} notif={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}

// ── Botón de soporte flotante ─────────────────────────────────

function SupportButton() {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setVisible(v => !v), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-cm-yellow text-cm-black shadow-lg flex items-center justify-center transition-all duration-700 hover:scale-110 hover:opacity-100 ${visible ? "opacity-100" : "opacity-20"}`}
        title="Soporte"
      >
        <MessageCircle size={20} />
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-cm-yellow p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-cm-black text-[13px]">Soporte Costamallas ERP</p>
              <p className="text-cm-black/60 text-[11px]">¿Necesitas ayuda?</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-cm-black/60 hover:text-cm-black"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <a href="https://wa.me/573177366417" target="_blank" rel="noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors text-[12px] font-medium text-green-700">
              💬 WhatsApp soporte
            </a>
            <a href="mailto:soporte@costamallas.com"
              className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors text-[12px] font-medium text-blue-700">
              ✉️ Enviar correo
            </a>
            <p className="text-[10px] text-gray-400 text-center">Lun–Vie 8am–6pm · Costamallas ERP v1.0</p>
          </div>
        </div>
      )}
    </>
  );
}

// ── Layout principal ──────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({ queryKey: ["dashboard", "kpis"], queryFn: fetchKPIs, staleTime: 60_000 });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        stockCriticos={data?.stock?.criticos ?? 0}
        erroresPendientes={data?.woocommerce?.erroresPendientes ?? 0}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <NotifToastManager />
      <SupportButton />
    </div>
  );
}
