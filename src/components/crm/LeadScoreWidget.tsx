"use client";

import { TrendingUp, TrendingDown, Minus, Zap, Target, Clock } from "lucide-react";

interface LeadScoreProps {
  cotizaciones: number;
  pedidos: number;
  totalFacturado: number;
  diasSinActividad?: number;
}

/** Calcula lead score 0–100 basado en métricas reales del cliente */
export function calcLeadScore({ cotizaciones, pedidos, totalFacturado, diasSinActividad = 0 }: LeadScoreProps): number {
  let score = 0;
  // Cotizaciones (max 25 pts)
  score += Math.min(cotizaciones * 5, 25);
  // Pedidos (max 35 pts)
  score += Math.min(pedidos * 7, 35);
  // Facturación (max 30 pts) — cada $1M = 5 pts
  score += Math.min(Math.floor(totalFacturado / 1_000_000) * 5, 30);
  // Recencia (max 10 pts) — penalizar inactividad
  if (diasSinActividad < 30) score += 10;
  else if (diasSinActividad < 60) score += 5;
  else if (diasSinActividad < 90) score += 2;
  return Math.min(100, score);
}

function getScoreColor(score: number) {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

function getScoreLabel(score: number) {
  if (score >= 70) return "Cliente caliente";
  if (score >= 40) return "Potencial medio";
  return "Requiere atención";
}

function getNextAction(score: number, diasSinActividad: number, pedidos: number): string {
  if (diasSinActividad > 60 && pedidos > 0) return "Haz seguimiento — lleva mucho tiempo sin actividad";
  if (score < 40 && pedidos === 0) return "Convierte la cotización en pedido";
  if (score >= 70) return "Cliente fidelizado — ofrecerle nuevos productos";
  return "Continuar el proceso de venta";
}

export function LeadScoreWidget({ cotizaciones, pedidos, totalFacturado, diasSinActividad = 0 }: LeadScoreProps) {
  const score = calcLeadScore({ cotizaciones, pedidos, totalFacturado, diasSinActividad });
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const nextAction = getNextAction(score, diasSinActividad, pedidos);

  const Icon = score >= 70 ? TrendingUp : score >= 40 ? Minus : TrendingDown;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <Target size={13} /> Lead Score
        </p>
        <div className="flex items-center gap-1.5">
          <Icon size={13} style={{ color }} />
          <span className="text-xs font-bold" style={{ color }}>{label}</span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Cotizaciones", val: cotizaciones, color: "#6366f1" },
          { label: "Pedidos", val: pedidos, color: "#16a34a" },
          { label: "Días inactivo", val: diasSinActividad, color: diasSinActividad > 30 ? "#dc2626" : "#9ca3af" },
        ].map(m => (
          <div key={m.label} className="text-center bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
            <p className="text-base font-bold" style={{ color: m.color }}>{m.val}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Siguiente acción recomendada */}
      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
        <Zap size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700 dark:text-amber-300">{nextAction}</p>
      </div>
    </div>
  );
}
