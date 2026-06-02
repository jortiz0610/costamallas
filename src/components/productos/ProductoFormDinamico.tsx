"use client";

import { useState, useCallback, useRef } from "react";
import {
  Save, Loader2, Plus, Trash2, ChevronDown,
  Tag, FileText, Shield, Layers, Package,
  Info, BarChart2, Ruler, Zap, Settings2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type FormData = Record<string, unknown>;
interface ProductoFormProps {
  initialData?: FormData;
  productoId?: string;
  modo: "crear" | "editar";
}

// ── Primitivos de campo ───────────────────────────────────────

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${checked ? "border-cm-yellow bg-cm-yellow/5" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}>
      <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${checked ? "bg-cm-yellow" : "bg-gray-300"}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
      <div>
        <p className={`text-[13px] font-medium transition-colors ${checked ? "text-cm-black" : "text-gray-600"}`}>{label}</p>
        {desc && <p className="text-[11px] text-gray-400">{desc}</p>}
      </div>
    </button>
  );
}

function Seccion({ title, icon: Icon, children, defaultOpen = true, accent }: {
  title: string; icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode; defaultOpen?: boolean; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 transition-all ${open ? "bg-gray-50 border-b border-gray-100" : "hover:bg-gray-50"}`}>
        {Icon && <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent ?? "bg-gray-100"}`}>
          <Icon size={14} className={accent ? "text-white" : "text-gray-500"} />
        </div>}
        <span className="text-[12px] font-semibold text-gray-700 flex-1 text-left">{title}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

function Repeater({ label, value, onChange, columns }: {
  label: string;
  value: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
  columns: { key: string; label: string; type?: string; choices?: Record<string, string> }[];
}) {
  const rows = Array.isArray(value) ? value : [];
  const addRow = () => onChange([...rows, Object.fromEntries(columns.map((c) => [c.key, ""]))]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, key: string, val: unknown) => {
    const next = [...rows]; next[i] = { ...next[i], [key]: val }; onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-[11px] font-medium text-cm-black bg-cm-yellow/20 hover:bg-cm-yellow/40 px-3 py-1.5 rounded-lg transition-colors">
          <Plus size={11} /> Agregar
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-[12px] text-gray-400">
          Sin filas — haz clic en "Agregar"
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              {columns.map((c) => (
                <div key={c.key} className="flex-1">
                  {c.choices ? (
                    <select className="input py-1.5 text-[12px] bg-white" value={String(row[c.key] ?? "")} onChange={(e) => updateRow(i, c.key, e.target.value)}>
                      <option value="">— {c.label}</option>
                      {Object.entries(c.choices).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <input type={c.type ?? "text"} step={c.type === "number" ? "any" : undefined} placeholder={c.label} className="input py-1.5 text-[12px] bg-white" value={String(row[c.key] ?? "")} onChange={(e) => updateRow(i, c.key, e.target.value)} />
                  )}
                </div>
              ))}
              <button type="button" onClick={() => removeRow(i)} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckboxGroup({ label, choices, value, onChange }: {
  label: string; choices: Record<string, string>; value: string[]; onChange: (v: string[]) => void;
}) {
  const vals = Array.isArray(value) ? value : [];
  const toggle = (k: string) => vals.includes(k) ? onChange(vals.filter((v) => v !== k)) : onChange([...vals, k]);
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-2">
        {Object.entries(choices).map(([k, v]) => (
          <button type="button" key={k} onClick={() => toggle(k)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border-2 transition-all duration-150 ${vals.includes(k) ? "bg-cm-yellow border-cm-yellow text-cm-black scale-105" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <F label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Seleccionar</option>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </F>
  );
}

function Num({ label, value, onChange, step = "any", hint }: { label: string; value: string; onChange: (v: string) => void; step?: string; hint?: string }) {
  return <F label={label} hint={hint}><input type="number" step={step} className="input" value={value} onChange={(e) => onChange(e.target.value)} /></F>;
}

function Txt({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <F label={label}><input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></F>;
}

// ── Fichas técnicas por categoría ─────────────────────────────

function ACFMetalicas({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? "");
  return (
    <div className="space-y-4">
      <Seccion title="Material y Acabado" icon={Layers} accent="bg-gray-700" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Sel label="Tipo de Acero" value={g("mm_tipo_acero")} onChange={(v) => set("mm_tipo_acero", v)} options={[["galvanizado","Galvanizado"],["galvanizado_pvc","Galvanizado + PVC"],["inoxidable","Inoxidable"],["negro","Acero Negro"]]} />
          <Sel label="Acabado Exterior" value={g("mm_acabado_exterior")} onChange={(v) => set("mm_acabado_exterior", v)} options={[["zinc_electro","Zinc Electrolítico"],["zinc_caliente","Zinc Galvanizado en Caliente"],["pvc","PVC"],["epoxi","Epoxi"],["sin_recubrimiento","Sin Recubrimiento"]]} />
          <Num label="Zinc (g/m²)" value={g("mm_zinc_gr_m2")} onChange={(v) => set("mm_zinc_gr_m2", v)} />
        </div>
      </Seccion>
      <Seccion title="Calibre del Alambre" icon={Ruler} accent="bg-blue-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Txt label="Calibre Externo BWG" value={g("mm_calibre_ext_bwg")} onChange={(v) => set("mm_calibre_ext_bwg", v)} />
          <Num label="Calibre Externo (mm)" value={g("mm_calibre_ext_mm")} onChange={(v) => set("mm_calibre_ext_mm", v)} step="0.01" />
          <Txt label="Calibre Interno BWG" value={g("mm_calibre_int_bwg")} onChange={(v) => set("mm_calibre_int_bwg", v)} />
          <Num label="Calibre Interno (mm)" value={g("mm_calibre_int_mm")} onChange={(v) => set("mm_calibre_int_mm", v)} step="0.01" />
          <Txt label="Tamaño del Ojo / Abertura" value={g("mm_tamano_ojo")} onChange={(v) => set("mm_tamano_ojo", v)} />
        </div>
      </Seccion>
      <Seccion title="Propiedades Mecánicas" icon={BarChart2} accent="bg-orange-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Num label="Resistencia Tensión (MPa)" value={g("mm_resistencia_tension_mpa")} onChange={(v) => set("mm_resistencia_tension_mpa", v)} />
          <Num label="Resistencia Tracción (kN/m)" value={g("mm_resistencia_traccion_kn")} onChange={(v) => set("mm_resistencia_traccion_kn", v)} step="0.1" />
          <Num label="Dureza Shore A (PVC)" value={g("mm_dureza_shore_a")} onChange={(v) => set("mm_dureza_shore_a", v)} />
          <Num label="Horas Cámara Salina" value={g("mm_horas_camara_salina")} onChange={(v) => set("mm_horas_camara_salina", v)} />
        </div>
        <Toggle label="Certificación LEED" desc="El producto cumple requisitos LEED" checked={Boolean(data["mm_certificacion_leed"])} onChange={(v) => set("mm_certificacion_leed", v)} />
      </Seccion>
      <Seccion title="Dimensiones y Peso" icon={Package} accent="bg-purple-500" defaultOpen>
        <div className="grid grid-cols-4 gap-4">
          <Num label="Alto (m)" value={g("mm_alto_m")} onChange={(v) => set("mm_alto_m", v)} step="0.01" />
          <Num label="Ancho (m)" value={g("mm_ancho_m")} onChange={(v) => set("mm_ancho_m", v)} step="0.01" />
          <Num label="Longitud Rollo (m)" value={g("mm_longitud_rollo_m")} onChange={(v) => set("mm_longitud_rollo_m", v)} step="0.1" />
          <Num label="Peso (kg)" value={g("mm_peso_kg")} onChange={(v) => set("mm_peso_kg", v)} step="0.01" />
        </div>
        <Toggle label="Incluye Abrazaderas" checked={Boolean(data["mm_incluye_abrazaderas"])} onChange={(v) => set("mm_incluye_abrazaderas", v)} />
        <F label="Compatibilidad Química"><textarea className="input" rows={3} value={g("mm_compatibilidad_quimica")} onChange={(e) => set("mm_compatibilidad_quimica", e.target.value)} /></F>
      </Seccion>
      <Seccion title="Tabla de Variantes" icon={Settings2} accent="bg-teal-500" defaultOpen={false}>
        <Repeater label="Hueco × Calibre × Unidad × Peso" value={(data["mm_tabla_variantes"] as Record<string, unknown>[]) ?? []} onChange={(v) => set("mm_tabla_variantes", v)}
          columns={[{key:"var_hueco",label:"Hueco / Abertura"},{key:"var_calibre",label:"Calibre"},{key:"var_unidad",label:"Unidad",choices:{m2:"m²",ml:"ml",rollo:"Rollo",panel:"Panel"}},{key:"var_peso",label:"Peso kg/m²",type:"number"}]} />
      </Seccion>
    </div>
  );
}

function ACFBalcones({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? "");
  return (
    <div className="space-y-4">
      <Seccion title="Fibra y Composición" icon={Layers} accent="bg-pink-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Sel label="Material del Filamento" value={g("bh_material_filamento")} onChange={(v) => set("bh_material_filamento", v)} options={[["poliester","Poliéster"],["polipropileno","Polipropileno"],["nylon","Nylon (Poliamida)"],["polietileno","Polietileno"]]} />
          <Num label="Diámetro del Hilo (mm)" value={g("bh_diametro_hilo_mm")} onChange={(v) => set("bh_diametro_hilo_mm", v)} step="0.01" />
          <Num label="Denier" value={g("bh_denier")} onChange={(v) => set("bh_denier", v)} />
          <Txt label="Título del Hilo" value={g("bh_titulo_hilo")} onChange={(v) => set("bh_titulo_hilo", v)} />
        </div>
      </Seccion>
      <Seccion title="Propiedades Mecánicas" icon={BarChart2} accent="bg-orange-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Num label="Tenacidad (g/denier)" value={g("bh_tenacidad_g_denier")} onChange={(v) => set("bh_tenacidad_g_denier", v)} step="0.01" />
          <Num label="Elongación (%)" value={g("bh_elongacion_pct")} onChange={(v) => set("bh_elongacion_pct", v)} step="0.1" />
          <Num label="Resistencia Tracción (kgf)" value={g("bh_resistencia_traccion_kgf")} onChange={(v) => set("bh_resistencia_traccion_kgf", v)} step="0.1" />
          <Num label="Resistencia al Impacto (J)" value={g("bh_resistencia_impacto_j")} onChange={(v) => set("bh_resistencia_impacto_j", v)} step="0.1" />
          <Num label="Carga Admisible (kg/m²)" value={g("bh_carga_kg_m2")} onChange={(v) => set("bh_carga_kg_m2", v)} step="0.1" />
        </div>
      </Seccion>
      <Seccion title="Dimensiones" icon={Ruler} accent="bg-blue-500" defaultOpen>
        <div className="grid grid-cols-3 gap-4">
          <Txt label="Tamaño de Abertura" value={g("bh_tamano_abertura")} onChange={(v) => set("bh_tamano_abertura", v)} />
          <Num label="Ancho Estándar (m)" value={g("bh_ancho_estandar_m")} onChange={(v) => set("bh_ancho_estandar_m", v)} step="0.01" />
          <Num label="Largo Estándar (m)" value={g("bh_largo_estandar_m")} onChange={(v) => set("bh_largo_estandar_m", v)} step="0.01" />
        </div>
      </Seccion>
      <Seccion title="Resistencia UV y Temperatura" icon={Zap} accent="bg-yellow-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Num label="Estabilidad Dimensional (%)" value={g("bh_estabilidad_dimensional_pct")} onChange={(v) => set("bh_estabilidad_dimensional_pct", v)} step="0.1" />
          <Num label="Temperatura Máxima (°C)" value={g("bh_temp_max_uso_c")} onChange={(v) => set("bh_temp_max_uso_c", v)} />
          <Sel label="Estabilizador UV" value={g("bh_estabilizador_uv")} onChange={(v) => set("bh_estabilizador_uv", v)} options={[["uv_estabilizado","UV Estabilizado"],["uv_no","Sin Protección UV"],["uv_premium","UV Premium (HLS)"]]} />
          <Txt label="Norma / Certificación" value={g("bh_norma_certificacion")} onChange={(v) => set("bh_norma_certificacion", v)} />
        </div>
      </Seccion>
      <Seccion title="Aplicaciones y Accesorios" icon={Tag} accent="bg-green-500" defaultOpen>
        <CheckboxGroup label="Espacios de Aplicación" choices={{balcon:"Balcón",ventana:"Ventana",escalera:"Escalera",terraza:"Terraza",piscina:"Piscina",rack:"Rack / Bodega",fachada:"Fachada",jardin:"Jardín"}} value={(data["bh_espacios_aplicacion"] as string[]) ?? []} onChange={(v) => set("bh_espacios_aplicacion", v)} />
        <Toggle label="Kit Autoinstalable" desc="Incluye instrucciones y accesorios para instalación" checked={Boolean(data["bh_kit_autoinstalable"])} onChange={(v) => set("bh_kit_autoinstalable", v)} />
        <Repeater label="Accesorios Incluidos" value={(data["bh_accesorios_incluidos"] as Record<string, unknown>[]) ?? []} onChange={(v) => set("bh_accesorios_incluidos", v)} columns={[{key:"accesorio_item",label:"Accesorio"},{key:"accesorio_qty",label:"Cantidad",type:"number"}]} />
      </Seccion>
    </div>
  );
}

function ACFNylon({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? "");
  return (
    <div className="space-y-4">
      <Seccion title="Tipo de Tejido" icon={Layers} accent="bg-indigo-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Sel label="Tipo de Tejido" value={g("ny_tipo_tejido")} onChange={(v) => set("ny_tipo_tejido", v)} options={[["mano","Tejido a Mano (Knotted)"],["maquina","Tejido a Máquina (Knotless)"],["extruido","Extruido"]]} />
          <Num label="Calibre del Hilo (mm)" value={g("ny_calibre_mm")} onChange={(v) => set("ny_calibre_mm", v)} step="0.01" />
          <Txt label="Tamaño del Cuadro / Malla" value={g("ny_tamano_cuadro")} onChange={(v) => set("ny_tamano_cuadro", v)} />
        </div>
        <Toggle label="Tiene Alma Interior" checked={Boolean(data["ny_tiene_alma"])} onChange={(v) => set("ny_tiene_alma", v)} />
      </Seccion>
      <Seccion title="Uso Deportivo" icon={Zap} accent="bg-green-600" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Sel label="Uso Principal" value={g("ny_uso_deportivo")} onChange={(v) => set("ny_uso_deportivo", v)} options={[["futbol","Fútbol"],["voleibol","Voleibol"],["tenis","Tenis"],["basquetbol","Básquetbol"],["cerramiento","Cerramiento Deportivo"],["cubierta","Cubierta / Techo"],["anticaida","Anticaída / Seguridad"],["beisbol","Béisbol"],["golf","Golf"]]} />
          <Txt label="Norma Anticaída (EN 1263, etc.)" value={g("ny_norma_anticaida")} onChange={(v) => set("ny_norma_anticaida", v)} />
          <Num label="Alto Reglamentario (m)" value={g("ny_alto_reglamentario_m")} onChange={(v) => set("ny_alto_reglamentario_m", v)} step="0.01" />
          <Num label="Ancho Reglamentario (m)" value={g("ny_ancho_reglamentario_m")} onChange={(v) => set("ny_ancho_reglamentario_m", v)} step="0.01" />
          <Num label="Profundidad Superior (m)" value={g("ny_prof_superior_m")} onChange={(v) => set("ny_prof_superior_m", v)} step="0.01" />
          <Num label="Profundidad Inferior (m)" value={g("ny_prof_inferior_m")} onChange={(v) => set("ny_prof_inferior_m", v)} step="0.01" />
        </div>
        <Toggle label="Incluye Lona / Faldón" checked={Boolean(data["ny_incluye_lona"])} onChange={(v) => set("ny_incluye_lona", v)} />
      </Seccion>
      <Seccion title="Pasto Sintético" icon={Tag} accent="bg-lime-600" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4">
          <Txt label="Referencia Dicitex" value={g("ny_ref_dicitex")} onChange={(v) => set("ny_ref_dicitex", v)} />
          <Num label="Altura de Fibra (mm)" value={g("ny_altura_fibra_mm")} onChange={(v) => set("ny_altura_fibra_mm", v)} />
          <Num label="Tasa de Puntadas / m²" value={g("ny_tasa_puntadas_m2")} onChange={(v) => set("ny_tasa_puntadas_m2", v)} />
          <Txt label="Galga" value={g("ny_galga")} onChange={(v) => set("ny_galga", v)} />
          <Num label="Peso de Fibra (g/m²)" value={g("ny_peso_fibra_g_m2")} onChange={(v) => set("ny_peso_fibra_g_m2", v)} />
          <Sel label="Base Primaria" value={g("ny_base_primaria")} onChange={(v) => set("ny_base_primaria", v)} options={[["pp_tejido","PP Tejido"],["poliester","Poliéster"],["pp_no_tejido","PP No Tejido"]]} />
          <Sel label="Base Secundaria" value={g("ny_base_secundaria")} onChange={(v) => set("ny_base_secundaria", v)} options={[["latex","Látex"],["poliuretano","Poliuretano"],["sin_base","Sin Base Secundaria"]]} />
        </div>
      </Seccion>
    </div>
  );
}

function ACFPlasticas({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? "");
  return (
    <div className="space-y-4">
      <Seccion title="Material" icon={Layers} accent="bg-green-600" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Sel label="Polímero Base" value={g("pl_polimero_base")} onChange={(v) => set("pl_polimero_base", v)} options={[["pead","PEAD (Polietileno Alta Densidad)"],["pe","PE (Polietileno)"],["pp","PP (Polipropileno)"],["pvc","PVC"]]} />
          <Sel label="Subtipo de Malla" value={g("pl_subtipo")} onChange={(v) => set("pl_subtipo", v)} options={[["reja","Reja Plástica"],["pollito","Malla Pollito"],["polisombra","Polisombra / Sombra"],["senalizacion","Señalización"],["geomalla","Geomalla"],["gallinero","Malla Gallinero"],["invernadero","Malla Invernadero"]]} />
        </div>
        <Toggle label="Aditivo UV" desc="Material con protección UV incorporada" checked={Boolean(data["pl_aditivo_uv"])} onChange={(v) => set("pl_aditivo_uv", v)} />
      </Seccion>
      <Seccion title="Geometría" icon={Settings2} accent="bg-teal-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Sel label="Forma del Hueco" value={g("pl_forma_hueco")} onChange={(v) => set("pl_forma_hueco", v)} options={[["cuadrado","Cuadrado"],["rectangular","Rectangular"],["rombo","Rombo / Diamante"],["hexagonal","Hexagonal"],["circular","Circular"]]} />
          <Txt label="Tamaño de Abertura" value={g("pl_tamano_abertura")} onChange={(v) => set("pl_tamano_abertura", v)} />
        </div>
      </Seccion>
      <Seccion title="Dimensiones del Rollo" icon={Ruler} accent="bg-blue-500" defaultOpen>
        <div className="grid grid-cols-2 gap-4">
          <Num label="Alto / Ancho (m)" value={g("pl_alto_m")} onChange={(v) => set("pl_alto_m", v)} step="0.01" />
          <Num label="Largo del Rollo (m)" value={g("pl_largo_rollo_m")} onChange={(v) => set("pl_largo_rollo_m", v)} step="0.1" />
          <Num label="Porcentaje de Sombra (%)" value={g("pl_porcentaje_sombra")} onChange={(v) => set("pl_porcentaje_sombra", v)} hint="0–100%" />
          <Num label="Peso (kg/m²)" value={g("pl_peso_kg_m2")} onChange={(v) => set("pl_peso_kg_m2", v)} step="0.001" />
          <Sel label="Color Estándar" value={g("pl_color_estandar")} onChange={(v) => set("pl_color_estandar", v)} options={[["verde","Verde"],["negro","Negro"],["naranja","Naranja"],["amarillo","Amarillo"],["rojo","Rojo"],["azul","Azul"],["blanco","Blanco"],["gris","Gris"]]} />
        </div>
      </Seccion>
    </div>
  );
}

function ACFSeguridad({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => String(data[k] ?? "");
  return (
    <div className="space-y-4">
      <Seccion title="Tipo de Producto" icon={Shield} accent="bg-red-600" defaultOpen>
        <Sel label="Subtipo" value={g("sp_subtipo")} onChange={(v) => set("sp_subtipo", v)} options={[["concertina","Concertina"],["alambre_puas","Alambre de Púas"],["alambre_galv","Alambre Galvanizado Liso"],["alambre_pvc","Alambre Galvanizado + PVC"],["alambre_cerca","Alambre para Cerca Eléctrica"],["energizador","Energizador / Electrificador"],["aislador","Aislador"],["varilla_tierra","Varilla de Tierra"],["sensor","Sensor de Vibración / Alarma"]]} />
      </Seccion>
      <Seccion title="Especificaciones del Alambre" icon={Ruler} accent="bg-gray-700" defaultOpen>
        <div className="grid grid-cols-3 gap-4">
          <Sel label="Material Cuchillas / Alambre" value={g("sp_material_cuchillas")} onChange={(v) => set("sp_material_cuchillas", v)} options={[["acero_galv","Acero Galvanizado"],["acero_inox","Acero Inoxidable"],["acero_pvc","Acero + PVC"]]} />
          <Txt label="Calibre BWG" value={g("sp_calibre_bwg")} onChange={(v) => set("sp_calibre_bwg", v)} />
          <Num label="Calibre (mm)" value={g("sp_calibre_mm")} onChange={(v) => set("sp_calibre_mm", v)} step="0.01" />
        </div>
      </Seccion>
      <Seccion title="Concertina" icon={Settings2} accent="bg-orange-600" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4">
          <Sel label="Tipo de Concertina" value={g("sp_tipo_concertina")} onChange={(v) => set("sp_tipo_concertina", v)} options={[["circular","Circular (CBT)"],["flat_wrap","Flat Wrap"],["bto_22","BTO-22"],["bto-65","BTO-65"],["razor_wire","Razor Wire"]]} />
          <Num label="Diámetro del Rollo (mm)" value={g("sp_diametro_rollo_mm")} onChange={(v) => set("sp_diametro_rollo_mm", v)} />
          <Num label="Número de Espirales" value={g("sp_num_espirales")} onChange={(v) => set("sp_num_espirales", v)} />
          <Num label="Rendimiento (ml)" value={g("sp_rendimiento_ml")} onChange={(v) => set("sp_rendimiento_ml", v)} step="0.1" />
        </div>
      </Seccion>
      <Seccion title="Energizador" icon={Zap} accent="bg-yellow-600" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-4">
          <Num label="Voltaje de Salida (V)" value={g("sp_voltaje_v")} onChange={(v) => set("sp_voltaje_v", v)} />
          <Num label="Cobertura (km)" value={g("sp_cobertura_km")} onChange={(v) => set("sp_cobertura_km", v)} step="0.1" />
          <Num label="Cobertura (ha)" value={g("sp_cobertura_ha")} onChange={(v) => set("sp_cobertura_ha", v)} step="0.1" />
        </div>
        <Toggle label="Incluye Control Remoto" checked={Boolean(data["sp_control_remoto"])} onChange={(v) => set("sp_control_remoto", v)} />
      </Seccion>
      <Seccion title="Dimensiones y Notas" icon={Package} accent="bg-purple-600" defaultOpen>
        <Num label="Peso (kg)" value={g("sp_peso_kg")} onChange={(v) => set("sp_peso_kg", v)} step="0.01" />
        <F label="Notas de Instalación"><textarea className="input" rows={3} value={g("sp_notas_instalacion")} onChange={(e) => set("sp_notas_instalacion", e.target.value)} /></F>
      </Seccion>
    </div>
  );
}

// ── Config de tabs y categorías ───────────────────────────────

const TABS = [
  { id: "producto", label: "Producto", icon: Package },
  { id: "identificacion", label: "Identificación", icon: Info },
  { id: "descripcion", label: "Descripción & Usos", icon: FileText },
  { id: "calidad", label: "Calidad", icon: Shield },
] as const;

type TabId = typeof TABS[number]["id"] | "fichaACF";

const CATEGORIA_ACF: Record<string, { label: string; emoji: string; color: string; component: React.ComponentType<{ data: FormData; set: (k: string, v: unknown) => void }> }> = {
  "mallas-metalicas":       { label: "Metálicas",           emoji: "🔩", color: "bg-gray-700",   component: ACFMetalicas },
  "mallas-para-balcones":   { label: "Balcones / Hogar",    emoji: "🏠", color: "bg-pink-500",   component: ACFBalcones },
  "mallas-nylon":           { label: "Nylon / Deportivas",  emoji: "🎾", color: "bg-green-600",  component: ACFNylon },
  "mallas-plasticas":       { label: "Plásticas",           emoji: "🟢", color: "bg-teal-500",   component: ACFPlasticas },
  "seguridad-perimetral":   { label: "Seguridad Perimetral",emoji: "🔒", color: "bg-red-600",    component: ACFSeguridad },
};

// ── Componente principal ──────────────────────────────────────

export default function ProductoFormDinamico({ initialData, productoId, modo }: ProductoFormProps) {
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
    claseEnvio: "", permiteResenas: true,
    publicado: false, destacado: false, visibilidad: "visible",
    intEstado: "BORRADOR", intListoExportar: false, intObservaciones: "",
    acfSkuInterno: "", acfMarcaFabricante: "", acfUnidadVenta: "",
    acfFabricacionMedida: false, acfInstalacion: false, acfGarantiaAnos: "",
    acfAplicaciones: [], acfColores: [], acfNormas: [],
    acfFichaTecnicaPdf: "", acfCertificaciones: [],
    acfExtra: (init.acfExtra as FormData) ?? {},
    ...init,
  });

  const set = useCallback((k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v })), []);
  const setExtra = useCallback((k: string, v: unknown) => setForm((p) => ({ ...p, acfExtra: { ...(p.acfExtra as FormData), [k]: v } })), []);

  const cats = Array.isArray(form.categorias) ? form.categorias as string[] : [];
  const categoriaACF = Object.keys(CATEGORIA_ACF).find((c) => cats.includes(c));
  const ACFConfig = categoriaACF ? CATEGORIA_ACF[categoriaACF] : null;
  const ACFComponent = ACFConfig?.component ?? null;

  const handleSave = async () => {
    if (!String(form.sku).trim()) return toast.error("SKU es requerido");
    if (!String(form.nombre).trim()) return toast.error("Nombre es requerido");
    setSaving(true);
    try {
      const payload = {
        ...form,
        precioNormal: form.precioNormal !== "" ? parseFloat(String(form.precioNormal)) : null,
        precioOferta: form.precioOferta !== "" ? parseFloat(String(form.precioOferta)) : null,
        pesoKg: form.pesoKg !== "" ? parseFloat(String(form.pesoKg)) : null,
        largoCm: form.largoCm !== "" ? parseFloat(String(form.largoCm)) : null,
        anchoCm: form.anchoCm !== "" ? parseFloat(String(form.anchoCm)) : null,
        altoCm: form.altoCm !== "" ? parseFloat(String(form.altoCm)) : null,
        acfGarantiaAnos: form.acfGarantiaAnos !== "" ? parseInt(String(form.acfGarantiaAnos)) : null,
        stock: parseInt(String(form.stock)) || 0,
        stockMinimo: parseInt(String(form.stockMinimo)) || 15,
        categorias: typeof form.categorias === "string" ? String(form.categorias).split(",").map((s) => s.trim()).filter(Boolean) : form.categorias,
        etiquetas: typeof form.etiquetas === "string" ? String(form.etiquetas).split(",").map((s) => s.trim()).filter(Boolean) : form.etiquetas,
      };
      const url = modo === "crear" ? "/api/productos" : `/api/productos/${productoId}`;
      const res = await fetch(url, { method: modo === "crear" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al guardar");
      toast.success(modo === "crear" ? "✅ Producto creado" : "✅ Cambios guardados");
      if (modo === "crear") router.push(`/productos/${json.data.id}`);
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  const g = (k: string) => String(form[k] ?? "");
  const gn = (k: string) => form[k] !== null && form[k] !== undefined && form[k] !== "" ? String(form[k]) : "";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-6 flex items-center gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as TabId)}
            className={`flex items-center gap-2 px-4 py-3.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all duration-200 ${tab === id ? "border-cm-yellow text-cm-black" : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"}`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
        {ACFConfig && (
          <button onClick={() => setTab("fichaACF")}
            className={`flex items-center gap-2 px-4 py-3.5 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-all duration-200 ${tab === "fichaACF" ? "border-cm-yellow text-cm-black" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            <span className="text-base leading-none">{ACFConfig.emoji}</span>
            Ficha: {ACFConfig.label}
          </button>
        )}
        <div className="ml-auto py-2 pl-4 flex-shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-cm-yellow text-cm-black font-semibold text-[13px] rounded-xl hover:bg-yellow-400 transition-colors shadow-sm disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {modo === "crear" ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

        {/* TAB: Producto */}
        {tab === "producto" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-6xl">
            <div className="lg:col-span-2 space-y-4">
              <Seccion title="Información básica" icon={Package} accent="bg-cm-yellow" defaultOpen>
                <div className="grid grid-cols-2 gap-4">
                  <F label="SKU *"><input className="input font-mono" value={g("sku")} onChange={(e) => set("sku", e.target.value)} placeholder="ej: MN-001" /></F>
                  <F label="Nombre *"><input className="input" value={g("nombre")} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre del producto" /></F>
                </div>
                <F label="Descripción corta"><textarea className="input" rows={2} value={g("descCorta")} onChange={(e) => set("descCorta", e.target.value)} /></F>
                <F label="Descripción larga"><textarea className="input" rows={4} value={g("descripcion")} onChange={(e) => set("descripcion", e.target.value)} /></F>
              </Seccion>

              <Seccion title="Precios" icon={BarChart2} accent="bg-green-500" defaultOpen>
                <div className="grid grid-cols-2 gap-4">
                  <F label="Precio normal (COP)"><input type="number" className="input" value={gn("precioNormal")} onChange={(e) => set("precioNormal", e.target.value)} placeholder="0" /></F>
                  <F label="Precio oferta (COP)"><input type="number" className="input" value={gn("precioOferta")} onChange={(e) => set("precioOferta", e.target.value)} placeholder="0" /></F>
                </div>
              </Seccion>

              <Seccion title="Inventario" icon={Layers} accent="bg-blue-500" defaultOpen>
                <div className="grid grid-cols-3 gap-4">
                  <F label="Stock actual"><input type="number" className="input" value={String(form.stock ?? 0)} onChange={(e) => set("stock", e.target.value)} /></F>
                  <F label="Stock mínimo"><input type="number" className="input" value={String(form.stockMinimo ?? 15)} onChange={(e) => set("stockMinimo", e.target.value)} /></F>
                  <F label="Backorders">
                    <select className="input" value={g("permiteBackorders")} onChange={(e) => set("permiteBackorders", e.target.value)}>
                      <option value="no">No permitir</option>
                      <option value="notify">Notificar</option>
                      <option value="yes">Permitir</option>
                    </select>
                  </F>
                </div>
              </Seccion>

              <Seccion title="Dimensiones y peso" icon={Ruler} accent="bg-purple-500" defaultOpen={false}>
                <div className="grid grid-cols-4 gap-4">
                  <Num label="Peso (kg)" value={gn("pesoKg")} onChange={(v) => set("pesoKg", v)} step="0.001" />
                  <Num label="Largo (cm)" value={gn("largoCm")} onChange={(v) => set("largoCm", v)} step="0.01" />
                  <Num label="Ancho (cm)" value={gn("anchoCm")} onChange={(v) => set("anchoCm", v)} step="0.01" />
                  <Num label="Alto (cm)" value={gn("altoCm")} onChange={(v) => set("altoCm", v)} step="0.01" />
                </div>
              </Seccion>
            </div>

            <div className="space-y-4">
              <Seccion title="Estado y publicación" icon={Zap} accent="bg-orange-500" defaultOpen>
                <F label="Estado interno">
                  <select className="input" value={g("intEstado")} onChange={(e) => set("intEstado", e.target.value)}>
                    {[["BORRADOR","📝 Borrador"],["REVISION","🔍 En revisión"],["LISTO","✅ Listo"],["PUBLICADO","🌐 Publicado"],["ARCHIVADO","📦 Archivado"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </F>
                <div className="space-y-2 pt-1">
                  <Toggle label="Publicado en tienda" desc="Visible en costamallas.com" checked={Boolean(form.publicado)} onChange={(v) => set("publicado", v)} />
                  <Toggle label="Destacado" desc="Aparece en secciones featured" checked={Boolean(form.destacado)} onChange={(v) => set("destacado", v)} />
                  <Toggle label="Listo para exportar" desc="Aparecerá en la cola de exportación" checked={Boolean(form.intListoExportar)} onChange={(v) => set("intListoExportar", v)} />
                </div>
              </Seccion>

              <Seccion title="Categorías" icon={Tag} accent="bg-indigo-500" defaultOpen>
                <F label="Categorías" hint="Separadas por coma. Define la ficha técnica activa.">
                  <input className="input" placeholder="mallas-metalicas, nylon"
                    value={Array.isArray(form.categorias) ? (form.categorias as string[]).join(", ") : String(form.categorias ?? "")}
                    onChange={(e) => set("categorias", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
                </F>
                {cats.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cats.map((c) => (
                      <span key={c} className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${CATEGORIA_ACF[c] ? "text-white " + CATEGORIA_ACF[c].color : "bg-gray-200 text-gray-600"}`}>
                        {CATEGORIA_ACF[c] ? `${CATEGORIA_ACF[c].emoji} ${CATEGORIA_ACF[c].label}` : c}
                      </span>
                    ))}
                  </div>
                )}
                <F label="Etiquetas" hint="Separadas por coma">
                  <input className="input" placeholder="exterior, resistente"
                    value={Array.isArray(form.etiquetas) ? (form.etiquetas as string[]).join(", ") : String(form.etiquetas ?? "")}
                    onChange={(e) => set("etiquetas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
                </F>
              </Seccion>

              <Seccion title="Notas internas" icon={FileText} accent="bg-gray-600" defaultOpen={false}>
                <textarea className="input text-[12px]" rows={4} value={g("intObservaciones")} onChange={(e) => set("intObservaciones", e.target.value)} placeholder="Notas del equipo…" />
              </Seccion>
            </div>
          </div>
        )}

        {/* TAB: Identificación */}
        {tab === "identificacion" && (
          <div className="max-w-2xl space-y-4">
            <Seccion title="Identificación del Producto" icon={Info} accent="bg-indigo-500" defaultOpen>
              <div className="grid grid-cols-2 gap-4">
                <Txt label="SKU Interno" value={g("acfSkuInterno")} onChange={(v) => set("acfSkuInterno", v)} />
                <Txt label="Marca / Fabricante" value={g("acfMarcaFabricante")} onChange={(v) => set("acfMarcaFabricante", v)} />
                <F label="Unidad de Venta">
                  <select className="input" value={g("acfUnidadVenta")} onChange={(e) => set("acfUnidadVenta", e.target.value)}>
                    <option value="">— Seleccionar</option>
                    {[["m2","m²"],["ml","ml"],["und","Unidad"],["rollo","Rollo"],["panel","Panel"],["kit","Kit"],["par","Par"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </F>
                <Num label="Garantía (años)" value={gn("acfGarantiaAnos")} onChange={(v) => set("acfGarantiaAnos", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Toggle label="Fabricación a Medida" desc="Se fabrica según especificaciones del cliente" checked={Boolean(form.acfFabricacionMedida)} onChange={(v) => set("acfFabricacionMedida", v)} />
                <Toggle label="Instalación Disponible" desc="Costamallas ofrece servicio de instalación" checked={Boolean(form.acfInstalacion)} onChange={(v) => set("acfInstalacion", v)} />
              </div>
            </Seccion>
          </div>
        )}

        {/* TAB: Descripción & Usos */}
        {tab === "descripcion" && (
          <div className="max-w-3xl space-y-4">
            <Seccion title="Descripción" icon={FileText} accent="bg-blue-500" defaultOpen>
              <F label="Descripción Corta"><textarea className="input" rows={4} value={g("descCorta")} onChange={(e) => set("descCorta", e.target.value)} /></F>
            </Seccion>
            <Seccion title="Aplicaciones / Usos" icon={Tag} accent="bg-green-500" defaultOpen>
              <Repeater label="Lista de aplicaciones del producto"
                value={(form.acfAplicaciones as Record<string, unknown>[]) ?? []}
                onChange={(v) => set("acfAplicaciones", v)}
                columns={[{ key: "aplicacion_item", label: "Descripción de la aplicación" }]} />
            </Seccion>
            <Seccion title="Colores Disponibles" icon={Layers} accent="bg-pink-500" defaultOpen>
              <Repeater label="Colores disponibles para este producto"
                value={(form.acfColores as Record<string, unknown>[]) ?? []}
                onChange={(v) => set("acfColores", v)}
                columns={[{ key: "color_item", label: "Nombre del color" }]} />
            </Seccion>
          </div>
        )}

        {/* TAB: Calidad */}
        {tab === "calidad" && (
          <div className="max-w-2xl space-y-4">
            <Seccion title="Normas y Certificaciones" icon={Shield} accent="bg-green-600" defaultOpen>
              <F label="Normas de Calidad" hint="Ej: ISO 9001, ASTM A392, NTC 2050">
                <input className="input" value={Array.isArray(form.acfNormas) ? (form.acfNormas as string[]).join(", ") : g("acfNormas")}
                  onChange={(e) => set("acfNormas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="ISO 9001, ASTM A392…" />
              </F>
              <F label="Certificaciones">
                <textarea className="input" rows={3}
                  value={Array.isArray(form.acfCertificaciones) ? (form.acfCertificaciones as string[]).join(", ") : g("acfCertificaciones")}
                  onChange={(e) => set("acfCertificaciones", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              </F>
              <F label="Ficha Técnica PDF (URL)" hint="Enlace directo al archivo PDF">
                <input className="input" type="url" value={g("acfFichaTecnicaPdf")} onChange={(e) => set("acfFichaTecnicaPdf", e.target.value || null)} placeholder="https://catalogo.costamallas.com/fichas/…" />
              </F>
            </Seccion>
          </div>
        )}

        {/* TAB: Ficha ACF por categoría */}
        {tab === "fichaACF" && (
          <div className="max-w-5xl">
            {ACFComponent && ACFConfig ? (
              <>
                <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-white mb-5 ${ACFConfig.color}`}>
                  <span className="text-2xl">{ACFConfig.emoji}</span>
                  <div>
                    <p className="font-bold text-[14px]">Ficha Técnica — {ACFConfig.label}</p>
                    <p className="text-white/70 text-[11px]">Completa los campos técnicos específicos de esta categoría</p>
                  </div>
                </div>
                <ACFComponent data={(form.acfExtra as FormData) ?? {}} set={setExtra} />
              </>
            ) : (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Layers size={28} className="text-gray-400" />
                </div>
                <p className="text-[14px] font-semibold text-gray-600 mb-2">Sin ficha técnica activa</p>
                <p className="text-[13px] text-gray-400 max-w-sm mx-auto">
                  Asigna una de estas categorías en la pestaña "Producto" para ver su ficha técnica:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {Object.entries(CATEGORIA_ACF).map(([k, v]) => (
                    <span key={k} className={`text-[11px] px-3 py-1.5 rounded-full text-white font-medium ${v.color}`}>
                      {v.emoji} {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
