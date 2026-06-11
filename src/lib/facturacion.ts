// ============================================================
// COSTAMALLAS ERP — Núcleo de Facturación
// Diseño agnóstico al proveedor de facturación electrónica (DIAN).
// Adaptadores: manual | factus | siigo | alegra (se completan al elegir el tercero).
// Config y credenciales en Configuracion (cifradas).
// ============================================================

import { prisma } from "@/lib/prisma";
import { decryptIfNeeded, encrypt } from "@/lib/encryption";

export type ProveedorFE = "manual" | "factus" | "siigo" | "alegra";

export interface FacturacionConfig {
  proveedor: ProveedorFE;
  apiKey: string;
  apiUrl: string;
  // Resolución DIAN
  prefijo: string;
  numeroResolucion: string;
  rangoDesde: number;
  rangoHasta: number;
  consecutivoActual: number; // próximo número a usar
  ivaPorDefecto: number;
}

const CLAVES = [
  "fact_proveedor", "fact_api_key", "fact_api_url", "fact_prefijo",
  "fact_num_resolucion", "fact_rango_desde", "fact_rango_hasta",
  "fact_consecutivo", "fact_iva",
];

export async function getFacturacionConfig(): Promise<FacturacionConfig> {
  const rows = await prisma.configuracion.findMany({ where: { clave: { in: CLAVES } } });
  const map = Object.fromEntries(rows.map(r => [r.clave, r]));
  const key = map["fact_api_key"];
  return {
    proveedor: (map["fact_proveedor"]?.valor as ProveedorFE) ?? "manual",
    apiKey: key ? (key.encrypted ? decryptIfNeeded(key.valor) : key.valor) : "",
    apiUrl: map["fact_api_url"]?.valor ?? "",
    prefijo: map["fact_prefijo"]?.valor ?? "FE",
    numeroResolucion: map["fact_num_resolucion"]?.valor ?? "",
    rangoDesde: Number(map["fact_rango_desde"]?.valor ?? 1),
    rangoHasta: Number(map["fact_rango_hasta"]?.valor ?? 1000),
    consecutivoActual: Number(map["fact_consecutivo"]?.valor ?? 1),
    ivaPorDefecto: Number(map["fact_iva"]?.valor ?? 19),
  };
}

export async function setFacturacionConfig(data: Partial<Record<string, string>>) {
  const enc = new Set(["fact_api_key"]);
  for (const [clave, valor] of Object.entries(data)) {
    if (valor === undefined) continue;
    const encrypted = enc.has(clave);
    if (encrypted && !valor) continue; // no sobreescribir key vacía
    await prisma.configuracion.upsert({
      where: { clave },
      create: { clave, valor: encrypted ? encrypt(valor) : valor, encrypted },
      update: { valor: encrypted ? encrypt(valor) : valor, encrypted },
    });
  }
}

// Número interno consecutivo (ej FAC-00001)
export async function siguienteNumeroInterno(): Promise<string> {
  const count = await prisma.factura.count();
  return `FAC-${String(count + 1).padStart(5, "0")}`;
}

// ── Adaptador de facturación electrónica ──
export interface ResultadoFE {
  ok: boolean;
  estadoDian: "ACEPTADA" | "ENVIADA" | "RECHAZADA" | "NO_APLICA";
  cufe?: string;
  proveedorRef?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  qrUrl?: string;
  mensaje?: string;
}

/**
 * Emite la factura ante el proveedor de facturación electrónica.
 * Por ahora, "manual" marca la factura como emitida sin DIAN.
 * Los adaptadores factus/siigo/alegra quedan listos para completar con la API del tercero elegido.
 */
export async function emitirElectronica(facturaId: string): Promise<ResultadoFE> {
  const cfg = await getFacturacionConfig();
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { cliente: true, items: true },
  });
  if (!factura) return { ok: false, estadoDian: "NO_APLICA", mensaje: "Factura no encontrada" };

  if (cfg.proveedor === "manual") {
    return { ok: true, estadoDian: "NO_APLICA", mensaje: "Factura emitida en modo manual (sin envío a DIAN)." };
  }

  if (!cfg.apiKey || !cfg.apiUrl) {
    return { ok: false, estadoDian: "PENDIENTE" as ResultadoFE["estadoDian"], mensaje: `Configura las credenciales de ${cfg.proveedor} en Configuración → Facturación.` };
  }

  // ── Punto de integración con el tercero ──
  // Aquí se construye el payload (UBL/JSON) y se llama a la API del proveedor.
  // Estructura lista; se completa al definir el proveedor exacto:
  try {
    // Ejemplo genérico (cada proveedor define su endpoint/payload real):
    // const res = await fetch(`${cfg.apiUrl}/invoices`, { method: "POST",
    //   headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    //   body: JSON.stringify(construirPayload(factura, cfg)) });
    // const j = await res.json();
    // return { ok: res.ok, estadoDian: "ACEPTADA", cufe: j.cufe, proveedorRef: j.id, pdfUrl: j.pdf, xmlUrl: j.xml, qrUrl: j.qr };

    return {
      ok: false,
      estadoDian: "PENDIENTE" as ResultadoFE["estadoDian"],
      mensaje: `Adaptador "${cfg.proveedor}" listo: falta conectar el endpoint del proveedor (estructura preparada).`,
    };
  } catch (e) {
    return { ok: false, estadoDian: "RECHAZADA", mensaje: (e as Error).message };
  }
}
