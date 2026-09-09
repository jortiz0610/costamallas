/* ============================================================
 * Costamallas ERP — Service Worker
 *
 * Este es un ERP con datos en vivo y sesión autenticada, así que la
 * estrategia es DELIBERADAMENTE conservadora:
 *
 *   · /api/**            → solo red. Nunca se cachea. Cachear una
 *                          respuesta de API significaría mostrar stock,
 *                          precios o pedidos viejos como si fueran
 *                          actuales, o servirle a un usuario datos
 *                          cacheados de la sesión de otro.
 *   · /_next/static, /icons → cache-first. Son archivos con hash o
 *                          inmutables; no cambian sin cambiar de nombre.
 *   · navegaciones        → red primero, y si no hay conexión se muestra
 *                          /offline.html.
 *
 * Al cambiar VERSION se descarta toda la caché anterior.
 * ============================================================ */

const VERSION = "cm-v1";
const CACHE_ESTATICO = `${VERSION}-estatico`;
const CACHE_PAGINAS = `${VERSION}-paginas`;

/** Mínimo para que la app arranque sin red. */
const PRECARGA = ["/offline.html", "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      .then((cache) => cache.addAll(PRECARGA))
      // Si un archivo de la precarga falla, la instalación no debe abortar.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Permite que el botón "Recargar" del portal limpie la caché de páginas. */
self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "LIMPIAR_CACHE") {
    evento.waitUntil(caches.delete(CACHE_PAGINAS));
  }
});

function esEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  const url = new URL(req.url);

  // Solo GET y solo nuestro propio origen.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Las APIs y la autenticación nunca pasan por caché.
  if (url.pathname.startsWith("/api/")) return;

  // Estáticos con hash: cache-first.
  if (esEstatico(url)) {
    evento.respondWith(
      caches.match(req).then(
        (enCache) =>
          enCache ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE_ESTATICO).then((c) => c.put(req, copia));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navegaciones (HTML): red primero, caché como respaldo, y si nada
  // funciona, la página de sin conexión.
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE_PAGINAS).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((enCache) => enCache || caches.match("/offline.html")),
        ),
    );
  }
});

/* ============================================================
 * AVISOS CON EL PORTAL CERRADO
 *
 * Esto es lo que hace que un aviso llegue cuando no hay ninguna
 * pestaña abierta. El navegador despierta al service worker, le
 * entrega el mensaje ya descifrado, y él lo muestra.
 *
 * El contenido viaja cifrado de extremo a extremo: el servicio de
 * push (Google, Apple, Mozilla) transporta el sobre pero no puede
 * leerlo. Aun así aquí NO se manda nada sensible — el aviso dice
 * "aprobaron COT-12076", no el valor ni los datos del cliente. Un
 * aviso se ve en la pantalla de bloqueo, delante de cualquiera.
 * ============================================================ */

self.addEventListener("push", (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch {
    // Un push sin cuerpo o con basura no puede dejar al usuario sin
    // aviso: se muestra uno genérico y que abra el portal.
    d = {};
  }

  const titulo = d.titulo || "Costamallas";
  const opciones = {
    body: d.mensaje || "Tienes un aviso nuevo en el portal.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Con la misma etiqueta, el aviso nuevo REEMPLAZA al anterior en
    // vez de apilarse. Tres avisos de la misma cotización son tres
    // veces el mismo aviso.
    tag: d.etiqueta || undefined,
    renotify: Boolean(d.etiqueta),
    data: { url: d.url || "/" },
  };

  // waitUntil es obligatorio: sin él el navegador puede dormir al
  // worker antes de que el aviso llegue a mostrarse.
  evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si el portal ya está abierto en alguna ventana, se reutiliza y
      // se navega ahí. Abrir una pestaña nueva cada vez deja al usuario
      // con seis copias del portal al final del día.
      for (const v of ventanas) {
        if (v.url.includes(self.location.origin) && "focus" in v) {
          v.focus();
          if ("navigate" in v) return v.navigate(destino);
          return;
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
