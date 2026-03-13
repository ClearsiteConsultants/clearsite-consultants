-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT,
  domain_name TEXT,
  plan TEXT DEFAULT 'Starter' CHECK (plan IN ('Starter', 'Pro', 'Enterprise')),
  service_status TEXT DEFAULT 'Active' CHECK (service_status IN ('Active', 'Canceled')),
  next_invoice_due DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table (for plan change history)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  old_plan TEXT,
  new_plan TEXT NOT NULL,
  change_type TEXT CHECK (change_type IN ('upgrade', 'downgrade', 'cancel')),
  change_date TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  amount_due DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Paid', 'Unpaid', 'Overdue')),
  file_url TEXT,
  qbo_payment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
