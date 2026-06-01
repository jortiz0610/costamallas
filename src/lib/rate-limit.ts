// ============================================================
// COSTAMALLAS ERP — Rate limiting simple en memoria
// Para producción, usar Redis (Upstash) o similar
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? "100");
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000");

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export function rateLimit(identifier: string, max = MAX_REQUESTS, windowMs = WINDOW_MS): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: max - 1, reset: now + windowMs };
  }

  entry.count++;

  if (entry.count > max) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  return { success: true, remaining: max - entry.count, reset: entry.resetAt };
}

// Limpiar entradas expiradas cada 5 minutos
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}
