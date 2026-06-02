"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, Search, Building2, Phone, Mail, MapPin, X, Loader2, ChevronRight, Users, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";

interface Cliente {
  id: string; nombre: string; empresa?: string; email?: string;
  telefono?: string; ciudad?: string; tipo: string; activo: boolean;
  createdAt: string; vendedor?: { nombre: string };
  _count: { cotizaciones: number; pedidos: number };
}

function ModalCliente({ cliente, onClose, onSaved }: {
  cliente?: Cliente; onClose: () => void; onSaved: () => void;
}) {
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
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/80 w-full max-w-lg border border-slate-100">
        {/* Header con gradiente */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">{esNuevo ? "Nuevo cliente" : "Editar cliente"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{esNuevo ? "Completa los datos del cliente" : "Actualiza la información"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
            <X size={15} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Tipo selector */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
            {["empresa", "persona"].map(t => (
              <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: t }))}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.tipo === t
                  ? "bg-white text-slate-800 shadow-sm shadow-slate-200"
                  : "text-slate-400 hover:text-slate-600"}`}>
                {t === "empresa" ? "🏢 Empresa" : "👤 Persona"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre completo o razón social" />
            </div>
            {form.tipo === "empresa" && (
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Empresa</label>
                <input className="input" value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} placeholder="Nombre de la empresa" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Teléfono</label>
              <input className="input" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="300 000 0000" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Ciudad</label>
              <input className="input" value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} placeholder="Bogotá" />
            </div>
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {esNuevo ? "Crear cliente" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const GRADIENTS = [
  "from-violet-400 to-indigo-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-500",
  "from-fuchsia-400 to-purple-500",
];

function getGradient(name: string) {
  const idx = name.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

function ClientesContent() {
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<{ open: boolean; cliente?: Cliente }>({ open: false });
  const qc = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["crm-clientes", busqueda],
    queryFn: async () => {
      const qs = busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : "";
      const res = await fetch(`/api/crm/clientes${qs}`);
      return (await res.json()).data ?? [];
    },
  });

  const empresas = clientes.filter(c => c.tipo === "empresa").length;
  const personas = clientes.filter(c => c.tipo === "persona").length;

  return (
    <>
      <Topbar title="Clientes" actions={
        <button onClick={() => setModal({ open: true })} className="btn-primary btn-sm">
          <Plus size={14} /> Nuevo cliente
        </button>
      } />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-violet-200 text-xs font-semibold uppercase tracking-wider">Total clientes</span>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Users size={15} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold">{clientes.length}</p>
          </div>
          <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-sky-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sky-200 text-xs font-semibold uppercase tracking-wider">Empresas</span>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Building2 size={15} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold">{empresas}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">Personas naturales</span>
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp size={15} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold">{personas}</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all shadow-sm"
            placeholder="Buscar por nombre, empresa, email…"
          />
        </div>

        {/* Lista */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {isLoading ? (
              <div className="p-10 text-center">
                <Loader2 size={20} className="animate-spin text-violet-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Cargando clientes…</p>
              </div>
            ) : clientes.length === 0 ? (
              <div className="p-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Building2 size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">Sin clientes aún</p>
                <p className="text-xs text-slate-400 mt-1">Crea tu primer cliente para empezar</p>
              </div>
            ) : clientes.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors group">
                {/* Avatar con gradiente */}
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${getGradient(c.nombre)} flex items-center justify-center flex-shrink-0 font-bold text-[13px] text-white shadow-sm`}>
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{c.nombre}</p>
                    {c.empresa && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{c.empresa}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.email && <span className="text-xs text-slate-400 flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                    {c.telefono && <span className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10} />{c.telefono}</span>}
                    {c.ciudad && <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={10} />{c.ciudad}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center hidden md:block">
                    <p className="text-[10px] text-slate-400 font-medium">Cotizaciones</p>
                    <p className="text-sm font-bold text-slate-700">{c._count.cotizaciones}</p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-[10px] text-slate-400 font-medium">Pedidos</p>
                    <p className="text-sm font-bold text-slate-700">{c._count.pedidos}</p>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal({ open: true, cliente: c })}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors">
                      Editar
                    </button>
                    <Link href={`/crm/clientes/${c.id}`}
                      className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-xs font-semibold text-white transition-colors flex items-center gap-1">
                      Ver <ChevronRight size={11} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal.open && (
        <ModalCliente
          cliente={modal.cliente}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); qc.invalidateQueries({ queryKey: ["crm-clientes"] }); }}
        />
      )}
    </>
  );
}

export default function Page() { return <Suspense><ClientesContent /></Suspense>; }
