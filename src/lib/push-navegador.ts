// ============================================================
// Suscribir ESTE navegador a los avisos con el portal cerrado.
//
// La diferencia con lo que ya había importa y hay que decirla en la
// pantalla, no solo aquí:
//
//   · **Permiso de notificaciones** (lo de antes): el aviso sale con la
//     pestaña abierta o en segundo plano. Si el navegador está cerrado,
//     no llega nada.
//   · **Suscripción push** (esto): el navegador queda registrado en el
//     servicio de push del sistema y el aviso llega aunque no haya nada
//     abierto. En el teléfono, con la app instalada, se comporta como un
//     WhatsApp.
//
// Lo segundo EXIGE lo primero: sin permiso no hay suscripción.
// ============================================================

/** Lo que puede pasar al intentar suscribir este aparato. */
export type EstadoPush =
  | "listo"           // suscrito
  | "sin-permiso"     // hay que pedirlo primero
  | "bloqueado"       // el usuario dijo que no
  | "no-configurado"  // el servidor no tiene claves VAPID
  | "no-soportado"    // navegador viejo, o iOS sin instalar la app
  | "error";

export function pushSoportado(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

/**
 * La clave VAPID viaja en base64url y `applicationServerKey` la quiere
 * como bytes. Sin esta conversión el navegador rechaza la suscripción
 * con un error que no dice nada útil.
 */
function base64UrlABytes(base64: string): Uint8Array {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(normal);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

/** ¿Está ya suscrito este navegador? */
export async function yaSuscrito(): Promise<boolean> {
  if (!pushSoportado()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return Boolean(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * Suscribe este navegador y guarda la suscripción en el portal.
 *
 * Da por hecho que el permiso ya está concedido: pedirlo es una acción
 * aparte porque el navegador solo deja preguntarlo una vez, y gastarlo
 * dentro de otra cosa es como se queda alguien sin poder activarlos.
 */
export async function suscribirEsteAparato(): Promise<EstadoPush> {
  if (!pushSoportado()) return "no-soportado";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "sin-permiso";

  try {
    const r = await fetch("/api/notificaciones/push");
    const j = await r.json();
    if (!j.success || !j.data?.disponible || !j.data?.clavePublica) return "no-configurado";

    const reg = await navigator.serviceWorker.ready;

    // Si ya hay una suscripción se reutiliza: volver a suscribirse
    // genera otro endpoint y deja el anterior vivo, así que la persona
    // acabaría recibiendo el mismo aviso dos veces en el mismo aparato.
    const sub = await reg.pushManager.getSubscription()
      ?? await reg.pushManager.subscribe({
        // Obligatorio en todos los navegadores modernos: no se admite
        // una suscripción que pueda usarse en silencio.
        userVisibleOnly: true,
        applicationServerKey: base64UrlABytes(j.data.clavePublica) as BufferSource,
      });

    const guardado = await fetch("/api/notificaciones/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    const gj = await guardado.json().catch(() => ({}));
    return gj?.success ? "listo" : "error";
  } catch {
    return "error";
  }
}

/** Da de baja este aparato, aquí y en el portal. */
export async function darDeBajaEsteAparato(): Promise<boolean> {
  if (!pushSoportado()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;

    // Primero se avisa al portal y después se cancela en el navegador.
    // Al revés, si lo segundo falla, quedaría una fila en la base
    // mandándole avisos a un endpoint que ya nadie escucha.
    await fetch("/api/notificaciones/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => undefined);

    return await sub.unsubscribe();
  } catch {
    return false;
  }
}
