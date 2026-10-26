/*
# Create SWITCH Microfinance loan management core

1. Purpose
- Establish the durable operating data used by the dashboard and lending workflows.
- This is a single-tenant institution workspace without a sign-in screen in this first release.

2. New tables and columns
- `branches`: branch code, name, location, manager, status, and timestamps.
- `customers`: customer identity, contact details, occupation, risk rating, KYC status, branch, and timestamps.
- `loan_products`: configurable product name, category, interest rate, term, frequency, limits, and status.
- `loan_applications`: customer, product, branch, requested amount, purpose, score, stage, collateral, and timestamps.
- `payments`: application, customer, amount, payment method, reference, payment date, and receipt status.
- `audit_events`: actor, action, area, description, severity, and timestamp for operational traceability.

3. Security
- Enable row level security on every table.
- Grant only the CRUD verbs needed by the browser to `anon` and `authenticated`.
- Add separate CRUD policies for the intentionally shared single-tenant workspace.

4. Important notes
- Seed records provide a useful management view immediately after the first load.
- All monetary values are numeric and all timestamps are timezone-aware.
- No existing tables or user data are modified or removed.
*/

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  location text NOT NULL,
  manager text NOT NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Review', 'Inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  occupation text,
  risk_rating text NOT NULL DEFAULT 'Medium' CHECK (risk_rating IN ('Low', 'Medium', 'High')),
  kyc_status text NOT NULL DEFAULT 'Pending' CHECK (kyc_status IN ('Verified', 'Pending', 'Review')),
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  interest_rate numeric(6,2) NOT NULL DEFAULT 18,
  term_months integer NOT NULL DEFAULT 12,
  repayment_frequency text NOT NULL DEFAULT 'Monthly',
  minimum_amount numeric(14,2) NOT NULL DEFAULT 500000,
  maximum_amount numeric(14,2) NOT NULL DEFAULT 25000000,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Draft', 'Archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES loan_products(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  requested_amount numeric(14,2) NOT NULL,
  approved_amount numeric(14,2),
  purpose text NOT NULL,
  credit_score integer,
  stage text NOT NULL DEFAULT 'Assessment' CHECK (stage IN ('Draft', 'Submitted', 'Assessment', 'Approval', 'Approved', 'Disbursed', 'Overdue', 'Closed', 'Rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  application_id uuid NOT NULL REFERENCES loan_applications(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('Bank', 'Mobile Money', 'Cash')),
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Posted' CHECK (status IN ('Posted', 'Pending', 'Reversed'))
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  area text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'Info' CHECK (severity IN ('Info', 'Success', 'Warning', 'Critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_branch_id ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_stage ON loan_applications(stage);
CREATE INDEX IF NOT EXISTS idx_loan_applications_customer_id ON loan_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON branches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON loan_products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON loan_applications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_events TO anon, authenticated;

DROP POLICY IF EXISTS "workspace_select_branches" ON branches;
CREATE POLICY "workspace_select_branches" ON branches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workspace_insert_branches" ON branches;
CREATE POLICY "workspace_insert_branches" ON branches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_update_branches" ON branches;
CREATE POLICY "workspace_update_branches" ON branches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_delete_branches" ON branches;
CREATE POLICY "workspace_delete_branches" ON branches FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "workspace_select_customers" ON customers;
CREATE POLICY "workspace_select_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workspace_insert_customers" ON customers;
CREATE POLICY "workspace_insert_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_update_customers" ON customers;
CREATE POLICY "workspace_update_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_delete_customers" ON customers;
CREATE POLICY "workspace_delete_customers" ON customers FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "workspace_select_products" ON loan_products;
CREATE POLICY "workspace_select_products" ON loan_products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workspace_insert_products" ON loan_products;
CREATE POLICY "workspace_insert_products" ON loan_products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_update_products" ON loan_products;
CREATE POLICY "workspace_update_products" ON loan_products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_delete_products" ON loan_products;
CREATE POLICY "workspace_delete_products" ON loan_products FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "workspace_select_applications" ON loan_applications;
CREATE POLICY "workspace_select_applications" ON loan_applications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workspace_insert_applications" ON loan_applications;
CREATE POLICY "workspace_insert_applications" ON loan_applications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_update_applications" ON loan_applications;
CREATE POLICY "workspace_update_applications" ON loan_applications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_delete_applications" ON loan_applications;
CREATE POLICY "workspace_delete_applications" ON loan_applications FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "workspace_select_payments" ON payments;
CREATE POLICY "workspace_select_payments" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workspace_insert_payments" ON payments;
CREATE POLICY "workspace_insert_payments" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_update_payments" ON payments;
CREATE POLICY "workspace_update_payments" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_delete_payments" ON payments;
CREATE POLICY "workspace_delete_payments" ON payments FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "workspace_select_audit_events" ON audit_events;
CREATE POLICY "workspace_select_audit_events" ON audit_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "workspace_insert_audit_events" ON audit_events;
CREATE POLICY "workspace_insert_audit_events" ON audit_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_update_audit_events" ON audit_events;
CREATE POLICY "workspace_update_audit_events" ON audit_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "workspace_delete_audit_events" ON audit_events;
CREATE POLICY "workspace_delete_audit_events" ON audit_events FOR DELETE TO anon, authenticated USING (true);

INSERT INTO branches (code, name, location, manager, status) VALUES
  ('HQ-001', 'Head Office', 'Dar es Salaam', 'Amina Mollel', 'Active'),
  ('ARU-002', 'Arusha Branch', 'Arusha', 'Daniel Mushi', 'Active'),
  ('MWZ-003', 'Mwanza Branch', 'Mwanza', 'Grace John', 'Active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO loan_products (name, category, interest_rate, term_months, repayment_frequency, minimum_amount, maximum_amount, status) VALUES
  ('Jasiri Salary Loan', 'Personal', 18, 12, 'Monthly', 500000, 15000000, 'Active'),
  ('Biashara Growth', 'Business', 22, 18, 'Monthly', 2000000, 50000000, 'Active'),
  ('Mkulima Seasonal', 'Agriculture', 16, 9, 'Quarterly', 1000000, 30000000, 'Active'),
  ('Asset Finance', 'Asset Finance', 20, 24, 'Monthly', 5000000, 80000000, 'Active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO audit_events (actor, action, area, description, severity) VALUES
  ('System', 'Portfolio sync', 'Operations', 'Daily portfolio figures reconciled successfully', 'Success'),
  ('Amina Mollel', 'Approval review', 'Credit', 'Application LN-2026-0042 moved to committee review', 'Info'),
  ('Daniel Mushi', 'KYC update', 'Compliance', 'Customer verification completed for 8 records', 'Success'),
  ('System', 'Collection alert', 'Collections', '12 accounts entered the PAR 30 monitoring queue', 'Warning');
