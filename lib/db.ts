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

export async function getClientQuickBooksProfile(clientId: string) {
  const result = await sql`
    SELECT id, email, company_name, contact_name, phone, domain_name, qbo_customer_id
    FROM clients
    WHERE id = ${clientId}
    LIMIT 1
  `;
  return result.rows[0];
}

export async function setClientQuickBooksCustomerId(clientId: string, qboCustomerId: string) {
  const result = await sql`
    UPDATE clients
    SET qbo_customer_id = ${qboCustomerId}, updated_at = NOW()
    WHERE id = ${clientId}
    RETURNING id, qbo_customer_id
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

export async function updateClientStatus(clientId: string, newStatus: string) {
  const result = await sql`
    UPDATE clients SET service_status = ${newStatus}, updated_at = NOW() WHERE id = ${clientId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function updateNextInvoiceDue(clientId: string, dueDate: string) {
  const result = await sql`
    UPDATE clients SET next_invoice_due = ${dueDate}, updated_at = NOW() WHERE id = ${clientId}
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

export async function getClientInvoicesForPortal(clientId: string) {
  const result = await sql`
    SELECT
      id,
      invoice_number,
      qbo_doc_number,
      amount_due,
      amount_paid,
      due_date,
      qbo_payment_url,
      file_url,
      qbo_sync_status,
      paid_at,
      created_at,
      is_manual_link,
      CASE WHEN pdf_data IS NOT NULL THEN TRUE ELSE FALSE END AS has_pdf
    FROM invoices
    WHERE client_id = ${clientId}
    ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function getInvoiceById(invoiceId: string) {
  const result = await sql`
    SELECT *
    FROM invoices
    WHERE id = ${invoiceId}
    LIMIT 1
  `;
  return result.rows[0];
}

export async function updateInvoiceQuickBooksData(data: {
  invoiceId: string;
  qboInvoiceId: string;
  qboDocNumber?: string | null;
  qboPaymentUrl?: string | null;
  qboSyncStatus: string;
  amountPaid?: number;
  paidAt?: string | Date | null;
  pdfData?: Buffer | null;
  pdfMimeType?: string | null;
  pdfFilename?: string | null;
  pdfSize?: number | null;
}) {
  const result = await sql`
    UPDATE invoices
    SET
      qbo_invoice_id = ${data.qboInvoiceId},
      qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
      qbo_payment_url = COALESCE(${data.qboPaymentUrl || null}, qbo_payment_url),
      qbo_sync_status = ${data.qboSyncStatus},
      amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
      paid_at = COALESCE(${data.paidAt || null}, paid_at),
      pdf_data = COALESCE(${data.pdfData ?? null}, pdf_data),
      pdf_mime_type = COALESCE(${data.pdfMimeType ?? null}, pdf_mime_type),
      pdf_filename = COALESCE(${data.pdfFilename ?? null}, pdf_filename),
      pdf_size = COALESCE(${data.pdfSize ?? null}, pdf_size),
      last_synced_at = NOW()
    WHERE id = ${data.invoiceId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function updateInvoiceStatusByQuickBooksInvoiceId(data: {
  qboInvoiceId: string;
  qboSyncStatus: string;
  amountPaid?: number;
  paidAt?: string | Date | null;
  qboPaymentUrl?: string | null;
  qboDocNumber?: string | null;
}) {
  const result = await sql`
    UPDATE invoices
    SET
      qbo_sync_status = ${data.qboSyncStatus},
      amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
      paid_at = COALESCE(${data.paidAt || null}, paid_at),
      qbo_payment_url = COALESCE(${data.qboPaymentUrl || null}, qbo_payment_url),
      qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
      last_synced_at = NOW()
    WHERE qbo_invoice_id = ${data.qboInvoiceId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function getQuickBooksConnection() {
  const result = await sql`
    SELECT *
    FROM quickbooks_connections
    ORDER BY id DESC
    LIMIT 1
  `;
  return result.rows[0];
}

export async function upsertQuickBooksConnection(data: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  connectedByUserId?: string | null;
}) {
  const result = await sql`
    INSERT INTO quickbooks_connections (
      realm_id,
      access_token,
      refresh_token,
      token_expires_at,
      connected_by_user_id,
      updated_at
    )
    VALUES (
      ${data.realmId},
      ${data.accessToken},
      ${data.refreshToken},
      ${data.tokenExpiresAt.toISOString()},
      ${data.connectedByUserId || null},
      NOW()
    )
    ON CONFLICT (realm_id)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      connected_by_user_id = EXCLUDED.connected_by_user_id,
      updated_at = NOW()
    RETURNING *
  `;
  return result.rows[0];
}

export async function createInvoice(data: {
  client_id: string;
  invoice_number?: string | null;
  amount_due: number;
  due_date: string;
  file_url?: string | null;
  qbo_payment_url?: string | null;
  qbo_invoice_id?: string | null;
  qbo_doc_number?: string | null;
  qbo_sync_status?: string;
  amount_paid?: number;
  paid_at?: string | Date | null;
  is_manual_link?: boolean;
  notes?: string | null;
}) {
  const result = await sql`
    INSERT INTO invoices (
      client_id,
      invoice_number,
      amount_due,
      due_date,
      file_url,
      qbo_payment_url,
      qbo_invoice_id,
      qbo_doc_number,
      qbo_sync_status,
      amount_paid,
      paid_at,
      is_manual_link,
      notes,
      last_synced_at
    )
    VALUES (
      ${data.client_id},
      ${data.invoice_number || null},
      ${data.amount_due},
      ${data.due_date},
      ${data.file_url || null},
      ${data.qbo_payment_url || null},
      ${data.qbo_invoice_id || null},
      ${data.qbo_doc_number || null},
      ${data.qbo_sync_status || "pending"},
      ${data.amount_paid ?? 0},
      ${data.paid_at || null},
      ${data.is_manual_link ?? false},
      ${data.notes || null},
      NOW()
    )
    RETURNING *
  `;
  return result.rows[0];
}

export async function getAllClients() {
  const result = await sql`SELECT id, company_name FROM clients ORDER BY company_name`;
  return result.rows;
}

export async function getInvoicePdfById(invoiceId: string) {
  const result = await sql`
    SELECT id, client_id, pdf_data, pdf_mime_type, pdf_filename, pdf_size
    FROM invoices
    WHERE id = ${invoiceId}
    LIMIT 1
  `;
  return result.rows[0];
}

export async function checkDuplicateManualLink(clientId: string, qboPaymentUrl: string) {
  const result = await sql`
    SELECT id FROM invoices
    WHERE client_id = ${clientId}
      AND qbo_payment_url = ${qboPaymentUrl}
      AND is_manual_link = TRUE
    LIMIT 1
  `;
  return result.rows.length > 0;
}
