// ============================================================
// Utilidades de fecha/hora — Zona horaria Colombia (UTC-5)
// ============================================================

export const TZ_COLOMBIA = "America/Bogota";

/** Fecha y hora local Colombia como string legible */
export function nowColombia(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ_COLOMBIA }));
}

/** Formatea una fecha ISO en formato colombiano */
export function formatFechaCO(
  date: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }
): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("es-CO", { ...opts, timeZone: TZ_COLOMBIA });
  } catch {
    return "—";
  }
}

/** Formatea fecha + hora Colombia */
export function formatFechaHoraCO(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString("es-CO", {
      timeZone: TZ_COLOMBIA,
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Tiempo relativo ("hace 5 minutos") en español */
export function timeAgoCO(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    const now = nowColombia();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "ahora mismo";
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffH < 24) return `hace ${diffH}h`;
    if (diffD < 7) return `hace ${diffD}d`;
    return formatFechaCO(date);
  } catch {
    return "—";
  }
}

/** Hora actual Colombia como HH:MM */
export function horaActualCO(): string {
  return new Date().toLocaleTimeString("es-CO", {
    timeZone: TZ_COLOMBIA,
    hour: "2-digit", minute: "2-digit",
  });
}
