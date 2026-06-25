import postgres from "postgres";
import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const rawConnectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const connectionString = rawConnectionString?.replace(/\\\$/g, "$");

if (!connectionString) {
  console.error("Missing POSTGRES_URL or DATABASE_URL environment variable.");
  process.exit(1);
}

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  console.error("Missing AUTH_SECRET or NEXTAUTH_SECRET environment variable. Required for modern hashing.");
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

function prehashPassword(password) {
  return crypto
    .createHmac("sha256", authSecret)
    .update(password, "utf8")
    .digest("base64");
}

async function hashPassword(password) {
  return bcrypt.hash(prehashPassword(password), 10);
}

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log("Usage: node scripts/admin-reset-password.mjs <email> <new_password>");
  process.exit(1);
}

async function main() {
  try {
    const passwordHash = await hashPassword(newPassword);
    
    const result = await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}
      WHERE email = ${email}
      RETURNING id, email
    `;
    
    if (result.length === 0) {
      console.error(`❌ User with email ${email} not found.`);
    } else {
      console.log(`✅ Password reset successfully for admin: ${result[0].email}`);
    }
  } catch (error) {
    console.error("❌ Failed to reset password:", error);
  } finally {
    await sql.end();
  }
}

main();
