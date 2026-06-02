"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";

async function fetchKPIs() {
  const res = await fetch("/api/dashboard/kpis");
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

function SupportButton() {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);

  // Auto-ocultar cada 30s y volver a aparecer
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible((v) => !v);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-cm-yellow text-cm-black shadow-lg flex items-center justify-center transition-all duration-700 hover:scale-110 hover:opacity-100 ${visible ? "opacity-100" : "opacity-20"}`}
        title="Soporte"
      >
        <MessageCircle size={20} />
      </button>

      {/* Panel de soporte */}
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
      <SupportButton />
    </div>
  );
}
