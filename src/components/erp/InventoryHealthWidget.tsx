"use client";

import { Activity, AlertTriangle, TrendingDown, CheckCircle2, Clock } from "lucide-react";

interface InventoryHealthProps {
  stock: number;
  stockMinimo: number;
  precioNormal?: number | null;
  diasSinMovimiento?: number;
  publicado?: boolean;
}

export function calcInventoryHealth({
  stock, stockMinimo, precioNormal, diasSinMovimiento = 0, publicado = false,
}: InventoryHealthProps): { score: number; label: string; color: string; issues: string[] } {
  let score = 100;
  const issues: string[] = [];

  if (stock <= 0) { score -= 40; issues.push("Sin stock"); }
  else if (stock < stockMinimo) { score -= 20; issues.push(`Stock bajo (${stock}/${stockMinimo} mín)`); }

  if (!precioNormal) { score -= 20; issues.push("Sin precio definido"); }
  if (!publicado) { score -= 10; issues.push("No publicado en WC"); }
  if (diasSinMovimiento > 90) { score -= 15; issues.push("Sin movimiento +90 días"); }
  else if (diasSinMovimiento > 45) { score -= 5; issues.push("Sin movimiento +45 días"); }

  score = Math.max(0, score);

  const label = score >= 80 ? "Saludable" : score >= 50 ? "Atención" : "Crítico";
  const color = score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";

  return { score, label, color, issues };
}

export function InventoryHealthBadge({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

export function InventoryHealthWidget(props: InventoryHealthProps) {
  const { score, label, color, issues } = calcInventoryHealth(props);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <Activity size={13} /> Salud del inventario
        </p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
          {label}
        </span>
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-slate-400 self-end">/100</span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{props.stock}</p>
          <p className="text-[9px] text-slate-400">Stock actual</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{props.stockMinimo}</p>
          <p className="text-[9px] text-slate-400">Stock mínimo</p>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="space-y-1">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle size={10} className="flex-shrink-0" />
              {issue}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
          <CheckCircle2 size={11} />
          Producto en condiciones óptimas
        </div>
      )}
    </div>
  );
}
