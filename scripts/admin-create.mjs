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
const password = process.argv[3];
const name = process.argv[4] || email?.split("@")[0];

if (!email || !password) {
  console.log("Usage: node scripts/admin-create.mjs <email> <password> [name]");
  process.exit(1);
}

async function main() {
  try {
    const passwordHash = await hashPassword(password);
    
    const result = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id, email, name
    `;
    
    console.log(`✅ Admin user created successfully:`);
    console.log(`   ID: ${result[0].id}`);
    console.log(`   Email: ${result[0].email}`);
    console.log(`   Name: ${result[0].name}`);
  } catch (error) {
    if (error.message.includes("unique constraint")) {
      console.error(`❌ User with email ${email} already exists.`);
    } else {
      console.error("❌ Failed to create admin user:", error);
    }
  } finally {
    await sql.end();
  }
}

main();
