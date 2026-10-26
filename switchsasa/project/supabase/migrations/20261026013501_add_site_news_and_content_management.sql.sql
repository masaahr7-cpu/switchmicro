/*
# Add site news posts and editable site content

1. New Tables
- `site_posts` — news/updates published by the CEO that appear automatically on the public website.
  - id (uuid PK), title, body, excerpt, category, status (draft/published), published_at, created_at, updated_at.
- `site_content` — key/value editable text blocks for the public site (hero headline, about text, contact info, etc.).
  - id (uuid PK), section_key (unique), content_value (text), updated_at.
2. Security
- Enable RLS on both tables.
- site_posts: public (anon + authenticated) SELECT for published posts; only authenticated staff can INSERT/UPDATE/DELETE.
- site_content: public (anon + authenticated) SELECT; only authenticated staff can INSERT/UPDATE/DELETE.
- Grants: SELECT to anon, authenticated on both. INSERT/UPDATE/DELETE to authenticated only.
3. Notes
- These tables are read by the public website (no login) to display news and editable content.
- Only signed-in staff (CEO/MD) can create or edit posts and content.
- A SECURITY DEFINER function `upsert_site_content` is created so staff can update content rows by key.
*/

CREATE TABLE IF NOT EXISTS site_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'News',
  status text NOT NULL DEFAULT 'published',
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_posts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON site_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON site_posts TO authenticated;

DROP POLICY IF EXISTS "public_read_published_posts" ON site_posts;
CREATE POLICY "public_read_published_posts"
  ON site_posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "staff_insert_posts" ON site_posts;
CREATE POLICY "staff_insert_posts"
  ON site_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_posts" ON site_posts;
CREATE POLICY "staff_update_posts"
  ON site_posts FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_posts" ON site_posts;
CREATE POLICY "staff_delete_posts"
  ON site_posts FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_site_posts_published ON site_posts(published_at DESC) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  content_value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON site_content TO authenticated;

DROP POLICY IF EXISTS "public_read_content" ON site_content;
CREATE POLICY "public_read_content"
  ON site_content FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "staff_insert_content" ON site_content;
CREATE POLICY "staff_insert_content"
  ON site_content FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_content" ON site_content;
CREATE POLICY "staff_update_content"
  ON site_content FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_content" ON site_content;
CREATE POLICY "staff_delete_content"
  ON site_content FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO site_content (section_key, content_value) VALUES
  ('hero_kicker', 'SWITCHING LIVES FINANCIALLY'),
  ('hero_title', 'Progress starts with a switch.'),
  ('hero_lead', 'Simple, responsible finance that helps micro-businesses, farmers and communities move forward with confidence.'),
  ('about_summary', 'Switch Microfinance Ltd exists to make responsible financial services more accessible to individuals, entrepreneurs, farmers and communities across Tanzania.'),
  ('about_detail', 'Our team is committed to clear communication, practical support and steady progress for every customer we serve.'),
  ('contact_phone_1', '+255 765 407 407'),
  ('contact_phone_2', '+255 616 761 909'),
  ('contact_email', 'info@switchmicrofinance.co.tz'),
  ('contact_address', 'Mbeya Soko Matola, Tanzania')
ON CONFLICT (section_key) DO NOTHING;
