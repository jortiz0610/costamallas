import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { calcularCotizacion, leerAIU } from "@/lib/cotizacion-calculo";
import { getUserFromRequest } from "@/lib/auth";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";
import { recalcularCliente } from "@/lib/estados-cliente-server";
import { filtroPorVendedor } from "@/lib/alcance-crm";
import { clienteEsDePrueba } from "@/lib/cotizaciones-prueba";
import { conFotoDelCatalogo, type ItemGuardable } from "@/lib/cotizacion-imagenes";
import { siguienteNumeroPrueba } from "@/lib/cotizaciones-prueba";
import { peticionPuede } from "@/lib/permisos-server";
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
    requiereVisita, requiereSgsst,
  } = body;

  // ── ¿Es una cotización de prueba? ──
  // El permiso lo tiene por defecto solo el superadministrador. Se
  // comprueba en el servidor y no se confía en la casilla del navegador:
  // una prueba que se cuela como oferta real acaba en el embudo.
  // Si el cliente es de capacitación, la oferta nace marcada y no hace
  // falta permiso: trabajar sobre un cliente que YA está marcado es
  // justamente para lo que se marcó. El permiso solo hace falta para
  // marcar a mano una oferta de un cliente real.
  const clienteDePrueba = await clienteEsDePrueba(body.clienteId);
  const quierePrueba = body.esPrueba === true && !clienteDePrueba;
  const esPrueba = clienteDePrueba || (quierePrueba && (await peticionPuede(req, "crm.cotizaciones.prueba")));
  if (quierePrueba && !esPrueba) {
    return NextResponse.json(
      { success: false, error: "No tienes permiso para crear cotizaciones de prueba." },
      { status: 403 },
    );
  }

  if (!clienteId) return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ success: false, error: "Agrega al menos un producto" }, { status: 400 });

  // Calcular totales. La cuenta vive en lib/cotizacion-calculo.ts:
  // estaba duplicada aquí y en el PUT, con el 19 % escrito en los dos.
  const aiu = leerAIU(body);
  const itemsData: ItemGuardable[] = items.map((item: {
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

  // Si el ítem trae producto y llegó sin foto, se busca la del catálogo.
  // Es la mitad "al guardar" del arreglo de las miniaturas; la otra mitad
  // —rellenar lo que ya está escrito— vive en lib/cotizacion-imagenes.ts.
  const itemsConFoto = await conFotoDelCatalogo(itemsData);

  const descGlobal = descuentoGlobal ?? 0;
  const cuenta = calcularCotizacion(itemsConFoto, descGlobal, aiu);
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
  //
  // Las pruebas llevan contador PROPIO (PRUEBA-001): el de COT viene de
  // SIIGO y va por el 12075, y quemar esos números para ensayar es
  // justamente lo que no se quiere.
  const numero = esPrueba ? await siguienteNumeroPrueba() : await siguienteNumeroSeguro("COT");

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
      esPrueba,
      requiereVisita: Boolean(requiereVisita),
      requiereSgsst: Boolean(requiereSgsst),
      publicId,
      items: { create: itemsConFoto },
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
