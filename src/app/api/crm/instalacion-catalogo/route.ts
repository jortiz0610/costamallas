// ============================================================
// Catálogo de instalación
//   GET    /api/crm/instalacion-catalogo    servicios + recargos por ciudad
//   POST   /api/crm/instalacion-catalogo    crea o edita un servicio
//   DELETE /api/crm/instalacion-catalogo?id=…
//
//   POST   ?tipo=ciudad  crea o edita un recargo por ciudad
//   DELETE ?tipo=ciudad&id=…
//
// Es lo que convierte "instalación: sí/no" en un ítem con precio. El
// recargo por ciudad existe porque mandar la cuadrilla a Santa Marta no
// cuesta lo mismo que instalar en Barranquilla.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, canWrite } from "@/lib/auth";

const num = (v: unknown, porDefecto = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : porDefecto;
};

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const todos = req.nextUrl.searchParams.get("todos") === "1";

  const [servicios, ciudades] = await Promise.all([
    prisma.servicioInstalacion.findMany({
      where: todos ? {} : { activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    }),
    prisma.recargoCiudad.findMany({
      where: todos ? {} : { activo: true },
      orderBy: { ciudad: "asc" },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      servicios: servicios.map(s => ({
        ...s,
        precioBase: Number(s.precioBase),
        minimoCobro: s.minimoCobro != null ? Number(s.minimoCobro) : null,
      })),
      ciudades: ciudades.map(c => ({
        ...c,
        porcentaje: Number(c.porcentaje),
        montoFijo: Number(c.montoFijo),
      })),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const esCiudad = req.nextUrl.searchParams.get("tipo") === "ciudad";
  const b = await req.json();

  if (esCiudad) {
    const ciudad = String(b.ciudad ?? "").trim();
    if (!ciudad) return NextResponse.json({ success: false, error: "Falta la ciudad" }, { status: 400 });

    const porcentaje = num(b.porcentaje);
    if (porcentaje < 0 || porcentaje > 100) {
      return NextResponse.json({ success: false, error: "El porcentaje debe ir entre 0 y 100" }, { status: 400 });
    }

    const datos = {
      departamento: b.departamento ? String(b.departamento).trim() : null,
      porcentaje,
      montoFijo: num(b.montoFijo),
      activo: b.activo !== false,
    };

    // La ciudad es única: si ya está, se actualiza en vez de reventar.
    const recargo = await prisma.recargoCiudad.upsert({
      where: { ciudad },
      create: { ciudad, ...datos },
      update: datos,
    });

    return NextResponse.json({
      success: true,
      data: { ...recargo, porcentaje: Number(recargo.porcentaje), montoFijo: Number(recargo.montoFijo) },
    });
  }

  const nombre = String(b.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ success: false, error: "Falta el nombre del servicio" }, { status: 400 });

  const datos = {
    nombre,
    descripcion: b.descripcion ? String(b.descripcion) : null,
    unidad: String(b.unidad ?? "m2"),
    precioBase: num(b.precioBase),
    categorias: Array.isArray(b.categorias) ? b.categorias.map(String) : [],
    minimoCobro: b.minimoCobro !== "" && b.minimoCobro != null ? num(b.minimoCobro) : null,
    activo: b.activo !== false,
    orden: Math.round(num(b.orden)),
  };

  const servicio = b.id
    ? await prisma.servicioInstalacion.update({ where: { id: String(b.id) }, data: datos })
    : await prisma.servicioInstalacion.create({ data: datos });

  return NextResponse.json({
    success: true,
    data: {
      ...servicio,
      precioBase: Number(servicio.precioBase),
      minimoCobro: servicio.minimoCobro != null ? Number(servicio.minimoCobro) : null,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Falta el id" }, { status: 400 });

  // Se desactiva en vez de borrar: las cotizaciones viejas guardan el
  // texto y el precio del servicio, pero el catálogo sigue siendo la
  // referencia de qué se ofrece hoy.
  if (req.nextUrl.searchParams.get("tipo") === "ciudad") {
    await prisma.recargoCiudad.update({ where: { id }, data: { activo: false } }).catch(() => undefined);
  } else {
    await prisma.servicioInstalacion.update({ where: { id }, data: { activo: false } }).catch(() => undefined);
  }

  return NextResponse.json({ success: true });
}
