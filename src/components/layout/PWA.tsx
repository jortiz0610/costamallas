"use client";

// ============================================================
// PWA — registro del service worker e invitación a instalar
//
// El registro se hace después de que la página termina de cargar para no
// competir por ancho de banda con el primer render.
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { Download, X } from "lucide-react";

/** El evento `beforeinstallprompt` aún no está en los tipos del DOM. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CLAVE_DESCARTADO = "cm_pwa_descartado";

export function PWA() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [visible, setVisible] = useState(false);

  // ── Registrar el service worker ──
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Si falla (navegador viejo, http sin TLS en local) la app sigue
        // funcionando normal: la PWA es una mejora, no un requisito.
      });
    };
    if (document.readyState === "complete") registrar();
    else {
      window.addEventListener("load", registrar);
      return () => window.removeEventListener("load", registrar);
    }
  }, []);

  // ── Capturar la invitación de instalación ──
  useEffect(() => {
    if (localStorage.getItem(CLAVE_DESCARTADO)) return;
    const manejar = (e: Event) => {
      e.preventDefault(); // sin esto el navegador muestra su propio aviso
      setEvento(e as EventoInstalacion);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", manejar);
    return () => window.removeEventListener("beforeinstallprompt", manejar);
  }, []);

  const instalar = useCallback(async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "dismissed") localStorage.setItem(CLAVE_DESCARTADO, "1");
    setVisible(false);
    setEvento(null);
  }, [evento]);

  const descartar = () => {
    localStorage.setItem(CLAVE_DESCARTADO, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-24 sm:w-80 z-40 card p-4 flex items-start gap-3 animate-fade-up">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "#f9df1e" }}
      >
        <Download size={18} className="text-slate-900" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-soft">Instala el portal</p>
        <p className="text-[11px] text-muted mt-0.5 leading-snug">
          Ábrelo como app, sin barra del navegador y con acceso directo en tu pantalla de inicio.
        </p>
        <button
          onClick={instalar}
          className="mt-2.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg text-slate-900"
          style={{ backgroundColor: "#f9df1e" }}
        >
          Instalar
        </button>
      </div>
      <button
        onClick={descartar}
        className="text-muted hover:text-soft flex-shrink-0"
        aria-label="No instalar"
      >
        <X size={14} />
      </button>
    </div>
  );
}
