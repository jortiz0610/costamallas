"use client";

// ============================================================
// Sembli — agente de IA de Sembla · by ESEK
//
// Reemplaza el antiguo AsistenteIA de "modo reglas": ahora habla con
// /api/sembli/chat, que corre el agente real con herramientas. El nivel
// de acceso lo decide el servidor a partir del JWT; aquí solo se pinta.
//
// En móvil abre como hoja a pantalla completa; en escritorio, como panel
// flotante.
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send, Loader2, Wrench, ShieldCheck, RotateCcw } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { cn } from "@/lib/utils";
import { usaRedactor } from "@/components/layout/BotonesFlotantes";

type Turno = { rol: "user" | "assistant"; texto: string; herramientas?: string[] };

const SALUDO =
  "Hola 👋 Soy **Sembli**. Puedo consultar el sistema por ti: productos, stock, clientes, " +
  "cotizaciones, pedidos e indicadores — según tu nivel de acceso. ¿Qué necesitas?";

const ETIQUETA_NIVEL: Record<string, { texto: string; color: string }> = {
  CLIENTE: { texto: "Cliente", color: "#0ea5e9" },
  VENDEDOR: { texto: "Asesor", color: "#16a34a" },
  ADMIN: { texto: "Gerencia", color: "#d97706" },
  SUPERADMIN: { texto: "Superadmin", color: "#7c3aed" },
};

/** Formato ligero: **negrita**, `código` y saltos de línea. */
function formatear(texto: string) {
  return texto.split("\n").map((linea, i) => (
    <span key={i} className="block">
      {linea.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((parte, j) => {
        if (parte.startsWith("**") && parte.endsWith("**")) {
          return (
            <strong key={j} className="font-semibold">
              {parte.slice(2, -2)}
            </strong>
          );
        }
        if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) {
          return (
            <code key={j} className="px-1 py-0.5 rounded surface-2 text-[12px] font-mono">
              {parte.slice(1, -1)}
            </code>
          );
        }
        return <span key={j}>{parte}</span>;
      })}
    </span>
  ));
}

export function Sembli() {
  const { brand } = useBrand();
  const pathname = usePathname();
  // En un chat, este botón caía justo sobre el de enviar.
  const estorba = usaRedactor(pathname);
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([{ rol: "assistant", texto: SALUDO }]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const [nivel, setNivel] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Al abrir por primera vez, preguntamos qué puede hacer este usuario.
  useEffect(() => {
    if (!abierto || nivel) return;
    fetch("/api/sembli/chat")
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) {
          setNivel(j.data.nivel);
          setSugerencias(j.data.sugerencias ?? []);
        }
      })
      .catch(() => undefined);
  }, [abierto, nivel]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turnos, pensando]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  const enviar = useCallback(
    async (texto: string) => {
      const limpio = texto.trim();
      if (!limpio || pensando) return;

      // Se manda el historial previo (sin el turno nuevo, que va aparte).
      const historial = turnos
        .filter((t) => t.texto !== SALUDO)
        .map((t) => ({ rol: t.rol, texto: t.texto }));

      setTurnos((t) => [...t, { rol: "user", texto: limpio }]);
      setEntrada("");
      setPensando(true);

      try {
        const res = await fetch("/api/sembli/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensaje: limpio, historial, contexto: `El usuario está en la pantalla ${pathname}` }),
        });
        const j = await res.json();

        if (j?.success) {
          setNivel(j.data.nivel);
          setTurnos((t) => [
            ...t,
            { rol: "assistant", texto: j.data.respuesta, herramientas: j.data.herramientasUsadas },
          ]);
        } else if (j?.sinClave) {
          setTurnos((t) => [
            ...t,
            {
              rol: "assistant",
              texto:
                "Todavía no estoy activado 🔌. Un **superadministrador** debe cargar la API key de Claude " +
                "en **Configuración → IA** (o correr `npm run sembli:activar`).",
            },
          ]);
        } else {
          setTurnos((t) => [
            ...t,
            { rol: "assistant", texto: `No pude responder: ${j?.error ?? "error desconocido"}` },
          ]);
        }
      } catch {
        setTurnos((t) => [
          ...t,
          { rol: "assistant", texto: "Se cayó la conexión. Revisa tu internet e intenta de nuevo." },
        ]);
      } finally {
        setPensando(false);
      }
    },
    [pensando, turnos, pathname],
  );

  const reiniciar = () => setTurnos([{ rol: "assistant", texto: SALUDO }]);
  const insignia = nivel ? ETIQUETA_NIVEL[nivel] : null;

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className={`${estorba ? "hidden lg:flex" : "flex"} fixed bottom-20 lg:bottom-6 right-4 sm:right-5 lg:right-6 z-40 w-14 h-14 rounded-2xl shadow-lg items-center justify-center transition-transform active:scale-95 hover:scale-105`}
        style={{ background: `linear-gradient(135deg, ${brand.brandColor}, ${brand.brandColor}bb)` }}
        aria-label={abierto ? "Cerrar Sembli" : "Abrir Sembli"}
      >
        {abierto ? <X size={22} className="text-white" /> : <Sparkles size={24} className="text-white" />}
      </button>

      {abierto && (
        <>
          {/* Fondo oscuro solo en móvil, para que la hoja se lea bien */}
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setAbierto(false)}
            aria-hidden
          />

          <div
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden card animate-fade-up",
              // Móvil: hoja pegada abajo, casi pantalla completa.
              "inset-x-0 bottom-0 top-14 rounded-b-none",
              // Escritorio: panel flotante.
              "sm:inset-auto sm:bottom-24 sm:right-6 sm:top-auto sm:w-[380px] sm:h-[560px] sm:max-h-[calc(100vh-9rem)] sm:rounded-2xl",
            )}
            role="dialog"
            aria-label="Sembli, asistente de IA"
          >
            {/* Cabecera */}
            <div
              className="p-4 flex items-center gap-3 flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${brand.brandColor}, ${brand.brandColor}cc)` }}
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Sembli</p>
                <p className="text-[10px] text-white/70 truncate">Sembla · by ESEK</p>
              </div>
              {insignia && (
                <span
                  className="text-[9px] font-bold px-2 py-1 rounded-full bg-white/20 text-white inline-flex items-center gap-1"
                  title={`Tu nivel de acceso: ${insignia.texto}`}
                >
                  <ShieldCheck size={10} /> {insignia.texto}
                </span>
              )}
              <button
                onClick={reiniciar}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/20 flex-shrink-0"
                title="Empezar de nuevo"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => setAbierto(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/20 flex-shrink-0"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Conversación */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
              {turnos.map((t, i) => (
                <div key={i} className={cn("flex", t.rol === "user" ? "justify-end" : "justify-start")}>
                  <div className="max-w-[88%] space-y-1">
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                        t.rol === "user" ? "text-white rounded-br-sm" : "surface-2 text-soft rounded-bl-sm",
                      )}
                      style={t.rol === "user" ? { backgroundColor: brand.brandColor } : undefined}
                    >
                      {formatear(t.texto)}
                    </div>
                    {t.herramientas && t.herramientas.length > 0 && (
                      <p className="text-[10px] text-muted flex items-center gap-1 px-1">
                        <Wrench size={9} />
                        Consultó: {[...new Set(t.herramientas)].join(", ").replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {pensando && (
                <div className="flex justify-start">
                  <div className="surface-2 rounded-2xl px-3.5 py-2.5 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-muted" />
                    <span className="text-[11px] text-muted">consultando el sistema…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sugerencias según el nivel */}
            {turnos.length <= 1 && sugerencias.length > 0 && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg surface-2 text-soft hover:brand-bg-10 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Entrada */}
            <div className="p-3 border-t divider flex items-center gap-2 flex-shrink-0">
              <input
                ref={inputRef}
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar(entrada);
                  }
                }}
                className="input py-2 text-sm"
                placeholder="Pregúntale a Sembli…"
                maxLength={4000}
              />
              <button
                onClick={() => enviar(entrada)}
                disabled={pensando || !entrada.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: brand.brandColor }}
                aria-label="Enviar"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
