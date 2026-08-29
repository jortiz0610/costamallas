import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { calcularCotizacion, leerAIU } from "@/lib/cotizacion-calculo";
import { getUserFromRequest } from "@/lib/auth";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";
import { recalcularCliente } from "@/lib/estados-cliente-server";
import { filtroPorVendedor } from "@/lib/alcance-crm";
import {
  getPoliticaComercial, descuentoEfectivoPct, evaluarPolitica,
} from "@/lib/politica-comercial";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  const estado = req.nextUrl.searchParams.get("estado");

  // Sin `crm.ver_todo`, cada vendedor ve solo sus propias ofertas.
  const suyas = await filtroPorVendedor(req);

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      ...suyas,
      ...(clienteId ? { clienteId } : {}),
      ...(estado ? { estado } : {}),
    },
    include: {
      cliente: { select: { nombre: true, empresa: true } },
      vendedor: { select: { nombre: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data: cotizaciones });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const {
    clienteId, items, notas, tieneInstalacion, validezDias, descuentoGlobal,
    plantilla, ciudadInstalacion, direccionInstalacion, anticipoPct, tiempoEntrega,
  } = body;

  if (!clienteId) return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ success: false, error: "Agrega al menos un producto" }, { status: 400 });

  // Calcular totales. La cuenta vive en lib/cotizacion-calculo.ts:
  // estaba duplicada aquí y en el PUT, con el 19 % escrito en los dos.
  const aiu = leerAIU(body);
  const itemsData = items.map((item: {
    productoId?: string; descripcion: string; cantidad: number; precioUnitario: number;
    descuento?: number; unidad?: string; tipo?: string; imagenUrl?: string; detalle?: string;
  }, i: number) => {
    const desc = item.descuento ?? 0;
    const sub = item.cantidad * item.precioUnitario * (1 - desc / 100);
    return {
      productoId: item.productoId ?? null,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      descuento: desc,
      subtotal: sub,
      unidad: item.unidad ?? null,
      // La foto se copia del catálogo al cotizar: si mañana cambian la
      // imagen del producto, la oferta ya enviada no se altera sola.
      tipo: item.tipo === "INSTALACION" ? "INSTALACION" : "PRODUCTO",
      imagenUrl: item.imagenUrl ?? null,
      detalle: item.detalle ?? null,
      orden: i,
    };
  });

  const descGlobal = descuentoGlobal ?? 0;
  const cuenta = calcularCotizacion(itemsData, descGlobal, aiu);
  const subtotal = cuenta.subtotal;

  // ── Política comercial ──
  // El descuento efectivo suma el de línea y el global: al cliente le da
  // igual dónde se aplicó, y un tope que solo mirara el global se
  // saltaría poniendo el 30% línea por línea.
  const politica = await getPoliticaComercial();
  const anticipo = anticipoPct == null || anticipoPct === "" ? null : Number(anticipoPct);
  const descPct = descuentoEfectivoPct(items, descGlobal, subtotal);
  const veredicto = evaluarPolitica({ descuentoPct: descPct, anticipoPct: anticipo }, politica);

  // Consecutivo atómico. Antes era `count() + 1`, que repetía números
  // si se borraba una cotización y chocaba entre usuarios simultáneos.
  const numero = await siguienteNumeroSeguro("COT");

  // El token del enlace público es aleatorio y largo a propósito: la
  // cotización se comparte sin login, así que no puede llegarse a ella
  // adivinando un id.
  const publicId = randomBytes(16).toString("base64url");

  const cotizacion = await prisma.cotizacion.create({
    data: {
      numero,
      clienteId,
      vendedorId: user.sub,
      estado: "BORRADOR",
      subtotal: cuenta.subtotal,
      descuento: cuenta.descuento,
      iva: cuenta.iva,
      total: cuenta.total,
      aiuActivo: cuenta.aiuActivo,
      aiuAdminPct: aiu.adminPct,
      aiuImprevPct: aiu.imprevPct,
      aiuUtilidadPct: aiu.utilidadPct,
      aiuAdmin: cuenta.admin,
      aiuImprev: cuenta.imprevistos,
      aiuUtilidad: cuenta.utilidad,
      ivaUtilidad: cuenta.ivaUtilidad,
      validezDias: validezDias ?? 30,
      notas,
      tieneInstalacion: tieneInstalacion ?? false,
      plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS",
      ciudadInstalacion: ciudadInstalacion || null,
      direccionInstalacion: direccionInstalacion || null,
      tiempoEntrega: tiempoEntrega || null,
      descuentoPct: descPct,
      anticipoPct: anticipo,
      aprobacionEstado: veredicto.requiere ? "PENDIENTE" : "NO_REQUIERE",
      aprobacionMotivo: veredicto.motivo,
      publicId,
      items: { create: itemsData },
    },
    include: {
      items: true,
      cliente: { select: { nombre: true, empresa: true } },
    },
  });

  // Cotizarle a alguien lo saca de "prospecto": el estado del cliente
  // se calcula a partir de sus cotizaciones.
  await recalcularCliente(clienteId);

  return NextResponse.json(
    {
      success: true,
      data: cotizacion,
      // Se avisa al crear, no al intentar enviar: el asesor tiene que
      // saber que le falta un visto bueno antes de prometerle nada al
      // cliente por teléfono.
      aviso: veredicto.requiere
        ? `Esta oferta necesita aprobación de un administrador para poder enviarse. ${veredicto.motivo}`
        : undefined,
    },
    { status: 201 },
  );
}
