"use client";

import { useState, Suspense } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  ArrowLeft, Phone, Mail, MapPin, Building2,
  ShoppingCart, ClipboardList, Edit2, Check, X,
  Loader2, Star, MessageSquare, ChevronRight, Plus, Save,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCOP } from "@/lib/utils";

const CRM_COLOR = "#BA7517";

const ESTADOS_CLIENTE = [
  { v: "PROSPECTO",       l: "Prospecto",       dot: "#9ca3af", bg: "#f3f4f6", text: "#6b7280" },
  { v: "INTERESADO",      l: "Interesado",      dot: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  { v: "CALIFICADO",      l: "Calificado",      dot: "#f59e0b", bg: "#fef3c7", text: "#92400e" },
  { v: "CLIENTE_ACTIVO",  l: "Cliente activo",  dot: "#10b981", bg: "#d1fae5", text: "#065f46" },
  { v: "RECURRENTE",      l: "Recurrente",      dot: "#7c3aed", bg: "#ede9fe", text: "#5b21b6" },
  { v: "VIP",             l: "VIP ⭐",           dot: "#eab308", bg: "#fef9c3", text: "#713f12" },
  { v: "CLIENTE_INACTIVO",l: "Inactivo",        dot: "#ef4444", bg: "#fee2e2", text: "#b91c1c" },
  { v: "NO_CALIFICADO",   l: "No calificado",   dot: "#94a3b8", bg: "#f1f5f9", text: "#475569" },
];

function avatarColor(name: string) {
  const colors = [CRM_COLOR, "#185FA5", "#7c3aed", "#059669", "#dc2626", "#0891b2"];
  return colors[(name?.charCodeAt(0) ?? 0) % colors.length];
}

function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS_CLIENTE.find(x => x.v === estado) ?? ESTADOS_CLIENTE[0];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: e.bg, color: e.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.dot }} />
      {e.l}
    </span>
  );
}

function ClientePerfilContent() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("info");

  // Form state — plain object
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [direccion, setDireccion] = useState("");
  const [nit, setNit] = useState("");
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState("PROSPECTO");

  const loadForm = (c: Record<string, string>) => {
    setNombre(c.nombre ?? ""); setEmpresa(c.empresa ?? ""); setCargo(c.cargo ?? "");
    setEmail(c.email ?? ""); setTelefono(c.telefono ?? ""); setCiudad(c.ciudad ?? "");
    setDepartamento(c.departamento ?? ""); setDireccion(c.direccion ?? "");
    setNit(c.nit ?? ""); setNotas(c.notas ?? ""); setEstado(c.estado ?? "PROSPECTO");
  };

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["crm-cliente", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/clientes/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      loadForm(json.data);
      return json.data as {
        id: string; nombre: string; empresa?: string; cargo?: string;
        email?: string; telefono?: string; ciudad?: string; departamento?: string;
        direccion?: string; nit?: string; notas?: string; tipo: string;
        estado: string; activo: boolean; createdAt: string;
        _count: { cotizaciones: number; pedidos: number };
      };
    },
  });

  const { data: cotizaciones = [] } = useQuery({
    queryKey: ["crm-cliente-cotizaciones", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/cotizaciones?clienteId=${id}`);
      return ((await res.json()).data ?? []) as Array<{ id: string; numero: string; estado: string; total: number; createdAt: string }>;
    },
    enabled: tab === "cotizaciones",
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["crm-cliente-pedidos", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/pedidos?clienteId=${id}`);
      return ((await res.json()).data ?? []) as Array<{ id: string; numero: string; estado: string; total: number; createdAt: string }>;
    },
    enabled: tab === "pedidos",
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clientes/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, empresa, cargo, email, telefono, ciudad, departamento, direccion, nit, notas, estado }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success("Cliente actualizado");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["crm-cliente", id] });
      qc.invalidateQueries({ queryKey: ["crm-clientes"] });
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  const cambiarEstado = async (nuevoEstado: string) => {
    const res = await fetch(`/api/crm/clientes/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["crm-cliente", id] });
      qc.invalidateQueries({ queryKey: ["crm-clientes"] });
    }
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={20} className="animate-spin" style={{ color: CRM_COLOR }} />
    </div>
  );

  if (!cliente) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
      Cliente no encontrado
    </div>
  );

  const estadoActual = ESTADOS_CLIENTE.find(e => e.v === cliente.estado);
  const TABS_LIST = [
    { k: "info",         l: "Información",  count: null },
    { k: "cotizaciones", l: "Cotizaciones", count: cliente._count.cotizaciones },
    { k: "pedidos",      l: "Pedidos",      count: cliente._count.pedidos },
    { k: "actividad",    l: "Actividad",    count: null },
  ];

  const Field = ({ label, value, onChange, editing }: { label: string; value: string; onChange?: (v: string) => void; editing: boolean }) => (
    <div>
      <label className="block text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {editing && onChange ? (
        <input className="input text-sm" value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {value || <span className="text-gray-300 dark:text-slate-600">—</span>}
        </p>
      )}
    </div>
  );

  return (
    <>
      <Topbar
        title={cliente.nombre}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/crm/clientes" className="btn-secondary btn-sm">
              <ArrowLeft size={13} /> Volver
            </Link>
            {editando ? (
              <>
                <button onClick={() => { setEditando(false); loadForm(cliente as unknown as Record<string, string>); }} className="btn-secondary btn-sm">
                  <X size={13} /> Cancelar
                </button>
                <button onClick={save} disabled={saving}
                  className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                  style={{ backgroundColor: CRM_COLOR }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                </button>
              </>
            ) : (
              <button onClick={() => setEditando(true)}
                className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                style={{ backgroundColor: CRM_COLOR }}>
                <Edit2 size={12} /> Editar
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto page-bg">
        <div className="max-w-5xl mx-auto p-6 space-y-5">

          {/* Header card */}
          <div className="card p-6">
            <div className="flex items-start gap-5 flex-wrap">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                style={{ backgroundColor: avatarColor(cliente.nombre) }}>
                {cliente.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{cliente.nombre}</h1>
                  <EstadoBadge estado={cliente.estado} />
                  {cliente.tipo === "empresa" && (
                    <span className="badge-blue badge"><Building2 size={9} className="mr-0.5" />Empresa</span>
                  )}
                </div>
                {cliente.empresa && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                    <Building2 size={12} /> {cliente.empresa}
                    {cliente.cargo && <span className="text-gray-400"> · {cliente.cargo}</span>}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {cliente.email && <a href={`mailto:${cliente.email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"><Mail size={12} />{cliente.email}</a>}
                  {cliente.telefono && <span className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} />{cliente.telefono}</span>}
                  {cliente.ciudad && <span className="flex items-center gap-1.5 text-xs text-gray-400"><MapPin size={12} />{cliente.ciudad}{cliente.departamento ? `, ${cliente.departamento}` : ""}</span>}
                </div>
              </div>

              {/* Cambiar estado rápido */}
              <div className="flex-shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Cambiar estado</p>
                <div className="flex flex-col gap-1.5">
                  {ESTADOS_CLIENTE.filter(e => e.v !== cliente.estado).slice(0, 4).map(e => (
                    <button key={e.v} onClick={() => cambiarEstado(e.v)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                      style={{ backgroundColor: e.bg, color: e.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.dot }} />
                      {e.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100 dark:border-slate-700/50">
              {[
                { l: "Cotizaciones",  v: String(cliente._count.cotizaciones), c: CRM_COLOR,  Icon: ClipboardList },
                { l: "Pedidos",       v: String(cliente._count.pedidos),      c: "#185FA5",  Icon: ShoppingCart  },
                { l: "Desde",         v: new Date(cliente.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "short" }), c: "#7c3aed", Icon: Star },
              ].map(s => {
                const Icon = s.Icon;
                return (
                  <div key={s.l} className="text-center p-3 rounded-xl" style={{ backgroundColor: s.c + "08" }}>
                    <Icon size={18} className="mx-auto mb-1" style={{ color: s.c }} />
                    <p className="text-base font-bold" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-[11px] text-gray-400">{s.l}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-t-xl px-4 border-b border-gray-100 dark:border-slate-700/50">
            <div className="flex gap-1">
              {TABS_LIST.map(t => (
                <button key={t.k} onClick={() => setTab(t.k)}
                  className="flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all"
                  style={tab === t.k ? { borderBottomColor: CRM_COLOR, color: CRM_COLOR } : { borderBottomColor: "transparent", color: "#6b7280" }}>
                  {t.l}
                  {t.count !== null && t.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: CRM_COLOR }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab: Información */}
          {tab === "info" && (
            <div className="card p-5 space-y-5 -mt-2 rounded-t-none">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Contacto</h3>
                  <Field label="Nombre" value={editando ? nombre : (cliente.nombre ?? "")} onChange={setNombre} editing={editando} />
                  <Field label="Empresa" value={editando ? empresa : (cliente.empresa ?? "")} onChange={setEmpresa} editing={editando} />
                  <Field label="Cargo" value={editando ? cargo : (cliente.cargo ?? "")} onChange={setCargo} editing={editando} />
                  <Field label="Email" value={editando ? email : (cliente.email ?? "")} onChange={setEmail} editing={editando} />
                  <Field label="Teléfono" value={editando ? telefono : (cliente.telefono ?? "")} onChange={setTelefono} editing={editando} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Ubicación</h3>
                  <Field label="Ciudad" value={editando ? ciudad : (cliente.ciudad ?? "")} onChange={setCiudad} editing={editando} />
                  <Field label="Departamento" value={editando ? departamento : (cliente.departamento ?? "")} onChange={setDepartamento} editing={editando} />
                  <Field label="Dirección" value={editando ? direccion : (cliente.direccion ?? "")} onChange={setDireccion} editing={editando} />
                  <Field label="NIT / RUT" value={editando ? nit : (cliente.nit ?? "")} onChange={setNit} editing={editando} />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-slate-700/50">
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Notas internas</label>
                {editando ? (
                  <textarea className="input resize-none" rows={4} value={notas} onChange={e => setNotas(e.target.value)}
                    placeholder="Observaciones, historial, condiciones especiales..." />
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {cliente.notas || <span className="text-gray-300 dark:text-slate-600 italic">Sin notas</span>}
                  </p>
                )}
              </div>

              {editando && (
                <div className="pt-4 border-t border-gray-100 dark:border-slate-700/50">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Estado del cliente</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ESTADOS_CLIENTE.map(e => {
                      const sel = estado === e.v;
                      return (
                        <button key={e.v} type="button" onClick={() => setEstado(e.v)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all"
                          style={sel ? { borderColor: e.dot, backgroundColor: e.bg } : { borderColor: "#e2e8f0" }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.dot }} />
                          <span className="text-[11px] font-semibold truncate" style={{ color: sel ? e.text : "#6b7280" }}>{e.l}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Cotizaciones */}
          {tab === "cotizaciones" && (
            <div className="card overflow-hidden -mt-2 rounded-t-none">
              <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Cotizaciones</h3>
                <Link href={`/crm/cotizaciones/nueva?clienteId=${id}`}
                  className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                  style={{ backgroundColor: CRM_COLOR }}>
                  <Plus size={12} /> Nueva cotización
                </Link>
              </div>
              {cotizaciones.length === 0 ? (
                <div className="p-10 text-center">
                  <ClipboardList size={24} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">Sin cotizaciones</p>
                </div>
              ) : cotizaciones.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3 border-b last:border-0 border-gray-50 dark:border-slate-700/40 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div><p className="text-xs font-mono text-gray-400">{c.numero}</p><p className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("es-CO")}</p></div>
                  <div className="flex-1" />
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{c.estado}</span>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{formatCOP(c.total)}</p>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              ))}
            </div>
          )}

          {/* Tab: Pedidos */}
          {tab === "pedidos" && (
            <div className="card overflow-hidden -mt-2 rounded-t-none">
              <div className="p-4 border-b border-gray-100 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Pedidos</h3>
              </div>
              {pedidos.length === 0 ? (
                <div className="p-10 text-center">
                  <ShoppingCart size={24} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">Sin pedidos</p>
                </div>
              ) : pedidos.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3 border-b last:border-0 border-gray-50 dark:border-slate-700/40 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                  <p className="text-xs font-mono text-gray-400">{p.numero}</p>
                  <p className="text-[10px] text-gray-400">{new Date(p.createdAt).toLocaleDateString("es-CO")}</p>
                  <div className="flex-1" />
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{p.estado}</span>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{formatCOP(p.total)}</p>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              ))}
            </div>
          )}

          {/* Tab: Actividad */}
          {tab === "actividad" && (
            <div className="card p-8 text-center -mt-2 rounded-t-none">
              <MessageSquare size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-semibold text-gray-500">Historial de actividad</p>
              <p className="text-xs text-gray-400 mt-1">Próximamente — conversaciones, notas y llamadas registradas</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ClientePerfilPage() {
  return <Suspense><ClientePerfilContent /></Suspense>;
}
