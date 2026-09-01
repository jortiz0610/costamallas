// ============================================================
// Modo CAPACITACIÓN.
//
// La idea: marcar UN cliente como cliente de prueba y poder hacerle
// absolutamente todo —cotizar, enviar, aprobar, agendar una visita,
// convertir en pedido, instalar, firmar el acta, facturar— igual que a
// uno real, para enseñarle el portal a alguien sin ensuciar el negocio.
//
// Antes esto era una casilla en la cotización, y por eso se moría ahí: el
// pedido nacía marcado, pero el pipeline y la lista de pedidos escondían
// lo de prueba, así que **no había dónde seguir el proceso**. Quien
// intentaba capacitar llegaba a "cotización enviada" y se quedaba mirando
// una pantalla que ya no mostraba su ensayo.
//
// Cuatro reglas, y las cuatro importan:
//
//   1. **La marca empieza en el cliente y se hereda hacia abajo.** Todo
//      lo que cuelgue de un cliente de capacitación nace marcado. Nadie
//      tiene que acordarse de tildar nada en cada paso.
//   2. **Numeración aparte.** `PRUEBA-001` para ofertas y
//      `PRUEBA-PED-001` para pedidos, cada uno con su contador. El
//      consecutivo de COT viene de SIIGO (va por el 12075) y quemar
//      números ahí para ensayar es exactamente lo que no se quiere.
//   3. **Fuera de todo lo que cuenta.** Informes, embudo y dashboard
//      filtran `esPrueba: false`. Una prueba en la cifra de ventas es
//      peor que no poder probar. Pero el pipeline y los pedidos **sí las
//      muestran** cuando se pide, porque ahí es donde se capacita.
//   4. **Se borra todo de una.** Un cliente de capacitación y su rastro
//      entero se van juntos cuando la formación termina.
//
// Quién marca un cliente como de capacitación: quien tenga
// `crm.cotizaciones.prueba`. Trabajar CON él no pide permiso: si el
// cliente ya está marcado, cualquiera puede practicar sobre él.
// ============================================================

import { prisma } from "@/lib/prisma";

/** Los contadores propios. No se toca ni el de COT ni el de PED. */
const CLAVE_CONTADOR = "consecutivo_prueba";
const CLAVE_CONTADOR_PED = "consecutivo_prueba_ped";
export const PREFIJO_PRUEBA = "PRUEBA";
const DIGITOS = 3;

/**
 * Filtro para todo lo que cuenta como negocio real.
 *
 * Se exporta como objeto para poder esparcirlo en un `where` de Prisma
 * sin que cada consulta tenga que acordarse del nombre de la columna:
 *
 *     where: { ...SIN_PRUEBAS, estado: "APROBADA" }
 */
export const SIN_PRUEBAS = { esPrueba: false } as const;

/** ¿Este número es de una cotización de prueba? */
export function esNumeroDePrueba(numero: string): boolean {
  return numero.startsWith(`${PREFIJO_PRUEBA}-`);
}

/**
 * Siguiente número de prueba, con incremento atómico.
 *
 * Misma técnica que `lib/consecutivos.ts` —un UPDATE que lee y escribe en
 * la misma sentencia— pero con contador propio y sin sembrar desde la
 * tabla: las pruebas empiezan en 1 aunque haya 12.075 cotizaciones reales.
 */
export async function siguienteNumeroPrueba(): Promise<string> {
  return contar(CLAVE_CONTADOR, PREFIJO_PRUEBA);
}

/**
 * Siguiente número de PEDIDO de prueba.
 *
 * Antes, aprobar una cotización de ensayo llamaba a `siguienteNumeroSeguro("PED")`
 * y quemaba un número del consecutivo real. Nadie lo notaba hasta que
 * faltaba un PED en la contabilidad.
 */
export async function siguienteNumeroPruebaPedido(): Promise<string> {
  return contar(CLAVE_CONTADOR_PED, `${PREFIJO_PRUEBA}-PED`);
}

/** ¿Este cliente es de capacitación? Lo consultan los que crean documentos. */
export async function clienteEsDePrueba(clienteId: string | null | undefined): Promise<boolean> {
  if (!clienteId) return false;
  const c = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { esPrueba: true },
  });
  return c?.esPrueba === true;
}

async function contar(clave: string, prefijo: string): Promise<string> {
  await prisma.$executeRaw`
    INSERT INTO configuracion (id, clave, valor, encrypted, descripcion, "updatedAt")
    VALUES (gen_random_uuid()::text, ${clave}, '0', false,
            'Contador de documentos de prueba (numeracion aparte)', NOW())
    ON CONFLICT (clave) DO NOTHING
  `;

  const filas = await prisma.$queryRaw<{ valor: string }[]>`
    UPDATE configuracion
       SET valor = ((valor)::bigint + 1)::text,
           "updatedAt" = NOW()
     WHERE clave = ${clave}
       AND valor ~ '^[0-9]+$'
    RETURNING valor
  `;

  if (!filas.length) {
    throw new Error(
      `El contador de pruebas ("${clave}") tiene un valor inválido. Corrígelo en Configuración.`,
    );
  }

  return `${prefijo}-${String(filas[0].valor).padStart(DIGITOS, "0")}`;
}

export interface ResumenBorradoPruebas {
  clientes: number;
  cotizaciones: number;
  pedidos: number;
  instalaciones: number;
  facturas: number;
  numeros: string[];
}

/**
 * Borra TODAS las cotizaciones de prueba y lo que nació de ellas.
 *
 * `dry` cuenta sin borrar, para poder decir "se van a borrar 7" antes de
 * que alguien confirme.
 *
 * Los pedidos de prueba se borran de verdad, al contrario de lo que pasa
 * con una cotización real: un pedido de mentira no es una venta que haya
 * que conservar.
 */
export async function borrarPruebas(opciones?: {
  dry?: boolean;
  /** Limitar a un solo cliente de capacitación, en vez de a todos. */
  clienteId?: string;
  /** Borrar también la ficha del cliente, no solo su rastro. */
  incluirCliente?: boolean;
}): Promise<ResumenBorradoPruebas> {
  const dry = opciones?.dry ?? false;
  const soloEste = opciones?.clienteId ? { clienteId: opciones.clienteId } : {};

  const clientes = await prisma.cliente.findMany({
    where: { esPrueba: true, ...(opciones?.clienteId ? { id: opciones.clienteId } : {}) },
    select: { id: true, nombre: true },
  });
  const idsCliente = clientes.map(c => c.id);

  // Todo lo del cliente de capacitación cuenta, esté marcado o no: si
  // algo se creó antes de que el cliente se marcara, sigue siendo parte
  // del ensayo y tiene que irse con él.
  const deEsosClientes = idsCliente.length ? [{ clienteId: { in: idsCliente } }] : [];

  const cotizaciones = await prisma.cotizacion.findMany({
    where: { OR: [{ esPrueba: true, ...soloEste }, ...deEsosClientes] },
    select: { id: true, numero: true, pedidos: { select: { id: true } } },
  });

  const pedidosDeCotizacion = cotizaciones.flatMap(c => c.pedidos.map(p => p.id));
  // Y los pedidos marcados como prueba que ya no tienen cotización (por
  // ejemplo si la oferta se borró antes).
  const sueltos = await prisma.pedido.findMany({
    where: {
      OR: [{ esPrueba: true, ...soloEste }, ...deEsosClientes],
      id: { notIn: pedidosDeCotizacion.length ? pedidosDeCotizacion : ["-"] },
    },
    select: { id: true },
  });
  const pedidos = [...new Set([...pedidosDeCotizacion, ...sueltos.map(p => p.id)])];

  // Las instalaciones cuelgan del pedido con onDelete: Cascade, así que
  // se van solas. Se cuentan igual para poder decir cuántas.
  const instalaciones = pedidos.length
    ? await prisma.instalacion.count({ where: { pedidoId: { in: pedidos } } })
    : 0;

  const facturas = await prisma.factura.findMany({
    where: { OR: [{ esPrueba: true, ...soloEste }, ...deEsosClientes] },
    select: { id: true },
  });

  if (!dry) {
    // Orden: primero lo que apunta hacia arriba.
    //
    // Las facturas van antes que el cliente porque la relación es
    // onDelete: Restrict — con una factura viva, borrar el cliente falla.
    if (facturas.length) await prisma.factura.deleteMany({ where: { id: { in: facturas.map(f => f.id) } } });
    // Los pedidos antes que las cotizaciones: al revés, el `cotizacionId`
    // quedaría en null (SetNull) y se perdería el vínculo para hallarlos.
    if (pedidos.length) await prisma.pedido.deleteMany({ where: { id: { in: pedidos } } });
    if (cotizaciones.length) {
      await prisma.cotizacion.deleteMany({ where: { id: { in: cotizaciones.map(c => c.id) } } });
    }
    if (opciones?.incluirCliente && idsCliente.length) {
      await prisma.cliente.deleteMany({ where: { id: { in: idsCliente } } });
    }
  }

  return {
    clientes: idsCliente.length,
    cotizaciones: cotizaciones.length,
    pedidos: pedidos.length,
    instalaciones,
    facturas: facturas.length,
    numeros: cotizaciones.map(c => c.numero),
  };
}
