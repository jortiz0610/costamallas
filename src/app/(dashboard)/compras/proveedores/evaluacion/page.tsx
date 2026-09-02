"use client";

// ============================================================
// Formato para la Selección de Proveedores y Contratistas.
//
// El mismo formulario que vivía en Google Forms, con sus mismas
// preguntas y sus mismos porcentajes.
//
// Lo que cambia al traerlo:
//
//   · El puntaje se ve MIENTRAS se contesta. En Forms salía después, en
//     una hoja, y en la práctica nadie lo miraba.
//   · Los porcentajes están a la vista al lado de cada opción. Estaban en
//     el formulario original —"Inmediata (100%)"— y quitarlos habría
//     hecho que quien contesta no supiera qué está puntuando.
//   · El visto bueno de gerencia exige permiso. En Forms era un campo de
//     texto que decía "SOLO LA GERENCIA ADMINISTRATIVA" y confiaba en que
//     nadie más lo escribiera.
// ============================================================

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, ShieldCheck, X, Minus } from "lucide-react";
import toast from "react-hot-toast";
import { Topbar } from "@/components/layout/Topbar";
import { useBrand } from "@/contexts/BrandContext";
import {
  DOCUMENTOS, TIEMPOS_ENTREGA, OPCIONES_PAGO, TIPOS_PROVEEDOR,
  calcularPuntaje, lecturaPuntaje, documentosEnBlanco,
  type RespuestaDocumento, type ValorDocumento,
} from "@/lib/evaluacion-proveedor";

interface Proveedor { id: string; nombre: string }

const OPCIONES_DOC: { v: ValorDocumento; l: string; Icon: React.ElementType; color: string }[] = [
  { v: "SI", l: "Sí", Icon: Check, color: "#16a34a" },
  { v: "NO", l: "No", Icon: X, color: "#dc2626" },
  { v: "NA", l: "No aplica", Icon: Minus, color: "#94a3b8" },
];

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-4">{titulo}</p>
      {children}
    </div>
  );
}

function Contenido() {
  const { brand } = useBrand();
  const router = useRouter();

  const [tipo, setTipo] = useState("");
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [documentos, setDocumentos] = useState<RespuestaDocumento[]>(documentosEnBlanco());
  const [tiempoEntrega, setTiempoEntrega] = useState("");
  const [opcionPago, setOpcionPago] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { data: proveedores = [] } = useQuery<Proveedor[]>({
    queryKey: ["proveedores-lista"],
    queryFn: async () => (await (await fetch("/api/compras/proveedores")).json()).data ?? [],
  });

  // Se recalcula en cada tecla: ver el número moverse mientras se
  // contesta es lo que hace que alguien se detenga a pensar la respuesta.
  const puntaje = useMemo(
    () => calcularPuntaje({ documentos, tiempoEntrega, opcionPago }),
    [documentos, tiempoEntrega, opcionPago],
  );
  const lectura = lecturaPuntaje(puntaje.total);

  const marcar = (clave: string, valor: ValorDocumento) =>
    setDocumentos(ds => ds.map(d => (d.clave === clave ? { ...d, valor } : d)));

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch("/api/compras/evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo, nombre, documento,
          proveedorId: proveedorId || null,
          documentos, tiempoEntrega, opcionPago,
        }),
      });
      const j = await r.json();
      if (!j.success) { toast.error(j.error ?? "No se pudo guardar"); return; }
      toast.success("Evaluación guardada");
      router.push("/compras");
    } catch {
      toast.error("Sin conexión");
    } finally { setGuardando(false); }
  };

  const listo = Boolean(tipo && nombre.trim() && documento.trim());

  return (
    <>
      <Topbar title="Selección de proveedores" actions={
        <button onClick={() => router.push("/compras")} className="btn-secondary btn-sm">
          <ArrowLeft size={13} /> Volver
        </button>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4 pb-8">

          <Bloque titulo="A quién se evalúa">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  Tipo de proveedor
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_PROVEEDOR.map(t => (
                    <button key={t.v} onClick={() => setTipo(t.v)}
                      className="px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all"
                      style={tipo === t.v
                        ? { backgroundColor: brand.brandColor, color: "#fff", borderColor: brand.brandColor }
                        : { borderColor: "var(--divider)", color: "var(--text-muted)" }}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre</label>
                  <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
                    placeholder="Razón social o nombre completo" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    NIT o número de documento
                  </label>
                  <input className="input" value={documento} onChange={e => setDocumento(e.target.value)} />
                </div>
              </div>

              {proveedores.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                    ¿Ya está en la lista de proveedores?
                  </label>
                  <select className="input" value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
                    <option value="">Todavía no — es uno nuevo</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                    Si lo enlazas, la evaluación queda colgada de su ficha y no hay que buscarla aparte.
                  </p>
                </div>
              )}
            </div>
          </Bloque>

          <Bloque titulo="Criterios de selección · documentos">
            <div className="space-y-3">
              {DOCUMENTOS.map(d => {
                const actual = documentos.find(x => x.clave === d.clave)?.valor ?? "NA";
                return (
                  <div key={d.clave} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-1">
                    <span className="text-[13.5px] text-soft flex-1 leading-snug">{d.texto}</span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {OPCIONES_DOC.map(o => {
                        const Icon = o.Icon;
                        const on = actual === o.v;
                        return (
                          <button key={o.v} onClick={() => marcar(d.clave, o.v)}
                            title={o.v === "NA" ? "No cuenta para el puntaje" : `${o.l} (${o.v === "SI" ? "100" : "0"}%)`}
                            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[12px] font-bold border transition-all"
                            style={on
                              ? { backgroundColor: o.color, color: "#fff", borderColor: o.color }
                              : { borderColor: "var(--divider)", color: "var(--text-muted)" }}>
                            <Icon size={12} /> {o.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
              <strong>No aplica</strong> no resta: se saca del promedio. Si restara, marcarlo castigaría al
              proveedor por algo que no le corresponde y todos aprenderían a marcar «sí».
            </p>
          </Bloque>

          <Bloque titulo="Tiempo de entrega del servicio y/o insumo">
            <div className="flex flex-wrap gap-2">
              {TIEMPOS_ENTREGA.map(t => (
                <button key={t.v} onClick={() => setTiempoEntrega(t.v)}
                  className="px-3.5 py-2.5 rounded-xl text-[13px] font-semibold border transition-all"
                  style={tiempoEntrega === t.v
                    ? { backgroundColor: brand.brandColor, color: "#fff", borderColor: brand.brandColor }
                    : { borderColor: "var(--divider)", color: "var(--text-muted)" }}>
                  {t.l} <span className="opacity-70 font-normal">({t.pct}%)</span>
                </button>
              ))}
            </div>
          </Bloque>

          <Bloque titulo="Opciones de pago">
            <div className="flex flex-wrap gap-2">
              {OPCIONES_PAGO.map(o => (
                <button key={o.v} onClick={() => setOpcionPago(o.v)}
                  className="px-3.5 py-2.5 rounded-xl text-[13px] font-semibold border transition-all"
                  style={opcionPago === o.v
                    ? { backgroundColor: brand.brandColor, color: "#fff", borderColor: brand.brandColor }
                    : { borderColor: "var(--divider)", color: "var(--text-muted)" }}>
                  {o.l} <span className="opacity-70 font-normal">({o.pct}%)</span>
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
              Puntúa más el crédito largo porque le cuesta menos flujo de caja a la empresa, no porque
              sea mejor proveedor.
            </p>
          </Bloque>

          {/* El puntaje, mientras se contesta. */}
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                style={{ backgroundColor: lectura.color + "1a" }}>
                <span className="text-[26px] font-bold leading-none tabular-nums" style={{ color: lectura.color }}>
                  {puntaje.total ?? "—"}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: lectura.color }}>
                  de 100
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold" style={{ color: lectura.color }}>{lectura.etiqueta}</p>
                <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{lectura.ayuda}</p>
                <p className="text-[11.5px] text-muted mt-2">
                  Documentos {puntaje.documentos ?? "—"} · Entrega {puntaje.entrega ?? "—"} · Pago {puntaje.pago ?? "—"}
                  {puntaje.noAplican > 0 && ` · ${puntaje.noAplican} no aplican`}
                </p>
              </div>
            </div>

            {puntaje.faltantes.length > 0 && (
              <div className="mt-4 pt-4 border-t divider">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                  Lo que hay que pedirle
                </p>
                <ul className="space-y-1">
                  {puntaje.faltantes.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] text-soft leading-snug">
                      <X size={12} className="text-red-500 flex-shrink-0 mt-1" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="flex items-start gap-1.5 text-[11.5px] text-muted mt-4 leading-relaxed">
              <ShieldCheck size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                El puntaje orienta; no decide. El visto bueno lo da la gerencia administrativa desde la
                lista de evaluaciones.
              </span>
            </p>
          </div>

          <button onClick={guardar} disabled={!listo || guardando}
            className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: brand.brandColor }}>
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Guardar evaluación
          </button>
          {!listo && (
            <p className="text-[11.5px] text-muted text-center">
              Faltan el tipo, el nombre y el documento.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Contenido /></Suspense>;
}
