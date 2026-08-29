// ============================================================
// POST   /api/crm/trabajos/sgsst        — alta de una persona
// PUT    /api/crm/trabajos/sgsst?id=…   — editar / registrar documentos
// DELETE /api/crm/trabajos/sgsst?id=…   — quitar una persona
//
// La carga es POR PERSONA de una vez —cédula, planilla, alturas— porque
// así es como llegan: el contratista manda la carpeta de un trabajador
// completa, no un documento suelto cada martes.
//
// ⚠️ Los ARCHIVOS todavía no se guardan. Ver
// `lib/almacenamiento-documentos.ts`: son datos personales y el portal no
// tiene aún dónde ponerlos de forma privada. Se guarda el REGISTRO de
// qué se entregó y cuándo, con `almacenado: false` y el motivo, y la
// pantalla lo dice. Un "documento cargado ✓" que no guardó nada sería
// mucho peor.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import {
  ALMACENAMIENTO_ACTIVO,
  type DocumentoRegistrado,
} from "@/lib/almacenamiento-documentos";
import { DOCUMENTOS_SGSST, ROLES_SGSST } from "@/lib/visita-tecnica";

const CLAVES = new Set(DOCUMENTOS_SGSST.map(d => d.k));
const ROLES = new Set(ROLES_SGSST.map(r => r.v as string));

/** Solo las casillas que existen: una clave inventada en el navegador no
 *  debe acabar en la base. Devuelve un booleano por clave. */
function soloClavesConocidas(entrada: unknown): Record<string, boolean> {
  if (!entrada || typeof entrada !== "object") return {};
  const salida: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(entrada as Record<string, unknown>)) {
    if (CLAVES.has(k)) salida[k] = Boolean(v);
  }
  return salida;
}

async function guardia(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 }) };
  const sinPermiso = await exigirPermiso(req, "crm.trabajos");
  if (sinPermiso) return { error: sinPermiso };
  return { user };
}

export async function POST(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const { cotizacionId, nombre, cedula, rol, requeridos } = await req.json().catch(() => ({}));
  if (!cotizacionId || !nombre?.trim()) {
    return NextResponse.json({ success: false, error: "Faltan la cotización y el nombre." }, { status: 400 });
  }
  if (rol && !ROLES.has(rol)) {
    return NextResponse.json({ success: false, error: `Rol no válido: ${rol}` }, { status: 400 });
  }

  const persona = await prisma.sgsstPersona.create({
    data: {
      cotizacionId,
      nombre: String(nombre).trim(),
      cedula: cedula ? String(cedula).trim() : null,
      rol: rol ?? "TRABAJADOR",
      requeridos: soloClavesConocidas(requeridos),
      documentos: [],
    },
  });

  return NextResponse.json({ success: true, data: persona }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Falta el id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { nombre, cedula, rol, requeridos, observaciones, registrarDocumentos } = body ?? {};

  const persona = await prisma.sgsstPersona.findUnique({
    where: { id },
    select: { id: true, cotizacionId: true, documentos: true },
  });
  if (!persona) return NextResponse.json({ success: false, error: "Persona no encontrada" }, { status: 404 });

  let documentos = (persona.documentos as unknown as DocumentoRegistrado[]) ?? [];
  const avisos: string[] = [];

  // `registrarDocumentos`: [{ tipo, nombreArchivo, tamano }]
  if (Array.isArray(registrarDocumentos) && registrarDocumentos.length) {
    for (const d of registrarDocumentos) {
      if (!CLAVES.has(d?.tipo)) continue;
      const r = await ALMACENAMIENTO_ACTIVO.guardar(
        { nombre: String(d.nombreArchivo ?? "sin-nombre"), tamano: Number(d.tamano) || 0 },
        { cotizacionId: persona.cotizacionId, personaId: persona.id, tipo: d.tipo },
      );
      // Un documento del mismo tipo REEMPLAZA al anterior: es lo que
      // pasa en la realidad —llega la planilla del mes nuevo— y guardar
      // los dos dejaría al coordinador adivinando cuál vale.
      documentos = documentos.filter(x => x.tipo !== d.tipo);
      documentos.push({
        tipo: d.tipo,
        nombreArchivo: String(d.nombreArchivo ?? "sin-nombre"),
        tamano: Number(d.tamano) || 0,
        subidoEn: new Date().toISOString(),
        subidoPorId: g.user!.sub,
        almacenado: r.almacenado,
        motivo: r.motivo,
        ref: r.ref,
      });
      if (r.motivo) avisos.push(r.motivo);
    }
  }

  const actualizada = await prisma.sgsstPersona.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),
      ...(cedula !== undefined && { cedula: cedula ? String(cedula).trim() : null }),
      ...(rol !== undefined && ROLES.has(rol) && { rol }),
      ...(requeridos !== undefined && { requeridos: soloClavesConocidas(requeridos) }),
      ...(observaciones !== undefined && { observaciones }),
      ...(registrarDocumentos !== undefined && { documentos: documentos as never }),
    },
  });

  return NextResponse.json({
    success: true,
    data: actualizada,
    // Se devuelve el motivo UNA vez aunque se hayan registrado cinco
    // documentos: repetir el mismo aviso cinco veces no informa más.
    aviso: avisos.length ? avisos[0] : undefined,
  });
}

export async function DELETE(req: NextRequest) {
  const g = await guardia(req);
  if (g.error) return g.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "Falta el id" }, { status: 400 });

  await prisma.sgsstPersona.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ success: true });
}
