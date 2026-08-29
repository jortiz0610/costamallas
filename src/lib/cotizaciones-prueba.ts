// ============================================================
// Cotizaciones de PRUEBA.
//
// Sirven para que alguien pueda ensayar el flujo completo —crear, enviar,
// aprobar, ver el pipeline— sin ensuciar el negocio. Hasta ahora la única
// forma de probar era crear una oferta de verdad, que quemaba un número
// del consecutivo real y aparecía en el embudo como plata en juego.
//
// Tres reglas, y las tres importan:
//
//   1. **Numeración aparte.** `PRUEBA-001`, con su propio contador. El
//      consecutivo de COT viene de SIIGO (va por el 12075) y quemar
//      números ahí para ensayar es exactamente lo que no se quiere.
//   2. **Fuera de todo lo que cuenta.** Informes, embudo, pipeline y
//      dashboard filtran `esPrueba: false`. Una prueba que aparece en la
//      cifra de ventas es peor que no poder probar.
//   3. **La marca se hereda.** El pedido que nace de una cotización de
//      prueba es una prueba. Si no, el ensayo se cuela por la puerta de
//      atrás en cuanto alguien aprueba.
//
// Quién las crea: quien tenga `crm.cotizaciones.prueba`, que por defecto
// es solo el superadministrador.
// ============================================================

import { prisma } from "@/lib/prisma";

/** El contador propio. No se toca el de COT. */
const CLAVE_CONTADOR = "consecutivo_prueba";
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
  await prisma.$executeRaw`
    INSERT INTO configuracion (id, clave, valor, encrypted, descripcion, "updatedAt")
    VALUES (gen_random_uuid()::text, ${CLAVE_CONTADOR}, '0', false,
            'Contador de cotizaciones de prueba (numeracion aparte)', NOW())
    ON CONFLICT (clave) DO NOTHING
  `;

  const filas = await prisma.$queryRaw<{ valor: string }[]>`
    UPDATE configuracion
       SET valor = ((valor)::bigint + 1)::text,
           "updatedAt" = NOW()
     WHERE clave = ${CLAVE_CONTADOR}
       AND valor ~ '^[0-9]+$'
    RETURNING valor
  `;

  if (!filas.length) {
    throw new Error(
      `El contador de pruebas ("${CLAVE_CONTADOR}") tiene un valor inválido. Corrígelo en Configuración.`,
    );
  }

  return `${PREFIJO_PRUEBA}-${String(filas[0].valor).padStart(DIGITOS, "0")}`;
}

export interface ResumenBorradoPruebas {
  cotizaciones: number;
  pedidos: number;
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
export async function borrarPruebas(opciones?: { dry?: boolean }): Promise<ResumenBorradoPruebas> {
  const dry = opciones?.dry ?? false;

  const cotizaciones = await prisma.cotizacion.findMany({
    where: { esPrueba: true },
    select: { id: true, numero: true, pedidos: { select: { id: true } } },
  });

  const pedidosDeCotizacion = cotizaciones.flatMap(c => c.pedidos.map(p => p.id));
  // Y los pedidos marcados como prueba que ya no tienen cotización (por
  // ejemplo si la oferta se borró antes).
  const sueltos = await prisma.pedido.findMany({
    where: { esPrueba: true, id: { notIn: pedidosDeCotizacion.length ? pedidosDeCotizacion : ["-"] } },
    select: { id: true },
  });
  const pedidos = [...pedidosDeCotizacion, ...sueltos.map(p => p.id)];

  if (!dry && (cotizaciones.length || pedidos.length)) {
    // Los pedidos primero: si se borrara la cotización antes, su
    // `cotizacionId` quedaría en null (SetNull) y se perdería el vínculo
    // que permite encontrarlos.
    if (pedidos.length) await prisma.pedido.deleteMany({ where: { id: { in: pedidos } } });
    if (cotizaciones.length) {
      await prisma.cotizacion.deleteMany({ where: { id: { in: cotizaciones.map(c => c.id) } } });
    }
  }

  return {
    cotizaciones: cotizaciones.length,
    pedidos: pedidos.length,
    numeros: cotizaciones.map(c => c.numero),
  };
}
