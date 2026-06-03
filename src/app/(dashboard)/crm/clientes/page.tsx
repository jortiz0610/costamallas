"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, Search, Building2, Phone, Mail, MapPin, X, Loader2, ChevronRight, Users, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useBrand } from "@/contexts/BrandContext";

interface Cliente {
  id: string; nombre: string; empresa?: string; email?: string;
  telefono?: string; ciudad?: string; tipo: string; activo: boolean;
  createdAt: string; vendedor?: { nombre: string };
  _count: { cotizaciones: number; pedidos: number };
}

const CRM_COLOR = "#BA7517";

function ModalCliente({ cliente, onClose, onSaved }: { cliente?: Cliente; onClose: () => void; onSaved: () => void }) {
  const esNuevo = !cliente;
  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? "", empresa: cliente?.empresa ?? "",
    email: cliente?.email ?? "", telefono: cliente?.telefono ?? "",
    ciudad: cliente?.ciudad ?? "", tipo: cliente?.tipo ?? "empresa",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nombre.trim()) return toast.error("Nombre requerido");
    setSaving(true);
    try {
      const res = await fetch(esNuevo ? "/api/crm/clientes" : `/api/crm/clientes/${cliente!.id}`, {
        method: esNuevo ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success(esNuevo ? "Cliente creado" : "Cliente actualizado");
      onSaved();
    } catch { toast.error("Error de conexion"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-800">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{esNuevo ? "Nuevo cliente" : "Editar cliente"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Modulo CRM</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2 p-1 rounded-xl" style={{ backgroundColor: "#f1f5f9" }}>
            {["empresa", "persona"].map(t => (
              <button key={t} onClick={() => setForm(p => ({ ...p, tipo: t }))}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={form.tipo === t ? { backgroundColor: CRM_COLOR, color: "white" } : { color: "#9ca3af" }}>
                {t === "empresa" ? "Empresa" : "Persona"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre o razon social" />
            </div>
            {form.tipo === "empresa" && (
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Empresa</label>
                <input className="input" value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} placeholder="Nombre de la empresa" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Telefono</label>
              <input className="input" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="300 000 0000" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Ciudad</label>
              <input className="input" value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} placeholder="Bogota" />
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: CRM_COLOR }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            {esNuevo ? "Crear cliente" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const AVATAR_COLORS = ["#BA7517","#185FA5","#7c3aed","#059669","#dc2626","#0891b2"];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

function LeadScore({ cot: c, ped: p }: { cot: number; ped: number }) {
  const score = Math.min(100, c * 10 + p * 15);
  const color = score >= 60 ? "#16a34a" : score >= 30 ? "#d97706" : "#dc2626";
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-12 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-semibold" style={{ color }}>{score}</span>
    </div>
  );
}

function ClientesContent() {
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<{ open: boolean; cliente?: Cliente }>({ open: false });
  const qc = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["crm-clientes", busqueda],
    queryFn: async () => {
      const qs = busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : "";
      return (await (await fetch(`/api/crm/clientes${qs}`)).json()).data ?? [];
    },
  });

  return (
    <>
      <Topbar title="Clientes" actions={
        <button onClick={() => setModal({ open: true })}
          className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ backgroundColor: CRM_COLOR }}>
          <Plus size={13} /> Nuevo cliente
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", val: clientes.length, color: CRM_COLOR, Icon: Users },
            { label: "Empresas", val: clientes.filter(c => c.tipo === "empresa").length, color: "#185FA5", Icon: Building2 },
            { label: "Personas", val: clientes.filter(c => c.tipo === "persona").length, color: "#7c3aed", Icon: TrendingUp },
          ].map(s => {
            const Icon = s.Icon;
            return (
              <div key={s.label} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + "18" }}>
                  <Icon size={16} style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="input pl-9 py-1.5 text-xs" placeholder="Buscar cliente..." />
        </div>

        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: CRM_COLOR }} /></div>
          ) : clientes.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Sin clientes</p>
            </div>
          ) : clientes.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group last:border-b-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: avatarColor(c.nombre) }}>
                {c.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.nombre}</p>
                  {c.empresa && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{c.empresa}</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {c.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={9} />{c.email}</span>}
                  {c.telefono && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={9} />{c.telefono}</span>}
                  {c.ciudad && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={9} />{c.ciudad}</span>}
                </div>
              </div>
              <LeadScore cot={c._count.cotizaciones} ped={c._count.pedidos} />
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setModal({ open: true, cliente: c })}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300">Editar</button>
                <Link href={`/crm/clientes/${c.id}`}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                  style={{ backgroundColor: CRM_COLOR }}>
                  Ver <ChevronRight size={11} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      {modal.open && (
        <ModalCliente cliente={modal.cliente} onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); qc.invalidateQueries({ queryKey: ["crm-clientes"] }); }} />
      )}
    </>
  );
}

export default function Page() { return <Suspense><ClientesContent /></Suspense>; }
