"use client";

// ============================================================
// La Orden de Producción de Malla Ciclón, en pantalla.
//
// Se replica el formato de papel TAL CUAL: las mismas secciones, en el
// mismo orden, con las mismas casillas. No se reorganiza "mejor" a
// propósito — es un documento del sistema de gestión, la gente ya sabe
// llenarlo, y un formulario que se parece al papel se adopta el primer
// día. Uno que lo mejora se llena mal durante un mes.
//
// Está pensado para una TABLET en el taller:
//
//   · Los campos van a 16 px. Por debajo de eso, Safari hace zoom al
//     enfocar y deja la pantalla torcida.
//   · Se guarda al salir de cada campo. Un turno de ocho horas no puede
//     depender de acordarse de un botón al final.
//   · Las tablas se deslizan dentro de su caja, no arrastran la página.
// ============================================================

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, ArrowLeft, AlertTriangle, CheckCircle2, PenLine, Ban, GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";
import { Firma } from "@/components/campo/Firma";
import { TRATAMIENTOS_PNC } from "@/lib/orden-produccion";

interface Cuadre {
  cuadra: boolean;
  problemas: { n: number; recibida: number; suma: number; diferencia: number }[];
  totalRecibida: number; totalUtilizada: number;
  totalDesperdicio: number; totalDevuelta: number;
}
type Fila = Record<string, string | number | undefined>;

interface OP {
  id: string; numero: string; estado: string; esPrueba: boolean;
  fechaExpedicion: string; fechaPrevista: string | null;
  especificacion: Fila[]; materiaPrima: Fila[];
  productoTerminado: Fila[]; interrupciones: Fila[];
  generaPnc: boolean; atributoNc: string | null;
  pncKg: number | null; pncTratamiento: string | null;
  inspeccion: string | null; observaciones: string | null;
  firmaOperarioEn: string | null; firmaOperarioNombre: string | null;
  firmaSupervisorEn: string | null; firmaSupervisorNombre: string | null;
  operario: { nombre: string } | null;
  pedido: { numero: string } | null;
  producto: { nombre: string; sku: string } | null;
  cuadre: Cuadre;
  desperdicioPct: number | null;
  puedeSupervisar: boolean;
}

/** Una sección del formato, con su franja de título como en el papel. */
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <p className="px-4 py-2 text-[11.5px] font-black uppercase tracking-wider"
        style={{ backgroundColor: "#11110f", color: "#ffdd00" }}>
        {titulo}
      </p>
      <div className="p-3">{children}</div>
    </div>
  );
}

/** Una celda de tabla que se guarda al salir. */
function Celda({
  valor, onGuardar, numerico, ancho = "w-24", placeholder,
}: {
  valor: string | number | undefined;
  onGuardar: (v: string) => void;
  numerico?: boolean;
  ancho?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(valor ?? "");
  useEffect(() => { setV(valor ?? ""); }, [valor]);
  return (
    <input
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => onGuardar(String(v))}
      inputMode={numerico ? "decimal" : undefined}
      placeholder={placeholder}
      className={`${ancho} rounded-lg border divider surface-2 px-2 py-2 outline-none text-center`}
      style={{ fontSize: 16 }}
    />
  );
}

function Contenido() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [firmando, setFirmando] = useState<"OPERARIO" | "SUPERVISOR" | null>(null);
  const [quienFirma, setQuienFirma] = useState("");
  const [guardandoFirma, setGuardandoFirma] = useState(false);

  const { data: op, isLoading, refetch } = useQuery<OP>({
    queryKey: ["op", id],
    queryFn: async () => {
      const r = await fetch(`/api/produccion/ordenes/${id}`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error ?? "No se pudo cargar");
      return j.data as OP;
    },
  });

  const guardar = useCallback(async (parche: Record<string, unknown>) => {
    const r = await fetch(`/api/produccion/ordenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parche),
    });
    const j = await r.json();
    if (!j.success) { toast.error(j.error ?? "No se pudo guardar"); return; }
    refetch();
  }, [id, refetch]);

  /** Cambia una celda de una de las cuatro tablas y guarda la tabla entera. */
  const cambiarFila = (campo: keyof OP, i: number, clave: string, valor: string) => {
    if (!op) return;
    const filas = [...((op[campo] as Fila[]) ?? [])];
    const numerico = /^(alto|largo|m2|cant|peso|kg|diametro)/i.test(clave);
    filas[i] = { ...filas[i], [clave]: numerico ? (valor === "" ? undefined : Number(valor)) : valor };
    guardar({ [campo]: filas });
  };

  const firmar = async (imagen: string) => {
    if (!quienFirma.trim()) { toast.error("Falta el nombre."); return; }
    setGuardandoFirma(true);
    try {
      const r = await fetch(`/api/produccion/ordenes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quien: firmando, firmaImagen: imagen, firmaNombre: quienFirma.trim() }),
      });
      const j = await r.json();
      if (!j.success) { toast.error(j.error ?? "No se pudo firmar", { duration: 8000 }); return; }
      toast.success(firmando === "OPERARIO" ? "Firmada. Falta el supervisor." : "Orden cerrada");
      setFirmando(null);
      setQuienFirma("");
      refetch();
    } finally { setGuardandoFirma(false); }
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center page-bg"><Loader2 size={22} className="animate-spin text-muted" /></div>;
  }
  if (!op) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 page-bg p-8 text-center">
        <p className="text-sm font-bold text-soft">Esta orden no existe</p>
        <button onClick={() => router.push("/produccion")} className="btn-secondary btn-sm">Volver</button>
      </div>
    );
  }

  const cerrada = Boolean(op.firmaSupervisorEn);
  const anulada = op.estado === "ANULADA";
  const soloLectura = cerrada || anulada;

  return (
    <>
      {firmando && (
        <Firma
          titulo={firmando === "OPERARIO" ? "Firma del operario" : "Firma del supervisor"}
          guardando={guardandoFirma}
          onCancelar={() => setFirmando(null)}
          onFirmar={firmar}
        />
      )}

      <div className="flex-1 overflow-y-auto page-bg">
        <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 topbar-bg border-b divider">
          <button onClick={() => router.push("/produccion")} className="text-muted p-1 -ml-1" aria-label="Volver">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-soft truncate">
              Orden de producción {op.numero}
            </p>
            <p className="text-[11.5px] text-muted">Malla ciclón · versión 1</p>
          </div>
          {op.esPrueba && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded flex-shrink-0"
              style={{ backgroundColor: "#7c3aed1f", color: "#7c3aed" }}>
              <GraduationCap size={11} /> Práctica
            </span>
          )}
        </div>

        <div className="max-w-4xl mx-auto p-3 space-y-3 pb-10">

          {anulada && (
            <div className="card p-4 flex items-start gap-2.5" style={{ backgroundColor: "#dc26261a" }}>
              <Ban size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-soft">Esta orden está anulada. Se conserva para que la numeración no quede con huecos.</p>
            </div>
          )}
          {cerrada && !anulada && (
            <div className="card p-4 flex items-start gap-2.5" style={{ backgroundColor: "#16a34a1a" }}>
              <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-soft">
                Cerrada. Firmó {op.firmaOperarioNombre} como operario y {op.firmaSupervisorNombre} como
                supervisor. Ya no se puede modificar.
              </p>
            </div>
          )}

          {/* ── Cabecera ── */}
          <Seccion titulo="Datos de la orden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Fecha de expedición</span>
                <span className="text-soft">
                  {new Date(op.fechaExpedicion).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Fecha prevista de finalización</span>
                {soloLectura ? (
                  <span className="text-soft">
                    {op.fechaPrevista ? new Date(op.fechaPrevista).toLocaleDateString("es-CO") : "—"}
                  </span>
                ) : (
                  <input
                    type="date"
                    defaultValue={op.fechaPrevista ? op.fechaPrevista.slice(0, 10) : ""}
                    onBlur={e => guardar({ fechaPrevista: e.target.value || null })}
                    className="rounded-lg border divider surface-2 px-3 py-2 outline-none"
                    style={{ fontSize: 16 }}
                  />
                )}
              </div>
              {op.producto && (
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Producto</span>
                  <span className="text-soft">{op.producto.nombre} <span className="text-muted font-mono text-[11px]">{op.producto.sku}</span></span>
                </div>
              )}
            </div>
          </Seccion>

          {/* ── Especificación de la malla ── */}
          <Seccion titulo="Especificación de la malla · presentación (rollos)">
            <div className="overflow-x-auto">
              <table className="text-[11px] min-w-[900px]">
                <thead>
                  <tr className="text-muted uppercase tracking-wider">
                    {["", "Ref.", "Color-galv", "Calibre", "Ojo", "Alto (cm)", "Largo (cm)", "M2", "Cant. 1", "Largo 1 (cm)", "Peso (kg)", "Cant. 2", "Largo 2 (cm)"]
                      .map(h => <th key={h} className="px-1 pb-2 font-bold text-center whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(op.especificacion ?? []).map((f, i) => (
                    <tr key={i}>
                      <td className="px-1 py-1 font-black text-center text-soft">{String(f.fila ?? "")}</td>
                      {["ref", "colorGalv", "calibre", "ojo", "alto", "largo", "m2", "cant1", "largo1", "peso", "cant2", "largo2"].map(c => (
                        <td key={c} className="px-1 py-1">
                          {soloLectura
                            ? <span className="block text-center text-soft py-2">{String(f[c] ?? "—")}</span>
                            : <Celda valor={f[c]} ancho="w-[86px]" onGuardar={v => cambiarFila("especificacion", i, c, v)} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>

          {/* ── Materia prima ── */}
          <Seccion titulo="Materia prima o insumos">
            <div className="overflow-x-auto">
              <table className="text-[11px] min-w-[780px]">
                <thead>
                  <tr className="text-muted uppercase tracking-wider">
                    {["#", "Color/galv", "Calibre", "Orden de compra y/o lote", "Recibida (kg)", "Utilizada (kg)", "Desperdicio (kg)", "Devuelta (kg)"]
                      .map(h => <th key={h} className="px-1 pb-2 font-bold text-center whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(op.materiaPrima ?? []).map((f, i) => {
                    const mal = op.cuadre.problemas.some(p => p.n === Number(f.n));
                    return (
                      <tr key={i} style={mal ? { backgroundColor: "#dc26260f" } : {}}>
                        <td className="px-1 py-1 font-black text-center text-soft">{String(f.n ?? i + 1)}</td>
                        {["colorGalv", "calibre", "ordenCompraLote", "kgRecibida", "kgUtilizada", "kgDesperdicio", "kgDevuelta"].map(c => (
                          <td key={c} className="px-1 py-1">
                            {soloLectura
                              ? <span className="block text-center text-soft py-2">{String(f[c] ?? "—")}</span>
                              : <Celda valor={f[c]} ancho={c === "ordenCompraLote" ? "w-[150px]" : "w-[96px]"}
                                  numerico={c.startsWith("kg")}
                                  onGuardar={v => cambiarFila("materiaPrima", i, c, v)} />}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* El cuadre, mientras se escribe y no al firmar.
                Enterarse de que los kilos no cuadran al final es
                enterarse cuando ya se guardó el papel. */}
            <div className="mt-3 p-3 rounded-xl surface-2">
              {op.cuadre.cuadra ? (
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-green-600">
                  <CheckCircle2 size={14} /> Los kilos cuadran.
                  <span className="font-normal text-muted">
                    Entraron {op.cuadre.totalRecibida} kg · desperdicio {op.cuadre.totalDesperdicio} kg
                    {op.desperdicioPct !== null ? ` (${op.desperdicioPct}%)` : ""}
                  </span>
                </p>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[12.5px]">
                    <p className="font-bold text-red-600">Los kilos no cuadran</p>
                    {op.cuadre.problemas.map(p => (
                      <p key={p.n} className="text-muted mt-0.5">
                        Insumo {p.n}: recibió {p.recibida} y declaró {p.suma}.{" "}
                        {p.diferencia > 0 ? "Faltan" : "Sobran"} {Math.abs(p.diferencia)} kg.
                      </p>
                    ))}
                    <p className="text-[11.5px] text-muted mt-1.5">
                      Recibida = utilizada + desperdicio + devuelta. Sin esto no se puede firmar.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Seccion>

          {/* ── Producto terminado ── */}
          <Seccion titulo="Producto terminado (rollos)">
            <div className="overflow-x-auto">
              <table className="text-[11px] min-w-[640px]">
                <thead>
                  <tr className="text-muted uppercase tracking-wider">
                    {["#", "Ref.", "Alto (cm)", "Largo (cm)", "Peso (kg)", "Diámetro", "M2"]
                      .map(h => <th key={h} className="px-1 pb-2 font-bold text-center whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(op.productoTerminado ?? []).map((f, i) => (
                    <tr key={i}>
                      <td className="px-1 py-1 font-black text-center text-soft">{String(f.n ?? i + 1)}</td>
                      {["ref", "alto", "largo", "peso", "diametro", "m2"].map(c => (
                        <td key={c} className="px-1 py-1">
                          {soloLectura
                            ? <span className="block text-center text-soft py-2">{String(f[c] ?? "—")}</span>
                            : <Celda valor={f[c]} ancho="w-[92px]" numerico={c !== "ref"}
                                onGuardar={v => cambiarFila("productoTerminado", i, c, v)} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>

          {/* ── Paradas ── */}
          <Seccion titulo="Tiempo de interrupciones y/o paradas">
            <div className="space-y-2">
              {(op.interrupciones ?? []).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 font-black text-center text-soft text-[12px]">{String(f.n ?? i + 1)}</span>
                  {soloLectura ? (
                    <span className="flex-1 text-[13px] text-soft">
                      {[f.horaInicio, f.horaFinal].filter(Boolean).join(" – ") || "—"}
                      {f.motivo ? ` · ${f.motivo}` : ""}
                    </span>
                  ) : (
                    <>
                      <Celda valor={f.horaInicio} ancho="w-24" placeholder="Inicio"
                        onGuardar={v => cambiarFila("interrupciones", i, "horaInicio", v)} />
                      <Celda valor={f.horaFinal} ancho="w-24" placeholder="Final"
                        onGuardar={v => cambiarFila("interrupciones", i, "horaFinal", v)} />
                      <Celda valor={f.motivo} ancho="flex-1" placeholder="Motivo"
                        onGuardar={v => cambiarFila("interrupciones", i, "motivo", v)} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </Seccion>

          {/* ── Producto no conforme ── */}
          <Seccion titulo="¿Se genera producto no conforme?">
            {soloLectura ? (
              <p className="text-[13px] text-soft">
                {op.generaPnc
                  ? `Sí · ${op.atributoNc ?? "sin atributo"} · ${op.pncKg ?? 0} kg · ${TRATAMIENTOS_PNC.find(t => t.v === op.pncTratamiento)?.l ?? "sin tratamiento"}`
                  : "No"}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {[["si", true], ["no", false]].map(([l, v]) => (
                    <button key={String(l)}
                      onClick={() => guardar({ generaPnc: v })}
                      className="px-5 py-2.5 rounded-xl text-[13px] font-bold border transition-all"
                      style={op.generaPnc === v
                        ? { backgroundColor: "#11110f", color: "#ffdd00", borderColor: "#11110f" }
                        : { borderColor: "var(--divider)", color: "var(--text-muted)" }}>
                      {String(l).toUpperCase()}
                    </button>
                  ))}
                </div>

                {op.generaPnc && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Atributo NC</label>
                        <input defaultValue={op.atributoNc ?? ""} onBlur={e => guardar({ atributoNc: e.target.value })}
                          className="w-full rounded-lg border divider surface-2 px-3 py-2.5 outline-none" style={{ fontSize: 16 }} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Cantidad (kg)</label>
                        <input defaultValue={op.pncKg ?? ""} inputMode="decimal"
                          onBlur={e => guardar({ pncKg: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-full rounded-lg border divider surface-2 px-3 py-2.5 outline-none" style={{ fontSize: 16 }} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">Tratamiento</label>
                      <div className="flex flex-wrap gap-2">
                        {TRATAMIENTOS_PNC.map(t => (
                          <button key={t.v} onClick={() => guardar({ pncTratamiento: t.v })}
                            className="px-3 py-2 rounded-xl text-[12.5px] font-semibold border transition-all"
                            style={op.pncTratamiento === t.v
                              ? { backgroundColor: "#11110f", color: "#ffdd00", borderColor: "#11110f" }
                              : { borderColor: "var(--divider)", color: "var(--text-muted)" }}>
                            {t.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Seccion>

          {/* ── Inspección ── */}
          <Seccion titulo="Inspección al producto en proceso">
            {soloLectura ? (
              <p className="text-[13px] text-soft whitespace-pre-line">{op.inspeccion || "—"}</p>
            ) : (
              <textarea defaultValue={op.inspeccion ?? ""} onBlur={e => guardar({ inspeccion: e.target.value })}
                rows={3} placeholder="Verificación de las especificaciones."
                className="w-full rounded-xl border divider surface-2 p-3 outline-none resize-y"
                style={{ fontSize: 16, lineHeight: 1.5 }} />
            )}
          </Seccion>

          {/* ── Firmas ── */}
          <Seccion titulo="Firmas">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ["OPERARIO", "Operario", op.firmaOperarioEn, op.firmaOperarioNombre, true],
                ["SUPERVISOR", "Supervisor", op.firmaSupervisorEn, op.firmaSupervisorNombre, op.puedeSupervisar],
              ] as const).map(([quien, label, cuando, nombre, puede]) => (
                <div key={quien} className="p-3 rounded-xl surface-2 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">{label}</p>
                  {cuando ? (
                    <>
                      <CheckCircle2 size={20} className="mx-auto mb-1 text-green-600" />
                      <p className="text-[13px] font-semibold text-soft">{nombre}</p>
                      <p className="text-[11px] text-muted">
                        {new Date(cuando).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </>
                  ) : anulada ? (
                    <p className="text-[12px] text-muted py-3">—</p>
                  ) : !puede ? (
                    <p className="text-[12px] text-muted py-3 leading-snug">
                      Pendiente. La firma un supervisor.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <input
                        value={firmando === quien ? quienFirma : ""}
                        onChange={e => { setQuienFirma(e.target.value); }}
                        onFocus={() => setQuienFirma(q => q)}
                        placeholder="Nombre completo"
                        className="w-full rounded-lg border divider px-3 py-2.5 outline-none bg-white dark:bg-slate-900"
                        style={{ fontSize: 16 }}
                      />
                      <button
                        onClick={() => {
                          if (!quienFirma.trim()) { toast.error("Escriba el nombre primero."); return; }
                          if (quien === "SUPERVISOR" && !op.firmaOperarioEn) {
                            toast.error("Primero tiene que firmar el operario.");
                            return;
                          }
                          setFirmando(quien);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px]"
                        style={{ backgroundColor: "#11110f", color: "#ffdd00" }}
                      >
                        <PenLine size={16} /> Firmar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Seccion>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Contenido /></Suspense>;
}
