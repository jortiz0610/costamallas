// ============================================================
// COSTAMALLAS ERP — Autenticación JWT con httpOnly cookies
// ============================================================

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { JWTPayload, Rol } from "@/types";

const COOKIE_NAME = "cm_token";
const COOKIE_NAME_REFRESH = "cm_refresh";

function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET no definida o demasiado corta (mínimo 32 caracteres)");
  }
  return new TextEncoder().encode(secret);
}

// ── Generar tokens ────────────────────────────

export async function signAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "7d")
    .setIssuer("costamallas-erp")
    .setAudience("costamallas-erp-client")
    .sign(getJWTSecret());
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN ?? "30d")
    .setIssuer("costamallas-erp")
    .sign(getJWTSecret());
}

// ── Verificar tokens ──────────────────────────

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret(), {
      issuer: "costamallas-erp",
      audience: "costamallas-erp-client",
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret(), {
      issuer: "costamallas-erp",
    });
    if (payload.type !== "refresh") return null;
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ── Cookies httpOnly ──────────────────────────

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  cookieStore.set(COOKIE_NAME_REFRESH, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/refresh",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(COOKIE_NAME_REFRESH);
}

// ── Obtener usuario actual ─────────────────────

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export function getTokenFromRequest(req: NextRequest): string | null {
  // 1. Primero httpOnly cookie
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie) return cookie;

  // 2. Fallback: Authorization header (para llamadas API server-to-server)
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  return null;
}

/**
 * El usuario de la petición. Su rol es el suyo y punto.
 *
 * Aquí vivía "ver el portal como…": una cookie que le cambiaba el rol al
 * superadministrador para que pudiera mirar el portal con otros ojos.
 * Se quitó el 29-ago. Funcionaba, pero el precio era alto para lo que
 * daba: una sesión cuyo rol dependía de una cookie, un bloqueo de
 * escrituras en el middleware para todo el portal, y el fallo probable
 * —dejarse el modo puesto y creer que el portal está roto— pegado a la
 * sesión de quien más permisos tiene.
 *
 * Lo reemplaza una PREVISUALIZACIÓN en Usuarios y Roles: se ve el menú
 * que le queda a esa persona sin cambiarle el rol a nadie y sin tocar la
 * sesión. Es lo que se quería mirar, sin nada de lo que costaba.
 */
export async function getUserFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return await verifyAccessToken(token);
}

// ── Guards de roles ────────────────────────────

export function hasRole(user: JWTPayload, ...roles: Rol[]): boolean {
  return roles.includes(user.rol);
}

/**
 * ¿Puede hacer cosas de administración?
 *
 * ⚠️ Antes comparaba solo con `ADMIN` y dejaba fuera a `SUPERADMIN`, que
 * es el rol MÁS alto. El resultado era absurdo: el superadministrador no
 * podía sincronizar con la tienda, exportar, borrar un producto ni tocar
 * los catálogos, y el mensaje que recibía era "Solo Admin".
 *
 * Se mantiene el nombre y la firma para no tocar las siete rutas que ya
 * lo usan, pero delega en `esAdmin()` de `lib/permisos.ts`, que es la
 * jerarquía real y la que usa el resto del sistema.
 */
export function isAdmin(user: JWTPayload): boolean {
  return user.rol === "ADMIN" || user.rol === "SUPERADMIN";
}

export function canWrite(user: JWTPayload): boolean {
  // Todos pueden escribir excepto los de solo lectura
  return user.rol !== "SOLO_LECTURA";
}
