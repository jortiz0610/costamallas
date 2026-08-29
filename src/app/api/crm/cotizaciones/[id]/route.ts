import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularCotizacion, leerAIU } from "@/lib/cotizacion-calculo";
import { getUserFromRequest } from "@/lib/auth";
import { siguienteNumeroSeguro } from "@/lib/consecutivos";
import { recalcularCliente } from "@/lib/estados-cliente-server";
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

  // ── Edición de los ítems ──
  //
  // Antes solo se podía en BORRADOR. Dejó de servir el día que compartir
  // el enlace pasó la oferta a ENVIADA: con esa regla, toda cotización
  // que se le manda a un cliente quedaba congelada, y corregir un precio
  // mal puesto obligaba a rehacerla entera.
  //
  // Qué se permite ahora y por qué:
  //   BORRADOR  · libre, no ha salido de la casa
  //   ENVIADA   · sí, pero el cliente YA tiene el enlace y ve lo que haya
  //               guardado. La pantalla lo advierte y aquí queda registro.
  //   APROBADA  · NO. Ya generó un pedido; cambiarle los ítems dejaría el
  //               pedido diciendo una cosa y la oferta otra.
  //   RECHAZADA / VENCIDA · NO. Son historia, y reescribir el pasado hace
  //               que los informes dejen de significar algo.
  const EDITABLES = new Set(["BORRADOR", "ENVIADA"]);
  if (Array.isArray(items)) {
    const actual = await prisma.cotizacion.findUnique({ where: { id }, select: { estado: true, numero: true } });
    if (!actual) return NextResponse.json({ success: false, error: "No encontrada" }, { status: 404 });
    if (!EDITABLES.has(actual.estado)) {
      const motivo = actual.estado === "APROBADA"
        ? "Esta oferta ya se aprobó y generó un pedido: cambiarle los ítems dejaría el pedido descuadrado."
        : `Una cotización en estado ${actual.estado} ya no se edita.`;
      return NextResponse.json({ success: false, error: motivo }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ success: false, error: "Agrega al menos un producto" }, { status: 400 });
    }

    // La cuenta vive en lib/cotizacion-calculo.ts.
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
          ...(notas !== undefined && { notas }),
          ...(plantilla && { plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS" }),
          ...(validezDias != null && { validezDias: Number(validezDias) }),
          ...(tieneInstalacion !== undefined && { tieneInstalacion: Boolean(tieneInstalacion) }),
          ciudadInstalacion: ciudadInstalacion || null,
          direccionInstalacion: direccionInstalacion || null,
          // Solo si viene. El cotizador no tiene este campo —se edita en
          // la ficha—, y ponerlo siempre borraba el plazo propio de la
          // oferta cada vez que alguien tocaba los ítems.
          ...(tiempoEntrega !== undefined && { tiempoEntrega: tiempoEntrega || null }),
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

    // Editar algo que el cliente ya tiene en la mano deja rastro: si
    // mañana reclama que el precio cambió, hay con qué responder.
    if (actual.estado === "ENVIADA") {
      await prisma.log
        .create({
          data: {
            usuarioId: user.sub,
            accion: "COTIZACION_EDITADA_ENVIADA",
            detalle: `${actual.numero} · el cliente ya tenía el enlace`,
            resultado: `total ${cuenta.total}`,
          },
        })
        .catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      data: guardada,
      editadaEnviada: actual.estado === "ENVIADA",
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

  // Pasar el estado a ENVIADA a mano tiene que sellar la fecha, igual
  // que enviar por correo o compartir el enlace. Sin `enviadaEn` el
  // seguimiento no ve la cotización (filtra por estado ENVIADA **y**
  // fecha no nula), y el panel seguía diciendo "Sin enviar" en una
  // oferta marcada como enviada. Se sella una sola vez: es el origen del
  // reloj de los tres toques.
  const sellarEnvio =
    estado === "ENVIADA" &&
    !(await prisma.cotizacion.findUnique({ where: { id }, select: { enviadaEn: true } }))?.enviadaEn;

  const updated = await prisma.cotizacion.update({
    where: { id },
    data: {
      ...(estado && { estado }),
      ...(sellarEnvio && { enviadaEn: new Date() }),
      ...(notas !== undefined && { notas }),
      ...(plantilla && { plantilla: plantilla === "PROPUESTA" ? "PROPUESTA" : "EXPRESS" }),
      ...(tiempoEntrega !== undefined && { tiempoEntrega: tiempoEntrega || null }),
      ...recalculo,
    },
  });

  // El estado del cliente sale de sus cotizaciones, así que tocar una
  // puede moverlo: de prospecto a interesado al cotizarle, de interesado
  // a cliente activo al aprobar. No se espera a la corrida diaria porque
  // el vendedor tiene la ficha abierta al lado.
  await recalcularCliente(updated.clienteId);

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
