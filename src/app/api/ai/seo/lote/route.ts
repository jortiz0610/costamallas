// ============================================================
// POST /api/ai/seo/lote — genera SEO en lote, a la cola de revisión
// GET  /api/ai/seo/lote — qué productos hay para hacer y cuánto costaría
//
// El GET es lo que se mira ANTES de gastar: devuelve los candidatos y la
// estimación en tokens y en dólares. Lanzar un lote de 175 productos sin
// saber qué cuesta es cómo se descubre el gasto al mes siguiente.
//
// El POST procesa una TANDA corta y devuelve cuántos quedan. La función
// de Vercel se corta al minuto y una llamada de Sonnet tarda entre 8 y
// 20 segundos: de un tirón no caben ni cuatro. La pantalla vuelve a
// llamar hasta que `restantes` llega a cero, y así además se ve avanzar.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { esSuperadmin } from "@/lib/permisos";
import { estimarLote } from "@/lib/seo-ia";
import { generarTanda } from "@/lib/seo-cola";
import { estadoCredencial } from "@/lib/sembli/agente";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Filtros de selección. Son los que de verdad se usan al decidir el lote. */
function condiciones(params: URLSearchParams) {
  const soloSinSeo = params.get("conSeo") !== "1";
  const publicado = params.get("publicado"); // "1" | "0" | null (todos)

  return {
    intEstado: { not: "ARCHIVADO" as const },
    ...(soloSinSeo ? { OR: [{ seoTitulo: null }, { seoTitulo: "" }] } : {}),
    ...(publicado === "1" ? { publicado: true } : publicado === "0" ? { publicado: false } : {}),
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  // Solo SUPERADMIN: lanzar el lote gasta dinero de verdad y aprobar el
  // resultado publica en costamallas.com. No es un módulo que el resto
  // del equipo necesite.
  if (!esSuperadmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Solo el superadministrador puede lanzar lotes de IA" }, { status: 403 });
  }

  const where = condiciones(req.nextUrl.searchParams);
  const productos = await prisma.producto.findMany({
    where,
    select: { id: true, sku: true, nombre: true, publicado: true, seoTitulo: true, categorias: true },
    orderBy: [{ publicado: "desc" }, { nombre: "asc" }],
  });

  // La estimación se hace sobre TODOS los candidatos: es el número que
  // hay que ver antes de decidir, no el de la selección de turno.
  const estimacion = await estimarLote(productos.map((p) => p.id));

  // Si la IA no está configurada, mejor decirlo aquí que dejar que el
  // lote arranque y falle 175 veces seguidas.
  const credencial = await estadoCredencial();

  const pendientesRevision = await prisma.seoPropuesta.count({ where: { estado: "PROPUESTO" } });

  return NextResponse.json({
    success: true,
    data: {
      productos,
      estimacion,
      pendientesRevision,
      ia: { configurada: credencial.origen !== "ninguno", origen: credencial.origen, descifraBien: credencial.descifraBien },
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  // Solo SUPERADMIN: lanzar el lote gasta dinero de verdad y aprobar el
  // resultado publica en costamallas.com. No es un módulo que el resto
  // del equipo necesite.
  if (!esSuperadmin(user.rol)) {
    return NextResponse.json({ success: false, error: "Solo el superadministrador puede lanzar lotes de IA" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const productoIds: string[] = Array.isArray(body.productoIds) ? body.productoIds.map(String) : [];
  const loteId: string = String(body.loteId ?? "").trim();
  const tanda = Number(body.tanda) || 3;

  if (!productoIds.length) {
    return NextResponse.json({ success: false, error: "No hay productos seleccionados" }, { status: 400 });
  }
  if (!loteId) {
    return NextResponse.json({ success: false, error: "Falta el identificador del lote" }, { status: 400 });
  }
  // Tope duro: no por seguridad, sino para que un error de la pantalla no
  // se convierta en una factura. 200 cubre el catálogo entero de hoy.
  if (productoIds.length > 200) {
    return NextResponse.json({ success: false, error: "El lote no puede pasar de 200 productos" }, { status: 400 });
  }

  const r = await generarTanda({ productoIds, loteId, usuarioId: user.sub, tanda });

  await prisma.log
    .create({
      data: {
        usuarioId: user.sub,
        accion: "IA_SEO_LOTE",
        detalle: `Lote ${loteId} · tanda de ${r.procesados}`,
        resultado: `ok=${r.ok} fallidos=${r.fallidos} usd=${r.costoUSD.toFixed(5)} restantes=${r.restantes}`,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ success: true, data: r });
}
