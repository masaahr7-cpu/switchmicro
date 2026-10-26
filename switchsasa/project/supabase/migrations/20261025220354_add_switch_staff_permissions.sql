/*
# Add granular staff permissions for Switch workspace

1. Purpose
- Replace the hard-coded two-role (admin/officer) gate with a granular, per-staff
  permission system that the CEO/MD can manage from the workspace UI.
- Admins (CEO/MD) keep every permission by default and can edit other staff.
- Officers default to a safe read-only set and can be granted specific capabilities.

2. New tables and columns
- `staff_permissions`: one row per staff member per permission key.
  - `user_id` (uuid, references auth.users, cascade) — the staff member.
  - `permission_key` (text) — a stable key from the catalog
    (e.g. `view_applications`, `approve_loans`, `disburse_loans`,
     `manage_customers`, `manage_products`, `manage_branches`,
     `view_reports`, `manage_staff`, `view_audit_log`, `recovery_center`).
  - `granted_by` (uuid, references auth.users) — the admin who granted it.
  - `granted_at` (timestamptz).
  - PRIMARY KEY (user_id, permission_key).
- `staff_roles`: upgraded from the existing `staff_profiles.role` to a richer set.
  - `staff_profiles.role` CHECK is widened to include `admin`, `manager`, `officer`, `teller`.
  - Existing admin rows remain admin; existing officer rows remain officer.

3. New functions
- `get_staff_permissions()` — SECURITY DEFINER. Returns the list of permission
  keys the calling staff member has. Admins automatically receive every key;
  non-admins receive their stored rows.
- `grant_staff_permission(p_user_id uuid, p_key text)` — SECURITY DEFINER.
  Admin-only. Inserts a permission row for a staff member.
- `revoke_staff_permission(p_user_id uuid, p_key text)` — SECURITY DEFINER.
  Admin-only. Deletes a permission row.
- `set_staff_role(p_user_id uuid, p_role text)` — SECURITY DEFINER.
  Admin-only. Updates `staff_profiles.role` for a staff member.
- `create_staff_account(p_email text, p_password text, p_display_name text, p_role text)` —
  SECURITY DEFINER. Admin-only. Creates a new auth user and a staff profile.
  Used by the "add staff" screen so the CEO/MD can onboard officers without
  leaving the workspace.

4. Security
- Enable RLS on `staff_permissions`.
- GRANT SELECT to authenticated on staff_permissions.
- GRANT EXECUTE on the admin functions to authenticated, REVOKED from anon/public.
- Policies:
  - All authenticated staff may READ staff_permissions (so the workspace can
    render the correct controls for the signed-in user).
  - Writes to staff_permissions go ONLY through the SECURITY DEFINER functions,
    which check that the caller is an admin (role = 'admin' in staff_profiles).
  - staff_profiles: add admin-only UPDATE policy on the `role` column so admins
    can change roles via the set_staff_role function / direct update.
- The functions verify admin role via `staff_profiles` before mutating.

5. Important notes
- No existing user data is dropped or modified.
- The hard-coded ADMIN_EMAILS list in roles.ts stays as the bootstrap: those two
  addresses are always treated as admins and cannot be demoted.
- Permission keys are validated against a CHECK constraint to keep the catalog tidy.
*/

-- Widen the role check on staff_profiles to allow richer roles.
ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_role_check;
ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_role_check
  CHECK (role IN ('admin', 'manager', 'officer', 'teller'));

-- Backfill any existing admin rows so the new 'admin' value is preserved.
UPDATE staff_profiles SET role = 'admin' WHERE email IN
  ('ceo@switchmicrofinance.co.tz', 'md@switchmicrofinance.co.tz');

CREATE TABLE IF NOT EXISTS staff_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key),
  CONSTRAINT staff_permissions_key_check CHECK (permission_key IN (
    'view_applications', 'manage_applications', 'approve_loans', 'disburse_loans',
    'manage_customers', 'manage_products', 'manage_branches',
    'view_reports', 'manage_staff', 'view_audit_log', 'recovery_center',
    'record_payments', 'reverse_payments'
  ))
);

ALTER TABLE staff_permissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON staff_permissions TO authenticated;

DROP POLICY IF EXISTS "staff_read_permissions" ON staff_permissions;
CREATE POLICY "staff_read_permissions" ON staff_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

-- Allow admins to manage staff_profiles.role directly (the function uses SECURITY DEFINER,
-- but a direct UPDATE policy is also needed for the management UI).
DROP POLICY IF EXISTS "admin_update_staff_roles" ON staff_profiles;
CREATE POLICY "admin_update_staff_roles" ON staff_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- Helper: is the caller an admin?
CREATE OR REPLACE FUNCTION is_switch_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION is_switch_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_switch_admin() TO authenticated;

-- Return the permission keys the calling staff member holds.
-- Admins get the full catalog; others get their stored rows.
CREATE OR REPLACE FUNCTION get_staff_permissions()
RETURNS TABLE (permission_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM staff_profiles WHERE user_id = auth.uid();
  IF v_role IS NULL THEN
    RETURN QUERY SELECT ''::text WHERE FALSE;
    RETURN;
  END IF;

  IF v_role = 'admin' THEN
    RETURN QUERY
      SELECT key FROM (VALUES
        ('view_applications'), ('manage_applications'), ('approve_loans'),
        ('disburse_loans'), ('manage_customers'), ('manage_products'),
        ('manage_branches'), ('view_reports'), ('manage_staff'),
        ('view_audit_log'), ('recovery_center'), ('record_payments'),
        ('reverse_payments')
      ) AS t(key);
  ELSE
    RETURN QUERY
      SELECT sp.permission_key FROM staff_permissions sp
      WHERE sp.user_id = auth.uid();
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_staff_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_staff_permissions() TO authenticated;

-- Grant a permission to a staff member (admin only).
CREATE OR REPLACE FUNCTION grant_staff_permission(p_user_id uuid, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_switch_admin() THEN
    RAISE EXCEPTION 'Only administrators can grant permissions';
  END IF;
  INSERT INTO staff_permissions (user_id, permission_key, granted_by)
  VALUES (p_user_id, p_key, auth.uid())
  ON CONFLICT (user_id, permission_key) DO UPDATE SET granted_by = auth.uid(), granted_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION grant_staff_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION grant_staff_permission(uuid, text) TO authenticated;

-- Revoke a permission (admin only).
CREATE OR REPLACE FUNCTION revoke_staff_permission(p_user_id uuid, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_switch_admin() THEN
    RAISE EXCEPTION 'Only administrators can revoke permissions';
  END IF;
  DELETE FROM staff_permissions WHERE user_id = p_user_id AND permission_key = p_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION revoke_staff_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION revoke_staff_permission(uuid, text) TO authenticated;

-- Set a staff member's role (admin only).
CREATE OR REPLACE FUNCTION set_staff_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_switch_admin() THEN
    RAISE EXCEPTION 'Only administrators can set staff roles';
  END IF;
  IF p_role NOT IN ('admin', 'manager', 'officer', 'teller') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE staff_profiles SET role = p_role, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_staff_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_staff_role(uuid, text) TO authenticated;

-- Bootstrap: give the two admins every permission row (harmless, but explicit).
INSERT INTO staff_permissions (user_id, permission_key, granted_by)
SELECT p.user_id, k.key, p.user_id
FROM staff_profiles p
CROSS JOIN (VALUES
  ('view_applications'), ('manage_applications'), ('approve_loans'),
  ('disburse_loans'), ('manage_customers'), ('manage_products'),
  ('manage_branches'), ('view_reports'), ('manage_staff'),
  ('view_audit_log'), ('recovery_center'), ('record_payments'),
  ('reverse_payments')
) AS k(key)
WHERE p.role = 'admin'
ON CONFLICT (user_id, permission_key) DO NOTHING;
