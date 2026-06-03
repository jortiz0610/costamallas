"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { BarChart2, Download, Search, RefreshCw, Activity, User, CheckCircle2, XCircle } from "lucide-react";
import { formatFechaHoraCO, timeAgoCO } from "@/lib/timezone";
import { useBrand } from "@/contexts/BrandContext";

interface LogEntry {
  id: string; createdAt: string; accion: string;
  usuario: { nombre: string } | null;
  resultado: string | null; detalle: string | null;
  ipAddress: string | null;
}

const ACCION_COLORES: Record<string, string> = {
  LOGIN:          "#185FA5",
  LOGOUT:         "#6b7280",
  PRODUCTO_EDIT:  "#7c3aed",
  PRODUCTO_NUEVO: "#16a34a",
  EXPORTAR:       "#d97706",
  IMPORTAR:       "#0891b2",
  PEDIDO_ESTADO:  "#BA7517",
  ERROR:          "#dc2626",
};

function accionColor(accion: string) {
  for (const [key, color] of Object.entries(ACCION_COLORES)) {
    if (accion.includes(key)) return color;
  }
  return "#6b7280";
}

function accionIcono(accion: string) {
  if (accion.includes("LOGIN")) return <User size={12} />;
  if (accion.includes("ERROR")) return <XCircle size={12} />;
  return <Activity size={12} />;
}

async function fetchLogs(page: number, busqueda: string, filtroAccion: string) {
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (busqueda) params.set("busqueda", busqueda);
  if (filtroAccion) params.set("accion", filtroAccion);
  const res = await fetch(`/api/logs?${params}`);
  if (!res.ok) throw new Error("Error");
  return res.json();
}

export default function ReportesPage() {
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const { brand } = useBrand();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs-reportes", page, busqueda, filtroAccion],
    queryFn: () => fetchLogs(page, busqueda, filtroAccion),
  });

  const logs: LogEntry[] = data?.data ?? [];

  // Stats rápidas
  const exitosos = logs.filter(l => l.resultado === "OK").length;
  const errores = logs.filter(l => l.resultado === "ERROR").length;
  const usuarios = new Set(logs.map(l => l.usuario?.nombre).filter(Boolean)).size;

  const ACCIONES_RAPIDAS = ["LOGIN", "EXPORTAR", "PRODUCTO_EDIT", "ERROR"];

  return (
    <>
      <Topbar title="Reportes y logs de auditoría" actions={
        <button onClick={() => refetch()} className="btn-secondary btn-sm">
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Actualizar
        </button>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Eventos mostrados", val: logs.length, color: brand.brandColor, icon: Activity },
            { label: "Exitosos", val: exitosos, color: "#16a34a", icon: CheckCircle2 },
            { label: "Errores", val: errores, color: "#dc2626", icon: XCircle },
            { label: "Usuarios activos", val: usuarios, color: "#7c3aed", icon: User },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: s.color + "18" }}>
                  <Icon size={16} style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }}
              className="input pl-9 py-1.5 text-xs" placeholder="Buscar usuario, acción, detalle…" />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => { setFiltroAccion(""); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={!filtroAccion ? { backgroundColor: brand.brandColor, color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
              Todos
            </button>
            {ACCIONES_RAPIDAS.map(a => (
              <button key={a} onClick={() => { setFiltroAccion(filtroAccion === a ? "" : a); setPage(1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={filtroAccion === a ? { backgroundColor: accionColor(a), color: "white" } : { backgroundColor: "var(--surface-3)", color: "var(--text-muted)" }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de logs */}
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {isLoading ? (
              <div className="p-10 text-center text-sm text-slate-400">Cargando historial…</div>
            ) : !logs.length ? (
              <div className="p-10 text-center text-sm text-slate-400">Sin registros en este filtro</div>
            ) : logs.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                {/* Icono acción */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: accionColor(l.accion) + "18", color: accionColor(l.accion) }}>
                  {accionIcono(l.accion)}
                </div>
                {/* Acción */}
                <div className="w-36 flex-shrink-0">
                  <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: accionColor(l.accion) + "15", color: accionColor(l.accion) }}>
                    {l.accion}
                  </span>
                </div>
                {/* Usuario */}
                <div className="w-28 flex-shrink-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {l.usuario?.nombre ?? "Sistema"}
                  </p>
                </div>
                {/* Detalle */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 truncate">{l.detalle ?? "—"}</p>
                </div>
                {/* Resultado */}
                <div className="w-16 flex-shrink-0 text-center">
                  {l.resultado === "OK"
                    ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">OK</span>
                    : l.resultado
                      ? <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">{l.resultado}</span>
                      : <span className="text-[10px] text-slate-300">—</span>
                  }
                </div>
                {/* Tiempo */}
                <div className="w-24 flex-shrink-0 text-right">
                  <p className="text-[10px] text-slate-400" title={formatFechaHoraCO(l.createdAt)}>
                    {timeAgoCO(l.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Paginación */}
        {data?.totalPages > 1 && (
          <div className="flex gap-2 justify-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">← Anterior</button>
            <span className="text-xs text-slate-500 self-center">Página {page} de {data.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="btn-secondary btn-sm">Siguiente →</button>
          </div>
        )}

      </div>
    </>
  );
}
