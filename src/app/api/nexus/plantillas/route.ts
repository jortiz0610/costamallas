import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { PLANTILLAS_BASE } from "@/lib/nexus/plantillas-base";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const categoria = req.nextUrl.searchParams.get("categoria");

  const plantillas = await prisma.plantillaNexus.findMany({
    where: { activo: true, ...(categoria ? { categoria } : {}) },
    orderBy: [{ categoria: "asc" }, { vecesUsada: "desc" }],
    take: 200,
  });

  return NextResponse.json({ success: true, data: plantillas });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();

  // ── Carga del paquete de arranque ──
  // Las respuestas a "cuánto vale", "cómo mido", "¿instalan?" son las
  // mismas todos los días. Tenerlas escritas de una es la diferencia
  // entre responder en un minuto o en veinte.
  if (body.semilla) {
    const existentes = await prisma.plantillaNexus.findMany({ select: { atajo: true, nombre: true } });
    const atajos = new Set(existentes.map(p => p.atajo).filter(Boolean));
    const nombres = new Set(existentes.map(p => p.nombre));

    // No se duplica lo que ya está: si la cargan dos veces, no pasa nada.
    const faltantes = PLANTILLAS_BASE.filter(p => !atajos.has(p.atajo) && !nombres.has(p.nombre));
    if (faltantes.length) {
      await prisma.plantillaNexus.createMany({
        data: faltantes.map(p => ({
          nombre: p.nombre,
          categoria: p.categoria,
          canal: "todos",
          contenido: p.contenido,
          atajo: p.atajo,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      creadas: faltantes.length,
      omitidas: PLANTILLAS_BASE.length - faltantes.length,
    });
  }

  const { nombre, categoria, canal, contenido, atajo } = body;
  if (!nombre?.trim() || !contenido?.trim())
    return NextResponse.json({ success: false, error: "Nombre y contenido requeridos" }, { status: 400 });

  const plantilla = await prisma.plantillaNexus.create({
    data: {
      nombre: nombre.trim(),
      categoria: categoria ?? "GENERAL",
      canal: canal ?? "todos",
      contenido: contenido.trim(),
      atajo: atajo || null,
    },
  });

  return NextResponse.json({ success: true, data: plantilla }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { id, incrementarUso, ...rest } = await req.json();
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });

  const plantilla = await prisma.plantillaNexus.update({
    where: { id },
    data: incrementarUso ? { vecesUsada: { increment: 1 } } : rest,
  });
  return NextResponse.json({ success: true, data: plantilla });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  await prisma.plantillaNexus.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
