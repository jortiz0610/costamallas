// ============================================================
// PATCH /api/crm/trabajos/[id]/campo — lo que anota producción en sitio
// POST  /api/crm/trabajos/[id]/campo — cerrar con la firma del cliente
//
// Es la API del teléfono en campo. Dos reglas que la separan del resto
// del CRM:
//
//   1. NUNCA devuelve precios. Quien mide no negocia, y un total en la
//      pantalla del técnico es una conversación que no le toca a él.
//   2. Guarda a trozos. Estar en un balcón con media barra de señal y
//      perder veinte minutos de anotaciones por un botón de "guardar
//      todo" al final es como se deja de usar una herramienta.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { exigirPermiso } from "@/lib/permisos-server";
import { guardarFormato, cerrarConFirma, type ProductoRecomendado } from "@/lib/visitas";
import { avisarCierreDeTrabajo } from "@/lib/cierre-trabajo";
import { urlPortal } from "@/lib/url-portal";

type P = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.trabajos");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const recomendados = Array.isArray(body.recomendados)
    ? (body.recomendados as ProductoRecomendado[]).slice(0, 40)
    : undefined;

  const r = await guardarFormato(id, {
    medidas: body.medidas,
    condicionesSitio: body.condicionesSitio,
    recomendados,
    notas: body.notas,
  });

  return NextResponse.json({ success: true, data: r });
}

export async function POST(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.trabajos");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const r = await cerrarConFirma(
    id,
    {
      imagen: String(body.firmaImagen ?? ""),
      nombre: String(body.firmaNombre ?? ""),
      documento: body.firmaDocumento ? String(body.firmaDocumento) : undefined,
    },
    { observaciones: body.observaciones, recibidoPor: body.recibidoPor },
  );

  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });

  // El correo se espera, no se dispara y se olvida: esto corre en una
  // función sin servidor y cerrar la petición mata lo que quede
  // pendiente. Si falla, el trabajo queda cerrado igual — un correo
  // caído no puede dejar a un técnico en la puerta de un cliente sin
  // poder cerrar el acta.
  const aviso = await avisarCierreDeTrabajo(id, urlPortal(req)).catch(e => ({
    ok: false, motivo: (e as Error).message,
  }));

  return NextResponse.json({ success: true, data: { tipo: r.tipo, aviso } });
}

/** Lo que ve el técnico. Sin un solo precio. */
export async function GET(req: NextRequest, { params }: P) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const sinPermiso = await exigirPermiso(req, "crm.trabajos");
  if (sinPermiso) return sinPermiso;

  const { id } = await params;
  const t = await prisma.instalacion.findUnique({
    where: { id },
    select: {
      id: true, tipo: true, estado: true, fechaAgendada: true,
      direccion: true, ciudad: true, notas: true, esPrueba: true,
      medidas: true, condicionesSitio: true, recomendados: true,
      checklist: true, fotos: true,
      firmadoEn: true, firmaNombre: true, firmaDocumento: true,
      actaObservaciones: true,
      cliente: { select: { nombre: true, empresa: true, telefono: true, direccion: true, ciudad: true } },
      pedido: {
        select: {
          numero: true, direccionEntrega: true,
          cliente: { select: { nombre: true, empresa: true, telefono: true, direccion: true, ciudad: true } },
          // Descripción, cantidad y unidad. Nada de precioUnitario ni
          // subtotal: si no se seleccionan, no se pueden filtrar mal.
          items: { select: { descripcion: true, cantidad: true, unidad: true }, orderBy: { orden: "asc" } },
        },
      },
    },
  });

  if (!t) return NextResponse.json({ success: false, error: "No existe" }, { status: 404 });

  const cli = t.cliente ?? t.pedido?.cliente ?? null;

  return NextResponse.json({
    success: true,
    data: {
      ...t,
      cliente: cli,
      donde: [t.direccion || t.pedido?.direccionEntrega || cli?.direccion, t.ciudad || cli?.ciudad]
        .filter(Boolean).join(", "),
      items: (t.pedido?.items ?? []).map(i => ({
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        unidad: i.unidad,
      })),
    },
  });
}
