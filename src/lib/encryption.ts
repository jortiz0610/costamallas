// ============================================================
// COSTAMALLAS ERP — Cifrado AES-256-GCM
// Usado para datos sensibles: API keys, secretos de WooCommerce
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY no definida en variables de entorno");

  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY debe tener ${KEY_LENGTH * 2} caracteres hex (got ${key.length})`);
  }
  return keyBuffer;
}

/**
 * Cifra texto con AES-256-GCM.
 * Retorna: iv:authTag:ciphertext en base64 separado por ":"
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Descifra un string cifrado con encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Formato de texto cifrado inválido");
  }

  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  if (iv.length !== IV_LENGTH) throw new Error("IV inválido");
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error("AuthTag inválido");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Comprueba si un string parece ser texto cifrado (formato iv:tag:data).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * Cifra solo si el valor no está ya cifrado.
 */
export function encryptIfNeeded(value: string): string {
  if (!value) return value;
  return isEncrypted(value) ? value : encrypt(value);
}

/**
 * Descifra solo si el valor está cifrado.
 */
export function decryptIfNeeded(value: string): string {
  if (!value) return value;
  return isEncrypted(value) ? decrypt(value) : value;
}
