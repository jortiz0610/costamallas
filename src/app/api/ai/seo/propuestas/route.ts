// ============================================================
// GET   /api/ai/seo/propuestas   la cola de revisión
// PATCH /api/ai/seo/propuestas   aprobar, rechazar o corregir a mano
//
// Aprobar ESCRIBE en el producto y lo empuja a costamallas.com. Es la
// única puerta por la que el texto de la IA llega a la tienda, y por eso
// es un acto explícito de una persona, producto por producto.
//
// El PATCH acepta también el texto editado: casi siempre la propuesta
// está bien salvo una palabra, y obligar a rechazar y regenerar por eso
// haría que nadie corrigiera nada.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esAdmin } from "@/lib/permisos";
import { aprobarPropuesta, rechazarPropuesta } from "@/lib/seo-cola";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Solo administración revisa el SEO propuesto" }, { status: 403 });
  }

  const estado = req.nextUrl.searchParams.get("estado") ?? "PROPUESTO";
  const loteId = req.nextUrl.searchParams.get("loteId");

  const propuestas = await prisma.seoPropuesta.findMany({
    where: {
      ...(estado === "TODAS" ? {} : { estado }),
      ...(loteId ? { loteId } : {}),
    },
    include: {
      producto: {
        select: {
          id: true, sku: true, nombre: true, slug: true, publicado: true, wcId: true,
          categorias: true, seoTitulo: true, seoDescripcion: true, seoKeywords: true,
          imagenes: { select: { id: true, urlImagen: true, esPrincipal: true }, orderBy: { posicion: "asc" } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  // Resumen por estado: es lo primero que se mira al entrar ("¿cuántas
  // me faltan por revisar?"), no la lista.
  const agrupado = await prisma.seoPropuesta.groupBy({
    by: ["estado"],
    _count: { _all: true },
    _sum: { costoUSD: true },
  });

  return NextResponse.json({
    success: true,
    data: propuestas,
    resumen: Object.fromEntries(
      agrupado.map((g) => [g.estado, { cantidad: g._count._all, costoUSD: g._sum.costoUSD ?? 0 }]),
    ),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!esAdmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Solo administración revisa el SEO propuesto" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const accion = String(body.accion ?? "");
  if (!id) return NextResponse.json({ success: false, error: "Falta la propuesta" }, { status: 400 });

  // Guardar la corrección antes de aprobar: lo que se aplica es el texto
  // que quedó en pantalla, no el que la IA escribió.
  if (body.edicion && typeof body.edicion === "object") {
    const e = body.edicion as Record<string, unknown>;
    await prisma.seoPropuesta.update({
      where: { id },
      data: {
        ...(typeof e.seoTitulo === "string" ? { seoTitulo: e.seoTitulo.slice(0, 60) } : {}),
        ...(typeof e.seoDescripcion === "string" ? { seoDescripcion: e.seoDescripcion.slice(0, 160) } : {}),
        ...(typeof e.seoTexto === "string" ? { seoTexto: e.seoTexto } : {}),
        ...(typeof e.slug === "string" ? { slug: e.slug } : {}),
        ...(Array.isArray(e.seoKeywords) ? { seoKeywords: e.seoKeywords.map(String).slice(0, 8) } : {}),
        ...(typeof e.aplicaSlug === "boolean" ? { aplicaSlug: e.aplicaSlug } : {}),
      },
    });
    if (!accion) return NextResponse.json({ success: true, data: { ok: true, detalle: "Cambios guardados" } });
  }

  if (accion === "aprobar") {
    const r = await aprobarPropuesta(id, user.sub);
    await prisma.log
      .create({
        data: {
          usuarioId: user.sub, accion: "IA_SEO_APROBAR",
          detalle: `Propuesta ${id}`, resultado: `${r.ok ? "ok" : "error"} · ${r.detalle}`,
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ success: r.ok, data: r, error: r.ok ? undefined : r.detalle });
  }

  if (accion === "rechazar") {
    const r = await rechazarPropuesta(id, user.sub);
    return NextResponse.json({ success: r.ok, data: r, error: r.ok ? undefined : r.detalle });
  }

  return NextResponse.json({ success: false, error: "Acción no reconocida" }, { status: 400 });
}
