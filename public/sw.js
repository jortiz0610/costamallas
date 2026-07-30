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
