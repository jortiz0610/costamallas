"use client";

// ============================================================
// El menú que sale al escribir `/`.
//
// Flota sobre la caja de escribir, no la empuja: si empujara, la lista
// de mensajes daría un salto cada vez que alguien teclea una barra.
//
// Se maneja con el teclado (flechas, Enter, Escape) porque quien
// contesta chats todo el día no suelta las manos para tocar la pantalla.
// ============================================================

import { useEffect, useState } from "react";
import { Sparkles, Slash } from "lucide-react";
import type { Comando } from "@/lib/nexus/comandos";

export function MenuComandos({
  comandos,
  onElegir,
  onCerrar,
}: {
  comandos: Comando[];
  onElegir: (c: Comando) => void;
  onCerrar: () => void;
}) {
  const [i, setI] = useState(0);

  useEffect(() => { setI(0); }, [comandos.length]);

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setI(v => (v + 1) % comandos.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setI(v => (v - 1 + comandos.length) % comandos.length); }
      else if (e.key === "Enter" || e.key === "Tab") {
        if (comandos[i]) { e.preventDefault(); onElegir(comandos[i]); }
      } else if (e.key === "Escape") { onCerrar(); }
    };
    // En captura: la caja de escribir también escucha Enter para enviar,
    // y sin esto el primer Enter mandaría "/plan" como mensaje.
    window.addEventListener("keydown", teclas, true);
    return () => window.removeEventListener("keydown", teclas, true);
  }, [comandos, i, onElegir, onCerrar]);

  if (!comandos.length) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 sm:mx-0 rounded-2xl overflow-hidden card shadow-lg z-30">
      <div className="px-3 py-1.5 flex items-center gap-1.5 surface-2">
        <Slash size={11} className="text-muted" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Comandos</span>
        <span className="ml-auto text-[10px] text-muted hidden sm:inline">↑↓ para moverte · Enter para elegir</span>
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {comandos.map((c, idx) => (
          <button
            key={c.nombre}
            onMouseEnter={() => setI(idx)}
            onClick={() => onElegir(c)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${
              idx === i ? "surface-2" : ""
            }`}
          >
            {c.nombre === "ia"
              ? <Sparkles size={14} className="flex-shrink-0" style={{ color: "var(--brand-color)" }} />
              : <Slash size={14} className="text-muted flex-shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">
                /{c.nombre}
                {c.argumento && <span className="font-normal text-gray-400"> {c.argumento}</span>}
              </span>
              <span className="block text-[10.5px] text-muted truncate">{c.descripcion}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
