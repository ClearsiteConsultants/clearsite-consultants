#!/usr/bin/env node
/**
 * One-time migration: encrypt existing plaintext OAuth tokens in the
 * quickbooks_connections table using AES-256-GCM.
 *
 * Prerequisites:
 *   - QBO_TOKEN_ENCRYPTION_KEY must be set in your environment (64-char hex, 32 bytes).
 *   - DATABASE_URL (or POSTGRES_URL) must point to the target database.
 *
 * Usage:
 *   node scripts/encrypt-existing-tokens.mjs
 *
 * Rollback:
 *   Take a full database backup BEFORE running this script. To roll back,
 *   restore from the backup. The script does NOT store plaintext tokens to avoid
 *   leaking credentials to process logs or stdout.
 *
 * Safety:
 *   - The script skips rows whose tokens already begin with "enc:v1:" (already encrypted).
 *   - It processes rows one at a time inside a transaction per row so a partial failure
 *     leaves previous rows encrypted and subsequent rows untouched.
 *   - Take a database backup BEFORE running this script.
 */

import { createHmac, createCipheriv, randomBytes } from "crypto";
import postgres from "postgres";

// ---------- configuration ----------
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const ENCRYPTED_PREFIX = "enc:v1:";

const keyHex = process.env.QBO_TOKEN_ENCRYPTION_KEY;
if (!keyHex) {
  console.error("ERROR: QBO_TOKEN_ENCRYPTION_KEY environment variable is not set.");
  process.exit(1);
}
if (keyHex.length !== 64) {
  console.error("ERROR: QBO_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).");
  process.exit(1);
}
const encryptionKey = Buffer.from(keyHex, "hex");

const connectionString =
  process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: POSTGRES_URL or DATABASE_URL environment variable is not set.");
  process.exit(1);
}

// ---------- helpers ----------
function encryptToken(plaintext) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
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

function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

// ---------- main ----------
const sql = postgres(connectionString, {
  // For non-localhost connections, enforce TLS with proper certificate validation.
  // If your database uses a self-signed certificate, set PGSSLMODE=no-verify in
  // your environment instead of weakening the default here.
  ssl: connectionString.includes("localhost") ? false : true,
  prepare: false,
});

console.log("Fetching all quickbooks_connections rows…");
const rows = await sql`SELECT id, realm_id, access_token, refresh_token FROM quickbooks_connections`;

if (rows.length === 0) {
  console.log("No rows found – nothing to migrate.");
  await sql.end();
  process.exit(0);
}

console.log(`Found ${rows.length} row(s). Processing…\n`);

let migrated = 0;
let skipped = 0;

for (const row of rows) {
  const alreadyEncryptedAccess = isEncrypted(row.access_token);
  const alreadyEncryptedRefresh = isEncrypted(row.refresh_token);

  if (alreadyEncryptedAccess && alreadyEncryptedRefresh) {
    console.log(`Row id=${row.id} (realm=${row.realm_id}): SKIP – already encrypted`);
    skipped++;
    continue;
  }

  // NOTE: Plaintext tokens are NOT printed here to avoid leaking them to stdout.
  // Before running this script take a full database backup for rollback purposes.

  const newAccessToken = alreadyEncryptedAccess
    ? row.access_token
    : encryptToken(row.access_token);

  const newRefreshToken = alreadyEncryptedRefresh
    ? row.refresh_token
    : encryptToken(row.refresh_token);

  await sql`
    UPDATE quickbooks_connections
    SET
      access_token  = ${newAccessToken},
      refresh_token = ${newRefreshToken},
      updated_at    = NOW()
    WHERE id = ${row.id}
  `;

  console.log(`Row id=${row.id} (realm=${row.realm_id}): ENCRYPTED ✓`);
  migrated++;
}

console.log(`\nDone. Migrated: ${migrated}, Skipped (already encrypted): ${skipped}.`);
await sql.end();
