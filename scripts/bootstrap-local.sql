-- One-time bootstrap for local development database.
-- Run this against your local clearsitedb database.

BEGIN;

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL DEFAULT '',
  last_name VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(50),
  domain_name VARCHAR(255),
  plan VARCHAR(100) DEFAULT NULL,
  service_status VARCHAR(50) DEFAULT 'Active',
  maintenance_fee_frequency VARCHAR(50) DEFAULT 'Monthly',
  next_invoice_due DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS next_invoice_due DATE;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS qbo_customer_id VARCHAR(64);

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS maintenance_fee_frequency VARCHAR(50) DEFAULT 'Monthly';

ALTER TABLE clients
ALTER COLUMN plan DROP DEFAULT;

-- Migration: add first_name / last_name for existing databases that still have contact_name.
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_address_line1 VARCHAR(255);

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_address_line2 VARCHAR(255);

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_city VARCHAR(255);

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_state VARCHAR(255);

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(50);

-- billing_country removed: US only

-- Drop legacy contact_name column if it still exists.
ALTER TABLE clients
DROP COLUMN IF EXISTS contact_name;

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  old_plan VARCHAR(100),
  new_plan VARCHAR(100),
  change_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  due_date DATE,
  qbo_payment_url TEXT,
  qbo_doc_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS qbo_invoice_id VARCHAR(64);

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS qbo_sync_status VARCHAR(32) DEFAULT 'pending';

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS is_manual_link BOOLEAN DEFAULT FALSE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_date DATE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS invoice_total NUMERIC(10,2);

ALTER TABLE invoices
DROP COLUMN IF EXISTS amount_due;

ALTER TABLE invoices
DROP COLUMN IF EXISTS pdf_data;

ALTER TABLE invoices
DROP COLUMN IF EXISTS pdf_mime_type;

ALTER TABLE invoices
DROP COLUMN IF EXISTS pdf_filename;

ALTER TABLE invoices
DROP COLUMN IF EXISTS pdf_size;

CREATE TABLE IF NOT EXISTS quickbooks_connections (
  id SERIAL PRIMARY KEY,
  realm_id VARCHAR(64) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP NOT NULL,
  connected_by_user_id VARCHAR(255),
  reconnect_required BOOLEAN NOT NULL DEFAULT FALSE,
  reconnect_reason VARCHAR(64),
  last_auth_error_code VARCHAR(64),
  last_auth_error_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE quickbooks_connections
ADD COLUMN IF NOT EXISTS reconnect_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE quickbooks_connections
ADD COLUMN IF NOT EXISTS reconnect_reason VARCHAR(64);

ALTER TABLE quickbooks_connections
ADD COLUMN IF NOT EXISTS last_auth_error_code VARCHAR(64);

ALTER TABLE quickbooks_connections
ADD COLUMN IF NOT EXISTS last_auth_error_at TIMESTAMP;

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
);

CREATE OR REPLACE FUNCTION cleanup_error_logs_30_days()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_error_logs_30_days ON error_logs;
CREATE TRIGGER trg_cleanup_error_logs_30_days
BEFORE INSERT ON error_logs
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_error_logs_30_days();

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_qbo_invoice_id ON invoices(qbo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_clients_qbo_customer_id ON clients(qbo_customer_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_route ON error_logs(route);

COMMIT;
