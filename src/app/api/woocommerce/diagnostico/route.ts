// GET /api/woocommerce/diagnostico — Prueba de sincronización (solo lectura)
// Corre en producción (donde hay acceso a la BD y a WooCommerce) y reporta
// por qué falla el sync: conexión, categorías inexistentes, imágenes no
// accesibles y SKU duplicado / wcId desalineado.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getWCCredentials, diagnosticarWC } from "@/lib/woocommerce";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const creds = await getWCCredentials();
  if (!creds) {
    return NextResponse.json({ success: false, error: "WooCommerce no está configurado (faltan credenciales en Configuración → WooCommerce)." }, { status: 400 });
  }

  try {
    const limite = Number(new URL(req.url).searchParams.get("limite") ?? 8);
    const data = await diagnosticarWC(creds, Math.min(Math.max(limite, 1), 25));
    const conProblemas = data.items.filter((i) => !i.ok).length;
    return NextResponse.json({ success: true, resumen: { conexion: data.conexion.ok, productosRevisados: data.items.length, conProblemas }, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Error en diagnóstico" }, { status: 500 });
  }
}
