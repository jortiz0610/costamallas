"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Bell, AlertTriangle, CheckCircle, Info, Package } from "lucide-react";
import type { NotificacionDTO } from "@/types";
import { AsistenteIA } from "@/components/layout/AsistenteIA";
import { useBrand } from "@/contexts/BrandContext";

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

function NotifToast({ notif, onClose }: { notif: NotificacionDTO; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const icons: Record<string, React.ReactNode> = {
    STOCK_CRITICO:        <AlertTriangle size={16} className="text-red-500" />,
    STOCK_BAJO:           <Package size={16} className="text-orange-500" />,
    EXPORTACION_COMPLETA: <CheckCircle size={16} className="text-green-500" />,
    SYNC_WOOCOMMERCE:     <CheckCircle size={16} className="text-blue-500" />,
    ERROR_VALIDACION:     <AlertTriangle size={16} className="text-yellow-500" />,
    SISTEMA:              <Info size={16} className="text-gray-500" />,
    NEXUS_MENSAJE:        <Bell size={16} className="text-violet-500" />,
  };

  return (
    <div className="flex items-start gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-lg px-4 py-3 w-80 animate-slide-in-right">
      <div className="flex-shrink-0 mt-0.5">{icons[notif.tipo] ?? <Bell size={16} />}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{notif.titulo}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.mensaje}</p>
      </div>
      <button onClick={onClose} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5">
        <X size={13} />
      </button>
    </div>
  );
}

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
    if (isFirst.current) {
      data.data.forEach((n: NotificacionDTO) => seenIds.current.add(n.id));
      isFirst.current = false;
      return;
    }
    const nuevas = data.data.filter((n: NotificacionDTO) => !n.leida && !seenIds.current.has(n.id));
    nuevas.forEach((n: NotificacionDTO) => seenIds.current.add(n.id));
    if (nuevas.length > 0) setToasts(prev => [...prev, ...nuevas].slice(-5));
  }, [data]);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => <NotifToast key={t.id} notif={t} onClose={() => remove(t.id)} />)}
    </div>
  );
}

function SupportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-7 right-24 z-40 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 surface border divider"
        title="Soporte">
        <MessageCircle size={18} style={{ color: "var(--brand-color)" }} />
      </button>
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="p-4 flex items-center justify-between" style={{ backgroundColor: "var(--brand-color)" }}>
            <div>
              <p className="font-bold text-white text-[13px]">Soporte ERP</p>
              <p className="text-white/70 text-[11px]">Necesitas ayuda?</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            <a href="https://wa.me/573177366417" target="_blank" rel="noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-[12px] font-medium text-green-700 dark:text-green-300">
              WhatsApp soporte
            </a>
            <a href="mailto:soporte@costamallas.com"
              className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[12px] font-medium text-blue-700 dark:text-blue-300">
              Enviar correo
            </a>
            <p className="text-[10px] text-gray-400 text-center">Lun-Vie 8am-6pm</p>
          </div>
        </div>
      )}
    </>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useBrand();
  const { data } = useQuery({ queryKey: ["dashboard", "kpis"], queryFn: fetchKPIs, staleTime: 60_000 });

  const { data: nexusData } = useQuery({
    queryKey: ["nexus-noleidas"],
    queryFn: async () => {
      const res = await fetch("/api/nexus/conversaciones?estado=ABIERTA&noLeidas=true");
      if (!res.ok) return { noLeidas: 0 };
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="flex h-screen overflow-hidden page-bg">
      {/* Backdrop móvil */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar: estático en desktop, cajón en móvil */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar
          stockCriticos={data?.stock?.criticos ?? 0}
          erroresPendientes={data?.woocommerce?.erroresPendientes ?? 0}
          nexusSinLeer={nexusData?.noLeidas ?? 0}
        />
      </div>
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <NotifToastManager />
      <SupportButton />
      <AsistenteIA />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ShellInner>{children}</ShellInner>;
}
