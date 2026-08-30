"use client";

// ============================================================
// La bandeja del coordinador de producción.
//
// Junta las dos cosas que el vendedor le pide desde una cotización: la
// visita técnica previa y los documentos de SG-SST. Una sola pantalla
// porque son el mismo trabajo — lo que hay que resolver ANTES de que la
// oferta se pueda cerrar— y porque partirlo en dos obligaría al
// coordinador a mirar en dos sitios para saber si un negocio está listo.
//
// El formulario de la visita se dibuja a partir de `lib/visita-tecnica`,
// que describe el formato de la empresa como datos. Añadir una medida el
// día que producción la pida es agregar una línea allí.
// ============================================================

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import toast from "react-hot-toast";
import {
  HardHat, ClipboardCheck, Loader2, Calendar, MapPin, Phone, User,
  Plus, Trash2, Save, Printer, Send, AlertTriangle, FlaskConical, ChevronDown,
  FileWarning, Check,
} from "lucide-react";
import {
  seccionesDe, DOCUMENTOS_SGSST, ROLES_SGSST, etiquetaRolSgsst,
  type Requisicion, type LineaRequisicion,
} from "@/lib/visita-tecnica";

const CRM_COLOR = "#BA7517";

interface Persona {
  id: string; nombre: string; cedula: string | null; rol: string;
  requeridos: Record<string, boolean>;
  documentos: { tipo: string; nombreArchivo: string; subidoEn: string; almacenado: boolean; motivo?: string }[];
  observaciones: string | null;
}

interface Visita {
  id: string; estado: string;
  fechaAgendada: string | null; fechaRealizada: string | null;
  direccion: string | null; ciudad: string | null;
  contacto: string | null; telefono: string | null;
  datos: Record<string, unknown>;
  requisicion: Requisicion;
  observaciones: string | null;
  devueltaEn: string | null;
}

interface Trabajo {
  id: string; numero: string; estado: string; esPrueba: boolean;
  requiereVisita: boolean; requiereSgsst: boolean;
  ciudadInstalacion: string | null; direccionInstalacion: string | null;
  createdAt: string;
  cliente: { id: string; nombre: string; empresa: string | null; telefono: string | null; whatsapp: string | null };
  vendedor: { id: string; nombre: string; telefono: string | null } | null;
  visita: Visita | null;
  sgsst: Persona[];
}

const COLOR_ESTADO: Record<string, { bg: string; text: string; l: string }> = {
  SOLICITADA: { bg: "#fef3c7", text: "#92400e", l: "Solicitada" },
  AGENDADA: { bg: "#dbeafe", text: "#1d4ed8", l: "Agendada" },
  REALIZADA: { bg: "#d1fae5", text: "#065f46", l: "Realizada" },
  CANCELADA: { bg: "#f1f5f9", text: "#475569", l: "Cancelada" },
};

// ─────────────────────────────────────────────

function FilasRequisicion({
  titulo, lineas, onChange,
}: { titulo: string; lineas: LineaRequisicion[]; onChange: (l: LineaRequisicion[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{titulo}</p>
        <button
          onClick={() => onChange([...lineas, { cantidad: "", detalle: "", unidad: "" }])}
          className="text-[11px] font-semibold flex items-center gap-1"
          style={{ color: CRM_COLOR }}
        >
          <Plus size={11} /> Agregar
        </button>
      </div>
      {lineas.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">Sin líneas todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {lineas.map((l, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input
                className="input py-1 text-xs w-16" placeholder="Cant." value={String(l.cantidad ?? "")}
                onChange={e => onChange(lineas.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))}
              />
              <input
                className="input py-1 text-xs w-20" placeholder="Unidad" value={l.unidad ?? ""}
                onChange={e => onChange(lineas.map((x, j) => j === i ? { ...x, unidad: e.target.value } : x))}
              />
              <input
                className="input py-1 text-xs flex-1" placeholder="Detalle" value={l.detalle}
                onChange={e => onChange(lineas.map((x, j) => j === i ? { ...x, detalle: e.target.value } : x))}
              />
              <button
                onClick={() => onChange(lineas.filter((_, j) => j !== i))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PanelVisita({ trabajo, onGuardado }: { trabajo: Trabajo; onGuardado: () => void }) {
  const v = trabajo.visita!;
  const [datos, setDatos] = useState<Record<string, unknown>>(v.datos ?? {});
  const [req, setReq] = useState<Requisicion>(v.requisicion ?? {});
  const [fecha, setFecha] = useState(v.fechaAgendada ? v.fechaAgendada.slice(0, 16) : "");
  const [obs, setObs] = useState(v.observaciones ?? "");
  const [tipo, setTipo] = useState<"cerca" | "malla" | "ambos">("ambos");
  const [guardando, setGuardando] = useState(false);

  const secciones = useMemo(() => seccionesDe(tipo), [tipo]);
  const set = (k: string, val: unknown) => setDatos(d => ({ ...d, [k]: val }));

  const guardar = async (devolver = false) => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/crm/trabajos/visita/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datos, requisicion: req, observaciones: obs,
          fechaAgendada: fecha || null,
          estado: devolver ? "REALIZADA" : (fecha ? "AGENDADA" : "SOLICITADA"),
          devolver,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo guardar");
      toast.success(devolver
        ? "Visita entregada. El vendedor ya tiene el aviso."
        : "Guardado");
      onGuardado();
    } catch { toast.error("Error de conexión"); }
    finally { setGuardando(false); }
  };

  const est = COLOR_ESTADO[v.estado] ?? COLOR_ESTADO.SOLICITADA;

  return (
    <div className="space-y-4">
      {/* Cabecera de la visita */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: est.bg, color: est.text }}>
          {est.l}
        </span>
        {v.devueltaEn && (
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <Check size={12} /> Entregada al vendedor el {new Date(v.devueltaEn).toLocaleDateString("es-CO")}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-[11px] text-gray-400">Cuándo se va</label>
          <input type="datetime-local" className="input py-1 text-xs w-52" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-gray-500 dark:text-slate-400">
        {v.direccion && <span className="flex items-center gap-1.5"><MapPin size={12} />{v.direccion}{v.ciudad ? `, ${v.ciudad}` : ""}</span>}
        {v.contacto && <span className="flex items-center gap-1.5"><User size={12} />{v.contacto}</span>}
        {v.telefono && <a href={`tel:${v.telefono}`} className="flex items-center gap-1.5 hover:text-gray-800 dark:hover:text-gray-200"><Phone size={12} />{v.telefono}</a>}
      </div>

      {/* Qué formato aplica */}
      <div className="flex gap-1.5">
        {([["ambos", "Todo el formato"], ["cerca", "Cerca eléctrica"], ["malla", "Malla invisible"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTipo(k)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={tipo === k
              ? { backgroundColor: CRM_COLOR, color: "white" }
              : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
            {l}
          </button>
        ))}
      </div>

      {/* El formulario, dibujado desde lib/visita-tecnica */}
      {secciones.map(sec => (
        <div key={sec.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-3)" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: CRM_COLOR }}>
            {sec.titulo}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sec.campos.map(c => (
              <div key={c.k} className={c.tipo === "area" ? "sm:col-span-2" : ""}>
                <label className="block text-[10.5px] font-semibold text-gray-500 dark:text-slate-400 mb-1">
                  {c.label}{c.unidad && <span className="text-gray-400"> ({c.unidad})</span>}
                </label>
                {c.tipo === "si_no" ? (
                  <div className="flex gap-1.5">
                    {[["si", "Sí"], ["no", "No"]].map(([val, lab]) => (
                      <button key={val} onClick={() => set(c.k, datos[c.k] === val ? "" : val)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={datos[c.k] === val
                          ? { backgroundColor: CRM_COLOR, color: "white" }
                          : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}>
                        {lab}
                      </button>
                    ))}
                  </div>
                ) : c.tipo === "area" ? (
                  <textarea className="input resize-none text-xs" rows={2}
                    value={String(datos[c.k] ?? "")} onChange={e => set(c.k, e.target.value)} placeholder={c.ayuda} />
                ) : (
                  <input className="input py-1.5 text-xs" type={c.tipo === "numero" ? "number" : "text"}
                    value={String(datos[c.k] ?? "")} onChange={e => set(c.k, e.target.value)} placeholder={c.ayuda} />
                )}
                {c.ayuda && c.tipo !== "area" && c.tipo !== "texto" && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.ayuda}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Requisición */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-3)" }}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: CRM_COLOR }}>
          Requisición de materiales y herramientas
        </p>
        <p className="text-[10.5px] text-gray-400 mb-3">
          Es lo que el vendedor necesita para cotizar en firme. Sale del formato de la empresa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input className="input py-1.5 text-xs" placeholder="Proyecto" value={req.proyecto ?? ""} onChange={e => setReq({ ...req, proyecto: e.target.value })} />
          <input className="input py-1.5 text-xs" placeholder="Ubicación" value={req.ubicacion ?? ""} onChange={e => setReq({ ...req, ubicacion: e.target.value })} />
          <input className="input py-1.5 text-xs" placeholder="Responsable" value={req.responsable ?? ""} onChange={e => setReq({ ...req, responsable: e.target.value })} />
          <input className="input py-1.5 text-xs" placeholder="Tiempo de ejecución" value={req.tiempoEjecucion ?? ""} onChange={e => setReq({ ...req, tiempoEjecucion: e.target.value })} />
          <textarea className="input resize-none text-xs sm:col-span-2" rows={2} placeholder="Descripción del trabajo"
            value={req.descripcion ?? ""} onChange={e => setReq({ ...req, descripcion: e.target.value })} />
        </div>
        <div className="space-y-4">
          <FilasRequisicion titulo="Materiales" lineas={req.materiales ?? []} onChange={l => setReq({ ...req, materiales: l })} />
          <FilasRequisicion titulo="Herramientas" lineas={req.herramientas ?? []} onChange={l => setReq({ ...req, herramientas: l })} />
          <textarea className="input resize-none text-xs" rows={2} placeholder="Solicitudes especiales"
            value={req.especiales ?? ""} onChange={e => setReq({ ...req, especiales: e.target.value })} />
        </div>
      </div>

      <textarea className="input resize-none text-xs" rows={2} placeholder="Observaciones de la visita"
        value={obs} onChange={e => setObs(e.target.value)} />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => guardar(false)} disabled={guardando} className="btn-secondary btn-sm">
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar
        </button>
        <button onClick={() => window.print()} className="btn-secondary btn-sm">
          <Printer size={13} /> Imprimir / PDF
        </button>
        <button
          onClick={() => guardar(true)}
          disabled={guardando}
          className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50"
          style={{ backgroundColor: "#059669" }}
          title="Marca la visita como hecha y avisa a quien vende para que cotice en firme"
        >
          <Send size={13} /> Entregar al vendedor
        </button>
      </div>
    </div>
  );
}

function PanelSgsst({ trabajo, aviso, onCambio }: { trabajo: Trabajo; aviso: string | null; onCambio: () => void }) {
  const [nuevo, setNuevo] = useState({ nombre: "", cedula: "", rol: "TRABAJADOR" });
  const [guardando, setGuardando] = useState(false);

  const agregar = async () => {
    if (!nuevo.nombre.trim()) return toast.error("Falta el nombre");
    setGuardando(true);
    try {
      const res = await fetch("/api/crm/trabajos/sgsst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cotizacionId: trabajo.id, ...nuevo, requeridos: {} }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo agregar");
      setNuevo({ nombre: "", cedula: "", rol: "TRABAJADOR" });
      onCambio();
    } catch { toast.error("Error de conexión"); }
    finally { setGuardando(false); }
  };

  const guardarPersona = async (p: Persona, cambios: Record<string, unknown>) => {
    const res = await fetch(`/api/crm/trabajos/sgsst?id=${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return toast.error(json.error ?? "No se pudo guardar");
    if (json.aviso) toast(json.aviso, { icon: "⚠️", duration: 10000 });
    onCambio();
  };

  const quitar = async (p: Persona) => {
    if (!confirm(`¿Quitar a ${p.nombre} del proceso?`)) return;
    await fetch(`/api/crm/trabajos/sgsst?id=${p.id}`, { method: "DELETE" });
    onCambio();
  };

  return (
    <div className="space-y-4">
      {/* La verdad sobre los archivos, arriba del todo. */}
      {aviso && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-[11.5px] text-amber-800 dark:text-amber-300">
          <FileWarning size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Los archivos todavía no se guardan aquí.</p>
            <p className="mt-0.5">{aviso}</p>
            <p className="mt-1 opacity-80">
              Lo que sí queda es el registro de qué documento entregó cada persona y cuándo, que es
              lo que hace falta para saber si puede entrar a la obra.
            </p>
          </div>
        </div>
      )}

      {/* Alta de persona */}
      <div className="rounded-xl p-3 flex flex-wrap gap-2 items-end" style={{ backgroundColor: "var(--surface-3)" }}>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nombre</label>
          <input className="input py-1.5 text-xs" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre completo" />
        </div>
        <div className="w-32">
          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Cédula</label>
          <input className="input py-1.5 text-xs" value={nuevo.cedula} onChange={e => setNuevo({ ...nuevo, cedula: e.target.value })} />
        </div>
        <div className="w-44">
          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Rol</label>
          <select className="input py-1.5 text-xs" value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })}>
            {ROLES_SGSST.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </div>
        <button onClick={agregar} disabled={guardando} className="btn-primary btn-sm">
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Agregar persona
        </button>
      </div>

      {trabajo.sgsst.length === 0 ? (
        <p className="text-[12px] text-gray-400 text-center py-6">
          Todavía no hay nadie en el proceso. Agrega a los trabajadores, al coordinador SST
          y al coordinador de alturas.
        </p>
      ) : (
        trabajo.sgsst.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{p.nombre}</p>
                <p className="text-[11px] text-gray-400">
                  {etiquetaRolSgsst(p.rol)}{p.cedula ? ` · C.C. ${p.cedula}` : ""}
                </p>
              </div>
              <button onClick={() => quitar(p)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-3 mb-2">
              Qué documentos le aplican
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DOCUMENTOS_SGSST.map(d => {
                const aplica = Boolean(p.requeridos?.[d.k]);
                const entregado = p.documentos?.find(x => x.tipo === d.k);
                return (
                  <div key={d.k} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "var(--surface-3)" }}>
                    <input
                      type="checkbox" className="mt-0.5" checked={aplica}
                      onChange={e => guardarPersona(p, { requeridos: { ...p.requeridos, [d.k]: e.target.checked } })}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-medium text-gray-700 dark:text-slate-200">{d.label}</p>
                      {d.ayuda && <p className="text-[10px] text-gray-400">{d.ayuda}</p>}
                      {aplica && (
                        entregado ? (
                          <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: entregado.almacenado ? "#059669" : "#b45309" }}>
                            {entregado.almacenado ? <Check size={10} /> : <AlertTriangle size={10} />}
                            {entregado.nombreArchivo} · {new Date(entregado.subidoEn).toLocaleDateString("es-CO")}
                            {!entregado.almacenado && " (registrado, sin archivar)"}
                          </p>
                        ) : (
                          <label className="text-[10px] mt-0.5 inline-block cursor-pointer" style={{ color: CRM_COLOR }}>
                            Registrar entrega
                            <input
                              type="file" className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                guardarPersona(p, {
                                  registrarDocumentos: [{ tipo: d.k, nombreArchivo: f.name, tamano: f.size }],
                                });
                              }}
                            />
                          </label>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────

function TrabajosContent() {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Record<string, "visita" | "sgsst">>({});

  const { data, isLoading, refetch } = useQuery<{ data: Trabajo[]; avisoAlmacenamiento: string | null }>({
    queryKey: ["crm-trabajos"],
    queryFn: async () => (await fetch("/api/crm/trabajos")).json(),
  });

  const trabajos = data?.data ?? [];
  const pendientes = trabajos.filter(t => t.visita && !t.visita.devueltaEn).length;

  return (
    <>
      <Topbar title="Trabajos de producción" />
      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">
        <p className="text-[12px] text-gray-500 dark:text-slate-400">
          Lo que hay que resolver antes de que una oferta se pueda cerrar: visitas técnicas
          solicitadas por los vendedores y documentos de SG-SST.
          {pendientes > 0 && <> Hay <strong>{pendientes}</strong> visita{pendientes === 1 ? "" : "s"} sin entregar.</>}
        </p>

        {isLoading ? (
          <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto text-gray-400" /></div>
        ) : trabajos.length === 0 ? (
          <div className="card p-10 text-center">
            <HardHat size={26} className="mx-auto mb-2 text-gray-300" />
            <p className="text-[13px] text-gray-500 dark:text-slate-400">Nada pendiente por ahora.</p>
            <p className="text-[11.5px] text-gray-400 mt-1">
              Aquí aparecen las cotizaciones que un vendedor marcó con visita técnica o con
              proceso de SG-SST.
            </p>
          </div>
        ) : (
          trabajos.map(t => {
            const abiertoEste = abierto === t.id;
            const tab = pestana[t.id] ?? (t.requiereVisita ? "visita" : "sgsst");
            const est = t.visita ? (COLOR_ESTADO[t.visita.estado] ?? COLOR_ESTADO.SOLICITADA) : null;
            return (
              <div key={t.id} className="card overflow-hidden">
                <button
                  onClick={() => setAbierto(abiertoEste ? null : t.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <p className="text-xs font-mono font-bold text-gray-500">{t.numero}</p>
                    <p className="text-[10px] text-gray-400">{new Date(t.createdAt).toLocaleDateString("es-CO")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 truncate">{t.cliente.nombre}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {t.ciudadInstalacion ?? "Sin ciudad"}
                      {t.vendedor && ` · pedido por ${t.vendedor.nombre}`}
                    </p>
                  </div>
                  {t.esPrueba && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
                      <FlaskConical size={10} /> Prueba
                    </span>
                  )}
                  {t.requiereVisita && est && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: est.bg, color: est.text }}>
                      <ClipboardCheck size={10} /> {est.l}
                    </span>
                  )}
                  {t.requiereSgsst && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: "#f5f3ff", color: "#6d28d9" }}>
                      <HardHat size={10} /> SG-SST ({t.sgsst.length})
                    </span>
                  )}
                  <ChevronDown size={14} className={`text-gray-300 transition-transform ${abiertoEste ? "rotate-180" : ""}`} />
                </button>

                {abiertoEste && (
                  <div className="px-5 pb-5 border-t border-gray-100 dark:border-slate-700 pt-4">
                    {t.requiereVisita && t.requiereSgsst && (
                      <div className="flex gap-1.5 mb-4">
                        {([["visita", "Visita técnica"], ["sgsst", "SG-SST"]] as const).map(([k, l]) => (
                          <button key={k} onClick={() => setPestana(p => ({ ...p, [t.id]: k }))}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                            style={tab === k
                              ? { backgroundColor: CRM_COLOR, color: "white" }
                              : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    )}

                    {tab === "visita" && t.requiereVisita && (
                      t.visita
                        ? <PanelVisita trabajo={t} onGuardado={() => refetch()} />
                        : <p className="text-[12px] text-gray-400">La visita se está creando; recarga en un momento.</p>
                    )}
                    {tab === "sgsst" && t.requiereSgsst && (
                      <PanelSgsst trabajo={t} aviso={data?.avisoAlmacenamiento ?? null} onCambio={() => refetch()} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><TrabajosContent /></Suspense>;
}
