"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Save, Loader2, Plus, Trash2, ChevronDown, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type FormData = Record<string, unknown>;
interface Props { initialData?: FormData; productoId?: string; modo: "crear" | "editar"; }

// ── Categorías disponibles ─────────────────────────────────────

const CATEGORIAS_DISPONIBLES = [
  { value: "mallas-metalicas",       label: "Mallas Metálicas",        color: "#374151" },
  { value: "mallas-para-balcones",   label: "Balcones / Hogar",        color: "#ec4899" },
  { value: "mallas-nylon",           label: "Nylon / Deportivas",      color: "#16a34a" },
  { value: "mallas-plasticas",       label: "Mallas Plásticas",        color: "#0d9488" },
  { value: "seguridad-perimetral",   label: "Seguridad Perimetral",    color: "#dc2626" },
  { value: "mallas-sombra",          label: "Mallas de Sombra",        color: "#ca8a04" },
  { value: "mallas-agricolas",       label: "Mallas Agrícolas",        color: "#65a30d" },
];

const ACF_POR_CATEGORIA: Record<string, string> = {
  "mallas-metalicas":     "metalicas",
  "mallas-para-balcones": "balcones",
  "mallas-nylon":         "nylon",
  "mallas-plasticas":     "plasticas",
  "seguridad-perimetral": "seguridad",
};

// ── Primitivos minimalistas ───────────────────────────────────

function Input({ label, value, onChange, placeholder, mono, type = "text", step, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; type?: string; step?: string; hint?: string;
}) {
  return (
    <div className="group">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{label}</label>
      <input
        type={type} step={step}
        className={`w-full bg-transparent border-0 border-b-2 border-gray-200 focus:border-cm-yellow outline-none py-2 text-[14px] text-gray-900 transition-colors placeholder:text-gray-300 ${mono ? "font-mono" : ""}`}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      />
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{label}</label>
      <textarea
        rows={rows}
        className="w-full bg-gray-50 rounded-xl border-2 border-transparent focus:border-cm-yellow outline-none p-3 text-[13px] text-gray-900 transition-colors resize-none placeholder:text-gray-300"
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: [string, string][]; hint?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{label}</label>
      <select
        className="w-full bg-transparent border-0 border-b-2 border-gray-200 focus:border-cm-yellow outline-none py-2 text-[13px] text-gray-900 transition-colors"
        value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Seleccionar</option>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-4 py-3 text-left group">
      <div className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${checked ? "bg-cm-yellow" : "bg-gray-200"}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${checked ? "translate-x-6" : "translate-x-0.5"}`} />
      </div>
      <div className="flex-1">
        <p className={`text-[13px] font-medium ${checked ? "text-gray-900" : "text-gray-500"}`}>{label}</p>
        {desc && <p className="text-[11px] text-gray-400">{desc}</p>}
      </div>
    </button>
  );
}

function Repeater({ label, value, onChange, columns }: {
  label: string; value: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
  columns: { key: string; label: string; type?: string; options?: [string,string][] }[];
}) {
  const rows = Array.isArray(value) ? value : [];
  const add = () => onChange([...rows, Object.fromEntries(columns.map(c => [c.key, ""]))]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i: number, k: string, v: unknown) => { const n = [...rows]; n[i] = { ...n[i], [k]: v }; onChange(n); };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</label>
        <button type="button" onClick={add} className="flex items-center gap-1 text-[11px] font-semibold text-cm-black hover:text-gray-600 transition-colors">
          <Plus size={12} /> Agregar
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <div className="border-2 border-dashed border-gray-100 rounded-xl p-4 text-center text-[12px] text-gray-300">Sin entradas</div>}
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <span className="text-[11px] font-mono font-bold text-gray-400 w-5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
            {columns.map(c => (
              <div key={c.key} className="flex-1">
                {c.options
                  ? <select className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] outline-none" value={String(row[c.key] ?? "")} onChange={e => update(i, c.key, e.target.value)}>
                      <option value="">—</option>
                      {c.options.map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  : <input type={c.type ?? "text"} step={c.type === "number" ? "any" : undefined} placeholder={c.label}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] outline-none focus:border-cm-yellow transition-colors"
                      value={String(row[c.key] ?? "")} onChange={e => update(i, c.key, e.target.value)} />
                }
              </div>
            ))}
            <button type="button" onClick={() => remove(i)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tags({ label, value, onChange, hint }: {
  label: string; value: string[]; onChange: (v: string[]) => void; hint?: string;
}) {
  const [input, setInput] = useState("");
  const add = () => { const t = input.trim(); if (t && !value.includes(t)) onChange([...value, t]); setInput(""); };
  const remove = (t: string) => onChange(value.filter(v => v !== t));
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(t => (
          <span key={t} className="flex items-center gap-1 bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-full">
            {t}
            <button type="button" onClick={() => remove(t)} className="hover:text-red-300 transition-colors"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 bg-transparent border-0 border-b-2 border-gray-200 focus:border-cm-yellow outline-none py-1.5 text-[13px] transition-colors"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Escribe y presiona Enter" />
        <button type="button" onClick={add} className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors">+ Agregar</button>
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function MultiSelect({ label, value, onChange }: {
  label: string; value: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (v: string) => value.includes(v) ? onChange(value.filter(c => c !== v)) : onChange([...value, v]);
  const selected = CATEGORIAS_DISPONIBLES.filter(c => value.includes(c.value));

  return (
    <div ref={ref} className="relative">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{label}</label>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between border-0 border-b-2 border-gray-200 hover:border-cm-yellow py-2 transition-colors text-left">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {selected.length === 0
            ? <span className="text-[13px] text-gray-300">Seleccionar categorías…</span>
            : selected.map(c => (
                <span key={c.value} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: c.color }}>
                  {c.label}
                </span>
              ))
          }
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform flex-shrink-0 ml-2 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
          {CATEGORIAS_DISPONIBLES.map(c => (
            <button type="button" key={c.value} onClick={() => toggle(c.value)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${value.includes(c.value) ? "text-white" : "border-2 border-gray-200"}`}
                style={value.includes(c.value) ? { backgroundColor: c.color } : {}}>
                {value.includes(c.value) && <Check size={11} />}
              </div>
              <span className="flex-1 text-[13px] font-medium text-gray-700">{c.label}</span>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckboxPills({ label, choices, value, onChange }: {
  label: string; choices: [string, string][]; value: string[]; onChange: (v: string[]) => void;
}) {
  const vals = Array.isArray(value) ? value : [];
  const toggle = (k: string) => vals.includes(k) ? onChange(vals.filter(v => v !== k)) : onChange([...vals, k]);
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {choices.map(([k, v]) => (
          <button type="button" key={k} onClick={() => toggle(k)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${vals.includes(k) ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Fichas ACF ────────────────────────────────────────────────

function FichaMetalicas({ d, s }: { d: FormData; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-8">
      <Block n="01" title="Material y Acabado">
        <div className="grid grid-cols-3 gap-6">
          <Select label="Tipo de Acero" value={g("mm_tipo_acero")} onChange={v => s("mm_tipo_acero", v)} options={[["galvanizado","Galvanizado"],["galvanizado_pvc","Galvanizado + PVC"],["inoxidable","Inoxidable"],["negro","Acero Negro"]]} />
          <Select label="Acabado Exterior" value={g("mm_acabado_exterior")} onChange={v => s("mm_acabado_exterior", v)} options={[["zinc_electro","Zinc Electrolítico"],["zinc_caliente","Zinc Galvanizado Caliente"],["pvc","PVC"],["epoxi","Epoxi"],["sin_recubrimiento","Sin Recubrimiento"]]} />
          <Input label="Zinc (g/m²)" value={g("mm_zinc_gr_m2")} onChange={v => s("mm_zinc_gr_m2", v)} type="number" />
        </div>
        <Toggle label="Certificación LEED" desc="El producto cumple estándares de construcción sostenible LEED" checked={Boolean(d["mm_certificacion_leed"])} onChange={v => s("mm_certificacion_leed", v)} />
      </Block>

      <Block n="02" title="Calibre del Alambre">
        <div className="grid grid-cols-2 gap-6">
          <Input label="Calibre Externo BWG" value={g("mm_calibre_ext_bwg")} onChange={v => s("mm_calibre_ext_bwg", v)} mono />
          <Input label="Calibre Externo (mm)" value={g("mm_calibre_ext_mm")} onChange={v => s("mm_calibre_ext_mm", v)} type="number" step="0.01" />
          <Input label="Calibre Interno BWG" value={g("mm_calibre_int_bwg")} onChange={v => s("mm_calibre_int_bwg", v)} mono />
          <Input label="Calibre Interno (mm)" value={g("mm_calibre_int_mm")} onChange={v => s("mm_calibre_int_mm", v)} type="number" step="0.01" />
        </div>
        <Input label="Tamaño del Ojo / Abertura" value={g("mm_tamano_ojo")} onChange={v => s("mm_tamano_ojo", v)} placeholder="ej: 1 × 1 pulgada" />
      </Block>

      <Block n="03" title="Propiedades Mecánicas">
        <div className="grid grid-cols-2 gap-6">
          <Input label="Resistencia a la Tensión (MPa)" value={g("mm_resistencia_tension_mpa")} onChange={v => s("mm_resistencia_tension_mpa", v)} type="number" />
          <Input label="Resistencia a la Tracción (kN/m)" value={g("mm_resistencia_traccion_kn")} onChange={v => s("mm_resistencia_traccion_kn", v)} type="number" step="0.1" />
          <Input label="Dureza Shore A (PVC)" value={g("mm_dureza_shore_a")} onChange={v => s("mm_dureza_shore_a", v)} type="number" />
          <Input label="Horas Cámara Salina" value={g("mm_horas_camara_salina")} onChange={v => s("mm_horas_camara_salina", v)} type="number" />
        </div>
        <Textarea label="Compatibilidad Química" value={g("mm_compatibilidad_quimica")} onChange={v => s("mm_compatibilidad_quimica", v)} rows={2} />
      </Block>

      <Block n="04" title="Dimensiones y Peso">
        <div className="grid grid-cols-4 gap-6">
          <Input label="Alto (m)" value={g("mm_alto_m")} onChange={v => s("mm_alto_m", v)} type="number" step="0.01" />
          <Input label="Ancho (m)" value={g("mm_ancho_m")} onChange={v => s("mm_ancho_m", v)} type="number" step="0.01" />
          <Input label="Longitud Rollo (m)" value={g("mm_longitud_rollo_m")} onChange={v => s("mm_longitud_rollo_m", v)} type="number" step="0.1" />
          <Input label="Peso (kg)" value={g("mm_peso_kg")} onChange={v => s("mm_peso_kg", v)} type="number" step="0.01" />
        </div>
        <Toggle label="Incluye Abrazaderas" checked={Boolean(d["mm_incluye_abrazaderas"])} onChange={v => s("mm_incluye_abrazaderas", v)} />
      </Block>

      <Block n="05" title="Tabla de Variantes">
        <Repeater label="Variantes disponibles (Hueco × Calibre)" value={(d["mm_tabla_variantes"] as Record<string, unknown>[]) ?? []} onChange={v => s("mm_tabla_variantes", v)}
          columns={[{key:"var_hueco",label:"Hueco / Abertura"},{key:"var_calibre",label:"Calibre"},{key:"var_unidad",label:"Unidad",options:[["m2","m²"],["ml","ml"],["rollo","Rollo"],["panel","Panel"]]},{key:"var_peso",label:"Peso kg/m²",type:"number"}]} />
      </Block>
    </div>
  );
}

function FichaBalcones({ d, s }: { d: FormData; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-8">
      <Block n="01" title="Fibra y Composición">
        <div className="grid grid-cols-2 gap-6">
          <Select label="Material del Filamento" value={g("bh_material_filamento")} onChange={v => s("bh_material_filamento", v)} options={[["poliester","Poliéster"],["polipropileno","Polipropileno"],["nylon","Nylon (Poliamida)"],["polietileno","Polietileno"]]} />
          <Input label="Diámetro del Hilo (mm)" value={g("bh_diametro_hilo_mm")} onChange={v => s("bh_diametro_hilo_mm", v)} type="number" step="0.01" />
          <Input label="Denier" value={g("bh_denier")} onChange={v => s("bh_denier", v)} type="number" />
          <Input label="Título del Hilo" value={g("bh_titulo_hilo")} onChange={v => s("bh_titulo_hilo", v)} />
        </div>
      </Block>
      <Block n="02" title="Propiedades Mecánicas">
        <div className="grid grid-cols-3 gap-6">
          <Input label="Tenacidad (g/denier)" value={g("bh_tenacidad_g_denier")} onChange={v => s("bh_tenacidad_g_denier", v)} type="number" step="0.01" />
          <Input label="Elongación (%)" value={g("bh_elongacion_pct")} onChange={v => s("bh_elongacion_pct", v)} type="number" step="0.1" />
          <Input label="Resistencia Tracción (kgf)" value={g("bh_resistencia_traccion_kgf")} onChange={v => s("bh_resistencia_traccion_kgf", v)} type="number" step="0.1" />
          <Input label="Resistencia al Impacto (J)" value={g("bh_resistencia_impacto_j")} onChange={v => s("bh_resistencia_impacto_j", v)} type="number" step="0.1" />
          <Input label="Carga Admisible (kg/m²)" value={g("bh_carga_kg_m2")} onChange={v => s("bh_carga_kg_m2", v)} type="number" step="0.1" />
        </div>
      </Block>
      <Block n="03" title="Dimensiones">
        <div className="grid grid-cols-3 gap-6">
          <Input label="Tamaño de Abertura" value={g("bh_tamano_abertura")} onChange={v => s("bh_tamano_abertura", v)} />
          <Input label="Ancho Estándar (m)" value={g("bh_ancho_estandar_m")} onChange={v => s("bh_ancho_estandar_m", v)} type="number" step="0.01" />
          <Input label="Largo Estándar (m)" value={g("bh_largo_estandar_m")} onChange={v => s("bh_largo_estandar_m", v)} type="number" step="0.01" />
        </div>
      </Block>
      <Block n="04" title="Resistencia UV y Temperatura">
        <div className="grid grid-cols-2 gap-6">
          <Input label="Estabilidad Dimensional (%)" value={g("bh_estabilidad_dimensional_pct")} onChange={v => s("bh_estabilidad_dimensional_pct", v)} type="number" step="0.1" />
          <Input label="Temperatura Máxima (°C)" value={g("bh_temp_max_uso_c")} onChange={v => s("bh_temp_max_uso_c", v)} type="number" />
          <Select label="Estabilizador UV" value={g("bh_estabilizador_uv")} onChange={v => s("bh_estabilizador_uv", v)} options={[["uv_estabilizado","UV Estabilizado"],["uv_no","Sin Protección UV"],["uv_premium","UV Premium (HLS)"]]} />
          <Input label="Norma / Certificación" value={g("bh_norma_certificacion")} onChange={v => s("bh_norma_certificacion", v)} />
        </div>
      </Block>
      <Block n="05" title="Aplicaciones y Accesorios">
        <CheckboxPills label="Espacios de Aplicación" choices={[["balcon","Balcón"],["ventana","Ventana"],["escalera","Escalera"],["terraza","Terraza"],["piscina","Piscina"],["rack","Rack / Bodega"],["fachada","Fachada"],["jardin","Jardín"]]} value={(d["bh_espacios_aplicacion"] as string[]) ?? []} onChange={v => s("bh_espacios_aplicacion", v)} />
        <Toggle label="Kit Autoinstalable" desc="Incluye instrucciones y accesorios para instalación sin ayuda profesional" checked={Boolean(d["bh_kit_autoinstalable"])} onChange={v => s("bh_kit_autoinstalable", v)} />
        <Repeater label="Accesorios Incluidos" value={(d["bh_accesorios_incluidos"] as Record<string, unknown>[]) ?? []} onChange={v => s("bh_accesorios_incluidos", v)} columns={[{key:"accesorio_item",label:"Nombre del accesorio"},{key:"accesorio_qty",label:"Cantidad",type:"number"}]} />
      </Block>
    </div>
  );
}

function FichaNylon({ d, s }: { d: FormData; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-8">
      <Block n="01" title="Tipo de Tejido">
        <div className="grid grid-cols-3 gap-6">
          <Select label="Tipo de Tejido" value={g("ny_tipo_tejido")} onChange={v => s("ny_tipo_tejido", v)} options={[["mano","Tejido a Mano (Knotted)"],["maquina","Tejido a Máquina (Knotless)"],["extruido","Extruido"]]} />
          <Input label="Calibre del Hilo (mm)" value={g("ny_calibre_mm")} onChange={v => s("ny_calibre_mm", v)} type="number" step="0.01" />
          <Input label="Tamaño del Cuadro / Malla" value={g("ny_tamano_cuadro")} onChange={v => s("ny_tamano_cuadro", v)} />
        </div>
        <Toggle label="Tiene Alma Interior" checked={Boolean(d["ny_tiene_alma"])} onChange={v => s("ny_tiene_alma", v)} />
      </Block>
      <Block n="02" title="Uso Deportivo">
        <div className="grid grid-cols-2 gap-6">
          <Select label="Uso Deportivo Principal" value={g("ny_uso_deportivo")} onChange={v => s("ny_uso_deportivo", v)} options={[["futbol","Fútbol"],["voleibol","Voleibol"],["tenis","Tenis"],["basquetbol","Básquetbol"],["cerramiento","Cerramiento Deportivo"],["cubierta","Cubierta / Techo"],["anticaida","Anticaída / Seguridad"],["beisbol","Béisbol"],["golf","Golf"]]} />
          <Input label="Norma Anticaída" value={g("ny_norma_anticaida")} onChange={v => s("ny_norma_anticaida", v)} placeholder="ej: EN 1263" />
          <Input label="Alto Reglamentario (m)" value={g("ny_alto_reglamentario_m")} onChange={v => s("ny_alto_reglamentario_m", v)} type="number" step="0.01" />
          <Input label="Ancho Reglamentario (m)" value={g("ny_ancho_reglamentario_m")} onChange={v => s("ny_ancho_reglamentario_m", v)} type="number" step="0.01" />
          <Input label="Profundidad Superior (m)" value={g("ny_prof_superior_m")} onChange={v => s("ny_prof_superior_m", v)} type="number" step="0.01" />
          <Input label="Profundidad Inferior (m)" value={g("ny_prof_inferior_m")} onChange={v => s("ny_prof_inferior_m", v)} type="number" step="0.01" />
        </div>
        <Toggle label="Incluye Lona / Faldón" checked={Boolean(d["ny_incluye_lona"])} onChange={v => s("ny_incluye_lona", v)} />
      </Block>
      <Block n="03" title="Pasto Sintético (si aplica)">
        <div className="grid grid-cols-2 gap-6">
          <Input label="Referencia Dicitex" value={g("ny_ref_dicitex")} onChange={v => s("ny_ref_dicitex", v)} mono />
          <Input label="Altura de Fibra (mm)" value={g("ny_altura_fibra_mm")} onChange={v => s("ny_altura_fibra_mm", v)} type="number" />
          <Input label="Tasa de Puntadas / m²" value={g("ny_tasa_puntadas_m2")} onChange={v => s("ny_tasa_puntadas_m2", v)} type="number" />
          <Input label="Galga" value={g("ny_galga")} onChange={v => s("ny_galga", v)} />
          <Select label="Base Primaria" value={g("ny_base_primaria")} onChange={v => s("ny_base_primaria", v)} options={[["pp_tejido","PP Tejido"],["poliester","Poliéster"],["pp_no_tejido","PP No Tejido"]]} />
          <Select label="Base Secundaria" value={g("ny_base_secundaria")} onChange={v => s("ny_base_secundaria", v)} options={[["latex","Látex"],["poliuretano","Poliuretano"],["sin_base","Sin Base Secundaria"]]} />
        </div>
      </Block>
    </div>
  );
}

function FichaPlasticas({ d, s }: { d: FormData; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-8">
      <Block n="01" title="Material">
        <div className="grid grid-cols-2 gap-6">
          <Select label="Polímero Base" value={g("pl_polimero_base")} onChange={v => s("pl_polimero_base", v)} options={[["pead","PEAD (Polietileno Alta Densidad)"],["pe","PE (Polietileno)"],["pp","PP (Polipropileno)"],["pvc","PVC"]]} />
          <Select label="Subtipo de Malla" value={g("pl_subtipo")} onChange={v => s("pl_subtipo", v)} options={[["reja","Reja Plástica"],["pollito","Malla Pollito"],["polisombra","Polisombra / Sombra"],["senalizacion","Señalización"],["geomalla","Geomalla"],["gallinero","Malla Gallinero"],["invernadero","Malla Invernadero"]]} />
        </div>
        <Toggle label="Aditivo UV" desc="Material con protección UV incorporada en proceso de fabricación" checked={Boolean(d["pl_aditivo_uv"])} onChange={v => s("pl_aditivo_uv", v)} />
      </Block>
      <Block n="02" title="Geometría de la Malla">
        <div className="grid grid-cols-2 gap-6">
          <Select label="Forma del Hueco" value={g("pl_forma_hueco")} onChange={v => s("pl_forma_hueco", v)} options={[["cuadrado","Cuadrado"],["rectangular","Rectangular"],["rombo","Rombo / Diamante"],["hexagonal","Hexagonal"],["circular","Circular"]]} />
          <Input label="Tamaño de Abertura" value={g("pl_tamano_abertura")} onChange={v => s("pl_tamano_abertura", v)} placeholder="ej: 5 × 5 cm" />
        </div>
      </Block>
      <Block n="03" title="Dimensiones del Rollo">
        <div className="grid grid-cols-3 gap-6">
          <Input label="Alto / Ancho (m)" value={g("pl_alto_m")} onChange={v => s("pl_alto_m", v)} type="number" step="0.01" />
          <Input label="Largo del Rollo (m)" value={g("pl_largo_rollo_m")} onChange={v => s("pl_largo_rollo_m", v)} type="number" step="0.1" />
          <Input label="Porcentaje de Sombra (%)" value={g("pl_porcentaje_sombra")} onChange={v => s("pl_porcentaje_sombra", v)} type="number" hint="0–100%" />
          <Input label="Peso (kg/m²)" value={g("pl_peso_kg_m2")} onChange={v => s("pl_peso_kg_m2", v)} type="number" step="0.001" />
          <Select label="Color Estándar" value={g("pl_color_estandar")} onChange={v => s("pl_color_estandar", v)} options={[["verde","Verde"],["negro","Negro"],["naranja","Naranja"],["amarillo","Amarillo"],["rojo","Rojo"],["azul","Azul"],["blanco","Blanco"],["gris","Gris"]]} />
        </div>
      </Block>
    </div>
  );
}

function FichaSeguridad({ d, s }: { d: FormData; s: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(d[k] ?? "");
  return (
    <div className="space-y-8">
      <Block n="01" title="Tipo de Producto">
        <Select label="Subtipo" value={g("sp_subtipo")} onChange={v => s("sp_subtipo", v)} options={[["concertina","Concertina"],["alambre_puas","Alambre de Púas"],["alambre_galv","Alambre Galvanizado Liso"],["alambre_pvc","Alambre Galvanizado + PVC"],["alambre_cerca","Alambre para Cerca Eléctrica"],["energizador","Energizador / Electrificador"],["aislador","Aislador"],["varilla_tierra","Varilla de Tierra"],["sensor","Sensor de Vibración / Alarma"]]} />
      </Block>
      <Block n="02" title="Especificaciones del Alambre">
        <div className="grid grid-cols-3 gap-6">
          <Select label="Material Cuchillas / Alambre" value={g("sp_material_cuchillas")} onChange={v => s("sp_material_cuchillas", v)} options={[["acero_galv","Acero Galvanizado"],["acero_inox","Acero Inoxidable"],["acero_pvc","Acero + PVC"]]} />
          <Input label="Calibre BWG" value={g("sp_calibre_bwg")} onChange={v => s("sp_calibre_bwg", v)} mono />
          <Input label="Calibre (mm)" value={g("sp_calibre_mm")} onChange={v => s("sp_calibre_mm", v)} type="number" step="0.01" />
        </div>
      </Block>
      <Block n="03" title="Concertina (si aplica)">
        <div className="grid grid-cols-2 gap-6">
          <Select label="Tipo de Concertina" value={g("sp_tipo_concertina")} onChange={v => s("sp_tipo_concertina", v)} options={[["circular","Circular (CBT)"],["flat_wrap","Flat Wrap"],["bto_22","BTO-22"],["bto-65","BTO-65"],["razor_wire","Razor Wire"]]} />
          <Input label="Diámetro del Rollo (mm)" value={g("sp_diametro_rollo_mm")} onChange={v => s("sp_diametro_rollo_mm", v)} type="number" />
          <Input label="Número de Espirales" value={g("sp_num_espirales")} onChange={v => s("sp_num_espirales", v)} type="number" />
          <Input label="Rendimiento (ml)" value={g("sp_rendimiento_ml")} onChange={v => s("sp_rendimiento_ml", v)} type="number" step="0.1" />
        </div>
      </Block>
      <Block n="04" title="Energizador (si aplica)">
        <div className="grid grid-cols-3 gap-6">
          <Input label="Voltaje de Salida (V)" value={g("sp_voltaje_v")} onChange={v => s("sp_voltaje_v", v)} type="number" />
          <Input label="Cobertura (km)" value={g("sp_cobertura_km")} onChange={v => s("sp_cobertura_km", v)} type="number" step="0.1" />
          <Input label="Cobertura (ha)" value={g("sp_cobertura_ha")} onChange={v => s("sp_cobertura_ha", v)} type="number" step="0.1" />
        </div>
        <Toggle label="Incluye Control Remoto" checked={Boolean(d["sp_control_remoto"])} onChange={v => s("sp_control_remoto", v)} />
      </Block>
      <Block n="05" title="Dimensiones y Notas de Instalación">
        <Input label="Peso (kg)" value={g("sp_peso_kg")} onChange={v => s("sp_peso_kg", v)} type="number" step="0.01" />
        <Textarea label="Notas de Instalación" value={g("sp_notas_instalacion")} onChange={v => s("sp_notas_instalacion", v)} rows={3} />
      </Block>
    </div>
  );
}

// ── Bloque de sección numerado ────────────────────────────────

function Block({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <span className="text-[11px] font-black text-gray-300 font-mono">{n}</span>
        <div className="w-px flex-1 bg-gray-100" />
      </div>
      <div className="flex-1 pb-8">
        <h3 className="text-[13px] font-bold text-gray-800 mb-5">{title}</h3>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}

// ── Nav de tabs ───────────────────────────────────────────────

const TABS = [
  { id: "producto",      label: "Producto" },
  { id: "descripcion",  label: "Descripción" },
  { id: "calidad",      label: "Calidad" },
] as const;

type TabId = typeof TABS[number]["id"] | "ficha";

const FICHA_MAP: Record<string, React.ComponentType<{ d: FormData; s: (k: string, v: unknown) => void }>> = {
  metalicas: FichaMetalicas,
  balcones:  FichaBalcones,
  nylon:     FichaNylon,
  plasticas: FichaPlasticas,
  seguridad: FichaSeguridad,
};

// ── Formulario principal ──────────────────────────────────────

export default function ProductoFormDinamico({ initialData, productoId, modo }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("producto");
  const [saving, setSaving] = useState(false);
  const init = initialData ?? {};

  const [form, setForm] = useState<FormData>({
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
    acfExtra: (init.acfExtra as FormData) ?? {},
    ...init,
  });

  const set = useCallback((k: string, v: unknown) => setForm(p => ({ ...p, [k]: v })), []);
  const setX = useCallback((k: string, v: unknown) => setForm(p => ({ ...p, acfExtra: { ...(p.acfExtra as FormData), [k]: v } })), []);

  const cats = Array.isArray(form.categorias) ? form.categorias as string[] : [];
  const fichaKey = Object.entries(ACF_POR_CATEGORIA).find(([cat]) => cats.includes(cat))?.[1] ?? null;
  const FichaComp = fichaKey ? FICHA_MAP[fichaKey] : null;
  const fichaLabel = fichaKey ? CATEGORIAS_DISPONIBLES.find(c => ACF_POR_CATEGORIA[c.value] === fichaKey)?.label : null;

  const g = (k: string) => String(form[k] ?? "");
  const gn = (k: string) => form[k] !== null && form[k] !== undefined && String(form[k]) !== "" ? String(form[k]) : "";

  const handleSave = async () => {
    if (!g("sku").trim()) return toast.error("SKU es requerido");
    if (!g("nombre").trim()) return toast.error("Nombre es requerido");
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
      toast.success(modo === "crear" ? "Producto creado" : "Guardado");
      if (modo === "crear") router.push(`/productos/${json.data.id}`);
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">

      {/* ── Header / Nav ── */}
      <div className="border-b border-gray-100 px-8 flex items-center">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto py-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as TabId)}
              className={`px-4 py-4 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all -mb-px ${tab === t.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}
            </button>
          ))}
          {FichaComp && (
            <button onClick={() => setTab("ficha")}
              className={`flex items-center gap-2 px-4 py-4 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${tab === "ficha" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              <span className="w-2 h-2 rounded-full bg-cm-yellow" />
              {fichaLabel}
            </button>
          )}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-[13px] font-semibold rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 ml-4 flex-shrink-0">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {modo === "crear" ? "Crear" : "Guardar"}
        </button>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-y-auto">

        {/* PRODUCTO */}
        {tab === "producto" && (
          <div className="max-w-5xl mx-auto px-8 py-8">
            <div className="grid grid-cols-3 gap-10">
              <div className="col-span-2 space-y-10">

                {/* Nombres */}
                <div className="grid grid-cols-2 gap-6">
                  <Input label="SKU *" value={g("sku")} onChange={v => set("sku", v)} placeholder="MN-001" mono />
                  <Input label="SKU Interno" value={g("acfSkuInterno")} onChange={v => set("acfSkuInterno", v)} mono />
                </div>
                <Input label="Nombre del producto *" value={g("nombre")} onChange={v => set("nombre", v)} placeholder="Nombre completo del producto" />

                <div className="grid grid-cols-2 gap-6">
                  <Input label="Marca / Fabricante" value={g("acfMarcaFabricante")} onChange={v => set("acfMarcaFabricante", v)} />
                  <Select label="Unidad de Venta" value={g("acfUnidadVenta")} onChange={v => set("acfUnidadVenta", v)} options={[["m2","m²"],["ml","ml"],["und","Unidad"],["rollo","Rollo"],["panel","Panel"],["kit","Kit"],["par","Par"]]} />
                </div>

                {/* Precios */}
                <div className="grid grid-cols-2 gap-6">
                  <Input label="Precio Normal (COP)" value={gn("precioNormal")} onChange={v => set("precioNormal", v)} type="number" placeholder="0" />
                  <Input label="Precio Oferta (COP)" value={gn("precioOferta")} onChange={v => set("precioOferta", v)} type="number" placeholder="0" />
                </div>

                {/* Stock */}
                <div className="grid grid-cols-3 gap-6">
                  <Input label="Stock actual" value={String(form.stock ?? 0)} onChange={v => set("stock", v)} type="number" />
                  <Input label="Stock mínimo" value={String(form.stockMinimo ?? 15)} onChange={v => set("stockMinimo", v)} type="number" />
                  <Select label="Backorders" value={g("permiteBackorders")} onChange={v => set("permiteBackorders", v)} options={[["no","No permitir"],["notify","Notificar"],["yes","Permitir"]]} />
                </div>

                {/* Dimensiones */}
                <div className="grid grid-cols-4 gap-6">
                  <Input label="Peso (kg)" value={gn("pesoKg")} onChange={v => set("pesoKg", v)} type="number" step="0.001" />
                  <Input label="Largo (cm)" value={gn("largoCm")} onChange={v => set("largoCm", v)} type="number" step="0.01" />
                  <Input label="Ancho (cm)" value={gn("anchoCm")} onChange={v => set("anchoCm", v)} type="number" step="0.01" />
                  <Input label="Alto (cm)" value={gn("altoCm")} onChange={v => set("altoCm", v)} type="number" step="0.01" />
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <Toggle label="Fabricación a Medida" desc="Se fabrica según especificaciones del cliente" checked={Boolean(form.acfFabricacionMedida)} onChange={v => set("acfFabricacionMedida", v)} />
                  <Toggle label="Instalación Disponible" desc="Costamallas ofrece servicio de instalación" checked={Boolean(form.acfInstalacion)} onChange={v => set("acfInstalacion", v)} />
                </div>
              </div>

              {/* Sidebar derecho */}
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Estado</label>
                  <div className="space-y-1">
                    {[["BORRADOR","Borrador"],["REVISION","En revisión"],["LISTO","Listo"],["PUBLICADO","Publicado"],["ARCHIVADO","Archivado"]].map(([v, l]) => (
                      <button type="button" key={v} onClick={() => set("intEstado", v)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${g("intEstado") === v ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Toggle label="Publicado" desc="Visible en tienda" checked={Boolean(form.publicado)} onChange={v => set("publicado", v)} />
                  <Toggle label="Destacado" checked={Boolean(form.destacado)} onChange={v => set("destacado", v)} />
                  <Toggle label="Listo para exportar" checked={Boolean(form.intListoExportar)} onChange={v => set("intListoExportar", v)} />
                </div>

                <MultiSelect label="Categorías" value={cats} onChange={v => set("categorias", v)} />

                <Tags label="Etiquetas" value={Array.isArray(form.etiquetas) ? form.etiquetas as string[] : []} onChange={v => set("etiquetas", v)} hint="Enter para agregar" />

                <Input label="Garantía (años)" value={gn("acfGarantiaAnos")} onChange={v => set("acfGarantiaAnos", v)} type="number" />

                <Textarea label="Observaciones internas" value={g("intObservaciones")} onChange={v => set("intObservaciones", v)} rows={3} placeholder="Notas del equipo…" />
              </div>
            </div>
          </div>
        )}

        {/* DESCRIPCIÓN */}
        {tab === "descripcion" && (
          <div className="max-w-3xl mx-auto px-8 py-8 space-y-10">
            <Block n="01" title="Descripción Corta">
              <Textarea label="" value={g("descCorta")} onChange={v => set("descCorta", v)} rows={4} placeholder="Descripción breve que aparece en listados de productos…" />
            </Block>
            <Block n="02" title="Descripción Completa">
              <Textarea label="" value={g("descripcion")} onChange={v => set("descripcion", v)} rows={8} placeholder="Descripción detallada, características, etc…" />
            </Block>
            <Block n="03" title="Aplicaciones y Usos">
              <Repeater label="Lista de aplicaciones" value={(form.acfAplicaciones as Record<string, unknown>[]) ?? []} onChange={v => set("acfAplicaciones", v)} columns={[{key:"aplicacion_item",label:"Describe la aplicación del producto"}]} />
            </Block>
            <Block n="04" title="Colores Disponibles">
              <Repeater label="Colores" value={(form.acfColores as Record<string, unknown>[]) ?? []} onChange={v => set("acfColores", v)} columns={[{key:"color_item",label:"Nombre del color"}]} />
            </Block>
          </div>
        )}

        {/* CALIDAD */}
        {tab === "calidad" && (
          <div className="max-w-3xl mx-auto px-8 py-8 space-y-10">
            <Block n="01" title="Normas de Calidad">
              <Tags label="Normas aplicables" value={Array.isArray(form.acfNormas) ? form.acfNormas as string[] : []} onChange={v => set("acfNormas", v)} hint="Ej: ISO 9001, ASTM A392, NTC 2050" />
            </Block>
            <Block n="02" title="Certificaciones">
              <Tags label="Certificaciones del producto" value={Array.isArray(form.acfCertificaciones) ? form.acfCertificaciones as string[] : []} onChange={v => set("acfCertificaciones", v)} />
            </Block>
            <Block n="03" title="Documentación Técnica">
              <Input label="URL Ficha Técnica (PDF)" value={g("acfFichaTecnicaPdf")} onChange={v => set("acfFichaTecnicaPdf", v || null as unknown as string)} placeholder="https://catalogo.costamallas.com/fichas/…" />
            </Block>
          </div>
        )}

        {/* FICHA TÉCNICA POR CATEGORÍA */}
        {tab === "ficha" && (
          <div className="max-w-4xl mx-auto px-8 py-8">
            {FichaComp ? (
              <FichaComp d={(form.acfExtra as FormData) ?? {}} s={setX} />
            ) : (
              <div className="text-center py-20 text-gray-300">
                <p className="text-[15px] font-semibold text-gray-400 mb-2">Sin ficha técnica activa</p>
                <p className="text-[13px]">Asigna una categoría específica en la pestaña Producto</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
