// ============================================================
// COSTAMALLAS ERP — Middleware de autenticación y seguridad
// Protege todas las rutas del dashboard
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// /api/cron: la propia ruta valida el CRON_SECRET (Vercel Cron no envía cookie de sesión)
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/cotizar", "/api/public", "/api/marketing/oauth", "/api/cron"];
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
    "/((?!_next/static|_next/image|favicon.ico|images|fonts).*)",
  ],
};
