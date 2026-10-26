/*
# Add client form submissions

1. Purpose
- Store completed online copies of the Switch Microfinance loan application,
  guarantor form, and loan agreement forms.
- Let signed-in clients save their own completed form and let staff review the
  submitted content from the database later.

2. New table: `client_form_submissions`
- `id`: unique submission id.
- `user_id`: signed-in client who completed the form.
- `form_type`: one of `loan_application`, `guarantor`, or `loan_agreement`.
- `payload`: JSON document containing the fields entered in the online copy.
- `status`: starts as `Submitted` and can later be reviewed by staff.
- `created_at`, `updated_at`: timestamps.

3. Security
- Enable RLS.
- Grant authenticated clients SELECT and INSERT access only.
- Clients can read and create only their own submissions.
- Anonymous users cannot submit online forms.
*/

CREATE TABLE IF NOT EXISTS client_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  form_type text NOT NULL CHECK (form_type IN ('loan_application', 'guarantor', 'loan_agreement')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under review', 'Approved', 'Returned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_form_submissions_user_id ON client_form_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_client_form_submissions_created_at ON client_form_submissions(created_at DESC);

ALTER TABLE client_form_submissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON client_form_submissions TO authenticated;

DROP POLICY IF EXISTS "clients_read_own_form_submissions" ON client_form_submissions;
CREATE POLICY "clients_read_own_form_submissions" ON client_form_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "clients_insert_own_form_submissions" ON client_form_submissions;
CREATE POLICY "clients_insert_own_form_submissions" ON client_form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
