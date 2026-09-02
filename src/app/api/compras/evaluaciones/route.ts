// ============================================================
// GET  /api/compras/evaluaciones — las evaluaciones de proveedores
// POST — guardar una (crea o actualiza)
//
// El visto bueno de gerencia va aparte, en PATCH, y exige su permiso: en
// el Google Form ese campo lo podía llenar cualquiera que abriera el
// enlace, y decía en letras grandes "SOLO LA GERENCIA ADMINISTRATIVA"
// confiando en que nadie lo escribiera.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso, peticionPuede } from "@/lib/permisos-server";
import { calcularPuntaje, type RespuestaDocumento } from "@/lib/evaluacion-proveedor";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.compras");
  if (sinPermiso) return sinPermiso;

  const { searchParams } = new URL(req.url);
  const proveedorId = searchParams.get("proveedor") ?? "";

  const filas = await prisma.evaluacionProveedor.findMany({
    where: {
      ...(proveedorId ? { proveedorId } : {}),
      esPrueba: false,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      proveedor: { select: { id: true, nombre: true } },
      aprobador: { select: { nombre: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: filas,
    puedeAprobar: await peticionPuede(req, "erp.compras.aprobar_proveedor"),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.compras");
  if (sinPermiso) return sinPermiso;

  const b = await req.json().catch(() => ({}));

  const nombre = String(b.nombre ?? "").trim();
  const documento = String(b.documento ?? "").trim();
  const tipo = b.tipo === "JURIDICA" ? "JURIDICA" : b.tipo === "NATURAL" ? "NATURAL" : "";

  // Las tres del papel son obligatorias. Sin ellas la evaluación no
  // identifica a nadie y no sirve para decidir.
  if (!tipo) return NextResponse.json({ success: false, error: "Falta el tipo de proveedor." }, { status: 400 });
  if (!nombre) return NextResponse.json({ success: false, error: "Falta el nombre." }, { status: 400 });
  if (!documento) return NextResponse.json({ success: false, error: "Falta el NIT o número de documento." }, { status: 400 });

  const documentos = Array.isArray(b.documentos) ? (b.documentos as RespuestaDocumento[]) : [];
  const puntaje = calcularPuntaje({
    documentos,
    tiempoEntrega: b.tiempoEntrega ?? null,
    opcionPago: b.opcionPago ?? null,
  });

  const datos = {
    tipo, nombre, documento,
    proveedorId: b.proveedorId || null,
    documentos: documentos as never,
    tiempoEntrega: b.tiempoEntrega || null,
    opcionPago: b.opcionPago || null,
    // Se guarda calculado para poder ordenar y filtrar sin recalcular en
    // cada consulta. Siempre lo calcula el SERVIDOR: un puntaje que llega
    // del navegador es un puntaje que se puede escribir a mano.
    puntaje: puntaje.total,
    creadoPor: user.sub,
  };

  const guardada = b.id
    ? await prisma.evaluacionProveedor.update({ where: { id: String(b.id) }, data: datos })
    : await prisma.evaluacionProveedor.create({ data: datos });

  return NextResponse.json({ success: true, data: guardada, puntaje });
}

/** El visto bueno. Solo gerencia. */
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "erp.compras.aprobar_proveedor");
  if (sinPermiso) return sinPermiso;

  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ success: false, error: "Falta el id." }, { status: 400 });

  const r = await prisma.evaluacionProveedor.update({
    where: { id: String(b.id) },
    data: {
      aprobado: b.aprobado === null ? null : Boolean(b.aprobado),
      aprobadoPor: user.sub,
      aprobadoEn: new Date(),
      notaGerencia: b.notaGerencia || null,
    },
    include: { aprobador: { select: { nombre: true } } },
  });

  return NextResponse.json({ success: true, data: r });
}
