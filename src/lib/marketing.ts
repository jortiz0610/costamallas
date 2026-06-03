// Utilidades del módulo de Marketing

export const CANALES = [
  { v: "google", l: "Google Ads", c: "#4285F4" },
  { v: "meta", l: "Meta (FB/IG)", c: "#1877F2" },
  { v: "tiktok", l: "TikTok Ads", c: "#111827" },
  { v: "email", l: "Email Mkt", c: "#6366f1" },
  { v: "organico", l: "Orgánico", c: "#16a34a" },
  { v: "otro", l: "Otro", c: "#64748b" },
];

type Metricas = { inversion: number; impresiones: number; clics: number; leads: number; conversiones: number; ingresos: number };

export function kpis(cs: Metricas[]) {
  const inversion = cs.reduce((a, c) => a + c.inversion, 0);
  const impresiones = cs.reduce((a, c) => a + c.impresiones, 0);
  const clics = cs.reduce((a, c) => a + c.clics, 0);
  const leads = cs.reduce((a, c) => a + c.leads, 0);
  const conversiones = cs.reduce((a, c) => a + c.conversiones, 0);
  const ingresos = cs.reduce((a, c) => a + c.ingresos, 0);
  return {
    inversion, impresiones, clics, leads, conversiones, ingresos,
    roas: inversion ? ingresos / inversion : 0,
    roi: inversion ? ((ingresos - inversion) / inversion) * 100 : 0,
    cpc: clics ? inversion / clics : 0,
    cpl: leads ? inversion / leads : 0,
    ctr: impresiones ? (clics / impresiones) * 100 : 0,
    tasaConv: leads ? (conversiones / leads) * 100 : 0,
  };
}
