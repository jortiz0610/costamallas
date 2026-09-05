// ============================================================
// COSTAMALLAS ERP — Cifrado AES-256-GCM
// Usado para datos sensibles: API keys, secretos de WooCommerce
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Convierte una llave en hexadecimal al buffer que espera AES.
 *
 * Existe aparte de `getEncryptionKey` porque el re-cifrado
 * (lib/recifrado.ts) trabaja con DOS llaves a la vez: descifra con la
 * vieja y vuelve a cifrar con la nueva. Sin esto habría que duplicar el
 * cifrado en otro archivo, que es como acaban desviándose.
 */
function bufferDeLlave(hex: string, nombre = "ENCRYPTION_KEY"): Buffer {
  const keyBuffer = Buffer.from(hex, "hex");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`${nombre} debe tener ${KEY_LENGTH * 2} caracteres hex (got ${hex.length})`);
  }
  return keyBuffer;
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY no definida en variables de entorno");
  return bufferDeLlave(key);
}

function cifrarConBuffer(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function descifrarConBuffer(key: Buffer, ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Formato de texto cifrado inválido");

  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  if (iv.length !== IV_LENGTH) throw new Error("IV inválido");
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error("AuthTag inválido");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Cifra con una llave concreta, no con la del entorno.
 *
 * Solo lo usa el re-cifrado. El resto del portal usa `encrypt`, que es
 * lo correcto: nadie más tiene por qué elegir con qué llave cifra.
 */
export function cifrarCon(llaveHex: string, texto: string): string {
  return cifrarConBuffer(bufferDeLlave(llaveHex, "la llave indicada"), texto);
}

/** Descifra con una llave concreta. Lanza si no es la que corresponde. */
export function descifrarCon(llaveHex: string, texto: string): string {
  return descifrarConBuffer(bufferDeLlave(llaveHex, "la llave indicada"), texto);
}

/**
 * Cifra texto con AES-256-GCM.
 * Retorna: iv:authTag:ciphertext en base64 separado por ":"
 */
export function encrypt(plaintext: string): string {
  return cifrarConBuffer(getEncryptionKey(), plaintext);
}

/**
 * Descifra un string cifrado con encrypt().
 */
export function decrypt(ciphertext: string): string {
  return descifrarConBuffer(getEncryptionKey(), ciphertext);
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
