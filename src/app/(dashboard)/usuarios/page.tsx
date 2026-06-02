"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, Shield, Check, X, Loader2, KeyRound, UserX, UserCheck, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { timeAgo } from "@/lib/utils";

interface Usuario {
  id: string; nombre: string; email: string;
  rol: string; activo: boolean; ultimoAcceso: string | null; createdAt: string;
}

const ROLES = [
  { v: "SUPERADMIN", l: "SuperAdmin", c: "bg-gray-900 text-white",       desc: "Acceso total al sistema" },
  { v: "ADMIN",      l: "Admin",      c: "bg-slate-700 text-white",       desc: "Todo excepto gestión de usuarios" },
  { v: "VENDEDOR",   l: "Vendedor",   c: "bg-yellow-400 text-yellow-900", desc: "CRM, cotizaciones, pedidos" },
  { v: "PRODUCCION", l: "Producción", c: "bg-blue-500 text-white",        desc: "Ver y gestionar producción" },
  { v: "BODEGA",     l: "Bodega",     c: "bg-emerald-500 text-white",     desc: "Stock y despachos" },
  { v: "USUARIO",    l: "Usuario",    c: "bg-gray-400 text-white",        desc: "Acceso general limitado" },
  { v: "SOLO_LECTURA", l: "Solo lectura", c: "bg-gray-200 text-gray-600", desc: "Solo visualización" },
];

function RolBadge({ rol }: { rol: string }) {
  const r = ROLES.find(r => r.v === rol);
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${r?.c ?? "bg-gray-100 text-gray-600"}`}>{r?.l ?? rol}</span>;
}

function ModalUsuario({ usuario, onClose, onSaved }: {
  usuario?: Usuario; onClose: () => void; onSaved: () => void;
}) {
  const esNuevo = !usuario;
  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? "",
    email: usuario?.email ?? "",
    rol: usuario?.rol ?? "VENDEDOR",
    password: "",
    activo: usuario?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nombre.trim() || (!usuario && !form.email.trim())) return toast.error("Completa los campos requeridos");
    if (esNuevo && form.password.length < 8) return toast.error("Contraseña mínimo 8 caracteres");
    setSaving(true);
    try {
      const body: Record<string, unknown> = { nombre: form.nombre, rol: form.rol, activo: form.activo };
      if (esNuevo) { body.email = form.email; body.password = form.password; }
      if (!esNuevo && form.password) body.password = form.password;

      const res = await fetch(esNuevo ? "/api/usuarios" : `/api/usuarios/${usuario!.id}`, {
        method: esNuevo ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return toast.error(json.error ?? "Error al guardar");
      toast.success(esNuevo ? "Usuario creado" : "Usuario actualizado");
      onSaved();
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">{esNuevo ? "Nuevo usuario" : "Editar usuario"}</h2>
            {!esNuevo && <p className="text-xs text-gray-400 mt-0.5">{usuario.email}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Nombre *</label>
            <input className="input" value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))} placeholder="Nombre completo" />
          </div>

          {esNuevo && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Email *</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="correo@empresa.com" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{esNuevo ? "Contraseña *" : "Nueva contraseña (opcional)"}</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder={esNuevo ? "Mínimo 8 caracteres" : "Dejar vacío para no cambiar"} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Rol *</label>
            <div className="space-y-1.5">
              {ROLES.map(r => (
                <button type="button" key={r.v} onClick={() => setForm(p => ({...p, rol: r.v}))}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${form.rol === r.v ? "border-gray-900 bg-gray-50" : "border-gray-100 hover:border-gray-200"}`}>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${form.rol === r.v ? "bg-gray-900" : "bg-gray-100"}`}>
                    {form.rol === r.v && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.c}`}>{r.l}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {!esNuevo && (
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">Usuario activo</p>
                <p className="text-xs text-gray-400">Puede iniciar sesión en el portal</p>
              </div>
              <button type="button" onClick={() => setForm(p => ({...p, activo: !p.activo}))}
                className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${form.activo ? "bg-cm-yellow" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${form.activo ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {esNuevo ? "Crear usuario" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsuariosContent() {
  const [modal, setModal] = useState<{ open: boolean; usuario?: Usuario }>({ open: false });
  const qc = useQueryClient();

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const toggleActivo = async (u: Usuario) => {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    const json = await res.json();
    if (json.success) { toast.success(u.activo ? "Usuario desactivado" : "Usuario activado"); qc.invalidateQueries({ queryKey: ["usuarios"] }); }
    else toast.error(json.error ?? "Error");
  };

  const activos = usuarios.filter(u => u.activo).length;

  return (
    <>
      <Topbar title="Usuarios y Roles"
        actions={
          <button onClick={() => setModal({ open: true })} className="btn-primary btn-sm">
            <Plus size={14} /> Nuevo usuario
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { l: "Total usuarios", v: usuarios.length, c: "text-gray-900" },
            { l: "Activos", v: activos, c: "text-green-600" },
            { l: "Inactivos", v: usuarios.length - activos, c: "text-red-500" },
            { l: "Roles distintos", v: new Set(usuarios.map(u => u.rol)).size, c: "text-blue-600" },
          ].map(s => (
            <div key={s.l} className="card p-4">
              <p className="text-xs text-gray-500 mb-1">{s.l}</p>
              <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
              <Shield size={15} className="text-gray-400" /> Equipo ({usuarios.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {isLoading ? (
              <div className="p-8 text-center text-[12px] text-gray-400">Cargando…</div>
            ) : usuarios.map(u => (
              <div key={u.id} className={`flex items-center gap-4 px-5 py-4 ${!u.activo ? "opacity-50" : ""}`}>
                <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                  {u.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800">{u.nombre}</p>
                  <p className="text-[11px] text-gray-400">{u.email}</p>
                </div>
                <RolBadge rol={u.rol} />
                <p className="text-[11px] text-gray-400 hidden lg:block w-28 text-right">
                  {u.ultimoAcceso ? timeAgo(u.ultimoAcceso) : "Nunca"}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal({ open: true, usuario: u })} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => toggleActivo(u)} title={u.activo ? "Desactivar" : "Activar"}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${u.activo ? "text-gray-400 hover:bg-red-50 hover:text-red-500" : "text-gray-400 hover:bg-green-50 hover:text-green-600"}`}>
                    {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal.open && (
        <ModalUsuario
          usuario={modal.usuario}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); qc.invalidateQueries({ queryKey: ["usuarios"] }); }}
        />
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><UsuariosContent /></Suspense>;
}
