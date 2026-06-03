"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Plus, Shield, Check, X, Loader2, KeyRound, UserX, UserCheck, Pencil, Users } from "lucide-react";
import toast from "react-hot-toast";
import { timeAgo } from "@/lib/utils";
import { useBrand } from "@/contexts/BrandContext";

interface Usuario {
  id: string; nombre: string; email: string;
  rol: string; activo: boolean; ultimoAcceso: string | null; createdAt: string;
}

const ROLES = [
  { v: "SUPERADMIN",   l: "SuperAdmin",   color: "#0f172a", bg: "#f1f5f9",  desc: "Acceso total al sistema" },
  { v: "ADMIN",        l: "Admin",        color: "#1e40af", bg: "#dbeafe",  desc: "Todo excepto gestión de usuarios" },
  { v: "VENDEDOR",     l: "Vendedor",     color: "#92400e", bg: "#fef3c7",  desc: "CRM, cotizaciones, pedidos" },
  { v: "PRODUCCION",   l: "Producción",   color: "#1d4ed8", bg: "#dbeafe",  desc: "Ver y gestionar producción" },
  { v: "BODEGA",       l: "Bodega",       color: "#065f46", bg: "#d1fae5",  desc: "Stock y despachos" },
  { v: "USUARIO",      l: "Usuario",      color: "#374151", bg: "#f3f4f6",  desc: "Acceso general limitado" },
  { v: "SOLO_LECTURA", l: "Solo lectura", color: "#6b7280", bg: "#f9fafb",  desc: "Solo visualización" },
];

function RolBadge({ rol }: { rol: string }) {
  const r = ROLES.find(r => r.v === rol);
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: r?.bg ?? "#f3f4f6", color: r?.color ?? "#6b7280" }}>
      {r?.l ?? rol}
    </span>
  );
}

function ModalUsuario({ usuario, onClose, onSaved }: {
  usuario?: Usuario; onClose: () => void; onSaved: () => void;
}) {
  const { brand } = useBrand();
  const esNuevo = !usuario;
  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? "",
    email: usuario?.email ?? "",
    rol: usuario?.rol ?? "VENDEDOR",
    password: "",
    activo: usuario?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

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

  const rolActual = ROLES.find(r => r.v === form.rol);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ backgroundColor: brand.brandColor + "10", borderBottom: `1px solid ${brand.brandColor}20` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brand.brandColor }}>
              <Users size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{esNuevo ? "Nuevo usuario" : "Editar usuario"}</h2>
              {!esNuevo && <p className="text-xs text-gray-400 mt-0.5">{usuario.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/60 dark:bg-slate-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Nombre */}
          <div>
            <label className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Nombre completo *</label>
            <input className="input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej. María García" />
          </div>

          {/* Email */}
          {esNuevo && (
            <div>
              <label className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Email *</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@empresa.com" />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
              {esNuevo ? "Contraseña *" : "Nueva contraseña (opcional)"}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="input pr-10"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={esNuevo ? "Mínimo 8 caracteres" : "Dejar vacío para no cambiar"}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <KeyRound size={14} />
              </button>
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider block mb-2">Rol *</label>
            <div className="space-y-1.5">
              {ROLES.map(r => (
                <button
                  type="button"
                  key={r.v}
                  onClick={() => setForm(p => ({ ...p, rol: r.v }))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left"
                  style={
                    form.rol === r.v
                      ? { borderColor: r.color, backgroundColor: r.bg }
                      : { borderColor: "#e2e8f0", backgroundColor: "transparent" }
                  }
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={form.rol === r.v ? { backgroundColor: r.color } : { backgroundColor: "#e2e8f0" }}
                  >
                    {form.rol === r.v && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: r.bg, color: r.color }}>{r.l}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Activo toggle (edit only) */}
          {!esNuevo && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-slate-700">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Usuario activo</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Puede iniciar sesión</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, activo: !p.activo }))}
                className="w-11 h-6 rounded-full relative transition-colors duration-200"
                style={{ backgroundColor: form.activo ? brand.brandColor : "#d1d5db" }}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${form.activo ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 flex gap-3 border-t border-gray-100 dark:border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            style={{ backgroundColor: brand.brandColor }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {esNuevo ? "Crear usuario" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsuariosContent() {
  const { brand } = useBrand();
  const [modal, setModal] = useState<{ open: boolean; usuario?: Usuario }>({ open: false });
  const qc = useQueryClient();

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: async () => (await (await fetch("/api/usuarios")).json()).data ?? [],
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
      <Topbar title="Usuarios y Roles" />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { l: "Total",        v: usuarios.length,             c: brand.brandColor },
            { l: "Activos",      v: activos,                     c: "#16a34a" },
            { l: "Inactivos",    v: usuarios.length - activos,   c: "#dc2626" },
            { l: "Roles",        v: new Set(usuarios.map(u => u.rol)).size, c: "#7c3aed" },
          ].map(s => (
            <div key={s.l} className="card p-4">
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">{s.l}</p>
              <p className="text-2xl font-bold" style={{ color: s.c }}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Roles legend */}
        <div className="flex flex-wrap gap-2">
          {ROLES.map(r => (
            <span key={r.v} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: r.bg, color: r.color }}>
              {r.l}
            </span>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Shield size={15} className="text-gray-400" /> Equipo ({usuarios.length})
            </h2>
            <button onClick={() => setModal({ open: true })} className="btn-primary btn-sm">
              <Plus size={14} /> Nuevo usuario
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 size={18} className="animate-spin mx-auto mb-2" style={{ color: brand.brandColor }} />
                <p className="text-xs text-gray-400">Cargando...</p>
              </div>
            ) : usuarios.map(u => {
              const rolMeta = ROLES.find(r => r.v === u.rol);
              return (
                <div key={u.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors ${!u.activo ? "opacity-40" : ""}`}>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: rolMeta?.color ?? brand.brandColor }}
                  >
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{u.nombre}</p>
                      {!u.activo && <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactivo</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500">{u.email}</p>
                  </div>
                  <RolBadge rol={u.rol} />
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 hidden lg:block w-28 text-right">
                    {u.ultimoAcceso ? timeAgo(u.ultimoAcceso) : "Nunca"}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModal({ open: true, usuario: u })}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      title="Editar usuario"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => toggleActivo(u)}
                      title={u.activo ? "Desactivar usuario" : "Activar usuario"}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${u.activo ? "text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500" : "text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600"}`}
                    >
                      {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
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
