// ============================================================
// GET   /api/siigo/productos   — la lista para revisar
// POST  /api/siigo/productos   — sincronizar la copia desde SIIGO
// PATCH /api/siigo/productos   — decidir: traer o descartar
//
// Solo administración. Decidir qué entra al catálogo no es una acción de
// cualquiera con sesión.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { credencialesSiigo } from "@/lib/siigo/cliente-api";
import {
  sincronizarCatalogoSiigo, traerProducto, descartarProducto,
} from "@/lib/siigo/productos-revision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function admin(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get("authorization") === `Bearer ${secreto}`) {
    return { ok: true as const, usuarioId: null };
  }
  const user = await getUserFromRequest(req);
  if (user && isAdmin(user)) return { ok: true as const, usuarioId: user.sub };
  return { ok: false as const, usuarioId: null };
}

export async function GET(req: NextRequest) {
  const quien = await admin(req);
  if (!quien.ok) {
    return NextResponse.json({ success: false, error: "Solo un administrador." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const decision = sp.get("decision") ?? "PENDIENTE";
  const busqueda = (sp.get("busqueda") ?? "").trim();
  const conPrecio = sp.get("conPrecio");
  const pagina = Math.max(1, Number(sp.get("pagina")) || 1);
  const porPagina = 50;

  const where = {
    ...(decision && decision !== "TODAS" ? { decision } : {}),
    ...(conPrecio === "1" ? { precio: { not: null } } : {}),
    ...(conPrecio === "0" ? { precio: null } : {}),
    ...(busqueda ? {
      OR: [
        { codigo: { contains: busqueda, mode: "insensitive" as const } },
        { nombre: { contains: busqueda, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [fichas, total, porDecision, conPrecioTotal] = await Promise.all([
    prisma.productoSiigo.findMany({
      where,
      orderBy: [{ precio: { sort: "desc", nulls: "last" } }, { codigo: "asc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.productoSiigo.count({ where }),
    prisma.productoSiigo.groupBy({ by: ["decision"], _count: { _all: true } }),
    prisma.productoSiigo.count({ where: { precio: { not: null } } }),
  ]);

  return NextResponse.json({
    success: true,
    data: fichas,
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    conteos: Object.fromEntries(porDecision.map(x => [x.decision, x._count._all])),
    conPrecio: conPrecioTotal,
  });
}

export async function POST(req: NextRequest) {
  const quien = await admin(req);
  if (!quien.ok) {
    return NextResponse.json({ success: false, error: "Solo un administrador." }, { status: 403 });
  }
  if (!(await credencialesSiigo())) {
    return NextResponse.json({ success: false, error: "SIIGO no está configurado." }, { status: 400 });
  }

  try {
    const r = await sincronizarCatalogoSiigo();
    return NextResponse.json({ success: true, data: r });
  } catch (e) {
    console.error("[siigo/productos] sync", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Error sincronizando" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const quien = await admin(req);
  if (!quien.ok) {
    return NextResponse.json({ success: false, error: "Solo un administrador." }, { status: 403 });
  }

  const { ids, decision } = await req.json() as { ids?: string[]; decision?: string };
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ success: false, error: "Sin fichas que decidir." }, { status: 400 });
  }
  if (decision !== "TRAER" && decision !== "DESCARTAR") {
    return NextResponse.json({ success: false, error: "Decisión no válida." }, { status: 400 });
  }

  const resultados: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids.slice(0, 200)) {
    if (decision === "DESCARTAR") {
      await descartarProducto(id, quien.usuarioId).catch(() => undefined);
      resultados.push({ id, ok: true });
    } else {
      const r = await traerProducto(id, quien.usuarioId);
      resultados.push({ id, ok: r.ok, error: r.error });
    }
  }

  const bien = resultados.filter(x => x.ok).length;
  return NextResponse.json({
    success: true,
    data: {
      decision,
      pedidas: ids.length,
      bien,
      fallidas: resultados.filter(x => !x.ok),
    },
  });
}
