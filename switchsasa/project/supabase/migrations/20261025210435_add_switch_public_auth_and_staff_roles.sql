/*
# Add Switch public website support and staff authorization

1. Purpose
- Add secure account profiles and role-aware staff access for the public website and protected workspace.
- Keep existing loan tables and records intact.

2. New tables and columns
- `staff_profiles`: authenticated user id, email, display name, role, and timestamps.
- `contact_messages`: public contact form submissions with name, email, phone, message, status, and timestamps.
- `staff_activity`: authenticated staff activity records with actor, activity type, description, and timestamp.

3. Security
- Enable RLS on all new tables.
- Staff profiles are readable only by the signed-in owner, while administrative reads are allowed only for the configured CEO and MD addresses.
- Contact messages accept public inserts but are readable and manageable only by authenticated staff.
- Staff activity is readable by authenticated staff and can only be written with the current authenticated user id.
- The profile provisioning function derives the role from the authenticated email and cannot be called by anonymous users.

4. Role rules
- CEO: `ceo@switchmicrofinance.co.tz`
- MD: `md@switchmicrofinance.co.tz`
- Other approved company-domain accounts receive the `officer` role.
- The browser may use the role for presentation, but database policies remain the enforcement layer.

5. Important notes
- No passwords, secrets, or credentials are stored in application tables.
- Existing tables are not dropped, renamed, or deleted.
*/

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Switch Team Member',
  role text NOT NULL DEFAULT 'officer' CHECK (role IN ('admin', 'officer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'In Progress', 'Resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_activity_created_at ON staff_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

CREATE OR REPLACE FUNCTION provision_staff_profile(p_display_name text DEFAULT NULL)
RETURNS staff_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_profile staff_profiles;
BEGIN
  IF auth.uid() IS NULL OR v_email = '' OR v_email NOT LIKE '%@switchmicrofinance.co.tz' THEN
    RAISE EXCEPTION 'Only Switch staff accounts may be provisioned';
  END IF;

  INSERT INTO staff_profiles (user_id, email, display_name, role)
  VALUES (
    auth.uid(),
    v_email,
    COALESCE(NULLIF(trim(p_display_name), ''), split_part(v_email, '@', 1)),
    CASE WHEN v_email IN ('ceo@switchmicrofinance.co.tz', 'md@switchmicrofinance.co.tz') THEN 'admin' ELSE 'officer' END
  )
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_activity ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON staff_profiles TO authenticated;
GRANT INSERT ON contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON contact_messages TO authenticated;
GRANT SELECT, INSERT ON staff_activity TO authenticated;
GRANT EXECUTE ON FUNCTION provision_staff_profile(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION provision_staff_profile(text) FROM PUBLIC, anon;

DROP POLICY IF EXISTS "staff_read_own_profile" ON staff_profiles;
CREATE POLICY "staff_read_own_profile" ON staff_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_read_staff_profiles" ON staff_profiles;
CREATE POLICY "admin_read_staff_profiles" ON staff_profiles FOR SELECT TO authenticated USING (lower(auth.jwt() ->> 'email') IN ('ceo@switchmicrofinance.co.tz', 'md@switchmicrofinance.co.tz'));
DROP POLICY IF EXISTS "staff_update_own_profile" ON staff_profiles;
CREATE POLICY "staff_update_own_profile" ON staff_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND role = (SELECT role FROM staff_profiles current_profile WHERE current_profile.user_id = auth.uid()));

DROP POLICY IF EXISTS "public_submit_contact_messages" ON contact_messages;
CREATE POLICY "public_submit_contact_messages" ON contact_messages FOR INSERT TO anon, authenticated WITH CHECK (length(trim(name)) BETWEEN 2 AND 120 AND length(trim(email)) BETWEEN 5 AND 180 AND length(trim(message)) BETWEEN 10 AND 4000);
DROP POLICY IF EXISTS "staff_read_contact_messages" ON contact_messages;
CREATE POLICY "staff_read_contact_messages" ON contact_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_update_contact_messages" ON contact_messages;
CREATE POLICY "staff_update_contact_messages" ON contact_messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_read_activity" ON staff_activity;
CREATE POLICY "staff_read_activity" ON staff_activity FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
DROP POLICY IF EXISTS "staff_insert_own_activity" ON staff_activity;
CREATE POLICY "staff_insert_own_activity" ON staff_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM staff_profiles WHERE staff_profiles.user_id = auth.uid()));
