import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Returns the HMAC key used for password pre-hashing.
 * AUTH_SECRET (or its alias NEXTAUTH_SECRET) is used so that even if the
 * bcrypt hash database were leaked, an attacker without the application secret
 * cannot mount an offline dictionary attack.
 *
 * IMPORTANT: Rotating AUTH_SECRET will invalidate all password hashes produced
 * by this function. If AUTH_SECRET must be rotated, all users will need to reset
 * their passwords.
 */
function getHmacKey(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for password hashing");
  }
  return secret;
}

/**
 * Normalises a raw password string before passing it to bcrypt.
 *
 * bcrypt silently truncates input at 72 bytes, so a password of 72+ characters
 * could match a shorter one that shares the same prefix. Passing the HMAC-SHA-256
 * digest (base64, always 44 chars = 44 bytes) ensures:
 *   - Passwords of any length (up to 128+ chars) are handled deterministically.
 *   - The bcrypt input is always within the safe 72-byte range.
 *   - An application-layer secret is mixed in for defence-in-depth.
 */
export function prehashPassword(password: string): string {
  return crypto
    .createHmac("sha256", getHmacKey())
    .update(password, "utf8")
    .digest("base64");
}

/**
 * Hashes a password for storage.
 * Always call this instead of bcrypt.hash() directly.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(prehashPassword(password), 10);
}

/**
 * Verifies a raw password against a stored hash.
 *
 * Tries the current prehash approach first.  If that fails, falls back to a
 * legacy direct bcrypt comparison so that hashes stored before this change was
 * introduced continue to work.  When the legacy path succeeds the caller
 * should re-hash and persist the upgraded hash.
 *
 * Returns `{ valid: true, legacy: false }` for modern hashes,
 *         `{ valid: true, legacy: true }` for legacy hashes (should be upgraded),
 *         `{ valid: false, legacy: false }` when the password is wrong.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<{ valid: boolean; legacy: boolean }> {
  const modernMatch = await bcrypt.compare(prehashPassword(password), hash);
  if (modernMatch) return { valid: true, legacy: false };

  const legacyMatch = await bcrypt.compare(password, hash);
  if (legacyMatch) return { valid: true, legacy: true };

  return { valid: false, legacy: false };
}
