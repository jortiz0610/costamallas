"use client";

// ============================================================
// Los tres puntos de una conversación.
//
// Antes solo había un botón: archivar. Y archivar es una de las cinco
// cosas que se hacen con un chat, así que todo lo demás —moverlo de
// estado, pasárselo a alguien, borrarlo— había que hacerlo por fuera o
// no se podía.
//
// El ESTADO va en el menú y no en un selector suelto a propósito: se
// cambia dos o tres veces al día, no cada minuto, y un desplegable
// siempre visible en la cabecera de un chat le roba sitio al nombre del
// cliente, que es lo que sí se mira todo el rato.
//
// Lo destructivo va abajo, separado por una línea y en rojo. Un menú
// donde "Borrar" queda pegado a "Marcar como abierta" es un menú que
// borra conversaciones por accidente.
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  MoreVertical, Inbox, Clock, CheckCheck, Archive, Trash2, UserCheck, Loader2,
} from "lucide-react";

export interface EstadoChat {
  v: string;
  l: string;
  ayuda: string;
  Icon: React.ElementType;
  color: string;
}

/**
 * Los cuatro estados, y qué significa cada uno de verdad.
 *
 * Se describen porque "en proceso" y "resuelta" quieren decir cosas
 * distintas en cada empresa, y sin decirlo cada asesor usa el suyo.
 */
export const ESTADOS_CHAT: EstadoChat[] = [
  { v: "ABIERTA",    l: "Abierta",     ayuda: "Está en la bandeja, esperando respuesta.", Icon: Inbox,     color: "#16a34a" },
  { v: "EN_PROCESO", l: "En proceso",  ayuda: "Ya la está atendiendo alguien.",           Icon: Clock,     color: "#d97706" },
  { v: "RESUELTA",   l: "Resuelta",    ayuda: "Se contestó y no queda nada pendiente.",   Icon: CheckCheck, color: "#185FA5" },
  { v: "ARCHIVADA",  l: "Archivada",   ayuda: "Fuera de la bandeja. Se puede recuperar.", Icon: Archive,   color: "#64748b" },
];

interface Props {
  estadoActual: string;
  /** Cambiar el estado. Si devuelve false, el menú se queda abierto. */
  onEstado: (v: string) => void | Promise<void>;
  onAsignarme?: () => void | Promise<void>;
  /** Solo se pinta si se pasa: borrar exige permiso. */
  onBorrar?: () => void | Promise<void>;
  ocupado?: boolean;
}

export function AccionesChat({ estadoActual, onEstado, onAsignarme, onBorrar, ocupado }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Cerrar al tocar fuera y con Escape. Un menú que se queda abierto
  // tapando el chat es de las cosas que más molestan en el teléfono.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) {
        setAbierto(false); setConfirmando(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAbierto(false); setConfirmando(false); }
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const cerrar = () => { setAbierto(false); setConfirmando(false); };

  return (
    <div className="relative flex-shrink-0" ref={caja}>
      <button
        onClick={() => setAbierto(v => !v)}
        aria-label="Más acciones"
        aria-expanded={abierto}
        className="w-9 h-9 rounded-lg flex items-center justify-center border divider text-muted hover:surface-2 transition-colors"
      >
        {ocupado ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={15} />}
      </button>

      {abierto && (
        <div
          className="absolute right-0 top-11 z-50 w-60 card p-1.5 shadow-xl"
          role="menu"
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted">
            Estado
          </p>

          {ESTADOS_CHAT.map(e => {
            const Icon = e.Icon;
            const actual = e.v === estadoActual;
            return (
              <button
                key={e.v}
                role="menuitem"
                onClick={() => { if (!actual) void onEstado(e.v); cerrar(); }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:surface-2 transition-colors"
                style={actual ? { backgroundColor: e.color + "14" } : {}}
              >
                <Icon size={14} className="flex-shrink-0 mt-0.5" style={{ color: e.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-soft">
                    {e.l}{actual && <span className="text-muted font-normal"> · ahora</span>}
                  </span>
                  <span className="block text-[11px] text-muted leading-snug mt-0.5">{e.ayuda}</span>
                </span>
              </button>
            );
          })}

          {onAsignarme && (
            <>
              <div className="my-1 border-t divider" />
              <button
                role="menuitem"
                onClick={() => { void onAsignarme(); cerrar(); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:surface-2 transition-colors"
              >
                <UserCheck size={14} className="text-muted flex-shrink-0" />
                <span className="text-[12.5px] font-semibold text-soft">Atenderla yo</span>
              </button>
            </>
          )}

          {onBorrar && (
            <>
              {/* Separado y abajo del todo. Pegado a "marcar como
                  abierta" se toca sin querer, y esto no se deshace. */}
              <div className="my-1 border-t divider" />
              {confirmando ? (
                <div className="px-2.5 py-2">
                  <p className="text-[11.5px] text-soft leading-snug mb-2">
                    Se borra la conversación y todos sus mensajes. No se puede deshacer.
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { void onBorrar(); cerrar(); }}
                      className="flex-1 py-1.5 rounded-lg text-[12px] font-bold text-white bg-red-600 hover:bg-red-700"
                    >
                      Sí, borrar
                    </button>
                    <button
                      onClick={() => setConfirmando(false)}
                      className="flex-1 py-1.5 rounded-lg text-[12px] font-semibold surface-2 text-soft"
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  role="menuitem"
                  onClick={() => setConfirmando(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} className="text-red-500 flex-shrink-0" />
                  <span className="text-[12.5px] font-semibold text-red-600">Borrar conversación</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
