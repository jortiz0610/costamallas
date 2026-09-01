"use client";

// ============================================================
// Firmar con el dedo.
//
// Ocupa la pantalla entera, y eso no es un capricho de diseño: una firma
// se hace con el movimiento del brazo, y en un recuadro de 200 px de
// alto sale un garabato que no se parece a la firma de nadie. Ancho
// completo, alto completo, y el papel se gira solo si el teléfono está
// vertical.
//
// Tres detalles que decidieron cómo está escrito:
//
//   1. **Punteros, no `touchstart`.** Un evento de puntero cubre dedo,
//      lápiz digital y ratón con el mismo código, y trae la presión del
//      Apple Pencil sin pedir nada aparte.
//   2. **`touch-action: none` en el lienzo.** Sin eso, el navegador
//      interpreta el trazo como un gesto de desplazamiento y la página
//      se mueve mientras la persona firma. Es el error clásico y es
//      invisible hasta que se prueba en un teléfono de verdad.
//   3. **El lienzo se dimensiona con `devicePixelRatio`.** Un canvas a
//      tamaño CSS en una pantalla retina firma borroso.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";

interface Props {
  /** A quién se le está pidiendo la firma. Sale en la cabecera. */
  titulo?: string;
  onCancelar: () => void;
  onFirmar: (dataUrl: string) => void;
  guardando?: boolean;
}

export function Firma({ titulo = "Firme aquí", onCancelar, onFirmar, guardando }: Props) {
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const trazando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [hayTrazo, setHayTrazo] = useState(false);

  // ── Preparar el lienzo ──
  const preparar = useCallback(() => {
    const c = lienzo.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    // Redimensionar borra el contenido, así que se guarda y se repinta.
    const antes = hayTrazo ? c.toDataURL() : null;

    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);

    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#11110f";
    g.lineWidth = 2.4;
    ctx.current = g;

    if (antes) {
      const img = new Image();
      img.onload = () => g.drawImage(img, 0, 0, r.width, r.height);
      img.src = antes;
    }
  }, [hayTrazo]);

  useEffect(() => {
    preparar();
    window.addEventListener("resize", preparar);
    window.addEventListener("orientationchange", preparar);
    return () => {
      window.removeEventListener("resize", preparar);
      window.removeEventListener("orientationchange", preparar);
    };
    // Solo al montar: repreparar en cada trazo repintaría sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mientras se firma, el fondo no se mueve. En un teléfono, la página
  // desplazándose bajo el dedo arruina la firma y no se entiende por qué.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previo; };
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    trazando.current = true;
    ultimo.current = punto(e);
    // Un toque suelto también deja marca: hay firmas que son un punto.
    const g = ctx.current;
    if (g && ultimo.current) {
      g.beginPath();
      g.arc(ultimo.current.x, ultimo.current.y, 1.2, 0, Math.PI * 2);
      g.fillStyle = "#11110f";
      g.fill();
    }
    setHayTrazo(true);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!trazando.current) return;
    const g = ctx.current;
    const p = punto(e);
    const prev = ultimo.current;
    if (!g || !prev) return;

    // El lápiz digital manda presión; el dedo manda 0.5 o 0. Se usa para
    // engrosar el trazo, con un mínimo para que un dedo no firme fino.
    const presion = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    g.lineWidth = 1.6 + presion * 2.2;

    g.beginPath();
    g.moveTo(prev.x, prev.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    ultimo.current = p;
  };

  const soltar = () => { trazando.current = false; ultimo.current = null; };

  const limpiar = () => {
    const c = lienzo.current;
    const g = ctx.current;
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
  };

  const confirmar = () => {
    const c = lienzo.current;
    if (!c || !hayTrazo) return;
    // Fondo blanco: un PNG transparente se ve como una firma en blanco
    // sobre el fondo oscuro de un lector de correo.
    const plano = document.createElement("canvas");
    plano.width = c.width;
    plano.height = c.height;
    const g = plano.getContext("2d");
    if (!g) return;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, plano.width, plano.height);
    g.drawImage(c, 0, 0);
    onFirmar(plano.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: "#f7f6f0" }}>
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ backgroundColor: "#11110f" }}>
        <button onClick={onCancelar} className="text-white/70 hover:text-white p-1" aria-label="Cancelar">
          <X size={20} />
        </button>
        <p className="flex-1 text-white font-bold text-[15px] truncate">{titulo}</p>
        <button
          onClick={limpiar}
          disabled={!hayTrazo}
          className="flex items-center gap-1.5 text-[12px] font-bold text-white/70 hover:text-white disabled:opacity-30 px-2 py-1"
        >
          <RotateCcw size={14} /> Borrar
        </button>
      </div>

      {/* El papel */}
      <div className="flex-1 p-3 min-h-0">
        <div className="relative w-full h-full rounded-2xl bg-white border-2 border-dashed overflow-hidden"
          style={{ borderColor: "#dcdcd4" }}>
          <canvas
            ref={lienzo}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: "none" }}
            onPointerDown={empezar}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerLeave={soltar}
            onPointerCancel={soltar}
          />
          {!hayTrazo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
              <p className="text-[15px] font-semibold" style={{ color: "#b6bab2" }}>
                Firme con el dedo
              </p>
              <p className="text-[12.5px]" style={{ color: "#c9ccc5" }}>
                Use todo el espacio
              </p>
            </div>
          )}
          {/* La rayita, como en el papel. */}
          <div className="absolute left-8 right-8 pointer-events-none"
            style={{ bottom: "22%", borderBottom: "1px solid #e4e4de" }} />
        </div>
      </div>

      {/* Confirmar */}
      <div className="p-3 pb-5 flex-shrink-0" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
        <button
          onClick={confirmar}
          disabled={!hayTrazo || guardando}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[16px] transition-all disabled:opacity-35"
          style={{ backgroundColor: "#11110f", color: "#ffdd00" }}
        >
          <Check size={19} />
          {guardando ? "Guardando…" : "Listo, firmado"}
        </button>
      </div>
    </div>
  );
}
