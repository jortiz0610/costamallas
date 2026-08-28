// ============================================================
// "Ver el portal como…" — el superadministrador se pone otro rol.
//
// Para qué: la única forma de saber qué ve un vendedor era crearle un
// usuario, cerrar sesión, entrar con el suyo y volver. Nadie lo hace, y
// por eso los permisos se descubren rotos cuando se queja el vendedor.
//
// ⚠️ ES SOLO DE LECTURA, y eso no es una promesa de la pantalla: se
// impone en el middleware, que rechaza TODA petición que no sea GET
// mientras el modo esté activo. No hay que acordarse de proteger cada
// ruta nueva — si mañana alguien agrega un POST, ya está cubierto.
//
// ⚠️ La regla de seguridad que sostiene todo esto: el rol de prueba SOLO
// se aplica si el token real dice SUPERADMIN. La cookie por sí sola no
// da permisos; si la pone cualquier otro, se ignora. Sin eso, esto sería
// un ascenso a ADMIN al alcance de quien sepa abrir las herramientas del
// navegador.
//
// No toca la sesión ni el token: es una capa encima que se quita
// borrando una cookie.
// ============================================================

import type { Rol } from "@/types";

/** No es httpOnly a propósito: la pantalla necesita saber si está
 *  activo para pintar el aviso, y su valor no es un secreto — el
 *  permiso lo da el token, no esta cookie. */
export const COOKIE_ROL_PRUEBA = "cm_rol_prueba";

/**
 * Roles que se pueden probar.
 *
 * SUPERADMIN no está: probarse a uno mismo no enseña nada y además
 * dejaría el portal en solo lectura sin motivo.
 */
export const ROLES_PROBABLES: { rol: Rol; label: string; descripcion: string }[] = [
  { rol: "ADMIN", label: "Administrador", descripcion: "Todo menos las conexiones externas y la IA." },
  { rol: "VENDEDOR", label: "Vendedor", descripcion: "CRM y Nexus. Es lo que ven Elkin y Bleidis." },
  { rol: "PRODUCCION", label: "Producción", descripcion: "Catálogo y CRM, sin plata ni configuración." },
  { rol: "BODEGA", label: "Bodega", descripcion: "Solo el ERP: productos, stock y compras." },
  { rol: "USUARIO", label: "Usuario", descripcion: "Acceso básico a catálogo y CRM." },
  { rol: "SOLO_LECTURA", label: "Solo lectura", descripcion: "Lo ve todo, no puede tocar nada." },
  { rol: "CLIENTE", label: "Cliente", descripcion: "No entra al portal interno: la pantalla queda vacía a propósito." },
];

const VALIDOS = new Set<string>(ROLES_PROBABLES.map(r => r.rol));

/** ¿Es un rol que se pueda probar? Cualquier otra cosa se ignora. */
export function esRolProbable(valor: string | undefined | null): valor is Rol {
  return !!valor && VALIDOS.has(valor);
}

/**
 * Métodos que el modo prueba deja pasar.
 *
 * Navegar el portal es GET; todo lo que guarda algo no lo es. HEAD y
 * OPTIONS entran porque son parte de la navegación, no escrituras.
 */
const SOLO_LECTURA = new Set(["GET", "HEAD", "OPTIONS"]);
export const esLectura = (metodo: string) => SOLO_LECTURA.has(metodo.toUpperCase());

/**
 * Rutas que siguen aceptando POST con el modo activo.
 *
 * Son las imprescindibles para poder SALIR: si se bloquearan, el
 * superadministrador quedaría atrapado en el rol de prueba y tendría que
 * borrar cookies a mano.
 */
const ESCAPES = ["/api/auth/rol-prueba", "/api/auth/logout", "/api/auth/refresh"];
export const esEscape = (ruta: string) => ESCAPES.some(e => ruta === e || ruta.startsWith(e + "/"));
