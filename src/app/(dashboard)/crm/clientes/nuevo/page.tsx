"use client";

// ============================================================
// Alta de cliente.
//
// Antes era un asistente de tres pasos igual para todo el mundo, con los
// campos de empresa apareciendo y desapareciendo según un interruptor.
// Dos problemas concretos:
//
//   1. Registrar una empresa y registrar a una persona NO son la misma
//      tarea. En una empresa lo que se da de alta es la razón social y
//      su NIT, y el contacto es un dato de la empresa. En una persona el
//      contacto ES el cliente. El mismo formulario para las dos cosas
//      obliga a leer etiquetas para saber qué se está llenando.
//   2. El paso 1 pedía elegir el "estado inicial" entre ocho opciones.
//      Ese campo ya no se escribe a mano: sale de los hechos
//      (`lib/estados-cliente.ts`). Todo el que se da de alta empieza
//      como prospecto, y sube solo cuando pide y cuando aprueba.
//
// Quedan dos formularios distintos detrás de una sola pregunta.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import {
  ArrowLeft, Check, Loader2, User, Building2, Phone, Mail,
  MapPin, FileText, IdCard, Globe, Briefcase, Info, MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { CIUDADES, DEPARTAMENTOS, departamentoDeCiudad } from "@/lib/colombia";
import { ESTADO_POR_CLAVE } from "@/lib/estados-cliente";
import { Ayuda } from "@/components/ui/Ayuda";

const CRM_COLOR = "#BA7517";

type Tipo = "persona" | "empresa" | null;

interface FormData {
  nombre: string; empresa: string; cargo: string;
  email: string; telefono: string; whatsapp: string; ciudad: string;
  departamento: string; direccion: string; nit: string; cedula: string;
  paginaWeb: string; notas: string;
}

const VACIO: FormData = {
  nombre: "", empresa: "", cargo: "", email: "", telefono: "", whatsapp: "",
  ciudad: "", departamento: "", direccion: "", nit: "", cedula: "",
  paginaWeb: "", notas: "",
};

function Campo({
  label, icono, children, ancho = 1, ayuda,
}: {
  label: string; icono?: React.ReactNode; children: React.ReactNode; ancho?: 1 | 2; ayuda?: string;
}) {
  return (
    <div className={ancho === 2 ? "sm:col-span-2" : ""}>
      <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
        {icono}{label}
      </label>
      {children}
      {ayuda && <p className="text-[10.5px] text-gray-400 mt-1">{ayuda}</p>}
    </div>
  );
}

function Seccion({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{titulo}</h2>
      {subtitulo && <p className="text-[11.5px] text-gray-400 mt-0.5 mb-4">{subtitulo}</p>}
      <div className={subtitulo ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4"}>
        {children}
      </div>
    </div>
  );
}

export default function NuevoClientePage() {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>(null);
  const [form, setForm] = useState<FormData>(VACIO);
  const [saving, setSaving] = useState(false);

  const upd = (k: keyof FormData, v: string) => setForm(p => ({ ...p, [k]: v }));

  const elegirCiudad = (ciudad: string) =>
    setForm(p => ({ ...p, ciudad, departamento: departamentoDeCiudad(ciudad) ?? p.departamento }));

  // En una empresa lo obligatorio es la razón social; en una persona, su
  // nombre. Es la única diferencia de validación, y es la que importa.
  const listo = tipo === "empresa"
    ? form.empresa.trim().length >= 2
    : form.nombre.trim().length >= 2;

  const save = async () => {
    if (!listo) return;
    setSaving(true);
    try {
      const res = await fetch("/api/crm/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // `nombre` es el campo con el que se lista y se busca. En una
          // empresa esa identidad es la razón social; el contacto va en
          // `cargo`/`email`/`telefono` y en las notas. Si se guardara el
          // nombre del contacto, buscar la empresa por su nombre no
          // encontraría nada.
          nombre: (tipo === "empresa" ? form.empresa : form.nombre).trim(),
          empresa: tipo === "empresa" ? form.empresa.trim() : undefined,
          cargo: form.cargo || undefined,
          email: form.email || undefined,
          telefono: form.telefono || undefined,
          whatsapp: form.whatsapp || undefined,
          ciudad: form.ciudad || undefined,
          departamento: form.departamento || undefined,
          direccion: form.direccion || undefined,
          nit: tipo === "empresa" ? (form.nit || undefined) : undefined,
          cedula: tipo === "persona" ? (form.cedula || undefined) : undefined,
          paginaWeb: tipo === "empresa" ? (form.paginaWeb || undefined) : undefined,
          notas: [
            tipo === "empresa" && form.nombre.trim()
              ? `Contacto principal: ${form.nombre.trim()}${form.cargo ? ` (${form.cargo})` : ""}`
              : "",
            form.notas,
          ].filter(Boolean).join("\n") || undefined,
          tipo,
          // El estado NO se elige: nace prospecto y sube solo cuando pide
          // una cotización y cuando aprueba.
          estado: "PROSPECTO",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al crear el cliente");
      toast.success(tipo === "empresa" ? "Empresa registrada" : "Cliente registrado");
      router.push(`/crm/clientes/${json.data.id}`);
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  // ── Paso 0: qué se va a registrar ──
  if (!tipo) {
    return (
      <>
        <Topbar
          title="Nuevo registro"
          actions={<Link href="/crm/clientes" className="btn-secondary btn-sm"><ArrowLeft size={13} /> Volver</Link>}
        />
        <div className="flex-1 overflow-y-auto page-bg p-6">
          <div className="max-w-2xl mx-auto pt-6">
            <h1 className="text-[17px] font-bold text-gray-800 dark:text-gray-100 text-center">
              ¿Qué vas a registrar?
            </h1>
            <p className="text-[12.5px] text-gray-400 text-center mt-1 mb-7 flex items-center justify-center gap-1.5">
              Los dos formularios son distintos: no se pide lo mismo.
              <Ayuda titulo="El estado no se elige">
                Todo registro nuevo entra como <strong>{ESTADO_POR_CLAVE.PROSPECTO.l}</strong> y
                sube solo: a <strong>{ESTADO_POR_CLAVE.INTERESADO.l}</strong> cuando pide una
                cotización y a <strong>{ESTADO_POR_CLAVE.CLIENTE_ACTIVO.l}</strong> cuando
                aprueba una.
              </Ayuda>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  v: "persona" as const, Icon: User, l: "Una persona",
                  d: "Un cliente particular. Se identifica con su cédula y su celular.",
                },
                {
                  v: "empresa" as const, Icon: Building2, l: "Una empresa",
                  d: "Razón social y NIT. El contacto es un dato más de la empresa, no el cliente.",
                },
              ].map(o => (
                <button
                  key={o.v}
                  onClick={() => setTipo(o.v)}
                  className="card p-6 text-left hover:shadow-md transition-all group"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors"
                    style={{ backgroundColor: CRM_COLOR + "14" }}
                  >
                    <o.Icon size={22} style={{ color: CRM_COLOR }} />
                  </div>
                  <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{o.l}</p>
                  <p className="text-[11.5px] text-gray-400 mt-1 leading-relaxed">{o.d}</p>
                </button>
              ))}
            </div>


          </div>
        </div>
      </>
    );
  }

  const esEmpresa = tipo === "empresa";

  return (
    <>
      <Topbar
        title={esEmpresa ? "Nueva empresa" : "Nuevo cliente"}
        actions={
          <button onClick={() => { setTipo(null); setForm(VACIO); }} className="btn-secondary btn-sm">
            <ArrowLeft size={13} /> Cambiar de tipo
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg p-6">
        <div className="max-w-3xl mx-auto space-y-4 pb-6">

          {esEmpresa ? (
            <>
              <Seccion titulo="La empresa" subtitulo="Con estos datos se factura y se busca en el CRM.">
                <Campo label="Razón social *" icono={<Building2 size={11} />} ancho={2}>
                  <input className="input" value={form.empresa} onChange={e => upd("empresa", e.target.value)}
                    placeholder="Constructora ABC S.A.S." autoFocus />
                </Campo>
                <Campo label="NIT" icono={<IdCard size={11} />} ayuda="Sin NIT no se le puede facturar.">
                  <input className="input" value={form.nit} onChange={e => upd("nit", e.target.value)} placeholder="900.123.456-7" />
                </Campo>
                <Campo label="Página web" icono={<Globe size={11} />}>
                  <input type="url" className="input" value={form.paginaWeb} onChange={e => upd("paginaWeb", e.target.value)} placeholder="https://…" />
                </Campo>
              </Seccion>

              <Seccion titulo="Contacto principal" subtitulo="La persona con la que se habla. Puede cambiar sin que cambie el cliente.">
                <Campo label="Nombre" icono={<User size={11} />}>
                  <input className="input" value={form.nombre} onChange={e => upd("nombre", e.target.value)} placeholder="Juan Rodríguez" />
                </Campo>
                <Campo label="Cargo" icono={<Briefcase size={11} />}>
                  <input className="input" value={form.cargo} onChange={e => upd("cargo", e.target.value)} placeholder="Gerente de compras" />
                </Campo>
                <Campo label="Correo" icono={<Mail size={11} />} ayuda="Es a donde llegan las cotizaciones.">
                  <input type="email" className="input" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="compras@empresa.com" />
                </Campo>
                <Campo label="Teléfono" icono={<Phone size={11} />}>
                  <input type="tel" className="input" value={form.telefono} onChange={e => upd("telefono", e.target.value)} placeholder="601 234 5678" />
                </Campo>
                <Campo label="WhatsApp" icono={<MessageCircle size={11} />} ancho={2}
                  ayuda="Con esto se le puede escribir desde la ficha, sin salir del portal.">
                  <input type="tel" className="input" value={form.whatsapp} onChange={e => upd("whatsapp", e.target.value)} placeholder="+57 300 000 0000" />
                </Campo>
              </Seccion>
            </>
          ) : (
            <Seccion titulo="La persona" subtitulo="Con estos datos se factura y se le escribe.">
              <Campo label="Nombre completo *" icono={<User size={11} />} ancho={2}>
                <input className="input" value={form.nombre} onChange={e => upd("nombre", e.target.value)}
                  placeholder="María García" autoFocus />
              </Campo>
              <Campo label="Cédula" icono={<IdCard size={11} />} ayuda="Sin identificación no se le puede facturar.">
                <input className="input" value={form.cedula} onChange={e => upd("cedula", e.target.value)} placeholder="1.045.678.901" />
              </Campo>
              <Campo label="Correo" icono={<Mail size={11} />} ayuda="Es a donde llegan las cotizaciones.">
                <input type="email" className="input" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="maria@correo.com" />
              </Campo>
              <Campo label="Teléfono" icono={<Phone size={11} />}>
                <input type="tel" className="input" value={form.telefono} onChange={e => upd("telefono", e.target.value)} placeholder="300 000 0000" />
              </Campo>
              <Campo label="WhatsApp" icono={<MessageCircle size={11} />}
                ayuda="Con esto se le puede escribir desde la ficha.">
                <input type="tel" className="input" value={form.whatsapp} onChange={e => upd("whatsapp", e.target.value)} placeholder="+57 300 000 0000" />
              </Campo>
            </Seccion>
          )}

          <Seccion titulo={esEmpresa ? "Dónde queda" : "Dónde vive"}
            subtitulo="La ciudad decide el recargo de instalación cuando haya que mandar cuadrilla.">
            <Campo label="Ciudad" icono={<MapPin size={11} />}>
              <select className="input" value={form.ciudad} onChange={e => elegirCiudad(e.target.value)}>
                <option value="">Selecciona una ciudad…</option>
                {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo label="Departamento">
              <select className="input" value={form.departamento} onChange={e => upd("departamento", e.target.value)}>
                <option value="">Selecciona un departamento…</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Campo>
            <Campo label="Dirección" ancho={2}>
              <input className="input" value={form.direccion} onChange={e => upd("direccion", e.target.value)}
                placeholder={esEmpresa ? "Cra 15 #98-23, Oficina 401" : "Cra 15 #98-23, Apto 401"} />
            </Campo>
          </Seccion>

          <Seccion titulo="Notas internas" subtitulo="Solo las ve el equipo. El cliente nunca las lee.">
            <Campo label="Observaciones" icono={<FileText size={11} />} ancho={2}>
              <textarea className="input resize-none" rows={4} value={form.notas}
                onChange={e => upd("notas", e.target.value)}
                placeholder="Cómo llegó, qué está buscando, condiciones acordadas…" />
            </Campo>
          </Seccion>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-gray-400">
              Entra como <strong>{ESTADO_POR_CLAVE.PROSPECTO.l}</strong>.
            </p>
            <button
              onClick={save}
              disabled={saving || !listo}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-40 transition-all"
              style={{ backgroundColor: CRM_COLOR }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {esEmpresa ? "Registrar empresa" : "Registrar cliente"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
