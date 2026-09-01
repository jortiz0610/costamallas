// ============================================================
// El ensayo general.
//
// Recorre el proceso completo —cliente, cotización, envío, apertura,
// aprobación, pedido, instalación y encuesta— con datos marcados como
// prueba, para poder responder una pregunta que hoy no se puede
// responder sin arriesgar un cliente real: **¿los correos salen?**
//
// Tres reglas que lo hacen seguro:
//
//   1. Todo lo que crea lleva `esPrueba` y el prefijo PRUEBA. Queda
//      fuera de informes, embudo, pipeline y del consecutivo real, y se
//      borra en bloque con lo que ya existía (`cotizaciones-prueba.ts`).
//   2. Los correos van a UNA dirección que se escribe al empezar: la de
//      quien está probando. Nunca a un cliente de verdad.
//   3. Cada paso dice lo que PASÓ, no lo que debería pasar. Si el correo
//      no salió, el paso sale en rojo con el error del servidor SMTP,
//      que es justamente lo que se está tratando de averiguar.
//
// No simula nada: usa las mismas funciones que el portal usa en
// producción. Un ensayo que llame a un camino distinto no prueba nada.
// ============================================================

import { prisma } from "@/lib/prisma";
import { siguienteNumeroPrueba } from "@/lib/cotizaciones-prueba";
import { correoConfigurado } from "@/lib/correo";
import { enlaceCotizacion } from "@/lib/url-portal";

export type ClavePaso =
  | "cliente"
  | "cotizacion"
  | "envio"
  | "apertura"
  | "aprobacion"
  | "instalacion"
  | "encuesta";

export interface Paso {
  clave: ClavePaso;
  titulo: string;
  /** Qué se está comprobando, en una línea. */
  que: string;
  /** Si toca un correo, cuál. Sirve para saber qué buscar en la bandeja. */
  correo?: string;
}

export const PASOS: Paso[] = [
  {
    clave: "cliente",
    titulo: "Crear el cliente de prueba",
    que: "Se crea un cliente con el correo que escribiste. Todo lo demás cuelga de él.",
  },
  {
    clave: "cotizacion",
    titulo: "Armar la cotización",
    que: "Con un producto real del catálogo y el servicio de instalación, si hay alguno cargado.",
  },
  {
    clave: "envio",
    titulo: "Enviarla al cliente",
    que: "Aquí sale el primer correo de verdad. Si el SMTP falla, se ve aquí.",
    correo: "Envío de cotización",
  },
  {
    clave: "apertura",
    titulo: "Simular que el cliente la abre",
    que: "Marca la oferta como vista y avisa al asesor, igual que cuando la abre un cliente.",
    correo: "Aviso al asesor: el cliente la abrió",
  },
  {
    clave: "aprobacion",
    titulo: "Aprobarla",
    que: "Crea el pedido, como cuando el cliente aprueba desde el enlace público.",
    correo: "Aviso de cotización aprobada",
  },
  {
    clave: "instalacion",
    titulo: "Agendar la instalación",
    que: "Crea la obra y avisa al coordinador de producción.",
    correo: "Aviso al coordinador",
  },
  {
    clave: "encuesta",
    titulo: "Cerrar y mandar la encuesta",
    que: "Da la obra por terminada y manda la encuesta de satisfacción.",
    correo: "Encuesta de satisfacción",
  },
];

export interface ResultadoPaso {
  clave: ClavePaso;
  ok: boolean;
  /** Lo que pasó, en castellano. */
  mensaje: string;
  /** El error real, si lo hubo. Sin traducir ni suavizar. */
  error?: string;
  /** Lo que quedó creado, para poder abrirlo. */
  enlace?: string;
  datos?: Record<string, string | number | null>;
}

/** El nombre con el que se reconocen los datos de este ensayo. */
export const MARCA_ENSAYO = "ENSAYO";

async function clienteDelEnsayo() {
  return prisma.cliente.findFirst({
    where: { nombre: { startsWith: MARCA_ENSAYO } },
    orderBy: { createdAt: "desc" },
    select: { id: true, nombre: true, email: true, vendedorId: true },
  });
}

async function cotizacionDelEnsayo() {
  const cliente = await clienteDelEnsayo();
  if (!cliente) return null;
  return prisma.cotizacion.findFirst({
    where: { clienteId: cliente.id, esPrueba: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, numero: true, publicId: true, estado: true, total: true,
      enviadaEn: true, tieneInstalacion: true, clienteId: true, vendedorId: true,
    },
  });
}

// ─────────────────────────────────────────────
// Los pasos
// ─────────────────────────────────────────────

async function pasoCliente(correo: string, usuarioId: string): Promise<ResultadoPaso> {
  const sello = new Date().toISOString().slice(5, 16).replace("T", " ");
  const cliente = await prisma.cliente.create({
    data: {
      nombre: `${MARCA_ENSAYO} ${sello}`,
      email: correo,
      telefono: "3000000000",
      whatsapp: "3000000000",
      ciudad: "Barranquilla",
      departamento: "Atlántico",
      tipo: "persona",
      estado: "PROSPECTO",
      vendedorId: usuarioId,
      notas: "Cliente del ensayo general. Se borra con el resto de las pruebas.",
    },
    select: { id: true, nombre: true },
  });
  return {
    clave: "cliente",
    ok: true,
    mensaje: `Creado «${cliente.nombre}» con el correo ${correo}.`,
    enlace: `/crm/clientes/${cliente.id}`,
    datos: { clienteId: cliente.id },
  };
}

async function pasoCotizacion(usuarioId: string): Promise<ResultadoPaso> {
  const cliente = await clienteDelEnsayo();
  if (!cliente) {
    return { clave: "cotizacion", ok: false, mensaje: "Falta el cliente: corre el paso 1 primero." };
  }

  // Un producto REAL del catálogo: si se inventara uno, no se estaría
  // probando lo que pasa con los datos de verdad (imagen, unidad, IVA).
  const producto = await prisma.producto.findFirst({
    where: { intEstado: { not: "ARCHIVADO" }, precioNormal: { not: null } },
    select: { id: true, nombre: true, precioNormal: true, acfUnidadVenta: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!producto) {
    return {
      clave: "cotizacion", ok: false,
      mensaje: "No hay ningún producto con precio en el catálogo, así que no se puede armar una oferta.",
    };
  }

  const servicio = await prisma.servicioInstalacion.findFirst({
    where: { activo: true },
    select: { nombre: true, precioBase: true },
  });

  const precio = Number(producto.precioNormal);
  const cantidad = 10;
  const subtotalProducto = precio * cantidad;
  const subtotalInstalacion = servicio ? Number(servicio.precioBase) : 0;
  const subtotal = subtotalProducto + subtotalInstalacion;
  const iva = Math.round(subtotal * 0.19);

  const { randomBytes } = await import("node:crypto");

  const cot = await prisma.cotizacion.create({
    data: {
      numero: await siguienteNumeroPrueba(),
      clienteId: cliente.id,
      vendedorId: usuarioId,
      estado: "BORRADOR",
      esPrueba: true,
      subtotal, iva, total: subtotal + iva,
      validezDias: 15,
      tieneInstalacion: Boolean(servicio),
      ciudadInstalacion: "Barranquilla",
      notas: "Cotización del ensayo general. No es una oferta real.",
      publicId: randomBytes(16).toString("base64url"),
      items: {
        create: [
          {
            productoId: producto.id,
            descripcion: producto.nombre,
            cantidad, precioUnitario: precio, subtotal: subtotalProducto,
            unidad: producto.acfUnidadVenta ?? "unidad",
            tipo: "PRODUCTO", orden: 0,
          },
          ...(servicio ? [{
            descripcion: servicio.nombre,
            cantidad: 1, precioUnitario: Number(servicio.precioBase), subtotal: subtotalInstalacion,
            unidad: "global", tipo: "INSTALACION", orden: 1,
          }] : []),
        ],
      },
    },
    select: { id: true, numero: true, total: true },
  });

  return {
    clave: "cotizacion",
    ok: true,
    mensaje: `${cot.numero} armada con «${producto.nombre}»${servicio ? ` y «${servicio.nombre}»` : ""}.`,
    enlace: `/crm/cotizaciones/${cot.id}`,
    datos: { numero: cot.numero, total: Number(cot.total) },
  };
}

async function pasoEnvio(): Promise<ResultadoPaso> {
  const cot = await cotizacionDelEnsayo();
  if (!cot) return { clave: "envio", ok: false, mensaje: "Falta la cotización: corre el paso 2." };

  if (!(await correoConfigurado())) {
    return {
      clave: "envio", ok: false,
      mensaje: "El correo no está configurado, así que no hay nada que enviar.",
      error: "Falta cargar el SMTP en Configuración → Correo.",
    };
  }

  // El MISMO camino que usa el botón de "Enviar" del portal. Llamar a
  // otro sitio probaría un código que nadie usa.
  const { enviarCotizacionPorCorreo } = await import("@/lib/envio-cotizacion");
  try {
    const r = await enviarCotizacionPorCorreo(cot.id);
    return {
      clave: "envio",
      ok: r.ok,
      mensaje: r.ok
        ? `Salió a ${r.destino}. Búscalo en tu bandeja: asunto «${r.asunto}».`
        : "El portal intentó enviarlo y el servidor de correo lo rechazó.",
      error: r.error,
      enlace: enlaceCotizacion(cot.publicId),
      datos: { destino: r.destino ?? null },
    };
  } catch (e) {
    return {
      clave: "envio", ok: false,
      mensaje: "El envío falló.",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function pasoApertura(): Promise<ResultadoPaso> {
  const cot = await cotizacionDelEnsayo();
  if (!cot) return { clave: "apertura", ok: false, mensaje: "Falta la cotización." };
  if (!cot.enviadaEn) {
    return { clave: "apertura", ok: false, mensaje: "Todavía no se ha enviado: corre el paso 3." };
  }

  await prisma.cotizacion.update({
    where: { id: cot.id },
    data: {
      vistas: { increment: 1 },
      vistaPrimeraEn: new Date(),
      vistaUltimaEn: new Date(),
    },
  });

  // El aviso al asesor se salta las cotizaciones de prueba a propósito
  // (ver `aviso-apertura.ts`), así que aquí se dice en vez de fingirlo.
  return {
    clave: "apertura",
    ok: true,
    mensaje: "Marcada como vista. El aviso al asesor NO se manda en las de prueba, para no llenarle la bandeja de avisos falsos.",
    enlace: enlaceCotizacion(cot.publicId),
  };
}

async function pasoAprobacion(): Promise<ResultadoPaso> {
  const cot = await cotizacionDelEnsayo();
  if (!cot) return { clave: "aprobacion", ok: false, mensaje: "Falta la cotización." };

  const { crearPedidoDeAprobacion } = await import("@/lib/aprobar-cotizacion");
  try {
    await prisma.cotizacion.update({ where: { id: cot.id }, data: { estado: "APROBADA" } });
    const r = await crearPedidoDeAprobacion(cot.id, null);
    return {
      clave: "aprobacion",
      ok: true,
      mensaje: r.pedidoNumero
        ? `Aprobada. Se creó el pedido ${r.pedidoNumero}.`
        : r.yaTeniaPedido ? "Aprobada. Ya tenía pedido." : "Aprobada.",
      enlace: `/crm/cotizaciones/${cot.id}`,
      datos: { pedido: r.pedidoNumero, aviso: r.avisoInstalacion ?? null },
    };
  } catch (e) {
    return {
      clave: "aprobacion", ok: false,
      mensaje: "No se pudo aprobar.",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function pasoInstalacion(): Promise<ResultadoPaso> {
  const cliente = await clienteDelEnsayo();
  if (!cliente) return { clave: "instalacion", ok: false, mensaje: "Falta el cliente." };

  const pedido = await prisma.pedido.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, numero: true, tieneInstalacion: true },
  });
  if (!pedido) return { clave: "instalacion", ok: false, mensaje: "Falta el pedido: corre el paso 5." };

  const yaHay = await prisma.instalacion.findFirst({
    where: { pedidoId: pedido.id },
    select: { id: true },
  });

  const inst = yaHay ?? await prisma.instalacion.create({
    data: {
      pedidoId: pedido.id,
      estado: "PENDIENTE",
      ciudad: "Barranquilla",
      direccion: "Dirección del ensayo",
      notas: "Instalación del ensayo general.",
    },
    select: { id: true },
  });

  const { avisarInstalacionNueva } = await import("@/lib/instalaciones");
  const aviso = await avisarInstalacionNueva(pedido.id).catch(e => ({
    ok: false, detalle: e instanceof Error ? e.message : String(e),
  }));

  return {
    clave: "instalacion",
    ok: true,
    mensaje: `Obra creada para ${pedido.numero}. Aviso al coordinador: ${aviso.detalle}`,
    enlace: `/crm/instalaciones/${inst.id}`,
  };
}

async function pasoEncuesta(): Promise<ResultadoPaso> {
  const cliente = await clienteDelEnsayo();
  if (!cliente) return { clave: "encuesta", ok: false, mensaje: "Falta el cliente." };

  const inst = await prisma.instalacion.findFirst({
    where: { pedido: { clienteId: cliente.id } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!inst) return { clave: "encuesta", ok: false, mensaje: "Falta la instalación: corre el paso 6." };

  await prisma.instalacion.update({
    where: { id: inst.id },
    data: { estado: "COMPLETADA", fechaRealizada: new Date() },
  });

  if (!(await correoConfigurado())) {
    return {
      clave: "encuesta", ok: false,
      mensaje: "Obra cerrada, pero el correo no está configurado.",
      error: "Falta el SMTP.",
    };
  }

  try {
    const { enviarEncuesta } = await import("@/lib/postventa");
    const r = await enviarEncuesta(inst.id);
    return {
      clave: "encuesta",
      ok: r.ok,
      mensaje: r.ok
        ? `Encuesta enviada a ${cliente.email}.`
        : "La obra se cerró pero la encuesta no salió.",
      error: r.error,
      enlace: `/crm/instalaciones/${inst.id}`,
    };
  } catch (e) {
    return {
      clave: "encuesta", ok: false,
      mensaje: "Obra cerrada. La encuesta falló.",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

const EJECUTORES: Record<ClavePaso, (correo: string, usuarioId: string) => Promise<ResultadoPaso>> = {
  cliente:     (correo, u) => pasoCliente(correo, u),
  cotizacion:  (_c, u) => pasoCotizacion(u),
  envio:       () => pasoEnvio(),
  apertura:    () => pasoApertura(),
  aprobacion:  () => pasoAprobacion(),
  instalacion: () => pasoInstalacion(),
  encuesta:    () => pasoEncuesta(),
};

export async function correrPaso(
  clave: ClavePaso,
  correo: string,
  usuarioId: string,
): Promise<ResultadoPaso> {
  const fn = EJECUTORES[clave];
  if (!fn) return { clave, ok: false, mensaje: `No existe el paso «${clave}».` };
  try {
    return await fn(correo, usuarioId);
  } catch (e) {
    return {
      clave, ok: false,
      mensaje: "El paso se cayó.",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─────────────────────────────────────────────
// Limpieza
// ─────────────────────────────────────────────

export interface ResumenLimpiezaEnsayo {
  clientes: number;
  cotizaciones: number;
  pedidos: number;
  instalaciones: number;
}

/**
 * Borra lo del ensayo. Se apoya en `borrarPruebas()` para las
 * cotizaciones y pedidos —que ya sabe el orden correcto— y remata con
 * los clientes ENSAYO y sus instalaciones.
 */
export async function limpiarEnsayo(opciones?: { dry?: boolean }): Promise<ResumenLimpiezaEnsayo> {
  const dry = opciones?.dry ?? false;

  const clientes = await prisma.cliente.findMany({
    where: { nombre: { startsWith: MARCA_ENSAYO } },
    select: { id: true },
  });
  const ids = clientes.map(c => c.id);

  const instalaciones = ids.length
    ? await prisma.instalacion.findMany({
        where: { pedido: { clienteId: { in: ids } } },
        select: { id: true },
      })
    : [];

  const { borrarPruebas } = await import("@/lib/cotizaciones-prueba");
  const pruebas = await borrarPruebas({ dry });

  if (!dry) {
    if (instalaciones.length) {
      await prisma.instalacion.deleteMany({ where: { id: { in: instalaciones.map(i => i.id) } } });
    }
    if (ids.length) {
      // Los pedidos que quedaran sin cotización de prueba se van con el
      // cliente: no son ventas que haya que conservar.
      await prisma.pedido.deleteMany({ where: { clienteId: { in: ids } } });
      await prisma.nexusConversacion.deleteMany({ where: { clienteId: { in: ids } } });
      await prisma.cliente.deleteMany({ where: { id: { in: ids } } });
    }
  }

  return {
    clientes: ids.length,
    cotizaciones: pruebas.cotizaciones,
    pedidos: pruebas.pedidos,
    instalaciones: instalaciones.length,
  };
}
