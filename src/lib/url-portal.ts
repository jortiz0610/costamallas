// ============================================================
// A qué dirección apuntan los enlaces que genera el servidor.
//
// ⚠️ Esto existe por un fallo concreto y caro: `NEXT_PUBLIC_APP_URL`
// está configurada en Vercel como **https://costamallas.com**, que es
// la TIENDA, no el portal. Media docena de sitios la usaban para armar
// enlaces a páginas de esta misma aplicación, así que producían
// direcciones que caen en WordPress y dan 404:
//
//   · el enlace de la cotización en el correo de "Enviar"
//   · el enlace en los tres toques del seguimiento
//   · la dirección a la que el widget de la web le habla (el agente
//     llamaba a costamallas.com/api/public/agente → 404)
//   · el <script> que se le dice a gerencia que pegue en WordPress
//   · la URL del webhook de los canales de Nexus
//
// Nadie lo había visto porque la pantalla de la cotización arma su
// enlace en el navegador con `window.location.origin` —que sí es el
// portal— y porque el correo nunca ha llegado a salir: falta el SMTP.
//
// La regla correcta y aburrida: estos enlaces apuntan a páginas que
// sirve ESTA aplicación, así que la única fuente fiable es el origen de
// la petición que está corriendo. `NEXT_PUBLIC_APP_URL` no se usa aquí
// a propósito; su valor es el de la tienda y cambiarlo podría romper
// otras cosas que sí esperan ese valor.
// ============================================================

/** Dominio del portal en producción. Último recurso, cuando no hay petición. */
const PORTAL = "https://portal.costamallas.com";

/**
 * La dirección base del portal, sin barra final.
 *
 * Con una petición a la mano, se saca de sus cabeceras: quien sirve esa
 * petición es el portal, así que es imposible equivocarse. Sin petición
 * (la corrida diaria, por ejemplo) se usa `PORTAL_URL` si está puesta y,
 * si no, el dominio de producción.
 */
export function urlPortal(req?: { headers: Headers; url: string }): string {
  if (req) {
    // Detrás de Vercel el host real viene en x-forwarded-host; `host` a
    // secas puede ser el interno.
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
    try {
      return new URL(req.url).origin;
    } catch {
      // Cae al valor de abajo.
    }
  }

  const env = (process.env.PORTAL_URL ?? "").trim().replace(/\/$/, "");
  return /^https?:\/\//.test(env) ? env : PORTAL;
}

/**
 * La dirección desde la que se le sirve la COTIZACIÓN al cliente.
 *
 * Se decidió que las ofertas viven en `cotizacion.costamallas.com` y no
 * en el portal. El motivo no es estético: lo que se le manda a un
 * cliente por correo o WhatsApp es un enlace, y un enlace a
 * `portal.costamallas.com` invita a curiosear el portal interno. Un
 * subdominio dedicado deja claro que ahí solo hay una cosa: su oferta.
 *
 * Hasta que el dominio esté conectado en Vercel esto devuelve el portal,
 * exactamente igual que hoy. En cuanto se cargue `COTIZACION_URL` en
 * Vercel, TODOS los enlaces del seguimiento y de los correos pasan a
 * usarlo sin tocar una línea de código.
 *
 * ⚠️ NO se usa el host de la petición aquí, al revés que en
 * `urlPortal()`: estos enlaces se arman casi siempre en la corrida
 * diaria, donde no hay petición, y los pocos que se arman con una
 * petición vienen del portal — que es justo el host que NO queremos
 * pegarle al cliente.
 */
export function urlCotizacion(): string {
  const env = (process.env.COTIZACION_URL ?? "").trim().replace(/\/$/, "");
  return /^https?:\/\//.test(env) ? env : urlPortal();
}

/** El enlace completo de una oferta, tal como lo recibe el cliente. */
export function enlaceCotizacion(publicId: string | null | undefined): string {
  return publicId ? `${urlCotizacion()}/cotizacion/${publicId}` : "";
}
