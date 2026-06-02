"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Save, Loader2, Plus, Trash2, Check, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type FD = Record<string, unknown>;
interface Props { initialData?: FD; productoId?: string; modo: "crear" | "editar"; }

// ─── Categorías con ficha técnica ────────────────────────────
const CATS = [
  { v: "mallas-metalicas",     l: "Mallas Metálicas",      c: "bg-slate-700 text-white",   dot: "#374151" },
  { v: "mallas-para-balcones", l: "Balcones / Hogar",       c: "bg-pink-600 text-white",    dot: "#db2777" },
  { v: "mallas-nylon",         l: "Nylon / Deportivas",     c: "bg-emerald-600 text-white", dot: "#059669" },
  { v: "mallas-plasticas",     l: "Mallas Plásticas",       c: "bg-teal-600 text-white",    dot: "#0d9488" },
  { v: "seguridad-perimetral", l: "Seguridad Perimetral",   c: "bg-red-600 text-white",     dot: "#dc2626" },
  { v: "mallas-sombra",        l: "Mallas de Sombra",       c: "bg-amber-500 text-white",   dot: "#f59e0b" },
  { v: "mallas-agricolas",     l: "Mallas Agrícolas",       c: "bg-lime-600 text-white",    dot: "#65a30d" },
];
const ACF_KEY: Record<string, string> = {
  "mallas-metalicas": "mm", "mallas-para-balcones": "bh",
  "mallas-nylon": "ny", "mallas-plasticas": "pl", "seguridad-perimetral": "sp",
};

// ─── Componentes base ─────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 mb-1.5">{children}</p>;
}

function FieldWrap({ label, hint, children, half }: { label: string; hint?: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? "" : ""}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function SInput({ label, value, onChange, placeholder, type = "text", step, hint, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; step?: string; hint?: string; mono?: boolean;
}) {
  return (
    <FieldWrap label={label} hint={hint}>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input ${mono ? "font-mono text-[13px]" : ""}`} />
    </FieldWrap>
  );
}

function SSelect({ label, value, onChange, opts, hint }: {
  label: string; value: string; onChange: (v: string) => void; opts: [string, string][]; hint?: string;
}) {
  return (
    <FieldWrap label={label} hint={hint}>
      <select className="input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Seleccionar</option>
        {opts.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </FieldWrap>
  );
}

function STextarea({ label, value, onChange, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <FieldWrap label={label}>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input resize-none" />
    </FieldWrap>
  );
}

function SToggle({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full text-left py-2 group">
      <div className={`w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 relative ${checked ? "bg-[#FFCC00]" : "bg-gray-200"}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px bg-gray-100 flex-1" />
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
      <div className="h-px bg-gray-100 flex-1" />
    </div>
  );
}

function Repeater({ label, value, onChange, cols }: {
  label: string; value: FD[]; onChange: (v: FD[]) => void;
  cols: { k: string; l: string; type?: string; opts?: [string, string][] }[];
}) {
  const rows = Array.isArray(value) ? value : [];
  const add = () => onChange([...rows, Object.fromEntries(cols.map(c => [c.k, ""]))]);
  const del = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const upd = (i: number, k: string, v: unknown) => { const n = [...rows]; n[i] = { ...n[i], [k]: v }; onChange(n); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{label}</Label>
        <button type="button" onClick={add} className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors">
          <Plus size={11} /> Agregar fila
        </button>
      </div>
      {rows.length === 0
        ? <div className="border-2 border-dashed border-gray-100 rounded-xl p-3 text-center text-xs text-gray-300">Sin filas</div>
        : <div className="rounded-xl border border-gray-100 overflow-hidden">
            {rows.map((row, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <span className="text-[10px] font-mono font-bold text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                {cols.map(c => (
                  <div key={c.k} className="flex-1">
                    {c.opts
                      ? <select className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#FFCC00]" value={String(row[c.k] ?? "")} onChange={e => upd(i, c.k, e.target.value)}>
                          <option value="">—</option>
                          {c.opts.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      : <input type={c.type ?? "text"} step={c.type === "number" ? "any" : undefined} placeholder={c.l}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#FFCC00] transition-colors"
                          value={String(row[c.k] ?? "")} onChange={e => upd(i, c.k, e.target.value)} />
                    }
                  </div>
                ))}
                <button type="button" onClick={() => del(i)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"><X size={13} /></button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

function TagInput({ label, value, onChange, hint, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; placeholder?: string;
}) {
  const [inp, setInp] = useState("");
  const add = () => { const t = inp.trim(); if (t && !value.includes(t)) onChange([...value, t]); setInp(""); };
  return (
    <FieldWrap label={label} hint={hint}>
      <div className="border border-gray-200 rounded-lg p-2 focus-within:border-[#FFCC00] focus-within:ring-2 focus-within:ring-[#FFCC00]/20 transition-all">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(t => (
            <span key={t} className="inline-flex items-center gap-1 bg-gray-900 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
              {t}
              <button type="button" onClick={() => onChange(value.filter(v => v !== t))} className="hover:text-red-300 transition-colors"><X size={9} /></button>
            </span>
          ))}
        </div>
        <input className="w-full text-sm outline-none placeholder:text-gray-300"
          value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "," ) { e.preventDefault(); add(); } }}
          placeholder={value.length === 0 ? (placeholder ?? "Escribe y presiona Enter…") : "+"} />
      </div>
    </FieldWrap>
  );
}

function CatDropdown({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (v: string) => value.includes(v) ? onChange(value.filter(c => c !== v)) : onChange([...value, v]);
  const sel = CATS.filter(c => value.includes(c.v));

  return (
    <div ref={ref} className="relative">
      <Label>Categorías</Label>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 hover:border-gray-300 focus:border-[#FFCC00] focus:ring-2 focus:ring-[#FFCC00]/20 outline-none transition-all bg-white">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {sel.length === 0
            ? <span className="text-sm text-gray-400">Seleccionar categorías…</span>
            : sel.map(c => <span key={c.v} className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${c.c}`}>{c.l}</span>)
          }
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {CATS.map(c => (
            <button type="button" key={c.v} onClick={() => toggle(c.v)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all border-2 ${value.includes(c.v) ? "border-0" : "border-gray-200"}`}
                style={value.includes(c.v) ? { backgroundColor: c.dot } : {}}>
                {value.includes(c.v) && <Check size={11} className="text-white" />}
              </div>
              <span className="text-sm text-gray-700 flex-1">{c.l}</span>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PillGroup({ label, opts, value, onChange }: {
  label: string; opts: [string, string][]; value: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (k: string) => value.includes(k) ? onChange(value.filter(v => v !== k)) : onChange([...value, k]);
  return (
    <FieldWrap label={label}>
      <div className="flex flex-wrap gap-2">
        {opts.map(([k, v]) => (
          <button type="button" key={k} onClick={() => toggle(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${value.includes(k) ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
            {v}
          </button>
        ))}
      </div>
    </FieldWrap>
  );
}

// ─── Sección de ficha con título ──────────────────────────────

function FSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50 bg-gray-50">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</p>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  );
}

// ─── Fichas técnicas ──────────────────────────────────────────

function FichaMetalicas({ d, s }: { d: FD; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-4">
      <FSection title="Material y Acabado">
        <div className="grid grid-cols-3 gap-4">
          <SSelect label="Tipo de Acero" value={g("mm_tipo_acero")} onChange={v => s("mm_tipo_acero", v)} opts={[["galvanizado","Galvanizado"],["galvanizado_pvc","Galv. + PVC"],["inoxidable","Inoxidable"],["negro","Acero Negro"]]} />
          <SSelect label="Acabado Exterior" value={g("mm_acabado_exterior")} onChange={v => s("mm_acabado_exterior", v)} opts={[["zinc_electro","Zinc Electrolítico"],["zinc_caliente","Zinc en Caliente"],["pvc","PVC"],["epoxi","Epoxi"],["sin_recubrimiento","Sin Recubrimiento"]]} />
          <SInput label="Zinc (g/m²)" value={g("mm_zinc_gr_m2")} onChange={v => s("mm_zinc_gr_m2", v)} type="number" />
        </div>
        <SToggle label="Certificación LEED" desc="El producto cumple estándares de construcción sostenible" checked={Boolean(d["mm_certificacion_leed"])} onChange={v => s("mm_certificacion_leed", v)} />
      </FSection>
      <FSection title="Calibre del Alambre">
        <div className="grid grid-cols-2 gap-4">
          <SInput label="Calibre Externo BWG" value={g("mm_calibre_ext_bwg")} onChange={v => s("mm_calibre_ext_bwg", v)} mono />
          <SInput label="Calibre Externo (mm)" value={g("mm_calibre_ext_mm")} onChange={v => s("mm_calibre_ext_mm", v)} type="number" step="0.01" />
          <SInput label="Calibre Interno BWG" value={g("mm_calibre_int_bwg")} onChange={v => s("mm_calibre_int_bwg", v)} mono />
          <SInput label="Calibre Interno (mm)" value={g("mm_calibre_int_mm")} onChange={v => s("mm_calibre_int_mm", v)} type="number" step="0.01" />
        </div>
        <SInput label="Tamaño del Ojo / Abertura" value={g("mm_tamano_ojo")} onChange={v => s("mm_tamano_ojo", v)} placeholder="ej: 1×1 pulgada" />
      </FSection>
      <FSection title="Propiedades Mecánicas">
        <div className="grid grid-cols-2 gap-4">
          <SInput label="Resistencia Tensión (MPa)" value={g("mm_resistencia_tension_mpa")} onChange={v => s("mm_resistencia_tension_mpa", v)} type="number" />
          <SInput label="Resistencia Tracción (kN/m)" value={g("mm_resistencia_traccion_kn")} onChange={v => s("mm_resistencia_traccion_kn", v)} type="number" step="0.1" />
          <SInput label="Dureza Shore A (PVC)" value={g("mm_dureza_shore_a")} onChange={v => s("mm_dureza_shore_a", v)} type="number" />
          <SInput label="Horas Cámara Salina" value={g("mm_horas_camara_salina")} onChange={v => s("mm_horas_camara_salina", v)} type="number" />
        </div>
        <STextarea label="Compatibilidad Química" value={g("mm_compatibilidad_quimica")} onChange={v => s("mm_compatibilidad_quimica", v)} rows={2} />
      </FSection>
      <FSection title="Dimensiones y Peso">
        <div className="grid grid-cols-4 gap-4">
          <SInput label="Alto (m)" value={g("mm_alto_m")} onChange={v => s("mm_alto_m", v)} type="number" step="0.01" />
          <SInput label="Ancho (m)" value={g("mm_ancho_m")} onChange={v => s("mm_ancho_m", v)} type="number" step="0.01" />
          <SInput label="Longitud Rollo (m)" value={g("mm_longitud_rollo_m")} onChange={v => s("mm_longitud_rollo_m", v)} type="number" step="0.1" />
          <SInput label="Peso (kg)" value={g("mm_peso_kg")} onChange={v => s("mm_peso_kg", v)} type="number" step="0.01" />
        </div>
        <SToggle label="Incluye Abrazaderas" checked={Boolean(d["mm_incluye_abrazaderas"])} onChange={v => s("mm_incluye_abrazaderas", v)} />
      </FSection>
      <FSection title="Tabla de Variantes">
        <Repeater label="Variantes (Hueco × Calibre × Unidad × Peso)" value={(d["mm_tabla_variantes"] as FD[]) ?? []} onChange={v => s("mm_tabla_variantes", v)}
          cols={[{k:"var_hueco",l:"Hueco/Abertura"},{k:"var_calibre",l:"Calibre"},{k:"var_unidad",l:"Unidad",opts:[["m2","m²"],["ml","ml"],["rollo","Rollo"],["panel","Panel"]]},{k:"var_peso",l:"Peso kg/m²",type:"number"}]} />
      </FSection>
    </div>
  );
}

function FichaBalcones({ d, s }: { d: FD; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-4">
      <FSection title="Fibra y Composición">
        <div className="grid grid-cols-2 gap-4">
          <SSelect label="Material del Filamento" value={g("bh_material_filamento")} onChange={v => s("bh_material_filamento", v)} opts={[["poliester","Poliéster"],["polipropileno","Polipropileno"],["nylon","Nylon (Poliamida)"],["polietileno","Polietileno"]]} />
          <SInput label="Diámetro del Hilo (mm)" value={g("bh_diametro_hilo_mm")} onChange={v => s("bh_diametro_hilo_mm", v)} type="number" step="0.01" />
          <SInput label="Denier" value={g("bh_denier")} onChange={v => s("bh_denier", v)} type="number" />
          <SInput label="Título del Hilo" value={g("bh_titulo_hilo")} onChange={v => s("bh_titulo_hilo", v)} />
        </div>
      </FSection>
      <FSection title="Propiedades Mecánicas">
        <div className="grid grid-cols-3 gap-4">
          <SInput label="Tenacidad (g/denier)" value={g("bh_tenacidad_g_denier")} onChange={v => s("bh_tenacidad_g_denier", v)} type="number" step="0.01" />
          <SInput label="Elongación (%)" value={g("bh_elongacion_pct")} onChange={v => s("bh_elongacion_pct", v)} type="number" step="0.1" />
          <SInput label="Resistencia Tracción (kgf)" value={g("bh_resistencia_traccion_kgf")} onChange={v => s("bh_resistencia_traccion_kgf", v)} type="number" step="0.1" />
          <SInput label="Resistencia al Impacto (J)" value={g("bh_resistencia_impacto_j")} onChange={v => s("bh_resistencia_impacto_j", v)} type="number" step="0.1" />
          <SInput label="Carga Admisible (kg/m²)" value={g("bh_carga_kg_m2")} onChange={v => s("bh_carga_kg_m2", v)} type="number" step="0.1" />
        </div>
      </FSection>
      <FSection title="Dimensiones">
        <div className="grid grid-cols-3 gap-4">
          <SInput label="Tamaño de Abertura" value={g("bh_tamano_abertura")} onChange={v => s("bh_tamano_abertura", v)} />
          <SInput label="Ancho Estándar (m)" value={g("bh_ancho_estandar_m")} onChange={v => s("bh_ancho_estandar_m", v)} type="number" step="0.01" />
          <SInput label="Largo Estándar (m)" value={g("bh_largo_estandar_m")} onChange={v => s("bh_largo_estandar_m", v)} type="number" step="0.01" />
        </div>
      </FSection>
      <FSection title="UV y Temperatura">
        <div className="grid grid-cols-2 gap-4">
          <SInput label="Estabilidad Dimensional (%)" value={g("bh_estabilidad_dimensional_pct")} onChange={v => s("bh_estabilidad_dimensional_pct", v)} type="number" step="0.1" />
          <SInput label="Temperatura Máxima (°C)" value={g("bh_temp_max_uso_c")} onChange={v => s("bh_temp_max_uso_c", v)} type="number" />
          <SSelect label="Estabilizador UV" value={g("bh_estabilizador_uv")} onChange={v => s("bh_estabilizador_uv", v)} opts={[["uv_estabilizado","UV Estabilizado"],["uv_no","Sin Protección UV"],["uv_premium","UV Premium (HLS)"]]} />
          <SInput label="Norma / Certificación" value={g("bh_norma_certificacion")} onChange={v => s("bh_norma_certificacion", v)} />
        </div>
      </FSection>
      <FSection title="Aplicaciones y Accesorios">
        <PillGroup label="Espacios de Aplicación" opts={[["balcon","Balcón"],["ventana","Ventana"],["escalera","Escalera"],["terraza","Terraza"],["piscina","Piscina"],["rack","Rack / Bodega"],["fachada","Fachada"],["jardin","Jardín"]]} value={(d["bh_espacios_aplicacion"] as string[]) ?? []} onChange={v => s("bh_espacios_aplicacion", v)} />
        <SToggle label="Kit Autoinstalable" desc="Incluye instrucciones y accesorios para instalación" checked={Boolean(d["bh_kit_autoinstalable"])} onChange={v => s("bh_kit_autoinstalable", v)} />
        <Repeater label="Accesorios Incluidos" value={(d["bh_accesorios_incluidos"] as FD[]) ?? []} onChange={v => s("bh_accesorios_incluidos", v)} cols={[{k:"accesorio_item",l:"Accesorio"},{k:"accesorio_qty",l:"Cantidad",type:"number"}]} />
      </FSection>
    </div>
  );
}

function FichaNylon({ d, s }: { d: FD; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-4">
      <FSection title="Tipo de Tejido">
        <div className="grid grid-cols-3 gap-4">
          <SSelect label="Tipo de Tejido" value={g("ny_tipo_tejido")} onChange={v => s("ny_tipo_tejido", v)} opts={[["mano","Knotted (a mano)"],["maquina","Knotless (máquina)"],["extruido","Extruido"]]} />
          <SInput label="Calibre del Hilo (mm)" value={g("ny_calibre_mm")} onChange={v => s("ny_calibre_mm", v)} type="number" step="0.01" />
          <SInput label="Tamaño del Cuadro" value={g("ny_tamano_cuadro")} onChange={v => s("ny_tamano_cuadro", v)} />
        </div>
        <SToggle label="Tiene Alma Interior" checked={Boolean(d["ny_tiene_alma"])} onChange={v => s("ny_tiene_alma", v)} />
      </FSection>
      <FSection title="Uso Deportivo">
        <div className="grid grid-cols-2 gap-4">
          <SSelect label="Uso Principal" value={g("ny_uso_deportivo")} onChange={v => s("ny_uso_deportivo", v)} opts={[["futbol","Fútbol"],["voleibol","Voleibol"],["tenis","Tenis"],["basquetbol","Básquetbol"],["cerramiento","Cerramiento Deportivo"],["cubierta","Cubierta / Techo"],["anticaida","Anticaída / Seguridad"],["beisbol","Béisbol"],["golf","Golf"]]} />
          <SInput label="Norma Anticaída" value={g("ny_norma_anticaida")} onChange={v => s("ny_norma_anticaida", v)} placeholder="ej: EN 1263" />
          <SInput label="Alto Reglamentario (m)" value={g("ny_alto_reglamentario_m")} onChange={v => s("ny_alto_reglamentario_m", v)} type="number" step="0.01" />
          <SInput label="Ancho Reglamentario (m)" value={g("ny_ancho_reglamentario_m")} onChange={v => s("ny_ancho_reglamentario_m", v)} type="number" step="0.01" />
          <SInput label="Profundidad Superior (m)" value={g("ny_prof_superior_m")} onChange={v => s("ny_prof_superior_m", v)} type="number" step="0.01" />
          <SInput label="Profundidad Inferior (m)" value={g("ny_prof_inferior_m")} onChange={v => s("ny_prof_inferior_m", v)} type="number" step="0.01" />
        </div>
        <SToggle label="Incluye Lona / Faldón" checked={Boolean(d["ny_incluye_lona"])} onChange={v => s("ny_incluye_lona", v)} />
      </FSection>
      <FSection title="Pasto Sintético (si aplica)">
        <div className="grid grid-cols-3 gap-4">
          <SInput label="Referencia Dicitex" value={g("ny_ref_dicitex")} onChange={v => s("ny_ref_dicitex", v)} mono />
          <SInput label="Altura de Fibra (mm)" value={g("ny_altura_fibra_mm")} onChange={v => s("ny_altura_fibra_mm", v)} type="number" />
          <SInput label="Tasa Puntadas/m²" value={g("ny_tasa_puntadas_m2")} onChange={v => s("ny_tasa_puntadas_m2", v)} type="number" />
          <SInput label="Galga" value={g("ny_galga")} onChange={v => s("ny_galga", v)} />
          <SSelect label="Base Primaria" value={g("ny_base_primaria")} onChange={v => s("ny_base_primaria", v)} opts={[["pp_tejido","PP Tejido"],["poliester","Poliéster"],["pp_no_tejido","PP No Tejido"]]} />
          <SSelect label="Base Secundaria" value={g("ny_base_secundaria")} onChange={v => s("ny_base_secundaria", v)} opts={[["latex","Látex"],["poliuretano","Poliuretano"],["sin_base","Sin Base Secundaria"]]} />
        </div>
      </FSection>
    </div>
  );
}

function FichaPlasticas({ d, s }: { d: FD; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-4">
      <FSection title="Material">
        <div className="grid grid-cols-2 gap-4">
          <SSelect label="Polímero Base" value={g("pl_polimero_base")} onChange={v => s("pl_polimero_base", v)} opts={[["pead","PEAD"],["pe","PE (Polietileno)"],["pp","PP (Polipropileno)"],["pvc","PVC"]]} />
          <SSelect label="Subtipo de Malla" value={g("pl_subtipo")} onChange={v => s("pl_subtipo", v)} opts={[["reja","Reja Plástica"],["pollito","Malla Pollito"],["polisombra","Polisombra / Sombra"],["senalizacion","Señalización"],["geomalla","Geomalla"],["gallinero","Malla Gallinero"],["invernadero","Malla Invernadero"]]} />
        </div>
        <SToggle label="Aditivo UV" desc="Material con protección UV incorporada en el proceso de fabricación" checked={Boolean(d["pl_aditivo_uv"])} onChange={v => s("pl_aditivo_uv", v)} />
      </FSection>
      <FSection title="Geometría">
        <div className="grid grid-cols-2 gap-4">
          <SSelect label="Forma del Hueco" value={g("pl_forma_hueco")} onChange={v => s("pl_forma_hueco", v)} opts={[["cuadrado","Cuadrado"],["rectangular","Rectangular"],["rombo","Rombo / Diamante"],["hexagonal","Hexagonal"],["circular","Circular"]]} />
          <SInput label="Tamaño de Abertura" value={g("pl_tamano_abertura")} onChange={v => s("pl_tamano_abertura", v)} placeholder="ej: 5×5 cm" />
        </div>
      </FSection>
      <FSection title="Dimensiones del Rollo">
        <div className="grid grid-cols-3 gap-4">
          <SInput label="Alto / Ancho (m)" value={g("pl_alto_m")} onChange={v => s("pl_alto_m", v)} type="number" step="0.01" />
          <SInput label="Largo del Rollo (m)" value={g("pl_largo_rollo_m")} onChange={v => s("pl_largo_rollo_m", v)} type="number" step="0.1" />
          <SInput label="% Sombra" value={g("pl_porcentaje_sombra")} onChange={v => s("pl_porcentaje_sombra", v)} type="number" hint="0–100%" />
          <SInput label="Peso (kg/m²)" value={g("pl_peso_kg_m2")} onChange={v => s("pl_peso_kg_m2", v)} type="number" step="0.001" />
          <SSelect label="Color Estándar" value={g("pl_color_estandar")} onChange={v => s("pl_color_estandar", v)} opts={[["verde","Verde"],["negro","Negro"],["naranja","Naranja"],["amarillo","Amarillo"],["rojo","Rojo"],["azul","Azul"],["blanco","Blanco"],["gris","Gris"]]} />
        </div>
      </FSection>
    </div>
  );
}

function FichaSeguridad({ d, s }: { d: FD; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-4">
      <FSection title="Tipo de Producto">
        <SSelect label="Subtipo" value={g("sp_subtipo")} onChange={v => s("sp_subtipo", v)} opts={[["concertina","Concertina"],["alambre_puas","Alambre de Púas"],["alambre_galv","Alambre Galvanizado Liso"],["alambre_pvc","Alambre Galvanizado + PVC"],["alambre_cerca","Alambre para Cerca Eléctrica"],["energizador","Energizador / Electrificador"],["aislador","Aislador"],["varilla_tierra","Varilla de Tierra"],["sensor","Sensor de Vibración / Alarma"]]} />
      </FSection>
      <FSection title="Especificaciones del Alambre">
        <div className="grid grid-cols-3 gap-4">
          <SSelect label="Material Cuchillas / Alambre" value={g("sp_material_cuchillas")} onChange={v => s("sp_material_cuchillas", v)} opts={[["acero_galv","Acero Galvanizado"],["acero_inox","Acero Inoxidable"],["acero_pvc","Acero + PVC"]]} />
          <SInput label="Calibre BWG" value={g("sp_calibre_bwg")} onChange={v => s("sp_calibre_bwg", v)} mono />
          <SInput label="Calibre (mm)" value={g("sp_calibre_mm")} onChange={v => s("sp_calibre_mm", v)} type="number" step="0.01" />
        </div>
      </FSection>
      <FSection title="Concertina (si aplica)">
        <div className="grid grid-cols-2 gap-4">
          <SSelect label="Tipo de Concertina" value={g("sp_tipo_concertina")} onChange={v => s("sp_tipo_concertina", v)} opts={[["circular","Circular (CBT)"],["flat_wrap","Flat Wrap"],["bto_22","BTO-22"],["bto-65","BTO-65"],["razor_wire","Razor Wire"]]} />
          <SInput label="Diámetro del Rollo (mm)" value={g("sp_diametro_rollo_mm")} onChange={v => s("sp_diametro_rollo_mm", v)} type="number" />
          <SInput label="Número de Espirales" value={g("sp_num_espirales")} onChange={v => s("sp_num_espirales", v)} type="number" />
          <SInput label="Rendimiento (ml)" value={g("sp_rendimiento_ml")} onChange={v => s("sp_rendimiento_ml", v)} type="number" step="0.1" />
        </div>
      </FSection>
      <FSection title="Energizador (si aplica)">
        <div className="grid grid-cols-3 gap-4">
          <SInput label="Voltaje de Salida (V)" value={g("sp_voltaje_v")} onChange={v => s("sp_voltaje_v", v)} type="number" />
          <SInput label="Cobertura (km)" value={g("sp_cobertura_km")} onChange={v => s("sp_cobertura_km", v)} type="number" step="0.1" />
          <SInput label="Cobertura (ha)" value={g("sp_cobertura_ha")} onChange={v => s("sp_cobertura_ha", v)} type="number" step="0.1" />
        </div>
        <SToggle label="Incluye Control Remoto" checked={Boolean(d["sp_control_remoto"])} onChange={v => s("sp_control_remoto", v)} />
      </FSection>
      <FSection title="Dimensiones y Notas">
        <SInput label="Peso (kg)" value={g("sp_peso_kg")} onChange={v => s("sp_peso_kg", v)} type="number" step="0.01" />
        <STextarea label="Notas de Instalación" value={g("sp_notas_instalacion")} onChange={v => s("sp_notas_instalacion", v)} rows={3} />
      </FSection>
    </div>
  );
}

const FICHAS: Record<string, React.ComponentType<{ d: FD; s: (k: string, v: unknown) => void }>> = {
  mm: FichaMetalicas, bh: FichaBalcones, ny: FichaNylon, pl: FichaPlasticas, sp: FichaSeguridad,
};

// ─── Formulario principal ─────────────────────────────────────

const TABS = [
  { id: "producto",    label: "Producto" },
  { id: "descripcion", label: "Descripción" },
  { id: "calidad",     label: "Calidad" },
] as const;
type TabId = typeof TABS[number]["id"] | "ficha";

export default function ProductoFormDinamico({ initialData, productoId, modo }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("producto");
  const [saving, setSaving] = useState(false);
  const init = initialData ?? {};

  const [form, setForm] = useState<FD>({
    sku: "", nombre: "", descCorta: "", descripcion: "",
    precioNormal: "", precioOferta: "",
    stock: 0, stockMinimo: 15, permiteBackorders: "no",
    pesoKg: "", largoCm: "", anchoCm: "", altoCm: "",
    categorias: [], etiquetas: [],
    publicado: false, destacado: false,
    intEstado: "BORRADOR", intListoExportar: false, intObservaciones: "",
    acfSkuInterno: "", acfMarcaFabricante: "", acfUnidadVenta: "",
    acfFabricacionMedida: false, acfInstalacion: false, acfGarantiaAnos: "",
    acfAplicaciones: [], acfColores: [], acfNormas: [],
    acfFichaTecnicaPdf: "", acfCertificaciones: [],
    acfExtra: (init.acfExtra as FD) ?? {},
    ...init,
  });

  const set = useCallback((k: string, v: unknown) => setForm(p => ({ ...p, [k]: v })), []);
  const setX = useCallback((k: string, v: unknown) => setForm(p => ({ ...p, acfExtra: { ...(p.acfExtra as FD), [k]: v } })), []);

  const cats = Array.isArray(form.categorias) ? form.categorias as string[] : [];
  // Todas las categorías con ficha técnica seleccionadas
  const fichasActivas = Object.entries(ACF_KEY)
    .filter(([cat]) => cats.includes(cat))
    .map(([cat, key]) => ({ key, info: CATS.find(c => c.v === cat)! }))
    .filter(f => f.info);
  const [activeFichaKey, setActiveFichaKey] = useState<string | null>(null);
  const fichaKey = activeFichaKey && fichasActivas.find(f => f.key === activeFichaKey)
    ? activeFichaKey
    : fichasActivas[0]?.key ?? null;
  const FichaComp = fichaKey ? FICHAS[fichaKey] : null;
  const fichaInfo = fichasActivas.find(f => f.key === fichaKey)?.info;

  const g = (k: string) => String(form[k] ?? "");
  const gn = (k: string) => form[k] != null && String(form[k]) !== "" ? String(form[k]) : "";

  const save = async () => {
    if (!g("sku").trim()) return toast.error("SKU requerido");
    if (!g("nombre").trim()) return toast.error("Nombre requerido");
    setSaving(true);
    try {
      const payload = {
        ...form,
        precioNormal: gn("precioNormal") ? parseFloat(gn("precioNormal")) : null,
        precioOferta: gn("precioOferta") ? parseFloat(gn("precioOferta")) : null,
        pesoKg: gn("pesoKg") ? parseFloat(gn("pesoKg")) : null,
        largoCm: gn("largoCm") ? parseFloat(gn("largoCm")) : null,
        anchoCm: gn("anchoCm") ? parseFloat(gn("anchoCm")) : null,
        altoCm: gn("altoCm") ? parseFloat(gn("altoCm")) : null,
        acfGarantiaAnos: gn("acfGarantiaAnos") ? parseInt(gn("acfGarantiaAnos")) : null,
        stock: parseInt(g("stock")) || 0,
        stockMinimo: parseInt(g("stockMinimo")) || 15,
      };
      const url = modo === "crear" ? "/api/productos" : `/api/productos/${productoId}`;
      const res = await fetch(url, { method: modo === "crear" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al guardar");
      toast.success(modo === "crear" ? "Producto creado ✓" : "Guardado ✓");
      if (modo === "crear") router.push(`/productos/${json.data.id}`);
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Barra de tabs ── */}
      <div className="bg-white border-b border-gray-100 px-6 flex items-center gap-0.5">
        <div className="flex items-center flex-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as TabId)}
              className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all -mb-px ${tab === t.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"}`}>
              {t.label}
            </button>
          ))}
          {fichasActivas.length > 0 && (
            <button onClick={() => setTab("ficha")}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${tab === "ficha" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              Ficha Técnica
              {fichasActivas.length > 1 && <span className="text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded-full">{fichasActivas.length}</span>}
            </button>
          )}
        </div>
        <button onClick={save} disabled={saving} className="btn-primary btn-sm ml-4 flex-shrink-0">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {modo === "crear" ? "Crear producto" : "Guardar cambios"}
        </button>
      </div>

      {/* ── Contenido de cada pestaña ── */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

        {/* PESTAÑA: PRODUCTO */}
        {tab === "producto" && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

            {/* Columna principal */}
            <div className="space-y-5">

              {/* Identificación */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Identificación</p>
                <div className="grid grid-cols-2 gap-4">
                  <SInput label="SKU *" value={g("sku")} onChange={v => set("sku", v)} placeholder="MN-001" mono />
                  <SInput label="SKU Interno" value={g("acfSkuInterno")} onChange={v => set("acfSkuInterno", v)} mono />
                </div>
                <SInput label="Nombre del producto *" value={g("nombre")} onChange={v => set("nombre", v)} placeholder="Nombre completo tal como aparece en la tienda" />
                <div className="grid grid-cols-2 gap-4">
                  <SInput label="Marca / Fabricante" value={g("acfMarcaFabricante")} onChange={v => set("acfMarcaFabricante", v)} />
                  <SSelect label="Unidad de Venta" value={g("acfUnidadVenta")} onChange={v => set("acfUnidadVenta", v)} opts={[["m2","m²"],["ml","ml"],["und","Unidad"],["rollo","Rollo"],["panel","Panel"],["kit","Kit"],["par","Par"]]} />
                </div>
              </div>

              {/* Precios */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Precios</p>
                <div className="grid grid-cols-2 gap-4">
                  <SInput label="Precio Normal (COP)" value={gn("precioNormal")} onChange={v => set("precioNormal", v)} type="number" placeholder="0" />
                  <SInput label="Precio Oferta (COP)" value={gn("precioOferta")} onChange={v => set("precioOferta", v)} type="number" placeholder="0" />
                </div>
              </div>

              {/* Inventario */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Inventario</p>
                <div className="grid grid-cols-3 gap-4">
                  <SInput label="Stock actual" value={String(form.stock ?? 0)} onChange={v => set("stock", v)} type="number" />
                  <SInput label="Stock mínimo" value={String(form.stockMinimo ?? 15)} onChange={v => set("stockMinimo", v)} type="number" />
                  <SSelect label="Backorders" value={g("permiteBackorders")} onChange={v => set("permiteBackorders", v)} opts={[["no","No permitir"],["notify","Notificar"],["yes","Permitir"]]} />
                </div>
              </div>

              {/* Dimensiones */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dimensiones y Peso</p>
                <div className="grid grid-cols-4 gap-4">
                  <SInput label="Peso (kg)" value={gn("pesoKg")} onChange={v => set("pesoKg", v)} type="number" step="0.001" />
                  <SInput label="Largo (cm)" value={gn("largoCm")} onChange={v => set("largoCm", v)} type="number" step="0.01" />
                  <SInput label="Ancho (cm)" value={gn("anchoCm")} onChange={v => set("anchoCm", v)} type="number" step="0.01" />
                  <SInput label="Alto (cm)" value={gn("altoCm")} onChange={v => set("altoCm", v)} type="number" step="0.01" />
                </div>
              </div>

              {/* Servicios */}
              <div className="card p-5 space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Servicios adicionales</p>
                <SToggle label="Fabricación a Medida" desc="Se puede fabricar según especificaciones del cliente" checked={Boolean(form.acfFabricacionMedida)} onChange={v => set("acfFabricacionMedida", v)} />
                <SToggle label="Instalación Disponible" desc="Costamallas ofrece servicio de instalación para este producto" checked={Boolean(form.acfInstalacion)} onChange={v => set("acfInstalacion", v)} />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">

              {/* Estado */}
              <div className="card p-4 space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Estado</p>
                {[["BORRADOR","📝 Borrador","text-gray-600"],["REVISION","🔍 En revisión","text-blue-600"],["LISTO","✅ Listo","text-green-600"],["PUBLICADO","🌐 Publicado","text-emerald-600"],["ARCHIVADO","📦 Archivado","text-gray-400"]].map(([v, l, cls]) => (
                  <button type="button" key={v} onClick={() => set("intEstado", v)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${g("intEstado") === v ? "bg-gray-900 text-white" : `${cls} hover:bg-gray-50`}`}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Publicación */}
              <div className="card p-4 space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Publicación</p>
                <SToggle label="Publicado en tienda" desc="Visible en costamallas.com" checked={Boolean(form.publicado)} onChange={v => set("publicado", v)} />
                <SToggle label="Producto destacado" desc="Aparece en secciones featured" checked={Boolean(form.destacado)} onChange={v => set("destacado", v)} />
                <SToggle label="Listo para exportar" desc="Aparece en la cola de exportación a WC" checked={Boolean(form.intListoExportar)} onChange={v => set("intListoExportar", v)} />
              </div>

              {/* Categorías */}
              <div className="card p-4">
                <CatDropdown value={cats} onChange={v => set("categorias", v)} />
              </div>

              {/* Etiquetas */}
              <div className="card p-4">
                <TagInput label="Etiquetas" value={Array.isArray(form.etiquetas) ? form.etiquetas as string[] : []} onChange={v => set("etiquetas", v)} hint="Enter o coma para agregar" />
              </div>

              {/* Garantía */}
              <div className="card p-4">
                <SInput label="Garantía (años)" value={gn("acfGarantiaAnos")} onChange={v => set("acfGarantiaAnos", v)} type="number" />
              </div>

              {/* Observaciones */}
              <div className="card p-4">
                <STextarea label="Observaciones internas" value={g("intObservaciones")} onChange={v => set("intObservaciones", v)} rows={3} placeholder="Notas del equipo, pendientes…" />
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: DESCRIPCIÓN */}
        {tab === "descripcion" && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="card p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Textos del producto</p>
              <STextarea label="Descripción Corta" value={g("descCorta")} onChange={v => set("descCorta", v)} rows={3} placeholder="Descripción breve que aparece en listados…" />
              <STextarea label="Descripción Completa" value={g("descripcion")} onChange={v => set("descripcion", v)} rows={8} placeholder="Descripción detallada con características, ventajas, especificaciones generales…" />
            </div>
            <div className="card p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aplicaciones y Colores</p>
              <Repeater label="Aplicaciones / Usos del producto" value={(form.acfAplicaciones as FD[]) ?? []} onChange={v => set("acfAplicaciones", v)} cols={[{k:"aplicacion_item",l:"Describe el uso o aplicación"}]} />
              <Divider label="" />
              <Repeater label="Colores disponibles" value={(form.acfColores as FD[]) ?? []} onChange={v => set("acfColores", v)} cols={[{k:"color_item",l:"Nombre del color"}]} />
            </div>
          </div>
        )}

        {/* PESTAÑA: CALIDAD */}
        {tab === "calidad" && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="card p-5 space-y-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calidad y Certificaciones</p>
              <TagInput label="Normas de Calidad" value={Array.isArray(form.acfNormas) ? form.acfNormas as string[] : []} onChange={v => set("acfNormas", v)} placeholder="ISO 9001, ASTM A392…" hint="Enter para agregar cada norma" />
              <Divider label="" />
              <TagInput label="Certificaciones" value={Array.isArray(form.acfCertificaciones) ? form.acfCertificaciones as string[] : []} onChange={v => set("acfCertificaciones", v)} hint="Enter para agregar cada certificación" />
              <Divider label="" />
              <SInput label="URL Ficha Técnica (PDF)" value={g("acfFichaTecnicaPdf")} onChange={v => set("acfFichaTecnicaPdf", v || (null as unknown as string))} placeholder="https://catalogo.costamallas.com/fichas/…" hint="Enlace directo al archivo PDF hospedado en el catálogo" />
            </div>
          </div>
        )}

        {/* PESTAÑA: FICHA TÉCNICA */}
        {tab === "ficha" && (
          <div className="max-w-4xl mx-auto">
            {fichasActivas.length > 0 ? (
              <>
                {/* Sub-tabs si hay más de una ficha */}
                {fichasActivas.length > 1 && (
                  <div className="flex gap-2 mb-5">
                    {fichasActivas.map(f => (
                      <button key={f.key} type="button" onClick={() => setActiveFichaKey(f.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${fichaKey === f.key ? `${f.info.c} shadow-sm` : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                        {f.info.l}
                      </button>
                    ))}
                  </div>
                )}
                {FichaComp && fichaInfo && (
                  <>
                    <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl mb-5 ${fichaInfo.c}`}>
                      <div>
                        <p className="font-bold text-[14px]">Ficha Técnica — {fichaInfo.l}</p>
                        <p className="text-white/70 text-xs">Completa los campos técnicos específicos de esta categoría</p>
                      </div>
                    </div>
                    <FichaComp d={(form.acfExtra as FD) ?? {}} s={setX} />
                  </>
                )}
              </>
            ) : (
              <div className="card p-12 text-center">
                <p className="text-sm font-semibold text-gray-500 mb-1">Sin ficha técnica activa</p>
                <p className="text-xs text-gray-400">Selecciona una categoría específica en la pestaña <strong>Producto</strong> para habilitar su ficha técnica.</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {Object.entries(ACF_KEY).map(([cat]) => {
                    const info = CATS.find(c => c.v === cat);
                    return info ? <span key={cat} className={`text-xs px-3 py-1.5 rounded-full font-medium ${info.c}`}>{info.l}</span> : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
