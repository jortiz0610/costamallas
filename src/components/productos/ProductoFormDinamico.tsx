"use client";

import { useState, useCallback } from "react";
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

// ── Tipos ─────────────────────────────────────────────────────

type FormData = Record<string, unknown>;

interface ProductoFormProps {
  initialData?: FormData;
  productoId?: string;
  modo: "crear" | "editar";
}

// ── Helpers de campos ─────────────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-cm-yellow" : "bg-gray-200"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
      <span className="text-[13px] text-gray-700 group-hover:text-gray-900">{label}</span>
    </label>
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
    const next = [...rows];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-medium text-gray-600">{label}</label>
        <button type="button" onClick={addRow} className="btn-secondary btn-sm text-[11px] py-0.5 px-2">
          <Plus size={11} /> Agregar fila
        </button>
      </div>
      {rows.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map((c) => <th key={c.key} className="text-left px-3 py-2 text-[10px] font-medium text-gray-500 uppercase">{c.label}</th>)}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-1.5">
                      {c.choices ? (
                        <select className="input py-1 text-[12px]" value={String(row[c.key] ?? "")} onChange={(e) => updateRow(i, c.key, e.target.value)}>
                          <option value="">—</option>
                          {Object.entries(c.choices).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : (
                        <input type={c.type ?? "text"} step={c.type === "number" ? "any" : undefined} className="input py-1 text-[12px]" value={String(row[c.key] ?? "")} onChange={(e) => updateRow(i, c.key, e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td className="px-2"><button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 0 && <p className="text-[11px] text-gray-400 italic">Sin filas. Haz clic en "Agregar fila".</p>}
    </div>
  );
}

function CheckboxGroup({ label, choices, value, onChange }: {
  label: string; choices: Record<string, string>;
  value: string[]; onChange: (v: string[]) => void;
}) {
  const vals = Array.isArray(value) ? value : [];
  const toggle = (k: string) => vals.includes(k) ? onChange(vals.filter((v) => v !== k)) : onChange([...vals, k]);
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(choices).map(([k, v]) => (
          <label key={k} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-[12px] transition-colors ${vals.includes(k) ? "bg-cm-yellow/10 border-cm-yellow text-cm-black font-medium" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
            <input type="checkbox" className="hidden" checked={vals.includes(k)} onChange={() => toggle(k)} />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}

function Seccion({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <span className="text-[12px] font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── Secciones ACF por categoría ───────────────────────────────

function ACFMetalicas({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => data[k] ?? "";
  return (
    <div className="space-y-4">
      <Seccion title="Material y Acabado">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo de Acero">
            <select className="input" value={String(g("mm_tipo_acero"))} onChange={(e) => set("mm_tipo_acero", e.target.value)}>
              <option value="">—</option>
              <option value="galvanizado">Galvanizado</option>
              <option value="galvanizado_pvc">Galvanizado + PVC</option>
              <option value="inoxidable">Inoxidable</option>
              <option value="negro">Acero Negro</option>
            </select>
          </Campo>
          <Campo label="Acabado Exterior">
            <select className="input" value={String(g("mm_acabado_exterior"))} onChange={(e) => set("mm_acabado_exterior", e.target.value)}>
              <option value="">—</option>
              <option value="zinc_electro">Zinc Electrolítico</option>
              <option value="zinc_caliente">Zinc Galvanizado en Caliente</option>
              <option value="pvc">Recubrimiento PVC</option>
              <option value="epoxi">Epoxi</option>
              <option value="sin_recubrimiento">Sin Recubrimiento</option>
            </select>
          </Campo>
          <Campo label="Zinc (g/m²)"><input type="number" className="input" value={String(g("mm_zinc_gr_m2"))} onChange={(e) => set("mm_zinc_gr_m2", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Calibre del Alambre">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Calibre Externo BWG"><input className="input" value={String(g("mm_calibre_ext_bwg"))} onChange={(e) => set("mm_calibre_ext_bwg", e.target.value)} /></Campo>
          <Campo label="Calibre Externo (mm)"><input type="number" step="0.01" className="input" value={String(g("mm_calibre_ext_mm"))} onChange={(e) => set("mm_calibre_ext_mm", e.target.value)} /></Campo>
          <Campo label="Calibre Interno BWG"><input className="input" value={String(g("mm_calibre_int_bwg"))} onChange={(e) => set("mm_calibre_int_bwg", e.target.value)} /></Campo>
          <Campo label="Calibre Interno (mm)"><input type="number" step="0.01" className="input" value={String(g("mm_calibre_int_mm"))} onChange={(e) => set("mm_calibre_int_mm", e.target.value)} /></Campo>
          <Campo label="Tamaño del Ojo / Abertura"><input className="input" value={String(g("mm_tamano_ojo"))} onChange={(e) => set("mm_tamano_ojo", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Propiedades Mecánicas">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Resistencia a la Tensión (MPa)"><input type="number" className="input" value={String(g("mm_resistencia_tension_mpa"))} onChange={(e) => set("mm_resistencia_tension_mpa", e.target.value)} /></Campo>
          <Campo label="Resistencia a la Tracción (kN/m)"><input type="number" step="0.1" className="input" value={String(g("mm_resistencia_traccion_kn"))} onChange={(e) => set("mm_resistencia_traccion_kn", e.target.value)} /></Campo>
          <Campo label="Dureza Shore A (PVC)"><input type="number" className="input" value={String(g("mm_dureza_shore_a"))} onChange={(e) => set("mm_dureza_shore_a", e.target.value)} /></Campo>
          <Campo label="Horas Cámara Salina"><input type="number" className="input" value={String(g("mm_horas_camara_salina"))} onChange={(e) => set("mm_horas_camara_salina", e.target.value)} /></Campo>
        </div>
        <Toggle label="Certificación LEED" checked={Boolean(g("mm_certificacion_leed"))} onChange={(v) => set("mm_certificacion_leed", v)} />
      </Seccion>

      <Seccion title="Dimensiones y Peso">
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Alto (m)"><input type="number" step="0.01" className="input" value={String(g("mm_alto_m"))} onChange={(e) => set("mm_alto_m", e.target.value)} /></Campo>
          <Campo label="Ancho (m)"><input type="number" step="0.01" className="input" value={String(g("mm_ancho_m"))} onChange={(e) => set("mm_ancho_m", e.target.value)} /></Campo>
          <Campo label="Longitud Rollo (m)"><input type="number" step="0.1" className="input" value={String(g("mm_longitud_rollo_m"))} onChange={(e) => set("mm_longitud_rollo_m", e.target.value)} /></Campo>
          <Campo label="Peso (kg)"><input type="number" step="0.01" className="input" value={String(g("mm_peso_kg"))} onChange={(e) => set("mm_peso_kg", e.target.value)} /></Campo>
        </div>
        <Toggle label="Incluye Abrazaderas" checked={Boolean(g("mm_incluye_abrazaderas"))} onChange={(v) => set("mm_incluye_abrazaderas", v)} />
        <Campo label="Compatibilidad Química"><textarea className="input" rows={3} value={String(g("mm_compatibilidad_quimica"))} onChange={(e) => set("mm_compatibilidad_quimica", e.target.value)} /></Campo>
      </Seccion>

      <Seccion title="Tabla de Variantes (Hueco × Calibre)">
        <Repeater
          label=""
          value={(data["mm_tabla_variantes"] as Record<string, unknown>[]) ?? []}
          onChange={(v) => set("mm_tabla_variantes", v)}
          columns={[
            { key: "var_hueco", label: "Hueco / Abertura" },
            { key: "var_calibre", label: "Calibre" },
            { key: "var_unidad", label: "Unidad", choices: { m2: "m²", ml: "ml", rollo: "Rollo", panel: "Panel" } },
            { key: "var_peso", label: "Peso kg/m²", type: "number" },
          ]}
        />
      </Seccion>
    </div>
  );
}

function ACFBalcones({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => data[k] ?? "";
  return (
    <div className="space-y-4">
      <Seccion title="Fibra y Composición">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Material del Filamento">
            <select className="input" value={String(g("bh_material_filamento"))} onChange={(e) => set("bh_material_filamento", e.target.value)}>
              <option value="">—</option>
              <option value="poliester">Poliéster</option>
              <option value="polipropileno">Polipropileno</option>
              <option value="nylon">Nylon (Poliamida)</option>
              <option value="polietileno">Polietileno</option>
            </select>
          </Campo>
          <Campo label="Diámetro del Hilo (mm)"><input type="number" step="0.01" className="input" value={String(g("bh_diametro_hilo_mm"))} onChange={(e) => set("bh_diametro_hilo_mm", e.target.value)} /></Campo>
          <Campo label="Denier"><input type="number" className="input" value={String(g("bh_denier"))} onChange={(e) => set("bh_denier", e.target.value)} /></Campo>
          <Campo label="Título del Hilo"><input className="input" value={String(g("bh_titulo_hilo"))} onChange={(e) => set("bh_titulo_hilo", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Propiedades Mecánicas">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tenacidad (g/denier)"><input type="number" step="0.01" className="input" value={String(g("bh_tenacidad_g_denier"))} onChange={(e) => set("bh_tenacidad_g_denier", e.target.value)} /></Campo>
          <Campo label="Elongación (%)"><input type="number" step="0.1" className="input" value={String(g("bh_elongacion_pct"))} onChange={(e) => set("bh_elongacion_pct", e.target.value)} /></Campo>
          <Campo label="Resistencia Tracción (kgf)"><input type="number" step="0.1" className="input" value={String(g("bh_resistencia_traccion_kgf"))} onChange={(e) => set("bh_resistencia_traccion_kgf", e.target.value)} /></Campo>
          <Campo label="Resistencia al Impacto (J)"><input type="number" step="0.1" className="input" value={String(g("bh_resistencia_impacto_j"))} onChange={(e) => set("bh_resistencia_impacto_j", e.target.value)} /></Campo>
          <Campo label="Carga Admisible (kg/m²)"><input type="number" step="0.1" className="input" value={String(g("bh_carga_kg_m2"))} onChange={(e) => set("bh_carga_kg_m2", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Dimensiones y Abertura">
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Tamaño de Abertura"><input className="input" value={String(g("bh_tamano_abertura"))} onChange={(e) => set("bh_tamano_abertura", e.target.value)} /></Campo>
          <Campo label="Ancho Estándar (m)"><input type="number" step="0.01" className="input" value={String(g("bh_ancho_estandar_m"))} onChange={(e) => set("bh_ancho_estandar_m", e.target.value)} /></Campo>
          <Campo label="Largo Estándar (m)"><input type="number" step="0.01" className="input" value={String(g("bh_largo_estandar_m"))} onChange={(e) => set("bh_largo_estandar_m", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Resistencia UV y Temperatura">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Estabilidad Dimensional (%)"><input type="number" step="0.1" className="input" value={String(g("bh_estabilidad_dimensional_pct"))} onChange={(e) => set("bh_estabilidad_dimensional_pct", e.target.value)} /></Campo>
          <Campo label="Temperatura Máxima de Uso (°C)"><input type="number" className="input" value={String(g("bh_temp_max_uso_c"))} onChange={(e) => set("bh_temp_max_uso_c", e.target.value)} /></Campo>
          <Campo label="Estabilizador UV">
            <select className="input" value={String(g("bh_estabilizador_uv"))} onChange={(e) => set("bh_estabilizador_uv", e.target.value)}>
              <option value="">—</option>
              <option value="uv_estabilizado">UV Estabilizado</option>
              <option value="uv_no">Sin Protección UV</option>
              <option value="uv_premium">UV Premium (HLS)</option>
            </select>
          </Campo>
          <Campo label="Norma / Certificación"><input className="input" value={String(g("bh_norma_certificacion"))} onChange={(e) => set("bh_norma_certificacion", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Aplicaciones y Accesorios">
        <CheckboxGroup
          label="Espacios de Aplicación"
          choices={{ balcon: "Balcón", ventana: "Ventana", escalera: "Escalera", terraza: "Terraza", piscina: "Piscina", rack: "Rack / Bodega", fachada: "Fachada", jardin: "Jardín" }}
          value={(data["bh_espacios_aplicacion"] as string[]) ?? []}
          onChange={(v) => set("bh_espacios_aplicacion", v)}
        />
        <Toggle label="Kit Autoinstalable" checked={Boolean(g("bh_kit_autoinstalable"))} onChange={(v) => set("bh_kit_autoinstalable", v)} />
        <Repeater
          label="Accesorios Incluidos"
          value={(data["bh_accesorios_incluidos"] as Record<string, unknown>[]) ?? []}
          onChange={(v) => set("bh_accesorios_incluidos", v)}
          columns={[{ key: "accesorio_item", label: "Accesorio" }, { key: "accesorio_qty", label: "Cantidad", type: "number" }]}
        />
      </Seccion>
    </div>
  );
}

function ACFNylon({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => data[k] ?? "";
  return (
    <div className="space-y-4">
      <Seccion title="Tipo de Tejido">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo de Tejido">
            <select className="input" value={String(g("ny_tipo_tejido"))} onChange={(e) => set("ny_tipo_tejido", e.target.value)}>
              <option value="">—</option>
              <option value="mano">Tejido a Mano (Knotted)</option>
              <option value="maquina">Tejido a Máquina (Knotless)</option>
              <option value="extruido">Extruido</option>
            </select>
          </Campo>
          <Campo label="Calibre del Hilo (mm)"><input type="number" step="0.01" className="input" value={String(g("ny_calibre_mm"))} onChange={(e) => set("ny_calibre_mm", e.target.value)} /></Campo>
          <Campo label="Tamaño del Cuadro / Malla"><input className="input" value={String(g("ny_tamano_cuadro"))} onChange={(e) => set("ny_tamano_cuadro", e.target.value)} /></Campo>
        </div>
        <Toggle label="Tiene Alma Interior" checked={Boolean(g("ny_tiene_alma"))} onChange={(v) => set("ny_tiene_alma", v)} />
      </Seccion>

      <Seccion title="Uso Deportivo">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Uso Deportivo Principal">
            <select className="input" value={String(g("ny_uso_deportivo"))} onChange={(e) => set("ny_uso_deportivo", e.target.value)}>
              <option value="">—</option>
              {[["futbol","Fútbol"],["voleibol","Voleibol"],["tenis","Tenis"],["basquetbol","Básquetbol"],["cerramiento","Cerramiento Deportivo"],["cubierta","Cubierta / Techo"],["anticaida","Anticaída / Seguridad"],["beisbol","Béisbol"],["golf","Golf"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo label="Norma Anticaída (EN 1263, etc.)"><input className="input" value={String(g("ny_norma_anticaida"))} onChange={(e) => set("ny_norma_anticaida", e.target.value)} /></Campo>
          <Campo label="Alto Reglamentario (m)"><input type="number" step="0.01" className="input" value={String(g("ny_alto_reglamentario_m"))} onChange={(e) => set("ny_alto_reglamentario_m", e.target.value)} /></Campo>
          <Campo label="Ancho Reglamentario (m)"><input type="number" step="0.01" className="input" value={String(g("ny_ancho_reglamentario_m"))} onChange={(e) => set("ny_ancho_reglamentario_m", e.target.value)} /></Campo>
          <Campo label="Profundidad Superior (m)"><input type="number" step="0.01" className="input" value={String(g("ny_prof_superior_m"))} onChange={(e) => set("ny_prof_superior_m", e.target.value)} /></Campo>
          <Campo label="Profundidad Inferior (m)"><input type="number" step="0.01" className="input" value={String(g("ny_prof_inferior_m"))} onChange={(e) => set("ny_prof_inferior_m", e.target.value)} /></Campo>
        </div>
        <Toggle label="Incluye Lona / Faldón" checked={Boolean(g("ny_incluye_lona"))} onChange={(v) => set("ny_incluye_lona", v)} />
      </Seccion>

      <Seccion title="Pasto Sintético (si aplica)" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Referencia Dicitex"><input className="input" value={String(g("ny_ref_dicitex"))} onChange={(e) => set("ny_ref_dicitex", e.target.value)} /></Campo>
          <Campo label="Altura de Fibra (mm)"><input type="number" className="input" value={String(g("ny_altura_fibra_mm"))} onChange={(e) => set("ny_altura_fibra_mm", e.target.value)} /></Campo>
          <Campo label="Tasa de Puntadas / m²"><input type="number" className="input" value={String(g("ny_tasa_puntadas_m2"))} onChange={(e) => set("ny_tasa_puntadas_m2", e.target.value)} /></Campo>
          <Campo label="Galga"><input className="input" value={String(g("ny_galga"))} onChange={(e) => set("ny_galga", e.target.value)} /></Campo>
          <Campo label="Peso de Fibra (g/m²)"><input type="number" className="input" value={String(g("ny_peso_fibra_g_m2"))} onChange={(e) => set("ny_peso_fibra_g_m2", e.target.value)} /></Campo>
          <Campo label="Base Primaria">
            <select className="input" value={String(g("ny_base_primaria"))} onChange={(e) => set("ny_base_primaria", e.target.value)}>
              <option value="">—</option>
              <option value="pp_tejido">PP Tejido</option>
              <option value="poliester">Poliéster</option>
              <option value="pp_no_tejido">PP No Tejido</option>
            </select>
          </Campo>
          <Campo label="Base Secundaria">
            <select className="input" value={String(g("ny_base_secundaria"))} onChange={(e) => set("ny_base_secundaria", e.target.value)}>
              <option value="">—</option>
              <option value="latex">Látex</option>
              <option value="poliuretano">Poliuretano</option>
              <option value="sin_base">Sin Base Secundaria</option>
            </select>
          </Campo>
        </div>
      </Seccion>
    </div>
  );
}

function ACFPlasticas({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => data[k] ?? "";
  return (
    <div className="space-y-4">
      <Seccion title="Material">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Polímero Base">
            <select className="input" value={String(g("pl_polimero_base"))} onChange={(e) => set("pl_polimero_base", e.target.value)}>
              <option value="">—</option>
              <option value="pead">PEAD (Polietileno Alta Densidad)</option>
              <option value="pe">PE (Polietileno)</option>
              <option value="pp">PP (Polipropileno)</option>
              <option value="pvc">PVC</option>
            </select>
          </Campo>
          <Campo label="Subtipo de Malla">
            <select className="input" value={String(g("pl_subtipo"))} onChange={(e) => set("pl_subtipo", e.target.value)}>
              <option value="">—</option>
              <option value="reja">Reja Plástica</option>
              <option value="pollito">Malla Pollito</option>
              <option value="polisombra">Polisombra / Sombra</option>
              <option value="senalizacion">Señalización</option>
              <option value="geomalla">Geomalla</option>
              <option value="gallinero">Malla Gallinero</option>
              <option value="invernadero">Malla Invernadero</option>
            </select>
          </Campo>
        </div>
        <Toggle label="Aditivo UV" checked={Boolean(g("pl_aditivo_uv"))} onChange={(v) => set("pl_aditivo_uv", v)} />
      </Seccion>

      <Seccion title="Geometría de la Malla">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Forma del Hueco">
            <select className="input" value={String(g("pl_forma_hueco"))} onChange={(e) => set("pl_forma_hueco", e.target.value)}>
              <option value="">—</option>
              <option value="cuadrado">Cuadrado</option>
              <option value="rectangular">Rectangular</option>
              <option value="rombo">Rombo / Diamante</option>
              <option value="hexagonal">Hexagonal</option>
              <option value="circular">Circular</option>
            </select>
          </Campo>
          <Campo label="Tamaño de Abertura"><input className="input" value={String(g("pl_tamano_abertura"))} onChange={(e) => set("pl_tamano_abertura", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Dimensiones del Rollo">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Alto / Ancho (m)"><input type="number" step="0.01" className="input" value={String(g("pl_alto_m"))} onChange={(e) => set("pl_alto_m", e.target.value)} /></Campo>
          <Campo label="Largo del Rollo (m)"><input type="number" step="0.1" className="input" value={String(g("pl_largo_rollo_m"))} onChange={(e) => set("pl_largo_rollo_m", e.target.value)} /></Campo>
          <Campo label="Porcentaje de Sombra (%)"><input type="number" min="0" max="100" className="input" value={String(g("pl_porcentaje_sombra"))} onChange={(e) => set("pl_porcentaje_sombra", e.target.value)} /></Campo>
          <Campo label="Peso (kg/m²)"><input type="number" step="0.001" className="input" value={String(g("pl_peso_kg_m2"))} onChange={(e) => set("pl_peso_kg_m2", e.target.value)} /></Campo>
          <Campo label="Color Estándar">
            <select className="input" value={String(g("pl_color_estandar"))} onChange={(e) => set("pl_color_estandar", e.target.value)}>
              <option value="">—</option>
              {[["verde","Verde"],["negro","Negro"],["naranja","Naranja"],["amarillo","Amarillo"],["rojo","Rojo"],["azul","Azul"],["blanco","Blanco"],["gris","Gris"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
        </div>
      </Seccion>
    </div>
  );
}

function ACFSeguridad({ data, set }: { data: FormData; set: (k: string, v: unknown) => void }) {
  const g = (k: string) => data[k] ?? "";
  return (
    <div className="space-y-4">
      <Seccion title="Tipo de Producto">
        <Campo label="Subtipo">
          <select className="input" value={String(g("sp_subtipo"))} onChange={(e) => set("sp_subtipo", e.target.value)}>
            <option value="">—</option>
            <option value="concertina">Concertina</option>
            <option value="alambre_puas">Alambre de Púas</option>
            <option value="alambre_galv">Alambre Galvanizado Liso</option>
            <option value="alambre_pvc">Alambre Galvanizado + PVC</option>
            <option value="alambre_cerca">Alambre para Cerca Eléctrica</option>
            <option value="energizador">Energizador / Electrificador</option>
            <option value="aislador">Aislador</option>
            <option value="varilla_tierra">Varilla de Tierra</option>
            <option value="sensor">Sensor de Vibración / Alarma</option>
          </select>
        </Campo>
      </Seccion>

      <Seccion title="Especificaciones del Alambre">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Material Cuchillas / Alambre">
            <select className="input" value={String(g("sp_material_cuchillas"))} onChange={(e) => set("sp_material_cuchillas", e.target.value)}>
              <option value="">—</option>
              <option value="acero_galv">Acero Galvanizado</option>
              <option value="acero_inox">Acero Inoxidable</option>
              <option value="acero_pvc">Acero + PVC</option>
            </select>
          </Campo>
          <Campo label="Calibre BWG"><input className="input" value={String(g("sp_calibre_bwg"))} onChange={(e) => set("sp_calibre_bwg", e.target.value)} /></Campo>
          <Campo label="Calibre (mm)"><input type="number" step="0.01" className="input" value={String(g("sp_calibre_mm"))} onChange={(e) => set("sp_calibre_mm", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Concertina (si aplica)" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo de Concertina">
            <select className="input" value={String(g("sp_tipo_concertina"))} onChange={(e) => set("sp_tipo_concertina", e.target.value)}>
              <option value="">—</option>
              <option value="circular">Circular (CBT)</option>
              <option value="flat_wrap">Flat Wrap</option>
              <option value="bto_22">BTO-22</option>
              <option value="bto-65">BTO-65</option>
              <option value="razor_wire">Razor Wire</option>
            </select>
          </Campo>
          <Campo label="Diámetro del Rollo (mm)"><input type="number" className="input" value={String(g("sp_diametro_rollo_mm"))} onChange={(e) => set("sp_diametro_rollo_mm", e.target.value)} /></Campo>
          <Campo label="Número de Espirales"><input type="number" className="input" value={String(g("sp_num_espirales"))} onChange={(e) => set("sp_num_espirales", e.target.value)} /></Campo>
          <Campo label="Rendimiento (ml)"><input type="number" step="0.1" className="input" value={String(g("sp_rendimiento_ml"))} onChange={(e) => set("sp_rendimiento_ml", e.target.value)} /></Campo>
        </div>
      </Seccion>

      <Seccion title="Energizador (si aplica)" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Voltaje de Salida (V)"><input type="number" className="input" value={String(g("sp_voltaje_v"))} onChange={(e) => set("sp_voltaje_v", e.target.value)} /></Campo>
          <Campo label="Cobertura (km de línea)"><input type="number" step="0.1" className="input" value={String(g("sp_cobertura_km"))} onChange={(e) => set("sp_cobertura_km", e.target.value)} /></Campo>
          <Campo label="Cobertura (ha)"><input type="number" step="0.1" className="input" value={String(g("sp_cobertura_ha"))} onChange={(e) => set("sp_cobertura_ha", e.target.value)} /></Campo>
        </div>
        <Toggle label="Incluye Control Remoto" checked={Boolean(g("sp_control_remoto"))} onChange={(v) => set("sp_control_remoto", v)} />
      </Seccion>

      <Seccion title="Dimensiones y Peso">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Peso (kg)"><input type="number" step="0.01" className="input" value={String(g("sp_peso_kg"))} onChange={(e) => set("sp_peso_kg", e.target.value)} /></Campo>
        </div>
        <Campo label="Notas de Instalación"><textarea className="input" rows={3} value={String(g("sp_notas_instalacion"))} onChange={(e) => set("sp_notas_instalacion", e.target.value)} /></Campo>
      </Seccion>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

const TABS_PRINCIPAL = ["Producto", "Identificación", "Descripción & Usos", "Calidad"] as const;
type TabPrincipal = typeof TABS_PRINCIPAL[number];

const CATEGORIA_ACF: Record<string, { label: string; component: React.ComponentType<{ data: FormData; set: (k: string, v: unknown) => void }> }> = {
  "mallas-metalicas": { label: "🔩 Metálicas", component: ACFMetalicas },
  "mallas-para-balcones": { label: "🏠 Balcones", component: ACFBalcones },
  "mallas-nylon": { label: "🎾 Nylon / Deportiva", component: ACFNylon },
  "mallas-plasticas": { label: "🟢 Plásticas", component: ACFPlasticas },
  "seguridad-perimetral": { label: "🔒 Seguridad Perimetral", component: ACFSeguridad },
};

export default function ProductoFormDinamico({ initialData, productoId, modo }: ProductoFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabPrincipal>("Producto");
  const [saving, setSaving] = useState(false);

  const init = initialData ?? {};
  const [form, setForm] = useState<FormData>({
    sku: "", nombre: "", descCorta: "", descripcion: "",
    precioNormal: "", precioOferta: "",
    stock: 0, stockMinimo: 15, permiteBackorders: "no",
    pesoKg: "", largoCm: "", anchoCm: "", altoCm: "",
    categorias: [], etiquetas: [],
    claseEnvio: "", notaCompra: "", permiteResenas: true,
    publicado: false, destacado: false, visibilidad: "visible",
    intEstado: "BORRADOR", intListoExportar: false, intObservaciones: "",
    // General ACF
    acfSkuInterno: "", acfMarcaFabricante: "", acfUnidadVenta: "",
    acfFabricacionMedida: false, acfInstalacion: false, acfGarantiaAnos: "",
    acfAplicaciones: [], acfColores: [], acfNormas: [],
    acfFichaTecnicaPdf: "", acfCertificaciones: [],
    // Extra ACF (por categoría)
    acfExtra: (init.acfExtra as FormData) ?? {},
    ...init,
  });

  const set = useCallback((k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v })), []);
  const setExtra = useCallback((k: string, v: unknown) => setForm((prev) => ({ ...prev, acfExtra: { ...(prev.acfExtra as FormData), [k]: v } })), []);

  const cats = (form.categorias as string[]) ?? [];
  const categoriaACF = Object.keys(CATEGORIA_ACF).find((cat) => cats.includes(cat));
  const ACFComponent = categoriaACF ? CATEGORIA_ACF[categoriaACF].component : null;
  const acfLabel = categoriaACF ? CATEGORIA_ACF[categoriaACF].label : null;

  const allTabs: TabPrincipal[] = [...TABS_PRINCIPAL];

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
      const method = modo === "crear" ? "POST" : "PUT";

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();

      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al guardar");
      toast.success(modo === "crear" ? "Producto creado" : "Cambios guardados");
      if (modo === "crear") router.push(`/productos/${json.data.id}`);
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 flex items-center gap-1 overflow-x-auto">
        {allTabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-cm-yellow text-cm-black" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
        {ACFComponent && (
          <button onClick={() => setTab("Producto")}
            className={`px-4 py-3 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors ${tab === ("fichaACF" as TabPrincipal) ? "border-cm-yellow text-cm-black" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setTab("fichaACF" as TabPrincipal)}>
            {acfLabel}
          </button>
        )}
        <div className="ml-auto py-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {modo === "crear" ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* TAB: Producto */}
        {tab === "Producto" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <Seccion title="Información básica">
                <div className="grid grid-cols-2 gap-4">
                  <Campo label="SKU *"><input className="input" value={String(form.sku)} onChange={(e) => set("sku", e.target.value)} placeholder="ej: MN-001" /></Campo>
                  <Campo label="Nombre *"><input className="input" value={String(form.nombre)} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre del producto" /></Campo>
                </div>
                <Campo label="Descripción corta"><textarea className="input" rows={2} value={String(form.descCorta ?? "")} onChange={(e) => set("descCorta", e.target.value)} /></Campo>
                <Campo label="Descripción larga"><textarea className="input" rows={4} value={String(form.descripcion ?? "")} onChange={(e) => set("descripcion", e.target.value)} /></Campo>
              </Seccion>

              <Seccion title="Precios">
                <div className="grid grid-cols-2 gap-4">
                  <Campo label="Precio normal"><input type="number" className="input" value={String(form.precioNormal ?? "")} onChange={(e) => set("precioNormal", e.target.value)} /></Campo>
                  <Campo label="Precio oferta"><input type="number" className="input" value={String(form.precioOferta ?? "")} onChange={(e) => set("precioOferta", e.target.value)} /></Campo>
                </div>
              </Seccion>

              <Seccion title="Inventario">
                <div className="grid grid-cols-3 gap-4">
                  <Campo label="Stock actual"><input type="number" className="input" value={String(form.stock ?? 0)} onChange={(e) => set("stock", e.target.value)} /></Campo>
                  <Campo label="Stock mínimo"><input type="number" className="input" value={String(form.stockMinimo ?? 15)} onChange={(e) => set("stockMinimo", e.target.value)} /></Campo>
                  <Campo label="Backorders">
                    <select className="input" value={String(form.permiteBackorders ?? "no")} onChange={(e) => set("permiteBackorders", e.target.value)}>
                      <option value="no">No</option>
                      <option value="notify">Notificar</option>
                      <option value="yes">Sí</option>
                    </select>
                  </Campo>
                </div>
              </Seccion>

              <Seccion title="Dimensiones y peso">
                <div className="grid grid-cols-4 gap-4">
                  <Campo label="Peso (kg)"><input type="number" step="0.001" className="input" value={String(form.pesoKg ?? "")} onChange={(e) => set("pesoKg", e.target.value)} /></Campo>
                  <Campo label="Largo (cm)"><input type="number" step="0.01" className="input" value={String(form.largoCm ?? "")} onChange={(e) => set("largoCm", e.target.value)} /></Campo>
                  <Campo label="Ancho (cm)"><input type="number" step="0.01" className="input" value={String(form.anchoCm ?? "")} onChange={(e) => set("anchoCm", e.target.value)} /></Campo>
                  <Campo label="Alto (cm)"><input type="number" step="0.01" className="input" value={String(form.altoCm ?? "")} onChange={(e) => set("altoCm", e.target.value)} /></Campo>
                </div>
              </Seccion>
            </div>

            <div className="space-y-5">
              <Seccion title="Estado y publicación">
                <Campo label="Estado interno">
                  <select className="input" value={String(form.intEstado ?? "BORRADOR")} onChange={(e) => set("intEstado", e.target.value)}>
                    {["BORRADOR","REVISION","LISTO","PUBLICADO","ARCHIVADO"].map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </Campo>
                <div className="space-y-3 pt-1">
                  <Toggle label="Publicado en tienda" checked={Boolean(form.publicado)} onChange={(v) => set("publicado", v)} />
                  <Toggle label="Destacado" checked={Boolean(form.destacado)} onChange={(v) => set("destacado", v)} />
                  <Toggle label="Listo para exportar" checked={Boolean(form.intListoExportar)} onChange={(v) => set("intListoExportar", v)} />
                </div>
              </Seccion>

              <Seccion title="Categorías y etiquetas">
                <Campo label="Categorías (separadas por coma)">
                  <input className="input text-[12px]"
                    placeholder="mallas-metalicas, nylon"
                    value={Array.isArray(form.categorias) ? (form.categorias as string[]).join(", ") : String(form.categorias ?? "")}
                    onChange={(e) => set("categorias", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  />
                </Campo>
                <Campo label="Etiquetas (separadas por coma)">
                  <input className="input text-[12px]"
                    placeholder="exterior, resistente"
                    value={Array.isArray(form.etiquetas) ? (form.etiquetas as string[]).join(", ") : String(form.etiquetas ?? "")}
                    onChange={(e) => set("etiquetas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  />
                </Campo>
                {cats.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cats.map((c) => (
                      <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORIA_ACF[c] ? "bg-cm-yellow/20 text-cm-black border border-cm-yellow/40" : "bg-gray-100 text-gray-600"}`}>
                        {CATEGORIA_ACF[c] ? CATEGORIA_ACF[c].label : c}
                      </span>
                    ))}
                  </div>
                )}
              </Seccion>

              <Seccion title="Observaciones">
                <textarea className="input text-[12px]" rows={3} value={String(form.intObservaciones ?? "")} onChange={(e) => set("intObservaciones", e.target.value)} placeholder="Notas internas…" />
              </Seccion>
            </div>
          </div>
        )}

        {/* TAB: Identificación ACF */}
        {tab === "Identificación" && (
          <div className="max-w-2xl space-y-5">
            <Seccion title="Identificación del Producto">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="SKU Interno"><input className="input" value={String(form.acfSkuInterno ?? "")} onChange={(e) => set("acfSkuInterno", e.target.value)} /></Campo>
                <Campo label="Marca / Fabricante"><input className="input" value={String(form.acfMarcaFabricante ?? "")} onChange={(e) => set("acfMarcaFabricante", e.target.value)} /></Campo>
                <Campo label="Unidad de Venta">
                  <select className="input" value={String(form.acfUnidadVenta ?? "")} onChange={(e) => set("acfUnidadVenta", e.target.value)}>
                    <option value="">—</option>
                    <option value="m2">m²</option>
                    <option value="ml">ml</option>
                    <option value="und">und</option>
                    <option value="rollo">Rollo</option>
                    <option value="panel">Panel</option>
                    <option value="kit">Kit</option>
                    <option value="par">Par</option>
                  </select>
                </Campo>
                <Campo label="Garantía (años)"><input type="number" min="0" className="input" value={String(form.acfGarantiaAnos ?? "")} onChange={(e) => set("acfGarantiaAnos", e.target.value)} /></Campo>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Toggle label="Fabricación a Medida" checked={Boolean(form.acfFabricacionMedida)} onChange={(v) => set("acfFabricacionMedida", v)} />
                <Toggle label="Instalación Disponible" checked={Boolean(form.acfInstalacion)} onChange={(v) => set("acfInstalacion", v)} />
              </div>
            </Seccion>
          </div>
        )}

        {/* TAB: Descripción & Usos */}
        {tab === "Descripción & Usos" && (
          <div className="max-w-3xl space-y-5">
            <Seccion title="Descripción Corta">
              <textarea className="input" rows={4} value={String(form.descCorta ?? "")} onChange={(e) => set("descCorta", e.target.value)} />
            </Seccion>
            <Seccion title="Aplicaciones / Usos">
              <Repeater
                label="Lista de aplicaciones"
                value={(form.acfAplicaciones as Record<string, unknown>[]) ?? []}
                onChange={(v) => set("acfAplicaciones", v)}
                columns={[{ key: "aplicacion_item", label: "Aplicación" }]}
              />
            </Seccion>
            <Seccion title="Colores Disponibles">
              <Repeater
                label="Colores"
                value={(form.acfColores as Record<string, unknown>[]) ?? []}
                onChange={(v) => set("acfColores", v)}
                columns={[{ key: "color_item", label: "Color" }]}
              />
            </Seccion>
          </div>
        )}

        {/* TAB: Calidad */}
        {tab === "Calidad" && (
          <div className="max-w-2xl space-y-5">
            <Seccion title="Calidad y Certificaciones">
              <Campo label="Normas de Calidad"><input className="input" value={String(form.acfNormas && Array.isArray(form.acfNormas) ? (form.acfNormas as string[]).join(", ") : String(form.acfNormas ?? ""))} onChange={(e) => set("acfNormas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="ISO 9001, ASTM A392…" /></Campo>
              <Campo label="Certificaciones"><textarea className="input" rows={3} value={String(form.acfCertificaciones && Array.isArray(form.acfCertificaciones) ? (form.acfCertificaciones as string[]).join(", ") : String(form.acfCertificaciones ?? ""))} onChange={(e) => set("acfCertificaciones", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></Campo>
              <Campo label="Ficha Técnica PDF (URL)"><input className="input" value={String(form.acfFichaTecnicaPdf ?? "")} onChange={(e) => set("acfFichaTecnicaPdf", e.target.value || null)} placeholder="https://…/ficha-tecnica.pdf" /></Campo>
            </Seccion>
          </div>
        )}

        {/* TAB: Ficha ACF por categoría */}
        {tab === ("fichaACF" as TabPrincipal) && ACFComponent && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Ficha técnica:</span>
              <span className="badge badge-green text-[11px]">{acfLabel}</span>
            </div>
            <ACFComponent data={(form.acfExtra as FormData) ?? {}} set={setExtra} />
          </div>
        )}

        {!ACFComponent && tab === ("fichaACF" as TabPrincipal) && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-[13px]">Selecciona una categoría específica en la pestaña "Producto" para ver la ficha técnica correspondiente.</p>
            <p className="text-[11px] mt-2">Categorías disponibles: mallas-metalicas, mallas-para-balcones, mallas-nylon, mallas-plasticas, seguridad-perimetral</p>
          </div>
        )}
      </div>
    </div>
  );
}
