// POST /api/imagenes/limpiar-rotas — Elimina de la BD las imágenes cuyo
// archivo ya no existe (HTTP 404 / inaccesible). Solo borra el registro; el
// archivo ya no está en el servidor. Incluye una guarda anti-caída: si TODAS
// las imágenes fallan (posible caída del servidor de imágenes) no borra nada.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function accesible(url: string): Promise<boolean> {
  const intento = async (method: string, headers?: Record<string, string>) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try { return await fetch(url, { method, headers, signal: ctrl.signal }); }
    finally { clearTimeout(t); }
  };
  try {
    let r = await intento("HEAD");
    if (r.status === 405 || r.status === 501) r = await intento("GET", { Range: "bytes=0-0" });
    return r.ok || r.status === 206;
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const productoId = new URL(req.url).searchParams.get("productoId") ?? undefined;
  const aplicar = new URL(req.url).searchParams.get("aplicar") === "1"; // sin esto, solo reporta (dry-run)

  const imagenes = await prisma.acfImagen.findMany({
    where: productoId ? { productoId } : undefined,
    select: { id: true, urlImagen: true, productoId: true, producto: { select: { sku: true } } },
  });

  // Verificar accesibilidad (en lotes de 10 para no saturar)
  const rotas: { id: string; url: string; sku: string }[] = [];
  let accesibles = 0;
  for (let i = 0; i < imagenes.length; i += 10) {
    const lote = imagenes.slice(i, i + 10);
    const res = await Promise.all(lote.map((img) => accesible(img.urlImagen)));
    lote.forEach((img, j) => {
      if (res[j]) accesibles++;
      else rotas.push({ id: img.id, url: img.urlImagen, sku: img.producto?.sku ?? "?" });
    });
  }

  // Guarda anti-caída: si hay imágenes y NINGUNA es accesible, aborta.
  if (imagenes.length > 0 && accesibles === 0) {
    return NextResponse.json({
      success: false,
      error: "Todas las imágenes fallaron — posible caída del servidor de imágenes. No se borró nada. Reintenta cuando el servidor responda.",
      revisadas: imagenes.length, rotas: rotas.length,
    }, { status: 409 });
  }

  let eliminadas = 0;
  if (aplicar && rotas.length) {
    const r = await prisma.acfImagen.deleteMany({ where: { id: { in: rotas.map((x) => x.id) } } });
    eliminadas = r.count;
  }

  return NextResponse.json({
    success: true,
    modo: aplicar ? "aplicado" : "dry-run",
    revisadas: imagenes.length,
    accesibles,
    rotas,
    eliminadas,
  });
}
