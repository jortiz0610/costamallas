// ============================================================
// Permisos: el lado que toca la base de datos.
//
// `lib/permisos.ts` es puro cálculo y sirve igual en el navegador. Aquí
// vive lo único que necesita servidor: leer las EXCEPCIONES de una
// persona y ofrecer un guardián para las route handlers.
//
// ⚠️ Ocultar un enlace del menú no es un permiso: es presentación.
// Cualquiera puede escribir la URL a mano o llamar la API con `fetch`.
// El permiso de verdad es este archivo, llamado desde la route handler.
// ============================================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  permisosEfectivos,
  type ExcepcionesPermisos,
} from "@/lib/permisos";

/**
 * Las excepciones guardadas de una persona.
 *
 * Sin caché a propósito: son pocas filas, indexadas por usuario, y una
 * caché aquí significaría que quitarle un permiso a alguien no surte
 * efecto hasta que expire — que es exactamente el momento en el que uno
 * quiere que surta efecto ya.
 */
export async function excepcionesDe(usuarioId: string): Promise<ExcepcionesPermisos> {
  const filas = await prisma.permisoUsuario.findMany({
    where: { usuarioId },
    select: { clave: true, permitido: true },
  });
  return Object.fromEntries(filas.map(f => [f.clave, f.permitido]));
}

/**
 * Lo que esta persona puede, de verdad.
 *
 * `rolPrueba` (el superadministrador viéndose como otro rol) usa SOLO el
 * juego por defecto del rol: las excepciones son ajustes personales de
 * otra gente, y mezclarlas mostraría un portal que no le corresponde a
 * nadie.
 */
export async function permisosDe(
  usuarioId: string,
  rol: string,
  rolPrueba = false,
): Promise<Set<string>> {
  if (rolPrueba) return permisosEfectivos(rol);
  return permisosEfectivos(rol, await excepcionesDe(usuarioId));
}

/** Los datos que el middleware inyecta en cada petición autenticada. */
export function usuarioDeCabeceras(req: NextRequest | Request) {
  const h = req.headers;
  return {
    id: h.get("x-user-id") ?? "",
    email: h.get("x-user-email") ?? "",
    rol: h.get("x-user-rol") ?? "",
    rolPrueba: h.get("x-rol-prueba") === "1",
  };
}

/** ¿Esta petición tiene el permiso `clave`? */
export async function peticionPuede(
  req: NextRequest | Request,
  clave: string,
): Promise<boolean> {
  const u = usuarioDeCabeceras(req);
  if (!u.id || !u.rol) return false;
  return (await permisosDe(u.id, u.rol, u.rolPrueba)).has(clave);
}

/**
 * Guardián para route handlers. Devuelve `null` si puede seguir, o la
 * respuesta 403 ya armada si no.
 *
 *     const no = await exigirPermiso(req, "erp.productos.editar");
 *     if (no) return no;
 */
export async function exigirPermiso(
  req: NextRequest | Request,
  clave: string,
): Promise<NextResponse | null> {
  if (await peticionPuede(req, clave)) return null;
  return NextResponse.json(
    {
      success: false,
      error: "No tienes permiso para esta acción. Pídeselo a un administrador.",
      permisoFaltante: clave,
    },
    { status: 403 },
  );
}
