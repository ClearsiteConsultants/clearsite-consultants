import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const rawConnectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const connectionString = rawConnectionString?.replace(/\\\$/g, "$");

if (!connectionString) {
  console.error("Missing POSTGRES_URL or DATABASE_URL environment variable.");
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

const oldEmail = process.argv[2];
const newEmail = process.argv[3];

if (!oldEmail || !newEmail) {
  console.log("Usage: node scripts/admin-update-email.mjs <old_email> <new_email>");
  process.exit(1);
}

async function main() {
  try {
    const result = await sql`
      UPDATE users 
      SET email = ${newEmail}
      WHERE email = ${oldEmail}
      RETURNING id, email
    `;
    
    if (result.length === 0) {
      console.error(`❌ User with email ${oldEmail} not found.`);
    } else {
      console.log(`✅ Email updated successfully for admin.`);
      console.log(`   Old Email: ${oldEmail}`);
      console.log(`   New Email: ${result[0].email}`);
    }
  } catch (error) {
    if (error.message.includes("unique constraint")) {
      console.error(`❌ User with email ${newEmail} already exists.`);
    } else {
      console.error("❌ Failed to update email:", error);
    }
  } finally {
    await sql.end();
  }
}

main();
