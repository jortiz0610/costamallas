// ============================================================
// Borrar una cotización, y qué pasa con su número.
//
// LO QUE NO SE HACE: borrarla de verdad.
//
// Una oferta borrada de la base deja pedidos, seguimientos, encuestas y
// cifras del embudo apuntando al vacío. A los tres meses, cuando alguien
// pregunte por qué el mes de agosto cuadra distinto, no habrá forma de
// reconstruirlo. Así que se MARCA: desaparece de todas las pantallas
// menos de la del administrador, que la sigue viendo con su número, su
// fecha y quién la borró.
//
// EL NÚMERO — que es la parte con miga
// ------------------------------------
// El consecutivo de COT viene de SIIGO y va por el 12.000 y pico. Dos
// casos, y se comportan distinto a propósito:
//
//   · Era el ÚLTIMO número dado. Entonces se devuelve al contador: la
//     próxima oferta lo reutiliza. No se quema un número de SIIGO por un
//     borrador creado sin querer.
//
//   · Ya hay ofertas con números mayores. El número NO se puede
//     reutilizar sin dejar dos cotizaciones con el mismo consecutivo, y
//     eso en un documento contable no es un detalle. Se pierde, y se
//     queda como hueco — que es lo correcto: un hueco documentado es
//     mejor que un número repetido.
//
// En los dos casos el campo `numero` se cambia por un centinela para
// LIBERAR el índice único, y el número real se guarda en
// `numeroOriginal`. Si se dejara puesto, el contador nunca podría
// volver a entregarlo aunque quisiéramos.
// ============================================================

import { prisma } from "@/lib/prisma";
import { claveConsecutivo } from "@/lib/consecutivos";

export interface ResultadoBorrado {
  ok: boolean;
  error?: string;
  numero?: string;
  /** true = el número volvió al contador y se reutilizará. */
  numeroDevuelto?: boolean;
}

/** El centinela que ocupa el sitio de un número liberado. */
export const numeroDeBorrada = (id: string) => `BORRADA-${id}`;

export async function borrarCotizacion(
  cotizacionId: string,
  usuarioId: string,
  motivo?: string,
): Promise<ResultadoBorrado> {
  const cot = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: { id: true, numero: true, estado: true, borradaEn: true, esPrueba: true },
  });
  if (!cot) return { ok: false, error: "Esta cotización no existe." };
  if (cot.borradaEn) return { ok: false, error: "Esta cotización ya estaba borrada." };

  // Una oferta APROBADA ya generó pedido: borrarla dejaría el pedido
  // huérfano y las cifras del mes sin explicación. Se niega, y se dice
  // por qué en vez de "no se puede".
  if (cot.estado === "APROBADA") {
    return {
      ok: false,
      error: "Esta oferta está aprobada y ya generó un pedido. Anula el pedido primero: "
        + "borrarla aquí dejaría el pedido sin origen y el mes sin cuadrar.",
    };
  }

  // ¿Es el último número entregado? Se mira si existe alguna oferta VIVA
  // con un número mayor. Las borradas no cuentan: su número ya no ocupa.
  const mayores = await prisma.cotizacion.count({
    where: {
      borradaEn: null,
      id: { not: cot.id },
      numero: { gt: cot.numero },
      // Las de prueba llevan su propio contador (PRUEBA-001) y no deben
      // influir en el de COT, ni al revés.
      esPrueba: cot.esPrueba,
    },
  });
  const eraElUltimo = mayores === 0;

  await prisma.$transaction(async (tx) => {
    await tx.cotizacion.update({
      where: { id: cot.id },
      data: {
        borradaEn: new Date(),
        borradaPorId: usuarioId,
        borradaMotivo: motivo?.trim().slice(0, 300) || null,
        numeroOriginal: cot.numero,
        // Liberar el índice único. Sin esto el contador no podría volver
        // a entregar ese número ni aunque fuera el último.
        numero: numeroDeBorrada(cot.id),
      },
    });

    // Devolver el número al contador SOLO si era el último. El contador
    // guarda el último entregado, así que restarle uno hace que la
    // próxima oferta reciba justo el que se acaba de liberar.
    if (eraElUltimo && !cot.esPrueba) {
      const fila = await tx.configuracion.findUnique({
        where: { clave: claveConsecutivo("COT") },
        select: { valor: true },
      });
      const actual = Number(fila?.valor);
      if (Number.isFinite(actual) && actual > 0) {
        await tx.configuracion.update({
          where: { clave: claveConsecutivo("COT") },
          data: { valor: String(actual - 1) },
        });
      }
    }
  });

  await prisma.log.create({
    data: {
      usuarioId,
      accion: "COTIZACION_BORRADA",
      detalle: `${cot.numero}${eraElUltimo ? " (número devuelto al contador)" : " (número perdido: había ofertas posteriores)"}`
        + (motivo ? ` — ${motivo.slice(0, 120)}` : ""),
      resultado: "OK",
    },
  }).catch(() => undefined);

  return { ok: true, numero: cot.numero, numeroDevuelto: eraElUltimo };
}

/**
 * Deshace un borrado.
 *
 * Existe porque borrar es la acción más fácil de lamentar, y porque el
 * número original está guardado: si nadie lo ha tomado, se recupera tal
 * cual. Si ya lo tomó otra oferta —pasa cuando era el último y el
 * contador lo reutilizó— se restaura con un número nuevo, y se dice.
 */
export async function restaurarCotizacion(
  cotizacionId: string,
  usuarioId: string,
): Promise<{ ok: boolean; error?: string; numero?: string; numeroCambiado?: boolean }> {
  const cot = await prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: { id: true, borradaEn: true, numeroOriginal: true, esPrueba: true },
  });
  if (!cot) return { ok: false, error: "Esta cotización no existe." };
  if (!cot.borradaEn) return { ok: false, error: "Esta cotización no está borrada." };

  const original = cot.numeroOriginal;
  if (!original) return { ok: false, error: "No se guardó el número original; no se puede restaurar." };

  const ocupado = await prisma.cotizacion.findFirst({
    where: { numero: original },
    select: { id: true },
  });

  let numero = original;
  let numeroCambiado = false;
  if (ocupado) {
    const { siguienteNumeroSeguro } = await import("@/lib/consecutivos");
    const { siguienteNumeroPrueba } = await import("@/lib/cotizaciones-prueba");
    numero = cot.esPrueba ? await siguienteNumeroPrueba() : await siguienteNumeroSeguro("COT");
    numeroCambiado = true;
  }

  await prisma.cotizacion.update({
    where: { id: cot.id },
    data: { borradaEn: null, borradaPorId: null, borradaMotivo: null, numero, numeroOriginal: null },
  });

  await prisma.log.create({
    data: {
      usuarioId,
      accion: "COTIZACION_RESTAURADA",
      detalle: `${numero}${numeroCambiado ? ` (el original ${original} ya estaba tomado)` : ""}`,
      resultado: "OK",
    },
  }).catch(() => undefined);

  return { ok: true, numero, numeroCambiado };
}
