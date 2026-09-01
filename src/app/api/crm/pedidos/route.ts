import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";
import { avisarInstalacionNueva } from "@/lib/instalaciones";
import { filtroPorVendedor } from "@/lib/alcance-crm";
import { SIN_PRUEBAS } from "@/lib/cotizaciones-prueba";
import { clienteEsDePrueba, siguienteNumeroPruebaPedido } from "@/lib/cotizaciones-prueba";

const ESTADOS_PEDIDO = ["NUEVO","CONFIRMADO","EN_PRODUCCION","LISTO","DESPACHADO","ENTREGADO","INSTALADO","CANCELADO"];

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const estado = req.nextUrl.searchParams.get("estado");
  const clienteId = req.nextUrl.searchParams.get("clienteId");

  // Sin `crm.ver_todo`, cada vendedor ve solo sus propios pedidos.
  const suyos = await filtroPorVendedor(req);

  // Los pedidos de PRUEBA quedan fuera salvo que se pidan a propósito
  // (?pruebas=1). El pipeline y el resumen del CRM leen de aquí, y una
  // prueba en la cifra de ventas es peor que no poder probar.
  const conPruebas = req.nextUrl.searchParams.get("pruebas") === "1";

  const pedidos = await prisma.pedido.findMany({
    where: {
      ...suyos,
      ...(conPruebas ? {} : SIN_PRUEBAS),
      ...(estado ? { estado } : {}),
      ...(clienteId ? { clienteId } : {}),
    },
    include: {
      cliente: { select: { nombre: true, empresa: true } },
      vendedor: { select: { id: true, nombre: true } },
      _count: { select: { items: true } },
      instalacion: { select: { estado: true, fechaAgendada: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    success: true,
    data: pedidos.map(p => ({
      ...p,
      total: Number(p.total),
      // Si el pedido es anterior a que existiera la columna, se cuenta
      // desde su última actualización en vez de mostrar "0 días".
      estadoDesde: (p.estadoDesde ?? p.updatedAt).toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { cotizacionId, clienteId, items, notas, tieneInstalacion, fechaEntrega, direccionEntrega } = body;

  if (!clienteId) return NextResponse.json({ success: false, error: "clienteId requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ success: false, error: "Sin items" }, { status: 400 });

  // Verificar stock
  const stockWarnings: string[] = [];
  for (const item of items) {
    if (item.productoId) {
      const prod = await prisma.producto.findUnique({ where: { id: item.productoId }, select: { sku: true, stock: true, nombre: true } });
      if (prod && prod.stock < Number(item.cantidad)) {
        stockWarnings.push(`${prod.sku}: stock insuficiente (${prod.stock} disponible, ${item.cantidad} requerido)`);
      }
    }
  }

  let total = 0;
  const itemsData = items.map((item: Record<string, unknown>, i: number) => {
    const sub = Number(item.cantidad) * Number(item.precioUnitario);
    total += sub;
    return { productoId: (item.productoId as string) ?? null, descripcion: item.descripcion as string, cantidad: Number(item.cantidad), precioUnitario: Number(item.precioUnitario), subtotal: sub, unidad: (item.unidad as string) ?? null, orden: i };
  });

  // Un pedido creado a mano para un cliente de capacitación también es
  // capacitación, aunque no venga de una cotización. Y con contador
  // propio: un ensayo no puede quemar un número del consecutivo real.
  const esPrueba = await clienteEsDePrueba(clienteId);
  const numero = esPrueba ? await siguienteNumeroPruebaPedido() : await siguienteNumeroSeguro("PED");

  const pedido = await prisma.pedido.create({
    data: {
      numero, cotizacionId: cotizacionId ?? null, clienteId, vendedorId: user.sub,
      estado: "NUEVO", tieneInstalacion: tieneInstalacion ?? false, esPrueba,
      // Lo creó un asesor desde el CRM (o nació de una cotización).
      origen: cotizacionId ? "COTIZACION" : "MANUAL",
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      direccionEntrega, notas, total,
      items: { create: itemsData },
      ...(tieneInstalacion ? { instalacion: { create: { estado: "PENDIENTE", direccion: direccionEntrega, esPrueba } } } : {}),
    },
    include: { items: true, cliente: { select: { nombre: true } }, instalacion: true },
  });

  // Actualizar cotización si viene de una
  if (cotizacionId) {
    await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: "APROBADA" } });
  }

  // Venta cerrada con instalación: se le avisa al coordinador. Vale lo
  // mismo si el pedido se creó a mano que si nació de una cotización.
  let avisoInstalacion: string | undefined;
  if (pedido.tieneInstalacion) {
    const r = await avisarInstalacionNueva(pedido.id);
    avisoInstalacion = r.detalle;
    await prisma.log.create({
      data: {
        usuarioId: user.sub,
        accion: "INSTALACION_AVISO_COORDINADOR",
        detalle: `${pedido.numero}: ${r.detalle}`,
        resultado: r.ok ? "OK" : "ERROR",
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, data: pedido, stockWarnings, avisoInstalacion }, { status: 201 });
}
