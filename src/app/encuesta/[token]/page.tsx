"use client";

// ============================================================
// La encuesta que contesta el cliente.
//
// Pública y sin cuenta: se llega por el enlace del correo. Vive en el
// mismo dominio que las cotizaciones porque es el que el cliente ya
// conoce — es donde vio su oferta.
//
// Dos decisiones sobre el formulario:
//
//   1. La escala son BOTONES del 0 al 10, no un desplegable ni un
//      deslizador. En un teléfono, un desplegable de once opciones son
//      dos toques y una lista que tapa la pregunta; un deslizador no
//      deja ver qué número quedó. Once botones se tocan una vez.
//   2. Solo la primera pregunta es obligatoria. Exigir las ocho hace que
//      la gente abandone a la mitad, y media encuesta vale más que
//      ninguna.
// ============================================================

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  PREGUNTA_NPS, PREGUNTAS_SATISFACCION, PREGUNTA_RECOMPRA, type Pregunta,
} from "@/lib/encuesta-preguntas";

const AMARILLO = "#ffdd00";
const NEGRO = "#11110f";

function Escala({
  pregunta, valor, onCambio,
}: {
  pregunta: Pregunta;
  valor: number | undefined;
  onCambio: (v: number) => void;
}) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend style={{ padding: 0, marginBottom: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: NEGRO, lineHeight: 1.3 }}>
          {pregunta.texto}
        </span>
      </legend>
      {pregunta.ayuda && (
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#6b6f6a" }}>{pregunta.ayuda}</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {Array.from({ length: 11 }, (_, n) => {
          const activo = valor === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onCambio(n)}
              aria-label={`${n} de 10`}
              aria-pressed={activo}
              style={{
                flex: "1 1 34px",
                minWidth: 34,
                height: 42,
                borderRadius: 8,
                border: activo ? `2px solid ${NEGRO}` : "1px solid #dcdcd4",
                background: activo ? NEGRO : "#fff",
                color: activo ? AMARILLO : "#4a4d47",
                fontSize: 14,
                fontWeight: activo ? 800 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background .12s, color .12s",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: "#8c8f88" }}>{pregunta.bajo}</span>
        <span style={{ fontSize: 11, color: "#8c8f88" }}>{pregunta.alto}</span>
      </div>
    </fieldset>
  );
}

function Bloque({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e6e6de",
      borderRadius: 12,
      padding: "20px 18px",
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function EncuestaContent() {
  const { token } = useParams<{ token: string }>();
  const [r, setR] = useState<Record<string, number>>({});
  const [destacaria, setDestacaria] = useState("");
  const [recomendaciones, setRecomendaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["encuesta", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/encuesta/${token}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as { yaRespondida: boolean; cliente: string | null; pedido: string | null };
    },
    retry: false,
  });

  const set = (campo: string) => (v: number) => setR(p => ({ ...p, [campo]: v }));

  const enviar = async () => {
    if (r.recomendaria === undefined) {
      setError("Falta la primera pregunta.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/encuesta/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...r, destacaria, recomendaciones }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "No se pudo guardar."); return; }
      setListo(true);
      window.scrollTo({ top: 0 });
    } catch {
      setError("No hay conexión. Inténtelo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const marco = (contenido: React.ReactNode) => (
    <main style={{
      minHeight: "100vh",
      background: "#f6f6f2",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      color: NEGRO,
      padding: "0 0 60px",
    }}>
      <div style={{ height: 6, background: AMARILLO }} />
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "0 16px" }}>{contenido}</div>
    </main>
  );

  if (isLoading) {
    return marco(<p style={{ padding: "60px 0", textAlign: "center", color: "#6b6f6a" }}>Un momento…</p>);
  }

  if (!data) {
    return marco(
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Este enlace no funciona</h1>
        <p style={{ color: "#6b6f6a", fontSize: 14 }}>
          Puede que la encuesta ya no exista. Escríbanos y se lo reenviamos.
        </p>
      </div>,
    );
  }

  if (listo || data.yaRespondida) {
    return marco(
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: NEGRO,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 18px", color: AMARILLO, fontSize: 26, fontWeight: 800,
        }}>
          ✓
        </div>
        <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>
          {listo ? "Gracias por contestar" : "Esta encuesta ya se contestó"}
        </h1>
        <p style={{ color: "#6b6f6a", fontSize: 14.5, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
          {listo
            ? "Lo leemos todo. Si algo no quedó bien, nos vamos a comunicar con usted."
            : "Ya tenemos su respuesta. Gracias por el tiempo."}
        </p>
      </div>,
    );
  }

  return marco(
    <>
      <header style={{ padding: "36px 0 22px" }}>
        <p style={{
          margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em",
          textTransform: "uppercase", color: "#8c8f88",
        }}>
          Costamallas{data.pedido ? ` · ${data.pedido}` : ""}
        </p>
        <h1 style={{ fontSize: 26, lineHeight: 1.15, margin: "0 0 10px", fontWeight: 800 }}>
          ¿Cómo nos fue?
        </h1>
        <p style={{ margin: 0, color: "#6b6f6a", fontSize: 14.5, lineHeight: 1.6 }}>
          {data.cliente ? `${data.cliente}, ya ` : "Ya "}terminamos el trabajo y queremos saber qué tal.
          Son dos minutos. Solo la primera pregunta es obligatoria.
        </p>
      </header>

      {error && (
        <div style={{
          background: "#fbeceb", border: "1px solid #f0c8c4", borderRadius: 10,
          padding: "12px 14px", marginBottom: 14, color: "#b3261e", fontSize: 13.5,
        }}>
          {error}
        </div>
      )}

      <Bloque>
        <Escala pregunta={PREGUNTA_NPS} valor={r.recomendaria} onCambio={set("recomendaria")} />
      </Bloque>

      <Bloque>
        <p style={{
          margin: "0 0 16px", fontSize: 11, fontWeight: 700, letterSpacing: ".12em",
          textTransform: "uppercase", color: "#8c8f88",
        }}>
          Del 0 al 10
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {PREGUNTAS_SATISFACCION.map(p => (
            <Escala key={p.campo} pregunta={p} valor={r[p.campo]} onCambio={set(p.campo)} />
          ))}
        </div>
      </Bloque>

      <Bloque>
        <Escala pregunta={PREGUNTA_RECOMPRA} valor={r.recompra} onCambio={set("recompra")} />
      </Bloque>

      <Bloque>
        <label htmlFor="destacaria" style={{ display: "block", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          ¿Qué destacaría de nosotros?
        </label>
        <textarea
          id="destacaria"
          value={destacaria}
          onChange={e => setDestacaria(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Lo que le pareció bien."
          style={{
            width: "100%", border: "1px solid #dcdcd4", borderRadius: 8, padding: "10px 12px",
            fontSize: 14, fontFamily: "inherit", resize: "vertical", background: "#fff", color: NEGRO,
          }}
        />

        <label htmlFor="recomendaciones" style={{ display: "block", fontSize: 15, fontWeight: 600, margin: "18px 0 8px" }}>
          ¿Qué deberíamos mejorar?
        </label>
        <textarea
          id="recomendaciones"
          value={recomendaciones}
          onChange={e => setRecomendaciones(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Con toda confianza: preferimos enterarnos por usted."
          style={{
            width: "100%", border: "1px solid #dcdcd4", borderRadius: 8, padding: "10px 12px",
            fontSize: 14, fontFamily: "inherit", resize: "vertical", background: "#fff", color: NEGRO,
          }}
        />
      </Bloque>

      <button
        onClick={enviar}
        disabled={enviando}
        style={{
          width: "100%", padding: "15px 20px", borderRadius: 10, border: 0,
          background: NEGRO, color: AMARILLO, fontSize: 15, fontWeight: 800,
          cursor: enviando ? "default" : "pointer", opacity: enviando ? 0.6 : 1,
          fontFamily: "inherit", letterSpacing: ".02em",
        }}
      >
        {enviando ? "Enviando…" : "Enviar mi respuesta"}
      </button>

      <p style={{ textAlign: "center", marginTop: 18, fontSize: 11.5, color: "#8c8f88", lineHeight: 1.6 }}>
        Costamallas · 3006078956 – 3245912653 · ventas@costamallas.com
      </p>
    </>,
  );
}

export default function Page() {
  return <Suspense><EncuestaContent /></Suspense>;
}
