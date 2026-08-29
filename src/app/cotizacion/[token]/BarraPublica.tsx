"use client";

// ============================================================
// Lo que el cliente puede HACER con su cotización.
//
// Antes era una barra pegada arriba con cuatro botones en fila. En el
// teléfono —que es donde se abre casi siempre, porque el enlace llega
// por WhatsApp— los botones se envolvían y la barra crecía hasta comerse
// media pantalla del documento.
//
// Ahora son dos piezas:
//   · Arriba, una franja delgada de INFORMACIÓN: número y vigencia. No
//     tiene botones, así que no crece.
//   · Abajo, una barra de ACCIONES fija, como la de un carrito. El
//     documento lleva relleno inferior para que nunca quede tapado.
//
// **Aprobar pide confirmación.** Aceptar una oferta es un compromiso de
// plata, y en un teléfono el dedo roza cualquier cosa. La confirmación
// no es un `confirm()` del navegador: es un panel que repite el número
// de la cotización y obliga a pulsar "Sí, la apruebo".
//
// **No hay botón de rechazar, a propósito.** Un "no" se dice hablando:
// si el cliente pulsa rechazar, el asesor pierde la conversación que
// habría tenido y la oferta muere sin que nadie sepa por qué. Para eso
// está el botón de escribir.
// ============================================================

import { useState } from "react";
import { Printer, MessageCircle, FileText, Check, Loader2, X, ShieldCheck } from "lucide-react";

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";
const VERDE = "#1fae5b";

interface Props {
  numero: string;
  vencida: boolean;
  venceEl: string;
  asesor: string | null;
  telefono: string | null;
  /** El token del enlace: con él se aprueba. */
  token: string;
  /** Estado real, para saber si el botón de aprobar tiene sentido. */
  estado: string;
  /** Está esperando visto bueno interno por descuento o anticipo. */
  enRevision: boolean;
}

export function BarraPublica({
  numero, vencida, venceEl, asesor, telefono, token, estado, enRevision,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aprobada, setAprobada] = useState(estado === "APROBADA");
  const [error, setError] = useState<string | null>(null);

  // El wa.me necesita el número sin espacios ni signos y con indicativo.
  const wa = telefono ? telefono.replace(/\D/g, "").replace(/^0+/, "") : null;
  const waLink = wa
    ? `https://wa.me/${wa.length <= 10 ? `57${wa}` : wa}?text=${encodeURIComponent(`Hola, sobre la cotización ${numero}…`)}`
    : null;

  const puedeAprobar = !aprobada && !vencida && !enRevision && estado === "ENVIADA";

  const aprobar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/cotizacion/${token}/aprobar`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "No se pudo registrar la aprobación. Escríbenos y lo resolvemos.");
        return;
      }
      setAprobada(true);
      setConfirmando(false);
    } catch {
      setError("No hay conexión. Inténtalo de nuevo o escríbenos por WhatsApp.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {/* ── Franja de información, arriba. Sin botones: no crece. ── */}
      <div className="no-print sticky top-0 z-20" style={{ backgroundColor: NEGRO }}>
        <div className="mx-auto px-5 py-2.5 flex items-center gap-3" style={{ maxWidth: "210mm" }}>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-black uppercase tracking-tight m-0 truncate">
              Cotización {numero}
            </p>
            <p className="text-[11px] m-0 truncate" style={{ color: vencida ? "#ff6b6b" : "rgba(255,255,255,.55)" }}>
              {aprobada
                ? "Aprobada — gracias por la confianza"
                : vencida
                  ? `Venció el ${venceEl} — escríbenos y la actualizamos`
                  : `Válida hasta el ${venceEl}`}
              {asesor && ` · ${asesor}`}
            </p>
          </div>
          {aprobada && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide flex-shrink-0"
              style={{ backgroundColor: VERDE, color: "#fff" }}
            >
              <Check size={13} /> Aprobada
            </span>
          )}
        </div>
      </div>

      {/* ── Acciones, abajo. El documento lleva relleno para no quedar
             tapado (ver el padding-bottom de la página). ── */}
      <div
        className="no-print fixed bottom-0 left-0 right-0 z-20"
        style={{
          backgroundColor: "rgba(17,17,15,.97)",
          borderTop: `3px solid ${AMARILLO}`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto px-4 py-2.5 flex items-center gap-2" style={{ maxWidth: "210mm" }}>
          {/* Secundarios: icono a secas en móvil, con texto en pantalla grande. */}
          <a
            href="/politicas" target="_blank" rel="noreferrer"
            title="Políticas de envío, devoluciones y datos"
            className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 flex-shrink-0"
            style={{ color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.25)" }}
          >
            <FileText size={14} /> <span className="hidden sm:inline">Políticas</span>
          </a>

          <button
            onClick={() => window.print()}
            title="Descargar en PDF"
            className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 flex-shrink-0"
            style={{ color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.25)" }}
          >
            <Printer size={14} /> <span className="hidden sm:inline">PDF</span>
          </button>

          {waLink && (
            <a
              href={waLink} target="_blank" rel="noreferrer"
              className="px-3 py-2.5 text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 flex-shrink-0"
              style={{ backgroundColor: VERDE, color: "#fff" }}
            >
              <MessageCircle size={14} /> <span className="hidden sm:inline">Escribir</span>
            </a>
          )}

          {/* El principal ocupa el resto del ancho: es lo que se quiere
              que se pulse, y en un teléfono el tamaño ES la jerarquía. */}
          {aprobada ? (
            <div
              className="flex-1 py-2.5 text-[12px] font-black uppercase tracking-wide flex items-center justify-center gap-2"
              style={{ backgroundColor: "rgba(31,174,91,.15)", color: VERDE }}
            >
              <Check size={15} /> Aprobada
            </div>
          ) : puedeAprobar ? (
            <button
              onClick={() => setConfirmando(true)}
              className="flex-1 py-2.5 text-[12px] font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              style={{ backgroundColor: AMARILLO, color: NEGRO }}
            >
              <Check size={15} /> Aprobar esta cotización
            </button>
          ) : (
            <div className="flex-1 text-[10.5px] text-right sm:text-center" style={{ color: "rgba(255,255,255,.45)" }}>
              {vencida
                ? "Escríbenos y te preparamos una nueva"
                : enRevision
                  ? "En revisión: tu asesor te confirma en breve"
                  : ""}
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 pb-2.5 mx-auto text-[11px]" style={{ maxWidth: "210mm", color: "#ff9b9b" }}>
            {error}
          </div>
        )}
      </div>

      {/* ── La confirmación ── */}
      {confirmando && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,.6)" }}
          onClick={() => !enviando && setConfirmando(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white"
            style={{ borderTop: `5px solid ${AMARILLO}` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div
                  className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: AMARILLO }}
                >
                  <ShieldCheck size={22} style={{ color: NEGRO }} />
                </div>
                <button
                  onClick={() => setConfirmando(false)}
                  disabled={enviando}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-40"
                >
                  <X size={20} />
                </button>
              </div>

              <h2 className="text-[17px] font-black uppercase tracking-tight mt-4 mb-1" style={{ color: NEGRO }}>
                ¿Apruebas la cotización {numero}?
              </h2>
              <p className="text-[13px] leading-relaxed" style={{ color: "#5b5f59" }}>
                Al aprobarla nos autorizas a preparar tu pedido con los productos, cantidades y
                precios de este documento. Tu asesor se comunica contigo enseguida para coordinar
                el anticipo y la fecha.
              </p>
              <p className="text-[12px] mt-3" style={{ color: "#8a8f88" }}>
                Si necesitas cambiar algo, cierra esto y escríbenos: lo ajustamos antes.
              </p>
            </div>

            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setConfirmando(false)}
                disabled={enviando}
                className="flex-1 py-3 text-[12px] font-bold uppercase tracking-wide disabled:opacity-40"
                style={{ border: "1px solid #d6d8d3", color: "#5b5f59" }}
              >
                No, todavía
              </button>
              <button
                onClick={aprobar}
                disabled={enviando}
                className="flex-1 py-3 text-[12px] font-black uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: NEGRO, color: AMARILLO }}
              >
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Sí, la apruebo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
