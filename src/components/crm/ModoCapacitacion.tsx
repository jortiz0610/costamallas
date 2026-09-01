"use client";

// ============================================================
// El interruptor de capacitación.
//
// Un cliente marcado como de capacitación se puede cotizar, aprobar,
// instalar y facturar igual que uno real, pero no cuenta en informes.
// El problema era verlo: el pipeline y la lista de pedidos esconden lo
// de prueba —y hacen bien, porque si no, la formación aparecería como
// plata en juego—, así que el ensayo se creaba y desaparecía.
//
// Esto lo enciende y lo apaga. Va en `localStorage` y no en la sesión
// porque es una preferencia de quien mira la pantalla, no del negocio:
// dos personas pueden estar viendo el mismo pipeline y solo una estar
// capacitando.
//
// Mientras está encendido hay un aviso permanente. Sin él, alguien que
// se lo deja puesto acaba tomando decisiones mirando cifras que incluyen
// una obra que nunca existió.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

const CLAVE = "cm_modo_capacitacion";
const EVENTO = "cm-modo-capacitacion";

export function useModoCapacitacion() {
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    const leer = () => {
      try { setActivo(localStorage.getItem(CLAVE) === "1"); } catch { /* modo privado */ }
    };
    leer();
    // Para que los dos tableros abiertos en pestañas distintas —y los dos
    // componentes de la misma pantalla— no se contradigan.
    window.addEventListener(EVENTO, leer);
    window.addEventListener("storage", leer);
    return () => {
      window.removeEventListener(EVENTO, leer);
      window.removeEventListener("storage", leer);
    };
  }, []);

  const cambiar = useCallback((v: boolean) => {
    try { localStorage.setItem(CLAVE, v ? "1" : "0"); } catch { /* modo privado */ }
    setActivo(v);
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { activo, cambiar, parametro: activo ? "?pruebas=1" : "" };
}

/**
 * El botón. Solo se le enseña a quien puede capacitar: a los demás sería
 * un interruptor que enciende una vista vacía.
 */
export function InterruptorCapacitacion({ puede }: { puede: boolean }) {
  const { activo, cambiar } = useModoCapacitacion();
  if (!puede) return null;

  return (
    <button
      onClick={() => cambiar(!activo)}
      title={activo
        ? "Estás viendo también los clientes de capacitación"
        : "Ver también los clientes de capacitación"}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border"
      style={activo
        ? { backgroundColor: "#7c3aed18", borderColor: "#7c3aed", color: "#7c3aed" }
        : { backgroundColor: "transparent", borderColor: "var(--divider)", color: "var(--text-muted)" }}
    >
      <GraduationCap size={13} />
      <span className="hidden sm:inline">Capacitación</span>
    </button>
  );
}

/** La franja de aviso. Va debajo de la barra de título. */
export function AvisoCapacitacion() {
  const { activo, cambiar } = useModoCapacitacion();
  if (!activo) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold"
      style={{ backgroundColor: "#7c3aed", color: "#fff" }}>
      <GraduationCap size={14} className="flex-shrink-0" />
      <span className="flex-1 min-w-0">
        Modo capacitación: aquí abajo también salen los clientes de práctica.
        <span className="hidden sm:inline"> No cuentan en informes.</span>
      </span>
      <button onClick={() => cambiar(false)}
        className="underline underline-offset-2 flex-shrink-0 hover:opacity-80">
        Salir
      </button>
    </div>
  );
}
