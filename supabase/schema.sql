-- Enable Row Level Security on all tables
ALTER TABLE IF EXISTS clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
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

-- Create subscriptions table (for plan change history)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  old_plan TEXT,
  new_plan TEXT NOT NULL,
  change_type TEXT CHECK (change_type IN ('upgrade', 'downgrade', 'cancel')),
  change_date TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoices table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id ON clients(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);

-- RLS Policies for clients table
DROP POLICY IF EXISTS "Users can view their own client profile" ON clients;
CREATE POLICY "Users can view their own client profile"
  ON clients FOR SELECT
  USING (auth.uid() = owner_user_id OR auth.jwt() ->> 'email' = 'your-admin-email@example.com');

DROP POLICY IF EXISTS "Users can update their own client profile" ON clients;
CREATE POLICY "Users can update their own client profile"
  ON clients FOR UPDATE
  USING (auth.uid() = owner_user_id OR auth.jwt() ->> 'email' = 'your-admin-email@example.com')
  WITH CHECK (auth.uid() = owner_user_id OR auth.jwt() ->> 'email' = 'your-admin-email@example.com');

DROP POLICY IF EXISTS "Users can insert their own client profile" ON clients;
CREATE POLICY "Users can insert their own client profile"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Admin can do anything with clients" ON clients;
CREATE POLICY "Admin can do anything with clients"
  ON clients FOR ALL
  USING (auth.jwt() ->> 'email' = 'your-admin-email@example.com');

-- RLS Policies for subscriptions table
DROP POLICY IF EXISTS "Users can view their own subscription history" ON subscriptions;
CREATE POLICY "Users can view their own subscription history"
  ON subscriptions FOR SELECT
  USING (
    client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid())
    OR auth.jwt() ->> 'email' = 'your-admin-email@example.com'
  );

DROP POLICY IF EXISTS "Users can insert their own subscription changes" ON subscriptions;
CREATE POLICY "Users can insert their own subscription changes"
  ON subscriptions FOR INSERT
  WITH CHECK (
    client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid())
    OR auth.jwt() ->> 'email' = 'your-admin-email@example.com'
  );

DROP POLICY IF EXISTS "Admin can do anything with subscriptions" ON subscriptions;
CREATE POLICY "Admin can do anything with subscriptions"
  ON subscriptions FOR ALL
  USING (auth.jwt() ->> 'email' = 'your-admin-email@example.com');

-- RLS Policies for invoices table
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (
    client_id IN (SELECT id FROM clients WHERE owner_user_id = auth.uid())
    OR auth.jwt() ->> 'email' = 'your-admin-email@example.com'
  );

DROP POLICY IF EXISTS "Admin can manage all invoices" ON invoices;
CREATE POLICY "Admin can manage all invoices"
  ON invoices FOR ALL
  USING (auth.jwt() ->> 'email' = 'your-admin-email@example.com');

-- Create storage bucket for invoice PDFs (run this in the Supabase dashboard)
-- Storage bucket name: "invoices"
-- Public: true (for client access via public URLs)
-- Then add storage policies:

-- Storage policy for viewing invoices
-- CREATE POLICY "Users can view their own invoice PDFs"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'invoices' 
--   AND (
--     auth.uid()::text = (storage.foldername(name))[1]
--     OR auth.jwt() ->> 'email' = 'your-admin-email@example.com'
--   )
-- );

-- Storage policy for uploading invoices (admin only)
-- CREATE POLICY "Admin can upload invoice PDFs"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'invoices'
--   AND auth.jwt() ->> 'email' = 'your-admin-email@example.com'
-- );
