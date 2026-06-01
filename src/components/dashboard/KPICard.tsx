import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  accent?: "yellow" | "red" | "green" | "blue";
  className?: string;
}

const accentStyles = {
  yellow: "border-l-2 border-cm-yellow",
  red:    "border-l-2 border-red-500",
  green:  "border-l-2 border-green-500",
  blue:   "border-l-2 border-blue-500",
};

const deltaStyles = {
  up:      "text-green-600",
  down:    "text-red-600",
  neutral: "text-gray-500",
};

export function KPICard({ label, value, delta, deltaType = "neutral", icon: Icon, accent, className }: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-gray-50 rounded-xl p-4",
        accent && accentStyles[accent],
        accent ? "rounded-l-none rounded-r-xl" : "",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {Icon && <Icon size={16} className="text-gray-400" />}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {delta && (
        <p className={cn("mt-1 text-[11px] font-medium", deltaStyles[deltaType])}>{delta}</p>
      )}
    </div>
  );
}
