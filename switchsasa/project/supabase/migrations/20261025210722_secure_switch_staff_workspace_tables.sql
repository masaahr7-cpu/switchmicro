/*
# Secure Switch operational records behind staff authentication

1. Purpose
- Remove anonymous access from the existing loan management workspace tables now that the app has secure staff login.

2. Modified tables
- `branches`, `customers`, `loan_products`, `loan_applications`, `payments`, and `audit_events`.
- Existing records, columns, indexes, and relationships remain unchanged.

3. Security changes
- Revoke browser CRUD privileges from `anon` on all operational tables.
- Grant only the existing operational CRUD permissions to `authenticated`.
- Replace public shared policies with staff-profile membership policies.
- A signed-in Switch staff member may access operational records; anonymous visitors cannot.

4. Important notes
- The public website uses only public content and the public contact insert policy.
- No operational data is deleted or modified by this migration.
*/

REVOKE SELECT, INSERT, UPDATE, DELETE ON branches, customers, loan_products, loan_applications, payments, audit_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON branches, customers, loan_products, loan_applications, payments, audit_events TO authenticated;

DROP POLICY IF EXISTS "workspace_select_branches" ON branches;
CREATE POLICY "staff_select_branches" ON branches FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_insert_branches" ON branches;
CREATE POLICY "staff_insert_branches" ON branches FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_update_branches" ON branches;
CREATE POLICY "staff_update_branches" ON branches FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_delete_branches" ON branches;
CREATE POLICY "staff_delete_branches" ON branches FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "workspace_select_customers" ON customers;
CREATE POLICY "staff_select_customers" ON customers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_insert_customers" ON customers;
CREATE POLICY "staff_insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_update_customers" ON customers;
CREATE POLICY "staff_update_customers" ON customers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_delete_customers" ON customers;
CREATE POLICY "staff_delete_customers" ON customers FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "workspace_select_products" ON loan_products;
CREATE POLICY "staff_select_products" ON loan_products FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_insert_products" ON loan_products;
CREATE POLICY "staff_insert_products" ON loan_products FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_update_products" ON loan_products;
CREATE POLICY "staff_update_products" ON loan_products FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_delete_products" ON loan_products;
CREATE POLICY "staff_delete_products" ON loan_products FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "workspace_select_applications" ON loan_applications;
CREATE POLICY "staff_select_applications" ON loan_applications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_insert_applications" ON loan_applications;
CREATE POLICY "staff_insert_applications" ON loan_applications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_update_applications" ON loan_applications;
CREATE POLICY "staff_update_applications" ON loan_applications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_delete_applications" ON loan_applications;
CREATE POLICY "staff_delete_applications" ON loan_applications FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "workspace_select_payments" ON payments;
CREATE POLICY "staff_select_payments" ON payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_insert_payments" ON payments;
CREATE POLICY "staff_insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_update_payments" ON payments;
CREATE POLICY "staff_update_payments" ON payments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_delete_payments" ON payments;
CREATE POLICY "staff_delete_payments" ON payments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "workspace_select_audit_events" ON audit_events;
CREATE POLICY "staff_select_audit_events" ON audit_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_insert_audit_events" ON audit_events;
CREATE POLICY "staff_insert_audit_events" ON audit_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_update_audit_events" ON audit_events;
CREATE POLICY "staff_update_audit_events" ON audit_events FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "workspace_delete_audit_events" ON audit_events;
CREATE POLICY "staff_delete_audit_events" ON audit_events FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
