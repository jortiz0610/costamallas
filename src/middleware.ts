// ============================================================
// COSTAMALLAS ERP — Middleware de autenticación y seguridad
// Protege todas las rutas del dashboard
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { esLectura, esEscape } from "@/lib/rol-prueba";

// /api/cron y /api/mantenimiento: la propia ruta valida el CRON_SECRET
//   (Vercel Cron no envía cookie de sesión, y las tareas de
//   mantenimiento se disparan igual, con el mismo bearer). Ojo: pasar
//   por aquí NO las hace públicas — las dos exigen CRON_SECRET o sesión
//   de administrador dentro de la ruta.
// /cotizacion: la cotización que se le comparte al cliente. Es pública a
//   propósito, pero se llega por un token largo, no por el id.
// /politicas: envíos, devoluciones y tratamiento de datos. Tiene que
//   poder leerse sin cuenta — se enlaza desde la cotización del cliente —
//   y no lleva datos de nadie.
const PUBLIC_PATHS = [
  "/login", "/api/auth/login", "/cotizar", "/api/public",
  "/api/marketing/oauth", "/api/cron", "/api/mantenimiento", "/cotizacion", "/politicas",
];
const API_RATE_LIMIT = 200;

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ── Rate limiting en todas las rutas API ──
  if (pathname.startsWith("/api/")) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const limit = rateLimit(`${ip}:${pathname}`, API_RATE_LIMIT);

    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: "Demasiadas solicitudes. Intenta más tarde." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(API_RATE_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  // ── Rutas públicas ────────────────────────
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic) return NextResponse.next();

  // ── Verificar autenticación ───────────────
  const user = await getUserFromRequest(req);

  // ── Modo prueba: SOLO LECTURA ─────────────
  // El bloqueo va AQUÍ, y no en cada ruta, porque este es el único sitio
  // por el que pasan todas. Si mañana alguien agrega un POST nuevo, ya
  // queda cubierto sin acordarse de nada. Protegerlo ruta por ruta falla
  // el día que a alguien se le olvide una — y ese día se guardan datos
  // que nadie quería guardar.
  if (user?.rolPrueba && !esLectura(req.method) && !esEscape(pathname)) {
    return NextResponse.json(
      {
        success: false,
        error: `Estás viendo el portal como ${user.rol}. Es modo de prueba: no se guarda nada. Sal del modo prueba para hacer cambios.`,
        rolPrueba: true,
      },
      { status: 403 },
    );
  }

  // Ruta API sin autenticación → 401
  if (pathname.startsWith("/api/")) {
    if (!user) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Inyectar datos del usuario en headers para las API routes
    const headers = new Headers(req.headers);
    headers.set("x-user-id", user.sub);
    headers.set("x-user-email", user.email);
    headers.set("x-user-rol", user.rol);
    if (user.rolPrueba) headers.set("x-rol-prueba", "1");

    return NextResponse.next({ request: { headers } });
  }

  // Ruta de página sin autenticación → redirigir a login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Se excluyen los assets estáticos y los archivos de la PWA.
    // Los de la PWA son obligatorios: el navegador pide el manifest y el
    // service worker SIN cookie de sesión, así que si el middleware los
    // redirige a /login la app no se puede instalar ni funciona offline.
    "/((?!_next/static|_next/image|favicon.ico|favicon.png|images|fonts|icons|sw\\.js|offline\\.html|manifest\\.webmanifest|robots\\.txt).*)",
  ],
};
