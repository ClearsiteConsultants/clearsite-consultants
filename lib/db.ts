import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

const db = postgres(connectionString, {
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  prepare: false,
});

// Wraps the postgres tagged template literal to match the { rows } shape used throughout this file.
export const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
  db(strings, ...values as Parameters<typeof db>[1][]).then((rows) => ({ rows }));

export async function getClientByEmail(email: string) {
  const result = await sql`
    SELECT * FROM clients WHERE email = ${email}
  `;
  return result.rows[0];
}

export async function getClientById(id: string) {
  const result = await sql`
    SELECT * FROM clients WHERE id = ${id}
  `;
  return result.rows[0];
}

export async function createClient(data: {
  email: string;
  password_hash: string;
  company_name: string;
  contact_name: string;
  phone?: string;
  domain_name?: string;
}) {
  const result = await sql`
    INSERT INTO clients (email, password_hash, company_name, contact_name, phone, domain_name)
    VALUES (${data.email}, ${data.password_hash}, ${data.company_name}, ${data.contact_name}, ${data.phone || null}, ${data.domain_name || null})
    RETURNING *
  `;
  return result.rows[0];
}

export async function updateClientPasswordById(clientId: string, passwordHash: string) {
  const result = await sql`
    UPDATE clients
    SET password_hash = ${passwordHash}
    WHERE id = ${clientId}
    RETURNING id, email
  `;
  return result.rows[0];
}

export async function updateClientPasswordByEmail(email: string, passwordHash: string) {
  const result = await sql`
    UPDATE clients
    SET password_hash = ${passwordHash}
    WHERE email = ${email}
    RETURNING id, email
  `;
  return result.rows[0];
}

export async function updateClientPlan(clientId: string, newPlan: string) {
  const client = await getClientById(clientId);
  
  // Log subscription change
  await sql`
    INSERT INTO subscriptions (client_id, old_plan, new_plan, change_type)
    VALUES (${clientId}, ${client.plan}, ${newPlan}, 'upgrade')
  `;

  const result = await sql`
    UPDATE clients SET plan = ${newPlan}, updated_at = NOW() WHERE id = ${clientId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function cancelClientService(clientId: string) {
  const result = await sql`
    UPDATE clients SET service_status = 'Canceled', updated_at = NOW() WHERE id = ${clientId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function getClientInvoices(clientId: string) {
  const result = await sql`
    SELECT * FROM invoices WHERE client_id = ${clientId} ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function createInvoice(data: {
  client_id: string;
  invoice_number: string;
  amount_due: number;
  due_date: string;
  file_url?: string;
  qbo_payment_url?: string;
}) {
  const result = await sql`
    INSERT INTO invoices (client_id, invoice_number, amount_due, due_date, file_url, qbo_payment_url)
    VALUES (${data.client_id}, ${data.invoice_number}, ${data.amount_due}, ${data.due_date}, ${data.file_url || null}, ${data.qbo_payment_url || null})
    RETURNING *
  `;
  return result.rows[0];
}

export async function getAllClients() {
  const result = await sql`SELECT id, company_name FROM clients ORDER BY company_name`;
  return result.rows;
}
