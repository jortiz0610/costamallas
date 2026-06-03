"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import {
  ArrowLeft, ArrowRight, Check, Loader2, User, Building2, Phone, Mail,
  MapPin, FileText, Star, UserCircle, ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useBrand } from "@/contexts/BrandContext";

const CRM_COLOR = "#BA7517";

const ESTADOS_CLIENTE = [
  { v: "PROSPECTO",       l: "Prospecto",       desc: "Contacto inicial, aún no evaluado",            dot: "#9ca3af",  bg: "#f3f4f6",  text: "#6b7280" },
  { v: "INTERESADO",      l: "Interesado",      desc: "Mostró interés en los productos",               dot: "#3b82f6",  bg: "#eff6ff",  text: "#1d4ed8" },
  { v: "CALIFICADO",      l: "Calificado",      desc: "Tiene necesidad y capacidad de compra",         dot: "#f59e0b",  bg: "#fef3c7",  text: "#92400e" },
  { v: "CLIENTE_ACTIVO",  l: "Cliente activo",  desc: "Ha realizado al menos una compra",              dot: "#10b981",  bg: "#d1fae5",  text: "#065f46" },
  { v: "RECURRENTE",      l: "Recurrente",      desc: "Compra con frecuencia",                         dot: "#7c3aed",  bg: "#ede9fe",  text: "#5b21b6" },
  { v: "VIP",             l: "VIP ⭐",           desc: "Cliente estratégico de alto valor",             dot: "#eab308",  bg: "#fef9c3",  text: "#713f12" },
  { v: "CLIENTE_INACTIVO",l: "Inactivo",        desc: "No ha comprado en más de 6 meses",              dot: "#ef4444",  bg: "#fee2e2",  text: "#b91c1c" },
  { v: "NO_CALIFICADO",   l: "No calificado",   desc: "No cumple perfil o rechazó el contacto",        dot: "#94a3b8",  bg: "#f1f5f9",  text: "#475569" },
];

const TIPOS_CLIENTE = [
  { v: "persona",  l: "Persona natural",  Icon: User,      desc: "Cliente particular" },
  { v: "empresa",  l: "Empresa",          Icon: Building2, desc: "Persona jurídica / empresa" },
];

const STEPS = [
  { n: 1, label: "Tipo y estado" },
  { n: 2, label: "Información de contacto" },
  { n: 3, label: "Datos adicionales" },
];

interface FormData {
  tipo: string; estado: string; nombre: string; empresa: string; cargo: string;
  email: string; telefono: string; whatsapp: string; ciudad: string;
  departamento: string; direccion: string; nit: string; paginaWeb: string; notas: string;
}

export default function NuevoClientePage() {
  const router = useRouter();
  const { brand } = useBrand();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    tipo: "persona", estado: "PROSPECTO", nombre: "", empresa: "", cargo: "",
    email: "", telefono: "", whatsapp: "", ciudad: "", departamento: "",
    direccion: "", nit: "", paginaWeb: "", notas: "",
  });

  const upd = (k: keyof FormData, v: string) => setForm(p => ({ ...p, [k]: v }));

  const canNext = () => {
    if (step === 1) return !!form.tipo && !!form.estado;
    if (step === 2) return form.nombre.trim().length >= 2;
    return true;
  };

  const save = async () => {
    if (!form.nombre.trim()) return toast.error("El nombre es requerido");
    setSaving(true);
    try {
      const res = await fetch("/api/crm/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          empresa: form.empresa || undefined,
          cargo: form.cargo || undefined,
          email: form.email || undefined,
          telefono: form.telefono || undefined,
          whatsapp: form.whatsapp || undefined,
          ciudad: form.ciudad || undefined,
          departamento: form.departamento || undefined,
          direccion: form.direccion || undefined,
          nit: form.nit || undefined,
          paginaWeb: form.paginaWeb || undefined,
          notas: form.notas || undefined,
          tipo: form.tipo,
          estado: form.estado,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al crear cliente");
      toast.success("Cliente creado exitosamente");
      router.push(`/crm/clientes/${json.data.id}`);
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  const estadoActual = ESTADOS_CLIENTE.find(e => e.v === form.estado);

  return (
    <>
      <Topbar
        title="Nuevo cliente"
        actions={
          <Link href="/crm/clientes" className="btn-secondary btn-sm">
            <ArrowLeft size={13} /> Volver
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Stepper */}
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                    style={
                      step > s.n
                        ? { backgroundColor: "#16a34a", color: "white" }
                        : step === s.n
                          ? { backgroundColor: CRM_COLOR, color: "white", boxShadow: `0 0 0 4px ${CRM_COLOR}25` }
                          : { backgroundColor: "#e5e7eb", color: "#9ca3af" }
                    }
                  >
                    {step > s.n ? <Check size={16} /> : s.n}
                  </div>
                  <span className="text-[11px] font-medium whitespace-nowrap"
                    style={{ color: step === s.n ? CRM_COLOR : step > s.n ? "#16a34a" : "#9ca3af" }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-3 mb-5 transition-all"
                    style={{ backgroundColor: step > s.n ? "#16a34a" : "#e5e7eb" }} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Tipo de cliente</h2>
                <p className="text-xs text-gray-400 mb-4">¿Es una persona natural o una empresa?</p>
                <div className="grid grid-cols-2 gap-3">
                  {TIPOS_CLIENTE.map(t => {
                    const Icon = t.Icon;
                    const sel = form.tipo === t.v;
                    return (
                      <button key={t.v} type="button" onClick={() => upd("tipo", t.v)}
                        className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all"
                        style={sel
                          ? { borderColor: CRM_COLOR, backgroundColor: CRM_COLOR + "10" }
                          : { borderColor: "#e2e8f0", backgroundColor: "transparent" }}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                          style={{ backgroundColor: sel ? CRM_COLOR : "#f1f5f9" }}>
                          <Icon size={22} style={{ color: sel ? "white" : "#9ca3af" }} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold" style={{ color: sel ? CRM_COLOR : "#374151" }}>{t.l}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                        </div>
                        {sel && <div className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: CRM_COLOR }}>
                          <Check size={12} className="text-white" />
                        </div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">Estado inicial</h2>
                <p className="text-xs text-gray-400 mb-4">¿En qué etapa está este contacto?</p>
                <div className="grid grid-cols-2 gap-2">
                  {ESTADOS_CLIENTE.map(e => {
                    const sel = form.estado === e.v;
                    return (
                      <button key={e.v} type="button" onClick={() => upd("estado", e.v)}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all"
                        style={sel
                          ? { borderColor: e.dot, backgroundColor: e.bg }
                          : { borderColor: "#e2e8f0", backgroundColor: "transparent" }}>
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.dot }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: sel ? e.text : "#374151" }}>{e.l}</p>
                          <p className="text-[10px] text-gray-400 truncate">{e.desc}</p>
                        </div>
                        {sel && <Check size={13} style={{ color: e.dot, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <UserCircle size={16} style={{ color: CRM_COLOR }} /> Información de contacto
              </h2>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  {form.tipo === "empresa" ? "Nombre del contacto principal *" : "Nombre completo *"}
                </label>
                <input className="input" value={form.nombre}
                  onChange={e => upd("nombre", e.target.value)}
                  placeholder={form.tipo === "empresa" ? "Ej: Juan Rodríguez" : "Ej: María García"} />
              </div>

              {form.tipo === "empresa" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nombre de la empresa</label>
                    <input className="input" value={form.empresa} onChange={e => upd("empresa", e.target.value)} placeholder="Ej: Constructora ABC S.A.S" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Cargo</label>
                    <input className="input" value={form.cargo} onChange={e => upd("cargo", e.target.value)} placeholder="Ej: Gerente de compras" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">NIT / RUT</label>
                    <input className="input" value={form.nit} onChange={e => upd("nit", e.target.value)} placeholder="900.123.456-7" />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    <Mail size={10} className="inline mr-1" /> Email
                  </label>
                  <input type="email" className="input" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="contacto@empresa.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    <Phone size={10} className="inline mr-1" /> Teléfono
                  </label>
                  <input type="tel" className="input" value={form.telefono} onChange={e => upd("telefono", e.target.value)} placeholder="601 234 5678" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">WhatsApp</label>
                  <input type="tel" className="input" value={form.whatsapp} onChange={e => upd("whatsapp", e.target.value)} placeholder="+57 300 000 0000" />
                </div>
                {form.tipo === "empresa" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Página web</label>
                    <input type="url" className="input" value={form.paginaWeb} onChange={e => upd("paginaWeb", e.target.value)} placeholder="https://..." />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <MapPin size={16} style={{ color: CRM_COLOR }} /> Ubicación y notas
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Ciudad</label>
                  <input className="input" value={form.ciudad} onChange={e => upd("ciudad", e.target.value)} placeholder="Ej: Bogotá" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Departamento</label>
                  <input className="input" value={form.departamento} onChange={e => upd("departamento", e.target.value)} placeholder="Ej: Cundinamarca" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Dirección</label>
                  <input className="input" value={form.direccion} onChange={e => upd("direccion", e.target.value)} placeholder="Ej: Cra 15 #98-23, Piso 4" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  <FileText size={10} className="inline mr-1" /> Notas internas
                </label>
                <textarea className="input resize-none" rows={4} value={form.notas}
                  onChange={e => upd("notas", e.target.value)}
                  placeholder="Observaciones, historial, referencias, condiciones especiales..." />
              </div>

              {/* Resumen */}
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: CRM_COLOR + "08", border: `1px solid ${CRM_COLOR}25` }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CRM_COLOR }}>Resumen del cliente</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: CRM_COLOR }}>
                    {form.nombre.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{form.nombre || "—"}</p>
                    {form.empresa && <p className="text-xs text-gray-500">{form.empresa}</p>}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estadoActual?.dot }} />
                      <span className="text-xs font-semibold" style={{ color: estadoActual?.text }}>{estadoActual?.l}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  {form.email && <span className="flex items-center gap-1"><Mail size={10} />{form.email}</span>}
                  {form.telefono && <span className="flex items-center gap-1"><Phone size={10} />{form.telefono}</span>}
                  {form.ciudad && <span className="flex items-center gap-1"><MapPin size={10} />{form.ciudad}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1">
                <ArrowLeft size={14} /> Anterior
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                style={{ backgroundColor: CRM_COLOR }}
              >
                Siguiente <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={save}
                disabled={saving || !form.nombre.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                style={{ backgroundColor: CRM_COLOR }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Crear cliente
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
