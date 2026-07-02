import postgres from "postgres";
import { encryptToken, decryptToken } from "@/lib/crypto";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

const db = postgres(connectionString, {
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  prepare: false,
});

// Wraps the postgres tagged template literal to match the { rows } shape used throughout this file.
export const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
  db(strings, ...values as Parameters<typeof db>[1][]).then((rows) => ({ rows }));

/** Typed representation of a row in the quickbooks_connections table. */
export type QuickBooksConnectionRow = {
  id: number;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  connected_by_user_id: string | null;
  reconnect_required: boolean;
  reconnect_reason: string | null;
  last_auth_error_code: string | null;
  last_auth_error_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ErrorLogRow = {
  id: number;
  level: string;
  route: string;
  method: string;
  status_code: number | null;
  error_name: string | null;
  error_message: string;
  error_stack: string | null;
  user_id: string | null;
  user_type: string | null;
  metadata: unknown;
  created_at: string;
};

export type ErrorLogRetentionConfig = {
  days: number;
  maxRetained: number;
};

const ERROR_LOG_RETENTION: ErrorLogRetentionConfig = Object.freeze({
  days: 30,
  maxRetained: 150,
});

const ERROR_LOG_DEFAULT_PAGE_SIZE = 50;
const ERROR_LOG_MAX_PAGE_SIZE = 200;

export function getErrorLogRetentionConfig(): ErrorLogRetentionConfig {
  return { ...ERROR_LOG_RETENTION };
}

async function cleanupErrorLogsForRetention() {
  const retention = getErrorLogRetentionConfig();

  await sql`
    DELETE FROM error_logs
    WHERE created_at < NOW() - (${retention.days} * INTERVAL '1 day')
  `;

  await sql`
    WITH ranked_duplicates AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY
            route,
            method,
            status_code,
            error_name,
            error_message,
            user_id,
            user_type
          ORDER BY created_at DESC, id DESC
        ) AS duplicate_rank
      FROM error_logs
    )
    DELETE FROM error_logs
    WHERE id IN (
      SELECT id
      FROM ranked_duplicates
      WHERE duplicate_rank > 1
    )
  `;

  await sql`
    DELETE FROM error_logs
    WHERE id IN (
      SELECT id
      FROM error_logs
      ORDER BY created_at DESC, id DESC
      OFFSET ${retention.maxRetained}
    )
  `;
}

function isMissingQuickBooksConnectionColumnError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /column .*reconnect_required|reconnect_reason|last_auth_error_code|last_auth_error_at.* does not exist/i.test(
    error.message
  );
}

function isMissingErrorLogsTableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /relation "error_logs" does not exist/i.test(error.message);
}

async function ensureErrorLogsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS error_logs (
      id BIGSERIAL PRIMARY KEY,
      level VARCHAR(16) NOT NULL DEFAULT 'error',
      route VARCHAR(255) NOT NULL,
      method VARCHAR(16) NOT NULL,
      status_code INTEGER,
      error_name VARCHAR(255),
      error_message TEXT NOT NULL,
      error_stack TEXT,
      user_id VARCHAR(255),
      user_type VARCHAR(64),
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`DROP TRIGGER IF EXISTS trg_cleanup_error_logs_30_days ON error_logs`;
  await sql`DROP TRIGGER IF EXISTS trg_cleanup_error_logs_retention ON error_logs`;
  await sql`DROP FUNCTION IF EXISTS cleanup_error_logs_30_days()`;
  await sql`DROP FUNCTION IF EXISTS cleanup_error_logs_retention()`;
  await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_route ON error_logs(route)`;
}

async function ensureQuickBooksConnectionColumns() {
  await sql`
    ALTER TABLE quickbooks_connections
    ADD COLUMN IF NOT EXISTS reconnect_required BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE quickbooks_connections
    ADD COLUMN IF NOT EXISTS reconnect_reason VARCHAR(100)
  `;
  await sql`
    ALTER TABLE quickbooks_connections
    ADD COLUMN IF NOT EXISTS last_auth_error_code VARCHAR(100)
  `;
  await sql`
    ALTER TABLE quickbooks_connections
    ADD COLUMN IF NOT EXISTS last_auth_error_at TIMESTAMP
  `;
}

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
  first_name: string;
  last_name: string;
  phone?: string;
  domain_name?: string;
}) {
  const result = await sql`
    INSERT INTO clients (
      email, 
      password_hash, 
      company_name, 
      first_name, 
      last_name, 
      phone, 
      domain_name,
      service_status,
      client_status,
      plan
    )
    VALUES (
      ${data.email}, 
      ${data.password_hash}, 
      ${data.company_name}, 
      ${data.first_name}, 
      ${data.last_name}, 
      ${data.phone || null}, 
      ${data.domain_name || null},
      'Inactive',
      'Active',
      NULL
    )
    RETURNING *
  `;
  return result.rows[0];
}

export async function getClientQuickBooksProfile(clientId: string) {
  const result = await sql`
    SELECT
      id,
      email,
      company_name,
      first_name,
      last_name,
      phone,
      domain_name,
      qbo_customer_id,
      billing_address_line1,
      billing_address_line2,
      billing_city,
      billing_state,
      billing_postal_code
    FROM clients
    WHERE id = ${clientId}
    LIMIT 1
  `;
  return result.rows[0];
}

export async function getClientByQboCustomerId(qboCustomerId: string) {
  const result = await sql`
    SELECT id, email, company_name, first_name, last_name, phone, domain_name, qbo_customer_id
    FROM clients
    WHERE qbo_customer_id = ${qboCustomerId}
    LIMIT 1
  `;
  return result.rows[0] || null;
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

export async function getUserById(id: string) {
  const result = await sql`
    SELECT id, email, name, password_hash FROM users WHERE id = ${id}
  `;
  return result.rows[0];
}

/**
 * Checks if an email is already in use by a client or an administrator.
 * @param email The email to check.
 * @param excludeClientId Optional client ID to exclude from the check (useful for updates).
 * @returns True if the email is in use, false otherwise.
 */
export async function isEmailInUse(email: string, excludeClientId?: string): Promise<boolean> {
  // Check clients table
  const clientQuery = excludeClientId
    ? sql`SELECT 1 FROM clients WHERE email = ${email} AND id != ${excludeClientId} LIMIT 1`
    : sql`SELECT 1 FROM clients WHERE email = ${email} LIMIT 1`;
  
  const clientResult = await clientQuery;
  if (clientResult.rows.length > 0) return true;

  // Check users (admin) table
  const userResult = await sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`;
  if (userResult.rows.length > 0) return true;

  return false;
}

export async function updateAdminPasswordById(userId: string, passwordHash: string) {
  const result = await sql`
    UPDATE users
    SET password_hash = ${passwordHash}
    WHERE id = ${userId}
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

export async function updateNextInvoiceDue(clientId: string, dueDate: string | null) {
  const result = await sql`
    UPDATE clients SET next_invoice_due = ${dueDate}, updated_at = NOW() WHERE id = ${clientId}
    RETURNING *
  `;
  return result.rows[0];
}

export async function getNextUnpaidInvoiceDueDate(clientId: string) {
  const result = await sql`
    SELECT due_date
    FROM invoices
    WHERE client_id = ${clientId}
      AND paid_at IS NULL
      AND LOWER(COALESCE(qbo_sync_status, 'pending')) <> 'paid'
    ORDER BY due_date ASC, created_at ASC
    LIMIT 1
  `;

  return result.rows[0]?.due_date ? String(result.rows[0].due_date).slice(0, 10) : null;
}

export async function refreshClientNextInvoiceDue(clientId: string) {
  const result = await sql`
    UPDATE clients
    SET
      next_invoice_due = (
        SELECT due_date
        FROM invoices
        WHERE client_id = ${clientId}
          AND paid_at IS NULL
          AND LOWER(COALESCE(qbo_sync_status, 'pending')) <> 'paid'
        ORDER BY due_date ASC, created_at ASC
        LIMIT 1
      ),
      updated_at = NOW()
    WHERE id = ${clientId}
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
      qbo_invoice_id,
      qbo_doc_number,
      invoice_total,
      amount_paid,
      invoice_date,
      due_date,
      qbo_payment_url,
      qbo_sync_status,
      paid_at,
      created_at,
      is_manual_link
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

export async function getInvoiceByQuickBooksInvoiceId(qboInvoiceId: string) {
  const result = await sql`
    SELECT *
    FROM invoices
    WHERE qbo_invoice_id = ${qboInvoiceId}
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function updateInvoiceQuickBooksData(data: {
  invoiceId: string;
  qboInvoiceId: string;
  qboDocNumber?: string | null;
  qboPaymentUrl?: string | null;
  qboSyncStatus: string;
  amountPaid?: number;
  paidAt?: string | Date | null;
  invoiceDate?: string | null;
  invoiceTotal?: number | null;
}) {
  const result = await sql`
    UPDATE invoices
    SET
      qbo_invoice_id = ${data.qboInvoiceId},
      -- COALESCE pattern: these fields can be set once from NULL but are never
      -- overwritten once populated, preserving immutability of QBO metadata.
      qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
      qbo_payment_url = COALESCE(NULLIF(BTRIM(${data.qboPaymentUrl ?? null}), ''), qbo_payment_url),
      qbo_sync_status = ${data.qboSyncStatus},
      amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
      paid_at = COALESCE(${data.paidAt || null}, paid_at),
      invoice_date = COALESCE(${data.invoiceDate ?? null}, invoice_date),
      invoice_total = COALESCE(${data.invoiceTotal ?? null}, invoice_total),
      last_synced_at = NOW()
    WHERE id = ${data.invoiceId}
    RETURNING *
  `;

  const invoice = result.rows[0];
  if (invoice?.client_id) {
    await refreshClientNextInvoiceDue(String(invoice.client_id));
  }

  return invoice;
}

export async function updateInvoiceStatusByQuickBooksInvoiceId(data: {
  qboInvoiceId: string;
  qboSyncStatus: string;
  amountPaid: number;
  paidAt: string | Date | null;
  qboPaymentUrl?: string | null;
  qboDocNumber?: string | null;
  invoiceDate?: string | null;
  invoiceTotal?: number | null;
  allowPaymentUrlClear?: boolean;
}) {
  const isPaidStatus = data.qboSyncStatus.trim().toLowerCase() === "paid";

  const result = isPaidStatus
    ? data.allowPaymentUrlClear
      ? await sql`
        UPDATE invoices
        SET
          qbo_sync_status = ${data.qboSyncStatus},
          amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
          paid_at = COALESCE(${data.paidAt || null}, paid_at),
          qbo_payment_url = COALESCE(NULLIF(BTRIM(${data.qboPaymentUrl ?? null}), ''), qbo_payment_url),
          qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
          invoice_date = COALESCE(${data.invoiceDate ?? null}, invoice_date),
          invoice_total = COALESCE(${data.invoiceTotal ?? null}, invoice_total),
          last_synced_at = NOW()
        WHERE qbo_invoice_id = ${data.qboInvoiceId}
        RETURNING *
      `
      : await sql`
        UPDATE invoices
        SET
          qbo_sync_status = ${data.qboSyncStatus},
          amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
          paid_at = COALESCE(${data.paidAt || null}, paid_at),
          qbo_payment_url = COALESCE(NULLIF(BTRIM(${data.qboPaymentUrl ?? null}), ''), qbo_payment_url),
          qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
          invoice_date = COALESCE(${data.invoiceDate ?? null}, invoice_date),
          invoice_total = COALESCE(${data.invoiceTotal ?? null}, invoice_total),
          last_synced_at = NOW()
        WHERE qbo_invoice_id = ${data.qboInvoiceId}
        RETURNING *
      `
    : data.paidAt === null
      ? data.allowPaymentUrlClear
        ? await sql`
        UPDATE invoices
        SET
          qbo_sync_status = ${data.qboSyncStatus},
          amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
          paid_at = NULL,
          qbo_payment_url = COALESCE(NULLIF(BTRIM(${data.qboPaymentUrl ?? null}), ''), qbo_payment_url),
          qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
          invoice_date = COALESCE(${data.invoiceDate ?? null}, invoice_date),
          invoice_total = COALESCE(${data.invoiceTotal ?? null}, invoice_total),
          last_synced_at = NOW()
        WHERE qbo_invoice_id = ${data.qboInvoiceId}
        RETURNING *
      `
        : await sql`
        UPDATE invoices
        SET
          qbo_sync_status = ${data.qboSyncStatus},
          amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
          paid_at = NULL,
          qbo_payment_url = COALESCE(NULLIF(BTRIM(${data.qboPaymentUrl ?? null}), ''), qbo_payment_url),
          qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
          invoice_date = COALESCE(${data.invoiceDate ?? null}, invoice_date),
          invoice_total = COALESCE(${data.invoiceTotal ?? null}, invoice_total),
          last_synced_at = NOW()
        WHERE qbo_invoice_id = ${data.qboInvoiceId}
        RETURNING *
      `
      : data.allowPaymentUrlClear
        ? await sql`
        UPDATE invoices
        SET
          qbo_sync_status = ${data.qboSyncStatus},
          amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
          paid_at = COALESCE(${data.paidAt || null}, paid_at),
          qbo_payment_url = COALESCE(NULLIF(BTRIM(${data.qboPaymentUrl ?? null}), ''), qbo_payment_url),
          qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
          invoice_date = COALESCE(${data.invoiceDate ?? null}, invoice_date),
          invoice_total = COALESCE(${data.invoiceTotal ?? null}, invoice_total),
          last_synced_at = NOW()
        WHERE qbo_invoice_id = ${data.qboInvoiceId}
        RETURNING *
      `
        : await sql`
        UPDATE invoices
        SET
          qbo_sync_status = ${data.qboSyncStatus},
          amount_paid = COALESCE(${data.amountPaid ?? null}, amount_paid),
          paid_at = COALESCE(${data.paidAt || null}, paid_at),
          qbo_payment_url = COALESCE(NULLIF(BTRIM(${data.qboPaymentUrl ?? null}), ''), qbo_payment_url),
          qbo_doc_number = COALESCE(${data.qboDocNumber ?? null}, qbo_doc_number),
          invoice_date = COALESCE(${data.invoiceDate ?? null}, invoice_date),
          invoice_total = COALESCE(${data.invoiceTotal ?? null}, invoice_total),
          last_synced_at = NOW()
        WHERE qbo_invoice_id = ${data.qboInvoiceId}
        RETURNING *
      `;

  const invoice = result.rows[0];
  if (invoice?.client_id) {
    await refreshClientNextInvoiceDue(String(invoice.client_id));
  }

  return invoice;
}

export type MissingPaymentUrlLogOrigin =
  | "admin-create"
  | "admin-link"
  | "admin-sync"
  | "portal-read"
  | "qbo-webhook";

export async function getQuickBooksConnection(): Promise<QuickBooksConnectionRow | undefined> {
  let result;
  try {
    result = await sql`
      SELECT *
      FROM quickbooks_connections
      ORDER BY id DESC
      LIMIT 1
    `;
  } catch (error) {
    if (!isMissingQuickBooksConnectionColumnError(error)) {
      throw error;
    }
    await ensureQuickBooksConnectionColumns();
    result = await sql`
      SELECT *
      FROM quickbooks_connections
      ORDER BY id DESC
      LIMIT 1
    `;
  }
  const row = result.rows[0] as QuickBooksConnectionRow | undefined;
  if (!row) return row;
  return {
    ...row,
    access_token: decryptToken(row.access_token),
    refresh_token: decryptToken(row.refresh_token),
  };
}

export async function upsertQuickBooksConnection(data: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  connectedByUserId?: string | null;
  reconnectRequired?: boolean;
  reconnectReason?: string | null;
  lastAuthErrorCode?: string | null;
  lastAuthErrorAt?: Date | null;
}) {
  const encryptedAccessToken = encryptToken(data.accessToken);
  const encryptedRefreshToken = encryptToken(data.refreshToken);
  const reconnectRequired = data.reconnectRequired ?? false;
  const reconnectReason = reconnectRequired ? (data.reconnectReason ?? null) : null;
  const lastAuthErrorCode = reconnectRequired ? (data.lastAuthErrorCode ?? null) : null;
  const lastAuthErrorAt = reconnectRequired
    ? (data.lastAuthErrorAt ?? new Date()).toISOString()
    : null;

  let result;
  try {
    result = await sql`
      INSERT INTO quickbooks_connections (
        realm_id,
        access_token,
        refresh_token,
        token_expires_at,
        connected_by_user_id,
        reconnect_required,
        reconnect_reason,
        last_auth_error_code,
        last_auth_error_at,
        updated_at
      )
      VALUES (
        ${data.realmId},
        ${encryptedAccessToken},
        ${encryptedRefreshToken},
        ${data.tokenExpiresAt.toISOString()},
        ${data.connectedByUserId || null},
        ${reconnectRequired},
        ${reconnectReason},
        ${lastAuthErrorCode},
        ${lastAuthErrorAt},
        NOW()
      )
      ON CONFLICT (realm_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        connected_by_user_id = EXCLUDED.connected_by_user_id,
        reconnect_required = EXCLUDED.reconnect_required,
        reconnect_reason = EXCLUDED.reconnect_reason,
        last_auth_error_code = EXCLUDED.last_auth_error_code,
        last_auth_error_at = EXCLUDED.last_auth_error_at,
        updated_at = NOW()
      RETURNING *
    `;
  } catch (error) {
    if (!isMissingQuickBooksConnectionColumnError(error)) {
      throw error;
    }
    await ensureQuickBooksConnectionColumns();
    result = await sql`
      INSERT INTO quickbooks_connections (
        realm_id,
        access_token,
        refresh_token,
        token_expires_at,
        connected_by_user_id,
        reconnect_required,
        reconnect_reason,
        last_auth_error_code,
        last_auth_error_at,
        updated_at
      )
      VALUES (
        ${data.realmId},
        ${encryptedAccessToken},
        ${encryptedRefreshToken},
        ${data.tokenExpiresAt.toISOString()},
        ${data.connectedByUserId || null},
        ${reconnectRequired},
        ${reconnectReason},
        ${lastAuthErrorCode},
        ${lastAuthErrorAt},
        NOW()
      )
      ON CONFLICT (realm_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        connected_by_user_id = EXCLUDED.connected_by_user_id,
        reconnect_required = EXCLUDED.reconnect_required,
        reconnect_reason = EXCLUDED.reconnect_reason,
        last_auth_error_code = EXCLUDED.last_auth_error_code,
        last_auth_error_at = EXCLUDED.last_auth_error_at,
        updated_at = NOW()
      RETURNING *
    `;
  }
  const row = result.rows[0] as QuickBooksConnectionRow | undefined;
  if (!row) return row;
  // Decrypt the stored ciphertext to confirm what was persisted and return plaintext.
  return {
    ...row,
    access_token: decryptToken(row.access_token),
    refresh_token: decryptToken(row.refresh_token),
  };
}

export async function setQuickBooksConnectionAuthState(data: {
  reconnectRequired: boolean;
  reconnectReason?: string | null;
  lastAuthErrorCode?: string | null;
  realmId?: string;
}) {
  const reconnectReason = data.reconnectRequired ? (data.reconnectReason ?? null) : null;
  const lastAuthErrorCode = data.reconnectRequired ? (data.lastAuthErrorCode ?? null) : null;
  let result;
  try {
    result = data.realmId
      ? await sql`
          UPDATE quickbooks_connections
          SET
            reconnect_required = ${data.reconnectRequired},
            reconnect_reason = ${reconnectReason},
            last_auth_error_code = ${lastAuthErrorCode},
            last_auth_error_at = ${data.reconnectRequired ? new Date().toISOString() : null},
            updated_at = NOW()
          WHERE realm_id = ${data.realmId}
          RETURNING *
        `
      : await sql`
          UPDATE quickbooks_connections
          SET
            reconnect_required = ${data.reconnectRequired},
            reconnect_reason = ${reconnectReason},
            last_auth_error_code = ${lastAuthErrorCode},
            last_auth_error_at = ${data.reconnectRequired ? new Date().toISOString() : null},
            updated_at = NOW()
          WHERE id = (
            SELECT id
            FROM quickbooks_connections
            ORDER BY id DESC
            LIMIT 1
          )
          RETURNING *
        `;
  } catch (error) {
    if (!isMissingQuickBooksConnectionColumnError(error)) {
      throw error;
    }
    await ensureQuickBooksConnectionColumns();
    result = data.realmId
      ? await sql`
          UPDATE quickbooks_connections
          SET
            reconnect_required = ${data.reconnectRequired},
            reconnect_reason = ${reconnectReason},
            last_auth_error_code = ${lastAuthErrorCode},
            last_auth_error_at = ${data.reconnectRequired ? new Date().toISOString() : null},
            updated_at = NOW()
          WHERE realm_id = ${data.realmId}
          RETURNING *
        `
      : await sql`
          UPDATE quickbooks_connections
          SET
            reconnect_required = ${data.reconnectRequired},
            reconnect_reason = ${reconnectReason},
            last_auth_error_code = ${lastAuthErrorCode},
            last_auth_error_at = ${data.reconnectRequired ? new Date().toISOString() : null},
            updated_at = NOW()
          WHERE id = (
            SELECT id
            FROM quickbooks_connections
            ORDER BY id DESC
            LIMIT 1
          )
          RETURNING *
        `;
  }

  const row = result.rows[0] as QuickBooksConnectionRow | undefined;
  if (!row) return row;
  return {
    ...row,
    access_token: decryptToken(row.access_token),
    refresh_token: decryptToken(row.refresh_token),
  };
}

export async function createInvoice(data: {
  client_id: string;
  invoice_total: number;
  invoice_date?: string | null;
  due_date: string;
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
      notes,
      invoice_date,
      due_date,
      invoice_total,
      qbo_payment_url,
      qbo_invoice_id,
      qbo_doc_number,
      qbo_sync_status,
      amount_paid,
      paid_at,
      is_manual_link,
      last_synced_at
    )
    VALUES (
      ${data.client_id},
      ${data.notes || null},
      ${data.invoice_date || null},
      ${data.due_date},
      ${data.invoice_total},
      ${data.qbo_payment_url || null},
      ${data.qbo_invoice_id || null},
      ${data.qbo_doc_number || null},
      ${data.qbo_sync_status || "pending"},
      ${data.amount_paid ?? 0},
      ${data.paid_at || null},
      ${data.is_manual_link ?? false},
      NOW()
    )
    RETURNING *
  `;

  await refreshClientNextInvoiceDue(data.client_id);

  return result.rows[0];
}

export async function getClientQboInvoiceIds(clientId: string) {
  const result = await sql`
    SELECT qbo_invoice_id
    FROM invoices
    WHERE client_id = ${clientId}
      AND qbo_invoice_id IS NOT NULL
    ORDER BY created_at DESC
  `;

  return result.rows
    .map((row) => row.qbo_invoice_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export async function getAllClients() {
  const result = await sql`SELECT id, company_name FROM clients ORDER BY company_name`;
  return result.rows;
}

export async function getClientBillingAddress(clientId: string) {
  const result = await sql`
    SELECT
      id,
      company_name,
      qbo_customer_id,
      billing_address_line1,
      billing_address_line2,
      billing_city,
      billing_state,
      billing_postal_code
    FROM clients
    WHERE id = ${clientId}
    LIMIT 1
  `;
  return result.rows[0];
}

export async function updateClientAccountInfo(
  clientId: string,
  data: {
    company_name: string;
    phone: string | null;
    email: string;
  }
) {
  const result = await sql`
    UPDATE clients
    SET
      company_name = ${data.company_name},
      phone = ${data.phone},
      email = ${data.email},
      updated_at = NOW()
    WHERE id = ${clientId}
    RETURNING
      id,
      email,
      company_name,
      first_name,
      last_name,
      phone,
      domain_name,
      plan,
      service_status,
      next_invoice_due,
      qbo_customer_id,
      billing_address_line1,
      billing_address_line2,
      billing_city,
      billing_state,
      billing_postal_code,
      billing_country
  `;
  return result.rows[0];
}

export async function updateClientBillingAddress(
  clientId: string,
  data: {
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_postal_code: string | null;
    // billing_country removed
  }
) {
  const result = await sql`
    UPDATE clients
    SET
      billing_address_line1 = ${data.billing_address_line1},
      billing_address_line2 = ${data.billing_address_line2},
      billing_city = ${data.billing_city},
      billing_state = ${data.billing_state},
      billing_postal_code = ${data.billing_postal_code},
      billing_country = 'US',
      updated_at = NOW()
    WHERE id = ${clientId}
    RETURNING
      id,
      email,
      company_name,
      first_name,
      last_name,
      domain_name,
      plan,
      service_status,
      next_invoice_due,
      qbo_customer_id,
      billing_address_line1,
      billing_address_line2,
      billing_city,
      billing_state,
      billing_postal_code,
      billing_country
  `;
  return result.rows[0];
}

export async function getInvoicePdfById(invoiceId: string) {
  const result = await sql`
    SELECT id, client_id, qbo_invoice_id, qbo_doc_number
    FROM invoices
    WHERE id = ${invoiceId}
    LIMIT 1
  `;
  return result.rows[0];
}

export async function checkDuplicateByQboInvoiceId(clientId: string, qboInvoiceId: string) {
  const result = await sql`
    SELECT id FROM invoices
    WHERE client_id = ${clientId}
      AND qbo_invoice_id = ${qboInvoiceId}
    LIMIT 1
  `;
  return result.rows.length > 0;
}

export async function createErrorLog(data: {
  level?: string;
  route: string;
  method: string;
  statusCode?: number | null;
  errorName?: string | null;
  errorMessage: string;
  errorStack?: string | null;
  userId?: string | null;
  userType?: string | null;
  metadata?: unknown;
}) {
  const level = (data.level || "error").toLowerCase();
  const metadata = data.metadata === undefined ? null : JSON.stringify(data.metadata);

  let result;
  try {
    result = await sql`
      INSERT INTO error_logs (
        level,
        route,
        method,
        status_code,
        error_name,
        error_message,
        error_stack,
        user_id,
        user_type,
        metadata
      )
      VALUES (
        ${level},
        ${data.route},
        ${data.method},
        ${data.statusCode ?? null},
        ${data.errorName ?? null},
        ${data.errorMessage},
        ${data.errorStack ?? null},
        ${data.userId ?? null},
        ${data.userType ?? null},
        ${metadata}
      )
      RETURNING *
    `;
    await cleanupErrorLogsForRetention();
  } catch (error) {
    if (!isMissingErrorLogsTableError(error)) {
      throw error;
    }
    await ensureErrorLogsTable();
    result = await sql`
      INSERT INTO error_logs (
        level,
        route,
        method,
        status_code,
        error_name,
        error_message,
        error_stack,
        user_id,
        user_type,
        metadata
      )
      VALUES (
        ${level},
        ${data.route},
        ${data.method},
        ${data.statusCode ?? null},
        ${data.errorName ?? null},
        ${data.errorMessage},
        ${data.errorStack ?? null},
        ${data.userId ?? null},
        ${data.userType ?? null},
        ${metadata}
      )
      RETURNING *
    `;
    await cleanupErrorLogsForRetention();
  }

  return result.rows[0] as ErrorLogRow;
}

export async function listErrorLogs(options?: {
  page?: number;
  pageSize?: number;
  level?: string;
  query?: string;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.max(1, Math.min(ERROR_LOG_MAX_PAGE_SIZE, options?.pageSize ?? ERROR_LOG_DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const level = options?.level?.trim().toLowerCase() || null;
  const query = options?.query?.trim() ? `%${options.query.trim()}%` : null;

  let totalResult;
  let rowsResult;
  try {
    totalResult = await sql`
      SELECT COUNT(*)::INT AS count
      FROM error_logs
      WHERE (${level}::TEXT IS NULL OR level = ${level})
        AND (
          ${query}::TEXT IS NULL
          OR route ILIKE ${query}
          OR method ILIKE ${query}
          OR error_message ILIKE ${query}
          OR COALESCE(user_id, '') ILIKE ${query}
        )
    `;
    rowsResult = await sql`
      SELECT *
      FROM error_logs
      WHERE (${level}::TEXT IS NULL OR level = ${level})
        AND (
          ${query}::TEXT IS NULL
          OR route ILIKE ${query}
          OR method ILIKE ${query}
          OR error_message ILIKE ${query}
          OR COALESCE(user_id, '') ILIKE ${query}
        )
      ORDER BY created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;
  } catch (error) {
    if (!isMissingErrorLogsTableError(error)) {
      throw error;
    }
    await ensureErrorLogsTable();
    totalResult = await sql`
      SELECT COUNT(*)::INT AS count
      FROM error_logs
      WHERE (${level}::TEXT IS NULL OR level = ${level})
        AND (
          ${query}::TEXT IS NULL
          OR route ILIKE ${query}
          OR method ILIKE ${query}
          OR error_message ILIKE ${query}
          OR COALESCE(user_id, '') ILIKE ${query}
        )
    `;
    rowsResult = await sql`
      SELECT *
      FROM error_logs
      WHERE (${level}::TEXT IS NULL OR level = ${level})
        AND (
          ${query}::TEXT IS NULL
          OR route ILIKE ${query}
          OR method ILIKE ${query}
          OR error_message ILIKE ${query}
          OR COALESCE(user_id, '') ILIKE ${query}
        )
      ORDER BY created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;
  }

  return {
    rows: rowsResult.rows as unknown as ErrorLogRow[],
    total: Number(totalResult.rows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function deleteErrorLogsByIds(ids: number[]) {
  if (!ids.length) return 0;

  let result;
  try {
    result = await sql`
      DELETE FROM error_logs
      WHERE id = ANY(${ids}::BIGINT[])
      RETURNING id
    `;
  } catch (error) {
    if (!isMissingErrorLogsTableError(error)) {
      throw error;
    }
    await ensureErrorLogsTable();
    return 0;
  }

  return result.rows.length;
}

export async function deleteErrorLogsOlderThanDays(days: number) {
  const safeDays = Math.max(1, Math.floor(days));

  let result;
  try {
    result = await sql`
      DELETE FROM error_logs
      WHERE created_at < NOW() - (${safeDays} * INTERVAL '1 day')
      RETURNING id
    `;
  } catch (error) {
    if (!isMissingErrorLogsTableError(error)) {
      throw error;
    }
    await ensureErrorLogsTable();
    return 0;
  }

  return result.rows.length;
}

export async function createMissingPaymentUrlLogIfNeeded(input: {
  route: string;
  method: string;
  invoiceId: string;
  clientId: string;
  origin: MissingPaymentUrlLogOrigin;
  qboDocNumber?: string | null;
  qboInvoiceId?: string | null;
  qboSyncStatus?: string | null;
  cooldownMinutes?: number;
}) {
  const cooldownMinutes = Math.max(1, Math.floor(input.cooldownMinutes ?? 60));

  let duplicateCheck;
  try {
    duplicateCheck = await sql`
      SELECT id
      FROM error_logs
      WHERE route = ${input.route}
        AND method = ${input.method}
        AND error_name = 'MissingQboPaymentUrl'
        AND metadata->>'invoiceId' = ${input.invoiceId}
        AND created_at >= NOW() - (${cooldownMinutes} * INTERVAL '1 minute')
      ORDER BY created_at DESC
      LIMIT 1
    `;
  } catch (error) {
    if (!isMissingErrorLogsTableError(error)) {
      throw error;
    }
    await ensureErrorLogsTable();
    duplicateCheck = await sql`
      SELECT id
      FROM error_logs
      WHERE route = ${input.route}
        AND method = ${input.method}
        AND error_name = 'MissingQboPaymentUrl'
        AND metadata->>'invoiceId' = ${input.invoiceId}
        AND created_at >= NOW() - (${cooldownMinutes} * INTERVAL '1 minute')
      ORDER BY created_at DESC
      LIMIT 1
    `;
  }

  if (duplicateCheck.rows.length > 0) {
    return null;
  }

  const docOrId = input.qboDocNumber?.trim() || input.qboInvoiceId?.trim() || input.invoiceId;
  const msg = `MISSING_QBO_PAY_URL inv:${docOrId} cli:${input.clientId} origin:${input.origin}`;

  return createErrorLog({
    level: "warn",
    route: input.route,
    method: input.method,
    statusCode: 200,
    errorName: "MissingQboPaymentUrl",
    errorMessage: msg,
    metadata: {
      invoiceId: input.invoiceId,
      clientId: input.clientId,
      qboDocNumber: input.qboDocNumber ?? null,
      qboInvoiceId: input.qboInvoiceId ?? null,
      qboSyncStatus: input.qboSyncStatus ?? null,
      origin: input.origin,
      event: "missing_qbo_payment_url",
    },
  });
}
