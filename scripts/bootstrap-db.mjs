import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "Missing POSTGRES_URL or DATABASE_URL environment variable. Set one in .env.local/.env or your shell."
  );
  process.exit(1);
}

const sql = postgres(connectionString, {
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function run() {
  await sql.begin(async (tx) => {
    await tx`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        domain_name VARCHAR(255),
        plan VARCHAR(100) DEFAULT 'Starter',
        service_status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await tx`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        old_plan VARCHAR(100),
        new_plan VARCHAR(100),
        change_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await tx`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100),
        amount_due NUMERIC(10,2),
        due_date DATE,
        file_url TEXT,
        qbo_payment_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await tx`CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id)`;
  });

  console.log("Database bootstrap complete. Required tables are present.");
}

run()
  .catch((error) => {
    console.error("Database bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
