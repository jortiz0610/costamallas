"use client";

// ============================================================
// Buscar en todo el portal desde cualquier pantalla.
//
// Se abre con Ctrl+K (⌘K en Mac) o con la lupa de la barra. Busca a la
// vez en clientes, cotizaciones, pedidos y productos.
//
// Existe porque hoy hay que acordarse de en QUÉ módulo estaba lo que se
// busca antes de poder buscarlo: si el cliente preguntó por su pedido y
// uno solo recuerda el nombre de la empresa, hay que ir a Clientes,
// abrir la ficha y desde ahí a Pedidos. Tres pantallas para llegar a un
// número.
//
// El servidor filtra por permisos y por alcance: esto no es una puerta
// trasera al CRM de los demás.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, Loader2, UserCircle, ClipboardList, ShoppingCart, Package, CornerDownLeft,
} from "lucide-react";

interface Resultado {
  tipo: "cliente" | "cotizacion" | "pedido" | "producto";
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  marca?: string;
}

const META: Record<Resultado["tipo"], { l: string; Icon: React.ElementType; color: string }> = {
  cliente:    { l: "Cliente",     Icon: UserCircle,    color: "#BA7517" },
  cotizacion: { l: "Cotización",  Icon: ClipboardList, color: "#BA7517" },
  pedido:     { l: "Pedido",      Icon: ShoppingCart,  color: "#185FA5" },
  producto:   { l: "Producto",    Icon: Package,       color: "#185FA5" },
};

const ORDEN: Resultado["tipo"][] = ["cliente", "cotizacion", "pedido", "producto"];

export function BuscadorGlobal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Ctrl+K / ⌘K ──
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto(v => !v);
      }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 40);
    else { setQ(""); setResultados([]); setI(0); }
  }, [abierto]);

  // ── Buscar, con freno ──
  // 250 ms: se escribe "malla" y salen cinco peticiones si no se frena.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(texto)}`);
        const json = await res.json();
        setResultados(json.success ? json.data : []);
        setI(0);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const ir = useCallback((r: Resultado) => {
    setAbierto(false);
    router.push(r.href);
  }, [router]);

  // ── Teclado dentro del buscador ──
  useEffect(() => {
    if (!abierto) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAbierto(false); return; }
      if (!resultados.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setI(v => (v + 1) % resultados.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setI(v => (v - 1 + resultados.length) % resultados.length); }
      else if (e.key === "Enter") { e.preventDefault(); if (resultados[i]) ir(resultados[i]); }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [abierto, resultados, i, ir]);

  // Se agrupan por tipo pero se numeran seguido: las flechas recorren la
  // lista entera, que es como espera moverse quien no suelta el teclado.
  let n = -1;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title="Buscar en todo el portal (Ctrl+K)"
        aria-label="Buscar"
        className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700"
      >
        <Search size={15} />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[8vh] sm:pt-[12vh]"
          onClick={() => setAbierto(false)}
        >
          <div
            className="card w-full max-w-xl flex flex-col overflow-hidden max-h-[76vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b divider flex-shrink-0">
              <Search size={16} className="text-muted flex-shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cliente, cotización, pedido o producto…"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
              />
              {buscando && <Loader2 size={14} className="animate-spin text-muted flex-shrink-0" />}
              <button
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:surface-2 flex-shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="px-4 py-8 text-center text-[12.5px] text-muted">
                  Escribe al menos dos letras. Busca por nombre, número, SKU, NIT o teléfono.
                </p>
              ) : !buscando && resultados.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12.5px] text-muted">
                  Nada coincide con «{q.trim()}».
                </p>
              ) : (
                ORDEN.map(tipo => {
                  const grupo = resultados.filter(r => r.tipo === tipo);
                  if (!grupo.length) return null;
                  const meta = META[tipo];
                  return (
                    <div key={tipo}>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted">
                        {meta.l}
                      </p>
                      {grupo.map(r => {
                        n += 1;
                        const activo = n === i;
                        const idx = n;
                        return (
                          <button
                            key={r.id}
                            onMouseEnter={() => setI(idx)}
                            onClick={() => ir(r)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${activo ? "surface-2" : ""}`}
                          >
                            <meta.Icon size={15} className="flex-shrink-0" style={{ color: meta.color }} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate">
                                {r.titulo}
                              </span>
                              <span className="block text-[11px] text-muted truncate">{r.detalle}</span>
                            </span>
                            {r.marca && (
                              <span className="text-[10.5px] text-muted flex-shrink-0 hidden sm:block">{r.marca}</span>
                            )}
                            {activo && <CornerDownLeft size={12} className="text-muted flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 border-t divider flex items-center gap-3 text-[10px] text-muted flex-shrink-0">
              <span>↑↓ moverse</span>
              <span>↵ abrir</span>
              <span>esc cerrar</span>
              <span className="ml-auto hidden sm:inline">Ctrl+K desde cualquier pantalla</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
