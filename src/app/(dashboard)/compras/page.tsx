"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Plus, Truck, Search, X, Loader2, Building2, Phone, Mail, Clock,
  Package, AlertTriangle, ShoppingBag, Trash2, MapPin, Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

const ERP_COLOR = "#185FA5";

interface Proveedor {
  id: string; nombre: string; contacto?: string; email?: string; telefono?: string;
  nit?: string; ciudad?: string; categorias: string[]; leadTimeDias?: number;
  _count: { ordenes: number };
}
interface ProductoBajo { id: string; sku: string; nombre: string; stock: number; stockMinimo: number; }

interface ProveedorEdit { id: string; nombre: string; contacto?: string; email?: string; telefono?: string; nit?: string; ciudad?: string; leadTimeDias?: number; }
function NuevoProveedor({ proveedor, onClose, onSaved }: { proveedor?: ProveedorEdit; onClose: () => void; onSaved: () => void }) {
  const editar = !!proveedor;
  const [form, setForm] = useState({
    nombre: proveedor?.nombre ?? "", contacto: proveedor?.contacto ?? "", email: proveedor?.email ?? "",
    telefono: proveedor?.telefono ?? "", nit: proveedor?.nit ?? "", ciudad: proveedor?.ciudad ?? "",
    leadTimeDias: proveedor?.leadTimeDias != null ? String(proveedor.leadTimeDias) : "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.nombre.trim()) return toast.error("Nombre requerido");
    setSaving(true);
    try {
      const res = await fetch("/api/compras/proveedores", {
        method: editar ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editar ? { id: proveedor!.id, ...form, leadTimeDias: form.leadTimeDias ? parseInt(form.leadTimeDias) : null } : form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error");
      toast.success(editar ? "Proveedor actualizado" : "Proveedor creado");
      onSaved();
    } catch { toast.error("Error"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-lg my-4 animate-fade-up">
        <div className="card-header">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Building2 size={16} style={{ color: ERP_COLOR }} /> {editar ? "Editar" : "Nuevo"} proveedor</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg surface-2 flex items-center justify-center text-muted"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Nombre / Empresa *</label>
            <input className="input" value={form.nombre} onChange={e => upd("nombre", e.target.value)} placeholder="Ej: Aceros del Norte S.A.S" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Contacto</label>
              <input className="input" value={form.contacto} onChange={e => upd("contacto", e.target.value)} placeholder="Nombre del contacto" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">NIT</label>
              <input className="input" value={form.nit} onChange={e => upd("nit", e.target.value)} placeholder="900.000.000-0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => upd("email", e.target.value)} placeholder="ventas@proveedor.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Teléfono</label>
              <input className="input" value={form.telefono} onChange={e => upd("telefono", e.target.value)} placeholder="601 000 0000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Ciudad</label>
              <input className="input" value={form.ciudad} onChange={e => upd("ciudad", e.target.value)} placeholder="Bogotá" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Lead time (días)</label>
              <input type="number" className="input" value={form.leadTimeDias} onChange={e => upd("leadTimeDias", e.target.value)} placeholder="15" />
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: ERP_COLOR }}>
            {saving && <Loader2 size={13} className="animate-spin" />} {editar ? "Guardar cambios" : "Crear proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ComprasContent() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editProv, setEditProv] = useState<ProveedorEdit | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const { data: proveedores = [], isLoading } = useQuery<Proveedor[]>({
    queryKey: ["proveedores", busqueda],
    queryFn: async () => (await (await fetch(`/api/compras/proveedores?busqueda=${encodeURIComponent(busqueda)}`)).json()).data ?? [],
  });

  // Productos que necesitan reabastecimiento (stock bajo)
  const { data: bajos = [] } = useQuery<ProductoBajo[]>({
    queryKey: ["productos-reabastecer"],
    queryFn: async () => {
      const json = await (await fetch("/api/productos?stockCritico=true&limit=50")).json();
      return (json.data ?? []).filter((p: ProductoBajo) => p.stock <= p.stockMinimo);
    },
  });

  const eliminar = async (id: string) => {
    if (!confirm("¿Desactivar proveedor?")) return;
    await fetch(`/api/compras/proveedores?id=${id}`, { method: "DELETE" });
    toast.success("Proveedor desactivado");
    qc.invalidateQueries({ queryKey: ["proveedores"] });
  };

  return (
    <>
      <Topbar title="Compras & Proveedores" actions={
        <button onClick={() => setModal(true)} className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5" style={{ backgroundColor: ERP_COLOR }}>
          <Plus size={13} /> Nuevo proveedor
        </button>
      } />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { l: "Proveedores", v: proveedores.length, c: ERP_COLOR, Icon: Building2 },
            { l: "Órdenes activas", v: proveedores.reduce((s, p) => s + p._count.ordenes, 0), c: "#7c3aed", Icon: ShoppingBag },
            { l: "Por reabastecer", v: bajos.length, c: "#ef4444", Icon: AlertTriangle },
          ].map(s => {
            const Icon = s.Icon;
            return (
              <div key={s.l} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.c + "18" }}>
                  <Icon size={18} style={{ color: s.c }} />
                </div>
                <div><p className="text-xs text-muted">{s.l}</p><p className="text-xl font-bold" style={{ color: s.c }}>{s.v}</p></div>
              </div>
            );
          })}
        </div>

        {/* Sugerencia de reabastecimiento */}
        {bajos.length > 0 && (
          <div className="card p-5" style={{ borderLeft: "4px solid #ef4444" }}>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-3">
              <AlertTriangle size={15} className="text-red-500" /> Productos que requieren reabastecimiento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {bajos.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl surface-2">
                  <Package size={16} className="text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-soft truncate">{p.nombre}</p>
                    <p className="text-[10px] text-muted font-mono">{p.sku}</p>
                  </div>
                  <span className="text-xs font-bold text-red-500">{p.stock}/{p.stockMinimo}</span>
                </div>
              ))}
            </div>
            {bajos.length > 6 && <Link href="/stock" className="text-xs font-semibold mt-3 inline-block" style={{ color: ERP_COLOR }}>Ver todos ({bajos.length})</Link>}
          </div>
        )}

        {/* Búsqueda */}
        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} className="input pl-9 py-1.5 text-xs" placeholder="Buscar proveedor..." />
        </div>

        {/* Lista proveedores */}
        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: ERP_COLOR }} /></div>
        ) : proveedores.length === 0 ? (
          <div className="card p-12 text-center">
            <Building2 size={28} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted">Sin proveedores registrados</p>
            <button onClick={() => setModal(true)} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2" style={{ backgroundColor: ERP_COLOR }}>
              <Plus size={14} /> Agregar primer proveedor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proveedores.map(p => (
              <div key={p.id} className="card card-hover p-5 group">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: ERP_COLOR }}>
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{p.nombre}</p>
                    {p.contacto && <p className="text-xs text-muted">{p.contacto}</p>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditProv({ id: p.id, nombre: p.nombre, contacto: p.contacto, email: p.email, telefono: p.telefono, nit: p.nit, ciudad: p.ciudad, leadTimeDias: p.leadTimeDias })} className="text-muted hover:text-blue-500" title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => eliminar(p.id)} className="text-muted hover:text-red-500" title="Desactivar"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {p.email && <span className="text-xs text-muted flex items-center gap-1.5 truncate"><Mail size={11} />{p.email}</span>}
                  {p.telefono && <span className="text-xs text-muted flex items-center gap-1.5"><Phone size={11} />{p.telefono}</span>}
                  {p.ciudad && <span className="text-xs text-muted flex items-center gap-1.5"><MapPin size={11} />{p.ciudad}</span>}
                  {p.leadTimeDias != null && <span className="text-xs text-muted flex items-center gap-1.5"><Clock size={11} />{p.leadTimeDias} días</span>}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t divider">
                  <span className="text-xs text-muted"><span className="font-bold text-soft">{p._count.ordenes}</span> órdenes</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {modal && <NuevoProveedor onClose={() => setModal(false)} onSaved={() => { setModal(false); qc.invalidateQueries({ queryKey: ["proveedores"] }); }} />}
      {editProv && <NuevoProveedor proveedor={editProv} onClose={() => setEditProv(null)} onSaved={() => { setEditProv(null); qc.invalidateQueries({ queryKey: ["proveedores"] }); }} />}
    </>
  );
}

export default function ComprasPage() {
  return <Suspense><ComprasContent /></Suspense>;
}
