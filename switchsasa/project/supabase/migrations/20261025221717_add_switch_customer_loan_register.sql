/*
# Add customer loan register and payment history

1. Purpose
- Add the requested field set for the staff customer loan register without removing
  or renaming any existing Switch records.
- Keep totals and balances calculated by the database, not trusted from the browser.
- Add an atomic payment workflow that updates the customer balance and records each
  payment in a durable history table.

2. Modified table: `customers`
- `customer_name`: customer name used by the new register.
- `phone_no`: Tanzanian phone number used by the new register.
- `dis_date`: loan disbursement date.
- `amount`: principal loan amount.
- `late`: late fee, default zero.
- `interest`: interest amount, default zero.
- `total_amount`: generated total of amount + late + interest.
- `payment`: cumulative amount paid, default zero.
- `balance`: generated remaining balance, never below zero.
- `pay_date`: most recent payment date.
- `location`: customer location.
- `dhamana`: collateral or guarantor asset.
- `occupation`: customer occupation.
- `mdhamini`: guarantor name.
- `mdhamini_no`: guarantor phone.
- Existing columns and existing rows remain intact.

3. New table: `customer_payment_history`
- `id`: payment record identifier.
- `customer_id`: linked customer.
- `amount_paid`: amount added to the customer's cumulative payment.
- `pay_date`: payment date.
- `created_by`: authenticated staff member who recorded it.
- `created_at`: audit timestamp.

4. New functions
- `register_customer_loan(...)`: validates staff access, phone format, non-negative
  amounts, and non-future disbursement date before inserting a customer record.
- `record_customer_payment(...)`: validates staff access and payment values, then
  atomically updates the customer's payment and inserts payment history.

5. Security
- Enable RLS on `customer_payment_history`.
- Staff profiles can read customer register data and payment history.
- Customer loan registration and payment updates are performed through SECURITY
  DEFINER functions that derive `created_by` from `auth.uid()`.
- Browser writes to calculated and audit fields are not granted directly.
- Keep existing operational data and relationships unchanged.

6. Important notes
- The existing `payments` table is retained for the earlier loan-application flow.
- The new customer register uses `customer_payment_history` so both workflows can
  coexist without losing prior payment records.
- Phone uniqueness is enforced for non-empty new-register phone numbers.
*/

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS phone_no text,
  ADD COLUMN IF NOT EXISTS dis_date date,
  ADD COLUMN IF NOT EXISTS amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS late numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pay_date date,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS dhamana text,
  ADD COLUMN IF NOT EXISTS mdhamini text,
  ADD COLUMN IF NOT EXISTS mdhamini_no text;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS total_amount numeric(14,2)
  GENERATED ALWAYS AS (COALESCE(amount, 0) + COALESCE(late, 0) + COALESCE(interest, 0)) STORED;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS balance numeric(14,2)
  GENERATED ALWAYS AS (GREATEST((COALESCE(amount, 0) + COALESCE(late, 0) + COALESCE(interest, 0)) - COALESCE(payment, 0), 0)) STORED;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_loan_amounts_nonnegative;
ALTER TABLE customers ADD CONSTRAINT customers_loan_amounts_nonnegative
  CHECK (COALESCE(amount, 0) >= 0 AND late >= 0 AND interest >= 0 AND payment >= 0);

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_no_format;
ALTER TABLE customers ADD CONSTRAINT customers_phone_no_format
  CHECK (phone_no IS NULL OR phone_no = '' OR phone_no ~ '^(0[67][0-9]{8}|\+255[67][0-9]{8})$');

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_no_unique
  ON customers (phone_no)
  WHERE phone_no IS NOT NULL AND phone_no <> '';

CREATE INDEX IF NOT EXISTS customers_register_search_idx
  ON customers (lower(customer_name), phone_no, lower(location));

CREATE TABLE IF NOT EXISTS customer_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount_paid numeric(14,2) NOT NULL CHECK (amount_paid > 0),
  pay_date date NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_payment_history_customer_idx
  ON customer_payment_history(customer_id, pay_date DESC, created_at DESC);

ALTER TABLE customer_payment_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON customers TO authenticated;
GRANT SELECT ON customer_payment_history TO authenticated;

DROP POLICY IF EXISTS "staff_read_customer_payment_history" ON customer_payment_history;
CREATE POLICY "staff_read_customer_payment_history" ON customer_payment_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION register_customer_loan(
  p_customer_name text,
  p_phone_no text,
  p_dis_date date,
  p_amount numeric,
  p_late numeric DEFAULT 0,
  p_interest numeric DEFAULT 0,
  p_location text DEFAULT NULL,
  p_dhamana text DEFAULT NULL,
  p_occupation text DEFAULT NULL,
  p_mdhamini text DEFAULT NULL,
  p_mdhamini_no text DEFAULT NULL
)
RETURNS customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer customers;
  v_phone text := regexp_replace(trim(coalesce(p_phone_no, '')), '\\s+', '', 'g');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF nullif(trim(coalesce(p_customer_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF v_phone !~ '^(0[67][0-9]{8}|\+255[67][0-9]{8})$' THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;
  IF p_dis_date IS NULL OR p_dis_date > current_date THEN
    RAISE EXCEPTION 'Invalid disbursement date';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR coalesce(p_late, 0) < 0 OR coalesce(p_interest, 0) < 0 THEN
    RAISE EXCEPTION 'Invalid loan amount';
  END IF;
  IF p_mdhamini_no IS NOT NULL AND trim(p_mdhamini_no) <> '' AND trim(p_mdhamini_no) !~ '^(0[67][0-9]{8}|\+255[67][0-9]{8})$' THEN
    RAISE EXCEPTION 'Invalid guarantor phone number';
  END IF;
  IF EXISTS (SELECT 1 FROM customers WHERE phone_no = v_phone) THEN
    RAISE EXCEPTION 'Phone number already exists';
  END IF;

  INSERT INTO customers (
    customer_number, full_name, phone, occupation, customer_name, phone_no,
    dis_date, amount, late, interest, payment, location, dhamana, mdhamini, mdhamini_no,
    kyc_status
  ) VALUES (
    'CUS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    trim(p_customer_name), v_phone, nullif(trim(coalesce(p_occupation, '')), ''),
    trim(p_customer_name), v_phone, p_dis_date, p_amount, coalesce(p_late, 0),
    coalesce(p_interest, 0), 0, nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_dhamana, '')), ''), nullif(trim(coalesce(p_mdhamini, '')), ''),
    nullif(trim(coalesce(p_mdhamini_no, '')), ''), 'Pending'
  ) RETURNING * INTO v_customer;

  RETURN v_customer;
END;
$$;

REVOKE EXECUTE ON FUNCTION register_customer_loan(text, text, date, numeric, numeric, numeric, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION register_customer_loan(text, text, date, numeric, numeric, numeric, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION record_customer_payment(
  p_customer_id uuid,
  p_amount_paid numeric,
  p_pay_date date
)
RETURNS customer_payment_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment customer_payment_history;
  v_customer customers;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_amount_paid IS NULL OR p_amount_paid <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount';
  END IF;
  IF p_pay_date IS NULL OR p_pay_date > current_date THEN
    RAISE EXCEPTION 'Invalid payment date';
  END IF;

  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id FOR UPDATE;
  IF v_customer.id IS NULL OR v_customer.amount IS NULL THEN
    RAISE EXCEPTION 'Customer loan not found';
  END IF;

  UPDATE customers
  SET payment = COALESCE(payment, 0) + p_amount_paid,
      pay_date = p_pay_date,
      updated_at = now()
  WHERE id = p_customer_id;

  INSERT INTO customer_payment_history (customer_id, amount_paid, pay_date, created_by)
  VALUES (p_customer_id, p_amount_paid, p_pay_date, auth.uid())
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_customer_payment(uuid, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_customer_payment(uuid, numeric, date) TO authenticated;
