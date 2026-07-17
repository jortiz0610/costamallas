// ============================================================
// GET/POST /api/cron/sync-woo — Sincronización programada CRM → WooCommerce
// ------------------------------------------------------------
// El CRM es la fuente de verdad. Esta ruta publica a WooCommerce SOLO los
// productos marcados "Listo para exportar" (intListoExportar) que hayan
// cambiado desde su última exportación. Así los productos a medias no se
// tocan y la tienda no se rompe.
//
// La ejecuta Vercel Cron (ver vercel.json) usando el header
// `Authorization: Bearer <CRON_SECRET>`, y también puede dispararla
// manualmente un administrador desde la app (botón "Sincronizar ahora").
//
// ?dry=1 → informa qué se sincronizaría, sin publicar nada (modo prueba).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getWCCredentials, syncProductosToWC } from "@/lib/woocommerce";

export const maxDuration = 60; // sincronizaciones pueden tardar (verifica imágenes)
export const dynamic = "force-dynamic";

// El propio sello de exportación mueve `updatedAt` unos milisegundos; con esta
// tolerancia no se re-sincroniza un producto recién exportado, pero sí uno
// editado después (las ediciones reales están a minutos/horas de distancia).
const TOLERANCIA_MS = 60_000;

async function autorizado(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true; // Vercel Cron
  const user = await getUserFromRequest(req); // disparo manual desde la app
  return !!user && (user.rol === "ADMIN" || user.rol === "SUPERADMIN");
}

async function pendientesDeSync() {
  const candidatos = await prisma.producto.findMany({
    // `wcId: not null` es una guarda de seguridad: la sincronización automática solo
    // ACTUALIZA productos que ya existen en la tienda, nunca crea nuevos. Así un
    // producto de prueba o a medias marcado "Listo" no puede aparecer publicado en
    // costamallas.com. Para crear un producto en la tienda se usa Exportar (manual).
    where: { publicado: true, intListoExportar: true, wcId: { not: null } },
    select: { id: true, sku: true, nombre: true, updatedAt: true, intExportadoEn: true },
  });
  return candidatos.filter(
    (p) => !p.intExportadoEn || p.updatedAt.getTime() - p.intExportadoEn.getTime() > TOLERANCIA_MS
  );
}

async function ejecutar(dry: boolean) {
  const pendientes = await pendientesDeSync();

  if (dry) {
    return {
      ok: true,
      dryRun: true,
      pendientes: pendientes.length,
      productos: pendientes.map((p) => ({ sku: p.sku, nombre: p.nombre })),
    };
  }

  if (pendientes.length === 0) {
    return { ok: true, sincronizados: 0, mensaje: "Sin cambios pendientes" };
  }

  const creds = await getWCCredentials();
  if (!creds) return { ok: false, error: "WooCommerce no está configurado" };

  const registro = await prisma.wooCommerceSync.create({
    data: { tipo: "export", estado: "procesando", totalProductos: pendientes.length },
  });

  const result = await syncProductosToWC(pendientes.map((p) => p.id), creds);

  await prisma.wooCommerceSync.update({
    where: { id: registro.id },
    data: {
      estado: result.failed === 0 ? "completado" : "error",
      procesados: result.created + result.updated,
      errores: result.failed,
      detalle: result as never,
      completedAt: new Date(),
    },
  });

  return { ok: result.failed === 0, sincronizados: result.created + result.updated, ...result };
}

async function handle(req: NextRequest) {
  if (!(await autorizado(req))) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  try {
    const data = await ejecutar(dry);
    return NextResponse.json({ success: data.ok, data });
  } catch (err) {
    console.error("[cron/sync-woo]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error en la sincronización" },
      { status: 500 }
    );
  }
}

export const GET = handle;   // usado por Vercel Cron
export const POST = handle;  // usado por el botón "Sincronizar ahora"
