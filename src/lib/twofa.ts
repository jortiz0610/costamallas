// ============================================================
// COSTAMALLAS ERP — Doble autenticación (TOTP / Google Authenticator)
// Estado por usuario guardado en la tabla Configuracion (sin migración)
// El secreto se cifra con AES-256-GCM.
// ============================================================

import { generateSecret, generateURI, verifySync } from "otplib";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const ISSUER = "Costamallas ERP";
const claveDe = (userId: string) => `2fa:${userId}`;

// ── Dispositivos confiables: el 2FA solo se pide en dispositivos nuevos y se vuelve a pedir cada 7 días ──
const TRUST_COOKIE = "cm_2fa_trust";
const TRUST_DAYS = 7;
function jwtSecret() { return new TextEncoder().encode(process.env.JWT_SECRET ?? ""); }

export async function dispositivoConfiable(userId: string): Promise<boolean> {
  try {
    const c = (await cookies()).get(TRUST_COOKIE)?.value;
    if (!c) return false;
    const { payload } = await jwtVerify(c, jwtSecret());
    return payload.sub === userId && payload.type === "2fa-trust";
  } catch { return false; }
}

export async function recordarDispositivo(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId, type: "2fa-trust" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(`${TRUST_DAYS}d`).sign(jwtSecret());
  (await cookies()).set(TRUST_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * TRUST_DAYS,
  });
}

function checkToken(token: string, secret: string): boolean {
  try { return verifySync({ strategy: "totp", token, secret }).valid; }
  catch { return false; }
}

interface TwoFAState { secret: string; enabled: boolean; required: boolean; }

export async function get2FA(userId: string): Promise<TwoFAState | null> {
  const row = await prisma.configuracion.findUnique({ where: { clave: claveDe(userId) } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valor) as { secretEnc: string; enabled: boolean; required?: boolean };
    return { secret: decrypt(parsed.secretEnc), enabled: parsed.enabled, required: !!parsed.required };
  } catch { return null; }
}

export async function is2FAEnabled(userId: string): Promise<boolean> {
  const s = await get2FA(userId);
  return !!s?.enabled;
}

/** 2FA exigido por un admin pero aún no configurado por el usuario. */
export async function is2FARequerido(userId: string): Promise<boolean> {
  const s = await get2FA(userId);
  return !!s?.required && !s?.enabled;
}

async function save2FA(userId: string, state: TwoFAState) {
  const valor = JSON.stringify({ secretEnc: encrypt(state.secret), enabled: state.enabled, required: state.required });
  await prisma.configuracion.upsert({
    where: { clave: claveDe(userId) },
    create: { clave: claveDe(userId), valor, encrypted: true, descripcion: "Estado 2FA del usuario" },
    update: { valor },
  });
}

/** Un admin EXIGE 2FA: genera el secreto (pendiente). El usuario lo configura en su próximo acceso. */
export async function requerir2FA(userId: string): Promise<void> {
  const s = await get2FA(userId);
  if (s?.enabled) return; // ya está activo
  const secret = s?.secret ?? generateSecret();
  await save2FA(userId, { secret, enabled: false, required: true });
}

/** otpauth URL para que el usuario escanee el QR en el setup. */
export async function otpauthDe(userId: string, email: string): Promise<string | null> {
  const s = await get2FA(userId);
  if (!s) return null;
  return generateURI({ strategy: "totp", issuer: ISSUER, label: email, secret: s.secret });
}

/** Genera un secreto nuevo (pendiente de confirmación) y devuelve el otpauth URL para el QR. */
export async function generar2FA(userId: string, email: string): Promise<{ secret: string; otpauth: string }> {
  const secret = generateSecret();
  await save2FA(userId, { secret, enabled: false, required: true });
  const otpauth = generateURI({ strategy: "totp", issuer: ISSUER, label: email, secret });
  return { secret, otpauth };
}

/** Verifica un código de 6 dígitos contra el secreto guardado. */
export async function verificar2FA(userId: string, codigo: string): Promise<boolean> {
  const s = await get2FA(userId);
  if (!s) return false;
  return checkToken(codigo.replace(/\s/g, ""), s.secret);
}

/** Activa el 2FA tras verificar el primer código. */
export async function activar2FA(userId: string, codigo: string): Promise<boolean> {
  const s = await get2FA(userId);
  if (!s) return false;
  const ok = checkToken(codigo.replace(/\s/g, ""), s.secret);
  if (ok) await save2FA(userId, { secret: s.secret, enabled: true, required: s.required });
  return ok;
}

/** Desactiva y elimina el 2FA del usuario. */
export async function desactivar2FA(userId: string): Promise<void> {
  await prisma.configuracion.deleteMany({ where: { clave: claveDe(userId) } });
}
