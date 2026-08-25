import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";
import {
  getPoliticaComercial, descuentoEfectivoPct, evaluarPolitica,
} from "@/lib/politica-comercial";
import { avisarInstalacionNueva } from "@/lib/instalaciones";

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(_req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      vendedor: { select: { nombre: true, email: true } },
      items: { orderBy: { orden: "asc" } },
    },
  });

  if (!cotizacion) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ success: true, data: cotizacion });
}

export async function PUT(req: NextRequest, { params }: P) {
  const { id } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { estado, notas, items, plantilla, validezDias, descuentoGlobal, ciudadInstalacion, direccionInstalacion, tieneInstalacion, anticipoPct, tiempoEntrega } = body;

  // ── Edición del borrador ──
  // Solo mientras la cotización no se haya enviado: una oferta que el
  // cliente ya tiene en la mano no puede cambiar de precio por detrás.
  if (Array.isArray(items)) {
    const actual = await prisma.cotizacion.findUnique({ where: { id }, select: { estado: true } });
    if (!actual) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
    if (actual.estado !== "BORRADOR") {
      return NextResponse.json(
        { success: false, error: "Solo se pueden editar los ítems de una cotización en borrador." },
        { status: 400 },
      );
    }
    if (!items.length) {
      return NextResponse.json({ success: false, error: "Agrega al menos un producto" }, { status: 400 });
    }

    const IVA_PCT = 0.19;
    let subtotal = 0;
    const itemsData = items.map((item: {
      productoId?: string; descripcion: string; cantidad: number; precioUnitario: number;
      descuento?: number; unidad?: string; tipo?: string; imagenUrl?: string; detalle?: string;
    }, i: number) => {
      const desc = item.descuento ?? 0;
      const sub = item.cantidad * item.precioUnitario * (1 - desc / 100);
      subtotal += sub;
      return {
        productoId: item.productoId ?? null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: desc,
        subtotal: sub,
        unidad: item.unidad ?? null,
        tipo: item.tipo === "INSTALACION" ? "INSTALACION" : "PRODUCTO",
        imagenUrl: item.imagenUrl ?? null,
        detalle: item.detalle ?? null,
        orden: i,
      };
    });

    const descGlobal = descuentoGlobal ?? 0;
    const subtotalConDesc = subtotal * (1 - descGlobal / 100);
    const iva = subtotalConDesc * IVA_PCT;

    // ── Política comercial ──
    // Cualquier edición vuelve a evaluarse desde cero: una aprobación
    // vale para la oferta que se aprobó, no para la que quede después.
    const politica = await getPoliticaComercial();
    const anticipo = anticipoPct == null || anticipoPct === "" ? null : Number(anticipoPct);
    const descPct = descuentoEfectivoPct(items, descGlobal, subtotal);
    const veredicto = evaluarPolitica({ descuentoPct: descPct, anticipoPct: anticipo }, politica);

    // Se reemplazan los ítems en bloque: es más simple y más seguro que
    // intentar casar cuáles cambiaron, y un borrador no tiene historial
    // que preservar.
    const guardada = await prisma.$transaction(async tx => {
      await tx.itemCotizacion.deleteMany({ where: { cotizacionId: id } });
      return tx.cotizacion.update({
        where: { id },
        data: {
          subtotal,
          descuento: subtotal - subtotalConDesc,
          iva,
          total: subtotalConDesc + iva,
          ...(notas !== undefined && { notas }),
          ...(plantilla && { plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS" }),
          ...(validezDias != null && { validezDias: Number(validezDias) }),
          ...(tieneInstalacion !== undefined && { tieneInstalacion: Boolean(tieneInstalacion) }),
          ciudadInstalacion: ciudadInstalacion || null,
          direccionInstalacion: direccionInstalacion || null,
          tiempoEntrega: tiempoEntrega || null,
          descuentoPct: descPct,
          anticipoPct: anticipo,
          aprobacionEstado: veredicto.requiere ? "PENDIENTE" : "NO_REQUIERE",
          aprobacionMotivo: veredicto.motivo,
          ...(veredicto.requiere
            ? {}
            : { aprobadaPorId: null, aprobadaPorNombre: null, aprobadaEn: null, aprobacionNota: null }),
          items: { create: itemsData },
        },
        include: { items: { orderBy: { orden: "asc" } } },
      });
    });

    return NextResponse.json({
      success: true,
      data: guardada,
      aviso: veredicto.requiere
        ? `Esta oferta necesita aprobación de un administrador para poder enviarse. ${veredicto.motivo}`
        : undefined,
    });
  }

  // Aprobar la oferta la convierte en pedido. Si se salió de la política
  // y nadie le dio el visto bueno, aquí se para: es el punto donde el
  // descuento deja de ser una propuesta y pasa a ser un compromiso.
  if (estado === "APROBADA") {
    const actual = await prisma.cotizacion.findUnique({
      where: { id },
      select: { aprobacionEstado: true, aprobacionMotivo: true },
    });
    if (actual?.aprobacionEstado === "PENDIENTE") {
      return NextResponse.json(
        {
          success: false,
          error: `Esta oferta está fuera de la política comercial y necesita el visto bueno de un administrador. ${actual.aprobacionMotivo ?? ""}`.trim(),
        },
        { status: 400 },
      );
    }
    if (actual?.aprobacionEstado === "RECHAZADA") {
      return NextResponse.json(
        { success: false, error: "Un administrador rechazó las condiciones de esta oferta. Ajústalas antes de aprobarla." },
        { status: 400 },
      );
    }
  }

  // El anticipo se puede cambiar sin tocar los ítems (es una condición de
  // pago, no un precio), así que se vuelve a evaluar la política aquí
  // también. Si no, bajarlo por esta vía se saltaría el tope.
  let recalculo: Record<string, unknown> = {};
  let avisoPolitica: string | undefined;
  if (anticipoPct !== undefined) {
    const actual = await prisma.cotizacion.findUnique({ where: { id }, select: { descuentoPct: true } });
    const politica = await getPoliticaComercial();
    const anticipo = anticipoPct === null || anticipoPct === "" ? null : Number(anticipoPct);
    const veredicto = evaluarPolitica(
      { descuentoPct: Number(actual?.descuentoPct ?? 0), anticipoPct: anticipo },
      politica,
    );
    recalculo = {
      anticipoPct: anticipo,
      aprobacionEstado: veredicto.requiere ? "PENDIENTE" : "NO_REQUIERE",
      aprobacionMotivo: veredicto.motivo,
      ...(veredicto.requiere
        ? {}
        : { aprobadaPorId: null, aprobadaPorNombre: null, aprobadaEn: null, aprobacionNota: null }),
    };
    if (veredicto.requiere) {
      avisoPolitica = `Esta oferta necesita aprobación de un administrador. ${veredicto.motivo}`;
    }
  }

  const updated = await prisma.cotizacion.update({
    where: { id },
    data: {
      ...(estado && { estado }),
      ...(notas !== undefined && { notas }),
      ...(plantilla && { plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS" }),
      ...(tiempoEntrega !== undefined && { tiempoEntrega: tiempoEntrega || null }),
      ...recalculo,
    },
  });

  // Si se aprueba, crear pedido automáticamente.
  // Solo si no hay uno ya: guardar dos veces con el estado en APROBADA
  // creaba un pedido nuevo cada vez, y el mismo negocio aparecía dos
  // veces en el pipeline y en la plata del embudo.
  const yaTienePedido =
    estado === "APROBADA" && (await prisma.pedido.count({ where: { cotizacionId: id } })) > 0;

  let avisoInstalacion: string | undefined;

  if (estado === "APROBADA" && !yaTienePedido) {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id }, include: { items: true },
    });
    if (cotizacion) {
      // Consecutivo atómico compartido: aquí también estaba el `count + 1`
      // que repetía número si se borraba un pedido.
      const numero = await siguienteNumeroSeguro("PED");
      const pedido = await prisma.pedido.create({
        data: {
          numero,
          cotizacionId: id,
          clienteId: cotizacion.clienteId,
          vendedorId: cotizacion.vendedorId,
          estado: "NUEVO",
          origen: "COTIZACION",
          origenRef: cotizacion.numero,
          tieneInstalacion: cotizacion.tieneInstalacion,
          total: cotizacion.total,
          items: {
            create: cotizacion.items.map((item) => ({
              productoId: item.productoId,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
              unidad: item.unidad,
              orden: item.orden,
            })),
          },
        },
      });

      // Venta cerrada con instalación: se crea la obra y se le avisa al
      // coordinador. Antes se enteraba cuando el cliente llamaba
      // preguntando cuándo van.
      //
      // Si el aviso falla NO se tumba la aprobación: el negocio ya se
      // cerró y perder eso por un correo sería absurdo. Queda en el log.
      if (cotizacion.tieneInstalacion) {
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
    }
  }

  return NextResponse.json({
    success: true,
    data: updated,
    aviso: avisoPolitica,
    avisoInstalacion,
  });
}
