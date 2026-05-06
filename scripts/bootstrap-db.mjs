import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const rawConnectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const connectionString = rawConnectionString?.replace(/\\\$/g, "$");

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
        first_name VARCHAR(255) NOT NULL DEFAULT '',
        last_name VARCHAR(255) NOT NULL DEFAULT '',
        phone VARCHAR(50),
        domain_name VARCHAR(255),
        plan VARCHAR(100) DEFAULT 'Starter',
        service_status VARCHAR(50) DEFAULT 'Active',
        next_invoice_due DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await tx`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS next_invoice_due DATE
    `;

    await tx`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS qbo_customer_id VARCHAR(64)
    `;

    // Migration: add first_name / last_name for existing databases that still have contact_name.
    await tx`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) NOT NULL DEFAULT ''
    `;

    await tx`
      ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) NOT NULL DEFAULT ''
    `;

    // Drop legacy contact_name column if it still exists.
    await tx`
      ALTER TABLE clients
      DROP COLUMN IF EXISTS contact_name
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
        qbo_payment_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS qbo_invoice_id VARCHAR(64)
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS qbo_sync_status VARCHAR(32) DEFAULT 'pending'
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS qbo_doc_number VARCHAR(100)
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS pdf_data BYTEA
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS pdf_mime_type VARCHAR(64)
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255)
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS pdf_size INTEGER
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS is_manual_link BOOLEAN DEFAULT FALSE
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS notes TEXT
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS invoice_date DATE
    `;

    await tx`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS invoice_total NUMERIC(10,2)
    `;

    // Remove legacy file_url column if it still exists.
    await tx`
      ALTER TABLE invoices
      DROP COLUMN IF EXISTS file_url
    `;

    await tx`
      CREATE TABLE IF NOT EXISTS quickbooks_connections (
        id SERIAL PRIMARY KEY,
        realm_id VARCHAR(64) UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expires_at TIMESTAMP NOT NULL,
        connected_by_user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await tx`CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_invoices_qbo_invoice_id ON invoices(qbo_invoice_id)`;
    await tx`CREATE INDEX IF NOT EXISTS idx_clients_qbo_customer_id ON clients(qbo_customer_id)`;
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
