"use client";

import { useState, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  Plus, Search, Building2, Phone, Mail, MapPin, Loader2,
  ChevronRight, Users, TrendingUp, UserCircle, Star, Filter,
  UserPlus, MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useBrand } from "@/contexts/BrandContext";

interface Cliente {
  id: string; nombre: string; empresa?: string; email?: string;
  telefono?: string; ciudad?: string; tipo: string; activo: boolean;
  estado: string; createdAt: string;
  vendedor?: { nombre: string };
  _count: { cotizaciones: number; pedidos: number };
}

const CRM_COLOR = "#BA7517";

const ESTADOS_CLIENTE = [
  { v: "PROSPECTO",       l: "Prospecto",       bg: "#f3f4f6", text: "#6b7280",  dot: "#9ca3af" },
  { v: "INTERESADO",      l: "Interesado",      bg: "#eff6ff", text: "#1d4ed8",  dot: "#3b82f6" },
  { v: "CALIFICADO",      l: "Calificado",      bg: "#fef3c7", text: "#92400e",  dot: "#f59e0b" },
  { v: "CLIENTE_ACTIVO",  l: "Cliente activo",  bg: "#d1fae5", text: "#065f46",  dot: "#10b981" },
  { v: "RECURRENTE",      l: "Recurrente",      bg: "#ede9fe", text: "#5b21b6",  dot: "#7c3aed" },
  { v: "VIP",             l: "VIP ⭐",           bg: "#fef9c3", text: "#713f12",  dot: "#eab308" },
  { v: "CLIENTE_INACTIVO",l: "Inactivo",        bg: "#fee2e2", text: "#b91c1c",  dot: "#ef4444" },
  { v: "NO_CALIFICADO",   l: "No calificado",   bg: "#f1f5f9", text: "#475569",  dot: "#94a3b8" },
];

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

const AVATAR_COLORS = [CRM_COLOR, "#185FA5", "#7c3aed", "#059669", "#dc2626", "#0891b2"];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

function LeadScore({ cot: c, ped: p }: { cot: number; ped: number }) {
  const score = Math.min(100, c * 10 + p * 15);
  const color = score >= 60 ? "#16a34a" : score >= 30 ? "#d97706" : "#dc2626";
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-14 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function ClientesContent() {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const qc = useQueryClient();
  const { brand } = useBrand();

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ["crm-clientes", busqueda],
    queryFn: async () => {
      const qs = busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : "";
      return (await (await fetch(`/api/crm/clientes${qs}`)).json()).data ?? [];
    },
  });

  const filtrados = filtroEstado
    ? clientes.filter(c => c.estado === filtroEstado)
    : clientes;

  const activos = clientes.filter(c => c.estado === "CLIENTE_ACTIVO" || c.estado === "RECURRENTE" || c.estado === "VIP").length;
  const vips = clientes.filter(c => c.estado === "VIP").length;

  return (
    <>
      <Topbar
        title="Clientes"
        actions={
          <Link
            href="/crm/clientes/nuevo"
            className="btn-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
            style={{ backgroundColor: CRM_COLOR }}
          >
            <UserPlus size={13} /> Nuevo cliente
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total clientes",  val: clientes.length, color: CRM_COLOR,   Icon: Users },
            { label: "Empresas",        val: clientes.filter(c => c.tipo === "empresa").length, color: "#185FA5", Icon: Building2 },
            { label: "Clientes activos",val: activos, color: "#059669", Icon: TrendingUp },
            { label: "VIP",             val: vips, color: "#eab308", Icon: Star },
          ].map(s => {
            const Icon = s.Icon;
            return (
              <div key={s.label} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + "18" }}>
                  <Icon size={16} style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="input pl-9 py-1.5 text-xs" placeholder="Buscar cliente..." />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFiltroEstado("")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={!filtroEstado ? { backgroundColor: "var(--brand-color)", color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
              Todos
            </button>
            {ESTADOS_CLIENTE.map(e => {
              const count = clientes.filter(c => c.estado === e.v).length;
              if (!count) return null;
              return (
                <button key={e.v} onClick={() => setFiltroEstado(filtroEstado === e.v ? "" : e.v)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={filtroEstado === e.v ? { backgroundColor: e.dot, color: "white" } : { backgroundColor: e.bg, color: e.text }}>
                  {e.l} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: CRM_COLOR }} /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center">
              <UserCircle size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Sin clientes</p>
              <Link href="/crm/clientes/nuevo"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: CRM_COLOR }}>
                <Plus size={14} /> Crear primer cliente
              </Link>
            </div>
          ) : filtrados.map(c => (
            <div key={c.id}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors group last:border-b-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: avatarColor(c.nombre) }}>
                {c.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{c.nombre}</p>
                  {c.empresa && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{c.empresa}</span>}
                  <EstadoBadge estado={c.estado ?? "PROSPECTO"} />
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {c.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={9} />{c.email}</span>}
                  {c.telefono && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={9} />{c.telefono}</span>}
                  {c.ciudad && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={9} />{c.ciudad}</span>}
                </div>
              </div>
              <LeadScore cot={c._count.cotizaciones} ped={c._count.pedidos} />
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/crm/clientes/${c.id}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                  style={{ backgroundColor: CRM_COLOR }}>
                  Ver perfil <ChevronRight size={11} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Suspense><ClientesContent /></Suspense>; }
