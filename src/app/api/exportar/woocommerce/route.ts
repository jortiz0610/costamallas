// ============================================================
// POST /api/exportar/woocommerce
// Exporta productos seleccionados a WooCommerce via API REST
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";
import { getWCCredentials, syncProductosToWC } from "@/lib/woocommerce";
import { z } from "zod";

const bodySchema = z.object({
  productoIds: z.array(z.string()).min(1, "Selecciona al menos un producto"),
  modo: z.enum(["api", "csv"]).default("api"),
});

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message }, { status: 400 });
    }

    const { productoIds, modo } = parsed.data;

    if (modo === "csv") {
      // Exportar como CSV (sin necesitar credenciales WC)
      const productos = await prisma.producto.findMany({
        where: { id: { in: productoIds } },
        include: { imagenes: { orderBy: { posicion: "asc" } } },
      });

      const { generarCSVWooCommerce } = await import("@/lib/woocommerce");

      // Mapear a ProductoDetalle
      const detalles = productos.map((p) => ({
        id: p.id, wcId: p.wcId, tipo: p.tipo as never, sku: p.sku,
        nombre: p.nombre, slug: p.slug, publicado: p.publicado,
        visibilidad: p.visibilidad, destacado: p.destacado,
        descCorta: p.descCorta, descripcion: p.descripcion,
        precioNormal: p.precioNormal ? Number(p.precioNormal) : null,
        precioOferta: p.precioOferta ? Number(p.precioOferta) : null,
        estadoImpuesto: p.estadoImpuesto, claseImpuesto: p.claseImpuesto,
        enStock: p.enStock, stock: p.stock, stockMinimo: p.stockMinimo,
        nivelStock: "OK" as never, permiteBackorders: p.permiteBackorders,
        pesoKg: p.pesoKg ? Number(p.pesoKg) : null,
        largoCm: p.largoCm ? Number(p.largoCm) : null,
        anchoCm: p.anchoCm ? Number(p.anchoCm) : null,
        altoCm: p.altoCm ? Number(p.altoCm) : null,
        categorias: p.categorias, etiquetas: p.etiquetas,
        claseEnvio: p.claseEnvio, notaCompra: p.notaCompra,
        permiteResenas: p.permiteResenas,
        acfSkuInterno: p.acfSkuInterno, acfMarcaFabricante: p.acfMarcaFabricante,
        acfUnidadVenta: p.acfUnidadVenta, acfFabricacionMedida: p.acfFabricacionMedida,
        acfInstalacion: p.acfInstalacion, acfGarantiaAnos: p.acfGarantiaAnos,
        acfAplicaciones: p.acfAplicaciones, acfColores: p.acfColores,
        acfNormas: p.acfNormas, acfFichaTecnicaPdf: p.acfFichaTecnicaPdf,
        acfCertificaciones: p.acfCertificaciones,
        intEstado: p.intEstado as never, intResponsable: p.intResponsable,
        intObservaciones: p.intObservaciones, intListoExportar: p.intListoExportar,
        intExportadoEn: p.intExportadoEn?.toISOString() ?? null,
        imagenes: p.imagenes,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      const csv = generarCSVWooCommerce(detalles);
      const filename = `costamallas-wc-export-${new Date().toISOString().slice(0, 10)}.csv`;

      await prisma.log.create({
        data: {
          usuarioId: user.sub,
          accion: "EXPORTAR_CSV",
          detalle: `${productos.length} productos`,
          resultado: "OK",
          archivoGenerado: filename,
          totalFilas: productos.length,
        },
      });

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Modo API — sincronización directa con WooCommerce
    const creds = await getWCCredentials();
    if (!creds) {
      return NextResponse.json(
        { success: false, error: "Credenciales de WooCommerce no configuradas. Ve a Configuración." },
        { status: 400 }
      );
    }

    // Crear registro de sync
    const sync = await prisma.wooCommerceSync.create({
      data: {
        tipo: "export",
        estado: "procesando",
        totalProductos: productoIds.length,
      },
    });

    // Sincronizar
    const result = await syncProductosToWC(productoIds, creds);

    await prisma.wooCommerceSync.update({
      where: { id: sync.id },
      data: {
        estado: result.failed === 0 ? "completado" : "error",
        procesados: result.created + result.updated,
        errores: result.failed,
        detalle: result as never,
        completedAt: new Date(),
      },
    });

    await prisma.notificacion.create({
      data: {
        tipo: "EXPORTACION_COMPLETA",
        titulo: "Exportación a WooCommerce completada",
        mensaje: `${result.created} creados, ${result.updated} actualizados, ${result.failed} errores`,
        data: result as never,
      },
    });

    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "EXPORTAR_WC_API",
        detalle: `Creados: ${result.created}, Actualizados: ${result.updated}, Errores: ${result.failed}`,
        resultado: result.failed === 0 ? "OK" : "PARCIAL",
        totalFilas: result.created + result.updated,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[POST /api/exportar/woocommerce]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error en la exportación" },
      { status: 500 }
    );
  }
}
