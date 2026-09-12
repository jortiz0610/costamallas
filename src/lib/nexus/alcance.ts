// ============================================================
// Quién puede ver qué conversación.
//
// Existe porque la regla estaba escrita DOS veces y las dos copias no
// decían lo mismo:
//
//   · El listado (`/api/nexus/conversaciones`) filtraba con cuidado:
//     un asesor solo veía las suyas.
//
//   · El historial (`/api/nexus/mensajes`) no filtraba nada. Con el id
//     de una conversación —que viaja en la URL— cualquiera con sesión
//     iniciada se leía el hilo entero de otro, y de paso se lo marcaba
//     como leído al que sí la estaba atendiendo.
//
// Una regla de acceso repetida es una regla que tarde o temprano se
// aplica en un sitio y en el otro no. Aquí está una sola vez.
//
// LO QUE CAMBIA ADEMÁS: las conversaciones SIN ASIGNAR pasan a verse.
// Antes el filtro era `asignadoId = yo`, y un chat nuevo de la web nace
// sin dueño (`agente-web` solo asigna si quien escribe ya es cliente de
// alguien). Resultado: el lead nuevo —lo único que de verdad corre
// prisa— era invisible para todo el que no fuera administrador, y se
// quedaba ahí hasta que un administrador lo repartía. Ahora cae en la
// bandeja de todos, y el primero que lo toma se lo asigna con «Es tuya».
// ============================================================

import { esAdmin } from "@/lib/permisos";

interface UsuarioSesion {
  sub: string;
  rol?: string;
}

/**
 * El `where` de Prisma que limita las conversaciones a las que esta
 * persona puede ver. Para un administrador, no limita nada.
 */
export function filtroConversaciones(user: UsuarioSesion): Record<string, unknown> {
  if (esAdmin(user.rol)) return {};
  return { OR: [{ asignadoId: user.sub }, { asignadoId: null }] };
}

/** La misma regla, aplicada a una conversación concreta ya cargada. */
export function puedeVerConversacion(
  user: UsuarioSesion,
  conv: { asignadoId: string | null },
): boolean {
  if (esAdmin(user.rol)) return true;
  return conv.asignadoId === null || conv.asignadoId === user.sub;
}

/**
 * Los estados que cuentan como «hay trabajo aquí».
 *
 * El contador de sin leer miraba solo ABIERTA, así que un mensaje nuevo
 * en una conversación que alguien ya había tomado (EN_PROCESO) no subía
 * el contador ni encendía la campana: justo el caso en el que hay un
 * cliente esperando a una persona concreta.
 */
export const ESTADOS_ACTIVOS = ["ABIERTA", "EN_PROCESO"];
