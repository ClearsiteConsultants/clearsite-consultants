import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV (recommended for GCM)
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

const ENCRYPTED_PREFIX = "enc:v1:";

/**
 * Returns the AES-256 encryption key from the environment.
 * Returns null when QBO_TOKEN_ENCRYPTION_KEY is not configured (development fallback).
 * In production this variable MUST be set; the application relies on it for token security.
 */
function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.QBO_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) return null;
  if (keyHex.length !== 64) {
    throw new Error(
      "QBO_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes / 256 bits)"
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string prefixed with "enc:v1:" so encrypted values are unambiguous.
 * Falls back to returning the plaintext unchanged when no encryption key is configured
 * (allows local development without the key).
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return (
    ENCRYPTED_PREFIX +
    iv.toString("hex") +
    "." +
    authTag.toString("hex") +
    "." +
    encrypted.toString("hex")
  );
}

/**
 * Decrypts a value produced by encryptToken.
 * If the value does not have the "enc:v1:" prefix it is returned as-is, which
 * provides transparent backward compatibility for plaintext tokens stored before
 * encryption was introduced (pre-migration rows or local-dev environments).
 */
export function decryptToken(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      "QBO_TOKEN_ENCRYPTION_KEY must be set to decrypt tokens"
    );
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return (
    decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
  );
}

/** Returns true when the value was produced by encryptToken. */
export function isEncryptedToken(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}
