import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { getFacturacionConfig, setFacturacionConfig } from "@/lib/facturacion";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const cfg = await getFacturacionConfig();
  // No exponer la apiKey
  return NextResponse.json({ success: true, data: { ...cfg, apiKey: undefined, tieneApiKey: !!cfg.apiKey } });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const b = await req.json();
  await setFacturacionConfig({
    fact_proveedor: b.proveedor,
    fact_api_key: b.apiKey,
    fact_api_url: b.apiUrl,
    fact_prefijo: b.prefijo,
    fact_num_resolucion: b.numeroResolucion,
    fact_rango_desde: b.rangoDesde != null ? String(b.rangoDesde) : undefined,
    fact_rango_hasta: b.rangoHasta != null ? String(b.rangoHasta) : undefined,
    fact_consecutivo: b.consecutivoActual != null ? String(b.consecutivoActual) : undefined,
    fact_iva: b.ivaPorDefecto != null ? String(b.ivaPorDefecto) : undefined,
  });
  return NextResponse.json({ success: true });
}
