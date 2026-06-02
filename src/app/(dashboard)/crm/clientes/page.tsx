"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, Search, Building2, User, Phone, Mail, MapPin, X, Loader2, ChevronRight } from "lucide-react";
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">{esNuevo ? "Nuevo cliente" : "Editar cliente"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            {["empresa","persona"].map(t => (
              <button key={t} type="button" onClick={() => setForm(p=>({...p, tipo: t}))}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${form.tipo === t ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                {t === "empresa" ? "🏢 Empresa" : "👤 Persona"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Nombre completo o razón social" />
            </div>
            {form.tipo === "empresa" && (
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Empresa</label>
                <input className="input" value={form.empresa} onChange={e=>setForm(p=>({...p,empresa:e.target.value}))} placeholder="Nombre de la empresa" />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Email</label>
              <input type="email" className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Teléfono</label>
              <input className="input" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))} placeholder="300 000 0000" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Ciudad</label>
              <input className="input" value={form.ciudad} onChange={e=>setForm(p=>({...p,ciudad:e.target.value}))} placeholder="Bogotá" />
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
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

function ClientesContent() {
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<{ open: boolean; cliente?: Cliente }>({ open: false });
  const qc = useQueryClient();
  const debouncedBusqueda = busqueda;

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["crm-clientes", debouncedBusqueda],
    queryFn: async () => {
      const qs = debouncedBusqueda ? `?busqueda=${encodeURIComponent(debouncedBusqueda)}` : "";
      const res = await fetch(`/api/crm/clientes${qs}`);
      return (await res.json()).data ?? [];
    },
  });

  return (
    <>
      <Topbar title="Clientes" actions={
        <button onClick={() => setModal({ open: true })} className="btn-primary btn-sm">
          <Plus size={14} /> Nuevo cliente
        </button>
      } />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-xs text-gray-500">Total clientes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{clientes.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Empresas</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{clientes.filter(c=>c.tipo==="empresa").length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">Personas naturales</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{clientes.filter(c=>c.tipo==="persona").length}</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="input pl-9 w-full max-w-sm" placeholder="Buscar por nombre, empresa, email…" />
        </div>

        {/* Lista */}
        <div className="card">
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Cargando clientes…</div>
            ) : clientes.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">Sin clientes</p>
                <p className="text-xs text-gray-400 mt-1">Crea tu primer cliente para empezar</p>
              </div>
            ) : clientes.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-[13px] ${c.tipo === "empresa" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{c.nombre}</p>
                    {c.empresa && <span className="text-xs text-gray-400">· {c.empresa}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10}/>{c.email}</span>}
                    {c.telefono && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10}/>{c.telefono}</span>}
                    {c.ciudad && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10}/>{c.ciudad}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center hidden md:block">
                    <p className="text-[11px] text-gray-400">Cotizaciones</p>
                    <p className="text-sm font-bold text-gray-700">{c._count.cotizaciones}</p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-[11px] text-gray-400">Pedidos</p>
                    <p className="text-sm font-bold text-gray-700">{c._count.pedidos}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setModal({ open: true, cliente: c })} className="btn-secondary btn-sm text-xs">Editar</button>
                    <Link href={`/crm/clientes/${c.id}`} className="btn-primary btn-sm text-xs">
                      Ver <ChevronRight size={12} />
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
