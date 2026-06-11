"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { AlertTriangle, Loader2, User, MapPin, Clock, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

interface Reporte {
  id: string; usuarioNombre: string; usuarioRol: string; modulo: string;
  accion?: string; descripcion?: string; url?: string; estado: string; createdAt: string;
}

const ESTADOS = [
  { v: "", l: "Todos", c: "#64748b" },
  { v: "NUEVO", l: "Nuevos", c: "#dc2626" },
  { v: "EN_REVISION", l: "En revisión", c: "#d97706" },
  { v: "RESUELTO", l: "Resueltos", c: "#16a34a" },
];

function ReportesContent() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");

  const { data, isLoading } = useQuery<{ data: Reporte[]; nuevos: number }>({
    queryKey: ["reportes-error", filtro],
    queryFn: async () => (await (await fetch(`/api/reportes-error${filtro ? `?estado=${filtro}` : ""}`)).json()),
  });
  const reportes = data?.data ?? [];

  const cambiar = async (id: string, estado: string) => {
    const res = await fetch("/api/reportes-error", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, estado }) });
    if ((await res.json()).success) { toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["reportes-error"] }); }
  };

  const estadoMeta = (e: string) => ESTADOS.find(x => x.v === e) ?? ESTADOS[1];

  return (
    <>
      <Topbar title="Reportes de error" />
      <div className="flex-1 overflow-y-auto page-bg p-6 space-y-5 max-w-4xl mx-auto w-full">
        <div className="flex gap-2">
          {ESTADOS.map(e => (
            <button key={e.v} onClick={() => setFiltro(e.v)} className="pill" style={filtro === e.v ? { backgroundColor: e.c, color: "white" } : {}}>{e.l}</button>
          ))}
        </div>

        {isLoading ? (
          <div className="card p-10 text-center"><Loader2 size={18} className="animate-spin mx-auto" /></div>
        ) : reportes.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-sm text-muted">Sin reportes en este filtro</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reportes.map(r => {
              const em = estadoMeta(r.estado);
              return (
                <div key={r.id} className="card p-4" style={{ borderLeft: `3px solid ${em.c}` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: em.c + "18" }}>
                      <AlertTriangle size={16} style={{ color: em.c }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{r.accion || "Reporte de problema"}</p>
                      {r.descripcion && <p className="text-xs text-soft mt-0.5">{r.descripcion}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted">
                        <span className="flex items-center gap-1"><User size={11} />{r.usuarioNombre} ({r.usuarioRol})</span>
                        <span className="flex items-center gap-1"><MapPin size={11} />{r.modulo}</span>
                        <span className="flex items-center gap-1"><Clock size={11} />{new Date(r.createdAt).toLocaleString("es-CO")}</span>
                      </div>
                    </div>
                    <select value={r.estado} onChange={e => cambiar(r.id, e.target.value)} className="input py-1 text-xs w-32 flex-shrink-0">
                      <option value="NUEVO">Nuevo</option>
                      <option value="EN_REVISION">En revisión</option>
                      <option value="RESUELTO">Resuelto</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function Page() { return <Suspense><ReportesContent /></Suspense>; }
