// ============================================================
// COSTAMALLAS ERP — Doble autenticación (TOTP / Google Authenticator)
// Estado por usuario guardado en la tabla Configuracion (sin migración)
// El secreto se cifra con AES-256-GCM.
// ============================================================

import { generateSecret, generateURI, verifySync } from "otplib";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";

const ISSUER = "Costamallas ERP";
const claveDe = (userId: string) => `2fa:${userId}`;

function checkToken(token: string, secret: string): boolean {
  try { return verifySync({ strategy: "totp", token, secret }).valid; }
  catch { return false; }
}

interface TwoFAState { secret: string; enabled: boolean; }

export async function get2FA(userId: string): Promise<TwoFAState | null> {
  const row = await prisma.configuracion.findUnique({ where: { clave: claveDe(userId) } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.valor) as { secretEnc: string; enabled: boolean };
    return { secret: decrypt(parsed.secretEnc), enabled: parsed.enabled };
  } catch { return null; }
}

export async function is2FAEnabled(userId: string): Promise<boolean> {
  const s = await get2FA(userId);
  return !!s?.enabled;
}

async function save2FA(userId: string, state: TwoFAState) {
  const valor = JSON.stringify({ secretEnc: encrypt(state.secret), enabled: state.enabled });
  await prisma.configuracion.upsert({
    where: { clave: claveDe(userId) },
    create: { clave: claveDe(userId), valor, encrypted: true, descripcion: "Estado 2FA del usuario" },
    update: { valor },
  });
}

/** Genera un secreto nuevo (pendiente de confirmación) y devuelve el otpauth URL para el QR. */
export async function generar2FA(userId: string, email: string): Promise<{ secret: string; otpauth: string }> {
  const secret = generateSecret();
  await save2FA(userId, { secret, enabled: false });
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
  if (ok) await save2FA(userId, { secret: s.secret, enabled: true });
  return ok;
}

/** Desactiva y elimina el 2FA del usuario. */
export async function desactivar2FA(userId: string): Promise<void> {
  await prisma.configuracion.deleteMany({ where: { clave: claveDe(userId) } });
}
