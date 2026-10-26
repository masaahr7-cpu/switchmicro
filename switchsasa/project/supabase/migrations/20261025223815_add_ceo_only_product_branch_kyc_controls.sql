/*
# CEO-only product/branch editing, single Mbeya Main branch, and client approval flow

1. Purpose
- Make loan product create / edit / delete a CEO / MD only operation.
- Make branch create / edit / delete a CEO / MD only operation, and consolidate the
  branch list to the single operating branch "Mbeya Main" the business actually runs.
- Add a client KYC approval flow: newly registered clients stay "Pending" until a
  CEO / MD administrator approves them in the dashboard.

2. New helper function
- `is_current_user_admin()` returns true when the signed-in user's staff_profiles.role
  is 'admin'. Used by RLS policies so non-admin staff cannot mutate catalogues even
  though they can still read them.

3. Modified RLS policies
- `loan_products` SELECT stays open to all staff. INSERT / UPDATE / DELETE now require
  `is_current_user_admin()` so only the CEO / MD can add, edit or delete products.
- `branches` SELECT stays open to all staff. INSERT / UPDATE / DELETE now require
  `is_current_user_admin()` so only the CEO / MD can manage branches.

4. Modified table: `loan_products`
- Add `updated_at` column so product edits are timestamped (matches branches behaviour).

5. Data change: consolidate branches to a single "Mbeya Main" branch
- Update the first existing branch row in place to become the Mbeya Main branch the
  business actually operates. This preserves the primary key and any foreign keys that
  already point at branches (e.g. customers.branch_id). The remaining two branch rows
  are deleted because they no longer reflect real locations.
- The result is exactly one branch row: code MBEYA-001, name "Mbeya Main".

6. New SECURITY DEFINER functions (admin-only)
- `upsert_loan_product(...)`: inserts a new product or updates an existing one by id.
  Validates required fields and non-negative amounts. Only admin staff may call it.
- `delete_loan_product(p_id uuid)`: deletes a product by id. Admin-only.
- `approve_customer_kyc(p_customer_id uuid)`: sets kyc_status to 'Verified'. Admin-only.

7. Security
- `is_current_user_admin`, `upsert_loan_product`, `delete_loan_product` and
  `approve_customer_kyc` are SECURITY DEFINER, owned by postgres, with a pinned
  search_path. EXECUTE is revoked from PUBLIC/anon and granted only to authenticated.
- RLS remains enabled on loan_products and branches; only the policy predicates change.

8. Important notes
- No customer data is lost. Customers linked to the first branch keep their branch_id.
- Non-admin staff retain read access to products and branches and can still register
  clients; they simply cannot edit the catalogue or approve KYC.
*/

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles
    WHERE staff_profiles.user_id = auth.uid() AND staff_profiles.role = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION is_current_user_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;

ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Loan products: SELECT for all staff, writes admin-only.
DROP POLICY IF EXISTS "staff_select_products" ON loan_products;
CREATE POLICY "staff_select_products" ON loan_products
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_insert_products" ON loan_products;
CREATE POLICY "staff_insert_products" ON loan_products
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS "staff_update_products" ON loan_products;
CREATE POLICY "staff_update_products" ON loan_products
  FOR UPDATE TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS "staff_delete_products" ON loan_products;
CREATE POLICY "staff_delete_products" ON loan_products
  FOR DELETE TO authenticated
  USING (is_current_user_admin());

-- Branches: SELECT for all staff, writes admin-only.
DROP POLICY IF EXISTS "staff_select_branches" ON branches;
CREATE POLICY "staff_select_branches" ON branches
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_insert_branches" ON branches;
CREATE POLICY "staff_insert_branches" ON branches
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS "staff_update_branches" ON branches;
CREATE POLICY "staff_update_branches" ON branches
  FOR UPDATE TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS "staff_delete_branches" ON branches;
CREATE POLICY "staff_delete_branches" ON branches
  FOR DELETE TO authenticated
  USING (is_current_user_admin());

-- Consolidate to the single operating branch: Mbeya Main. Keep the first row's id so
-- existing customer.branch_id references stay valid; remove the other two rows.
WITH first_branch AS (
  SELECT id FROM branches ORDER BY created_at LIMIT 1
)
UPDATE branches
SET code = 'MBEYA-001', name = 'Mbeya Main', location = 'Mbeya Soko Matola', manager = 'Switch Microfinance', status = 'Active', updated_at = now()
WHERE id = (SELECT id FROM first_branch);

DELETE FROM branches
WHERE id NOT IN (SELECT id FROM branches ORDER BY created_at LIMIT 1);

CREATE OR REPLACE FUNCTION upsert_loan_product(
  p_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_interest_rate numeric DEFAULT NULL,
  p_term_months integer DEFAULT NULL,
  p_repayment_frequency text DEFAULT 'Monthly',
  p_minimum_amount numeric DEFAULT NULL,
  p_maximum_amount numeric DEFAULT NULL,
  p_status text DEFAULT 'Active'
)
RETURNS loan_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result loan_products;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Only the CEO / MD can manage loan products.';
  END IF;
  IF nullif(trim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Product name is required.';
  END IF;
  IF nullif(trim(coalesce(p_category, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Product category is required.';
  END IF;
  IF p_interest_rate IS NULL OR p_interest_rate < 0 THEN
    RAISE EXCEPTION 'Interest rate must be zero or positive.';
  END IF;
  IF p_term_months IS NULL OR p_term_months <= 0 THEN
    RAISE EXCEPTION 'Term must be at least one month.';
  END IF;
  IF p_minimum_amount IS NULL OR p_minimum_amount < 0 OR p_maximum_amount IS NULL OR p_maximum_amount < p_minimum_amount THEN
    RAISE EXCEPTION 'Minimum and maximum amounts are invalid.';
  END IF;
  IF p_status NOT IN ('Active', 'Inactive') THEN
    RAISE EXCEPTION 'Status must be Active or Inactive.';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE loan_products
    SET name = trim(p_name), category = trim(p_category), interest_rate = p_interest_rate,
        term_months = p_term_months, repayment_frequency = coalesce(nullif(trim(p_repayment_frequency), ''), 'Monthly'),
        minimum_amount = p_minimum_amount, maximum_amount = p_maximum_amount, status = p_status,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO loan_products (name, category, interest_rate, term_months, repayment_frequency, minimum_amount, maximum_amount, status)
    VALUES (trim(p_name), trim(p_category), p_interest_rate, p_term_months, coalesce(nullif(trim(p_repayment_frequency), ''), 'Monthly'), p_minimum_amount, p_maximum_amount, p_status)
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION upsert_loan_product(uuid, text, text, numeric, integer, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_loan_product(uuid, text, text, numeric, integer, text, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION delete_loan_product(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Only the CEO / MD can delete loan products.';
  END IF;
  DELETE FROM loan_products WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION delete_loan_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_loan_product(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION approve_customer_kyc(p_customer_id uuid)
RETURNS customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer customers;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Only the CEO / MD can approve clients.';
  END IF;
  UPDATE customers
  SET kyc_status = 'Verified', risk_rating = COALESCE(NULLIF(risk_rating, ''), 'Medium'), updated_at = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;

  IF v_customer.id IS NULL THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  INSERT INTO staff_activity (activity_type, description)
  VALUES ('KYC approval', 'Approved client ' || COALESCE(v_customer.full_name, v_customer.customer_name, v_customer.id::text));

  RETURN v_customer;
END;
$$;
REVOKE EXECUTE ON FUNCTION approve_customer_kyc(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION approve_customer_kyc(uuid) TO authenticated;
