"use client";

import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import {
  ShieldCheck, ShieldAlert, Database, Wifi, Clock, RefreshCw,
  Activity, AlertTriangle, CheckCircle2, XCircle, Zap, Server,
} from "lucide-react";
import { formatFechaHoraCO, timeAgoCO, horaActualCO } from "@/lib/timezone";
import { useBrand } from "@/contexts/BrandContext";
import { useState, useEffect } from "react";

interface HealthData {
  checks: Record<string, { ok: boolean; latencyMs?: number; mensaje?: string }>;
  logsRecientes: number;
  erroresPendientes: number;
  sinStock: number;
  caidas: { createdAt: string; accion: string; detalle: string | null }[];
  ultimoAcceso: { nombre: string; ultimoAcceso: string | null } | null;
  uptime: number;
  timestamp: string;
  nodeVersion: string;
  env: string;
}

function formatUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
      style={{ boxShadow: ok ? "0 0 6px #10b981" : "0 0 6px #ef4444" }} />
  );
}

export default function SeguridadPage() {
  const { brand } = useBrand();
  const [horaActual, setHoraActual] = useState(horaActualCO());

  useEffect(() => {
    const t = setInterval(() => setHoraActual(horaActualCO()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["sistema-health"],
    queryFn: async () => {
      const res = await fetch("/api/sistema/health");
      return (await res.json()).data;
    },
    refetchInterval: 60_000,
  });

  const dbOk = data?.checks.database?.ok ?? false;
  const dbLatency = data?.checks.database?.latencyMs ?? 0;
  const todoOk = dbOk && (data?.erroresPendientes ?? 0) === 0;

  const CHECKS = [
    {
      label: "Base de datos",
      icon: Database,
      ok: dbOk,
      detalle: dbOk ? `${dbLatency}ms latencia` : (data?.checks.database?.mensaje ?? "Sin conexión"),
      color: "#185FA5",
    },
    {
      label: "API / Backend",
      icon: Server,
      ok: true,
      detalle: `Node ${data?.nodeVersion ?? "…"} · ${data?.env ?? "…"}`,
      color: "#7c3aed",
    },
    {
      label: "Errores de validación",
      icon: AlertTriangle,
      ok: (data?.erroresPendientes ?? 0) === 0,
      detalle: data?.erroresPendientes ? `${data.erroresPendientes} errores pendientes` : "Sin errores pendientes",
      color: "#d97706",
    },
    {
      label: "Stock crítico",
      icon: Zap,
      ok: (data?.sinStock ?? 0) === 0,
      detalle: data?.sinStock ? `${data.sinStock} productos sin stock` : "Stock OK en todos los productos",
      color: "#dc2626",
    },
    {
      label: "Actividad reciente",
      icon: Activity,
      ok: (data?.logsRecientes ?? 0) > 0,
      detalle: `${data?.logsRecientes ?? 0} acciones en las últimas 24h`,
      color: "#16a34a",
    },
    {
      label: "Uptime del servidor",
      icon: Clock,
      ok: (data?.uptime ?? 0) > 0,
      detalle: data?.uptime ? formatUptime(data.uptime) : "—",
      color: "#0891b2",
    },
  ];

  return (
    <>
      <Topbar title="Seguridad del sistema" actions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Colombia · {horaActual}</span>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto page-bg p-5 space-y-5">

        {/* Estado general */}
        <div className="card p-5 flex items-center gap-4"
          style={{ borderLeft: `4px solid ${todoOk ? "#10b981" : "#ef4444"}` }}>
          {todoOk
            ? <ShieldCheck size={32} className="text-emerald-500 flex-shrink-0" />
            : <ShieldAlert size={32} className="text-red-500 flex-shrink-0" />}
          <div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {todoOk ? "Sistema operando con normalidad" : "Se detectaron problemas que requieren atención"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Última verificación: {dataUpdatedAt ? timeAgoCO(new Date(dataUpdatedAt)) : "—"}
            </p>
          </div>
        </div>

        {/* Grid de checks */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CHECKS.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="card p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: c.color + "15" }}>
                  <Icon size={17} style={{ color: c.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <StatusDot ok={c.ok} />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.label}</p>
                  </div>
                  <p className="text-[11px] text-slate-400">{c.detalle}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Protecciones de seguridad activas */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-500" /> Protecciones activas
            </h2>
            <span className="text-xs text-slate-400">Buenas prácticas implementadas</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px surface-2">
            {[
              { t: "Cifrado AES-256-GCM", d: "Credenciales y datos sensibles (API keys, tokens) cifrados en reposo." },
              { t: "Contraseñas con bcrypt", d: "Las contraseñas se almacenan con hash bcrypt, nunca en texto plano." },
              { t: "Autenticación JWT", d: "Sesiones con tokens firmados y refresh tokens de expiración controlada." },
              { t: "HTTPS forzado (HSTS)", d: "Todo el tráfico se cifra en tránsito con TLS y HSTS preload." },
              { t: "Cabeceras de seguridad", d: "CSP, X-Frame-Options, nosniff y Referrer-Policy contra XSS y clickjacking." },
              { t: "Control de acceso por roles", d: "Permisos granulares por rol (RBAC) en cada endpoint sensible." },
              { t: "Registro de auditoría", d: "Todas las acciones críticas quedan registradas con usuario y fecha." },
              { t: "Rate limiting suave", d: "Protección contra abuso sin bloquear el uso normal del equipo." },
            ].map(p => (
              <div key={p.t} className="surface p-4 flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.t}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{p.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Último acceso */}
        {data?.ultimoAcceso && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: brand.brandColor }}>
              {data.ultimoAcceso.nombre.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Último acceso: <span className="font-semibold">{data.ultimoAcceso.nombre}</span>
              </p>
              <p className="text-[11px] text-slate-400">{formatFechaHoraCO(data.ultimoAcceso.ultimoAcceso)}</p>
            </div>
          </div>
        )}

        {/* Log de caídas/errores */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" /> Registro de errores (últimas 48h)
            </h2>
            <span className="text-xs text-slate-400">{data?.caidas?.length ?? 0} eventos</span>
          </div>
          {!data?.caidas?.length ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sin errores en las últimas 48 horas</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {data.caidas.map((c, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.accion}</p>
                    {c.detalle && <p className="text-[11px] text-slate-400 truncate">{c.detalle}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgoCO(c.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
