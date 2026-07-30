"use client";

// ============================================================
// Bloques del formulario de producto
//
// Dos comportamientos según el tamaño de pantalla, tal como se pidió:
//
//   Escritorio → se pueden reordenar arrastrándolos. El orden se guarda
//                por usuario en localStorage, así cada quien acomoda el
//                formulario como trabaja.
//   Celular    → orden fijo, pero cada bloque se pliega y despliega. En
//                una pantalla angosta el formulario completo es un
//                scroll larguísimo; plegado se navega de un vistazo.
//
// El arrastre usa la API nativa de HTML5: no hace falta traer una
// librería de drag & drop para reordenar seis tarjetas.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, GripVertical, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Un bloque del formulario. */
export interface DefBloque {
  id: string;
  titulo: string;
  /** Si es true no se puede mover ni queda plegado por defecto. */
  fijo?: boolean;
  contenido: React.ReactNode;
}

const CLAVE_ORDEN = "cm_orden_bloques";
/** Ancho a partir del cual se considera escritorio (coincide con `lg:` de Tailwind). */
const ANCHO_ESCRITORIO = 1024;

/** Detecta si estamos en escritorio, reaccionando a cambios de tamaño. */
function useEsEscritorio() {
  // Arranca en null para no renderizar el modo equivocado antes de
  // hidratar (el servidor no sabe el ancho de la ventana).
  const [esEscritorio, setEsEscritorio] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${ANCHO_ESCRITORIO}px)`);
    const aplicar = () => setEsEscritorio(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  return esEscritorio;
}

/** Lee y guarda el orden preferido para un grupo de bloques. */
function useOrden(grupo: string, ids: string[]) {
  const [orden, setOrden] = useState<string[]>(ids);

  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(`${CLAVE_ORDEN}_${grupo}`) ?? "null");
      if (Array.isArray(guardado)) {
        // Se respeta lo guardado pero se añaden los bloques nuevos al
        // final y se descartan los que ya no existen: si no, al agregar
        // un bloque al formulario desaparecería para quien tenga orden
        // guardado.
        const validos = guardado.filter((id: string) => ids.includes(id));
        const faltantes = ids.filter(id => !validos.includes(id));
        setOrden([...validos, ...faltantes]);
        return;
      }
    } catch {
      // localStorage lleno o JSON corrupto: se usa el orden por defecto.
    }
    setOrden(ids);
  }, [grupo, ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = useCallback((nuevo: string[]) => {
    setOrden(nuevo);
    try { localStorage.setItem(`${CLAVE_ORDEN}_${grupo}`, JSON.stringify(nuevo)); } catch { /* sin espacio */ }
  }, [grupo]);

  const restablecer = useCallback(() => {
    setOrden(ids);
    try { localStorage.removeItem(`${CLAVE_ORDEN}_${grupo}`); } catch { /* nada */ }
  }, [grupo, ids]);

  const personalizado = orden.join("|") !== ids.join("|");

  return { orden, guardar, restablecer, personalizado };
}

export function GrupoBloques({ grupo, bloques }: { grupo: string; bloques: DefBloque[] }) {
  const esEscritorio = useEsEscritorio();
  const ids = bloques.map(b => b.id);
  const { orden, guardar, restablecer, personalizado } = useOrden(grupo, ids);

  const [plegados, setPlegados] = useState<Set<string>>(new Set());
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const eraEscritorio = useRef<boolean | null>(null);
  /** Bloque que se está arrastrando, disponible de inmediato en el drop. */
  const refArrastrando = useRef<string | null>(null);

  // En celular todo arranca plegado menos el primero, que es el que
  // siempre se toca (identificación).
  //
  // Se compara contra el valor anterior en vez de usar una bandera de
  // "ya se inicializó": con la bandera, al abrir en escritorio y luego
  // estrechar la ventana (o girar una tablet) los bloques se quedaban
  // todos abiertos, que es justo el scroll interminable que se quería
  // evitar.
  useEffect(() => {
    if (esEscritorio === null) return;
    const antes = eraEscritorio.current;
    eraEscritorio.current = esEscritorio;
    if (esEscritorio) {
      // En escritorio no hay plegado: se limpia para no arrastrar estado.
      if (antes !== true) setPlegados(new Set());
      return;
    }
    // Entramos a móvil (primera carga o al estrechar): plegar todo menos el primero.
    if (antes !== false) setPlegados(new Set(bloques.slice(1).map(b => b.id)));
  }, [esEscritorio]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (id: string) =>
    setPlegados(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });

  const soltar = (destino: string) => {
    // Se lee del ref y no del estado: `setArrastrando` no se ha aplicado
    // todavía cuando el navegador dispara el drop en el mismo ciclo, y el
    // reordenamiento se perdía en silencio. El estado se conserva solo
    // para el efecto visual (opacidad del bloque que se mueve).
    const origen = refArrastrando.current;
    if (!origen || origen === destino) {
      setEncima(null);
      return;
    }
    const nuevo = orden.filter(id => id !== origen);
    nuevo.splice(nuevo.indexOf(destino), 0, origen);
    guardar(nuevo);
    refArrastrando.current = null;
    setArrastrando(null);
    setEncima(null);
  };

  const porId = new Map(bloques.map(b => [b.id, b]));
  const ordenados = orden.map(id => porId.get(id)).filter(Boolean) as DefBloque[];

  // Antes de saber el ancho se pinta la versión simple: evita que el
  // formulario "salte" de plegado a desplegado al hidratar.
  if (esEscritorio === null) {
    return (
      <div className="space-y-5">
        {bloques.map(b => (
          <div key={b.id} className="card p-5 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{b.titulo}</p>
            {b.contenido}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {esEscritorio && personalizado && (
        <button
          type="button"
          onClick={restablecer}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-soft ml-auto"
        >
          <RotateCcw size={11} /> Restablecer el orden
        </button>
      )}

      {ordenados.map(b => {
        const plegado = !esEscritorio && plegados.has(b.id);
        const movible = esEscritorio && !b.fijo;

        return (
          <div
            key={b.id}
            draggable={movible}
            onDragStart={e => {
              refArrastrando.current = b.id;
              setArrastrando(b.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => { refArrastrando.current = null; setArrastrando(null); setEncima(null); }}
            onDragOver={e => { if (movible) { e.preventDefault(); setEncima(b.id); } }}
            onDragLeave={() => setEncima(null)}
            onDrop={e => { e.preventDefault(); soltar(b.id); }}
            className={cn(
              "card overflow-hidden transition-all",
              arrastrando === b.id && "opacity-40",
              encima === b.id && arrastrando !== b.id && "ring-2",
            )}
            style={encima === b.id && arrastrando !== b.id ? { "--tw-ring-color": "var(--brand-color)" } as React.CSSProperties : undefined}
          >
            <div
              className={cn(
                "flex items-center gap-2 px-5 py-4",
                !esEscritorio && "cursor-pointer select-none active:surface-2",
                movible && "cursor-grab active:cursor-grabbing",
              )}
              onClick={() => { if (!esEscritorio) alternar(b.id); }}
              role={!esEscritorio ? "button" : undefined}
              aria-expanded={!esEscritorio ? !plegado : undefined}
            >
              {movible && <GripVertical size={14} className="text-gray-300 flex-shrink-0" aria-hidden />}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex-1">{b.titulo}</p>
              {!esEscritorio && (
                <ChevronDown
                  size={16}
                  className={cn("text-muted transition-transform flex-shrink-0", !plegado && "rotate-180")}
                />
              )}
            </div>

            {!plegado && <div className="px-5 pb-5 space-y-4">{b.contenido}</div>}
          </div>
        );
      })}
    </div>
  );
}
