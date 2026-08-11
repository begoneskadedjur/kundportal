-- ============================================================
-- Intranät utbyggnad: anslagstavla, ansvarsroller, KMA-statistik
-- och utökade kategorier för handboksguider i innehållsmodellen.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Utöka dokumentkategorier så att handboksguider kan
--    kategoriseras (styr filterpiller + ikon/färg i UI)
-- ------------------------------------------------------------
ALTER TABLE intranet_documents DROP CONSTRAINT IF EXISTS intranet_documents_category_check;
ALTER TABLE intranet_documents ADD CONSTRAINT intranet_documents_category_check
  CHECK (category IN ('introduktion', 'policy', 'rutin', 'guide', 'kommunikation', 'arenden', 'utrustning', 'sakerhet'));

-- ------------------------------------------------------------
-- 2) Behörighetshjälpare: vem får posta anslag
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION intranet_can_post()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_active = true
      AND (
        p.role IN ('admin', 'koordinator')
        OR p.is_admin = true
        OR p.is_koordinator = true
      )
  );
$$;

-- ------------------------------------------------------------
-- 3) Anslagstavla
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intranet_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,                -- ren text; stycken separeras med dubbla radbrytningar
  pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  author_user_id uuid NOT NULL,
  author_name text,                  -- snapshot så anslag står sig om profilen ändras
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intranet_posts_published ON intranet_posts(is_published, pinned, published_at DESC);

DROP TRIGGER IF EXISTS trg_intranet_posts_touch ON intranet_posts;
CREATE TRIGGER trg_intranet_posts_touch
  BEFORE UPDATE ON intranet_posts
  FOR EACH ROW EXECUTE FUNCTION intranet_touch_updated_at();

ALTER TABLE intranet_posts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON intranet_posts TO authenticated;

DROP POLICY IF EXISTS "Internal read published posts" ON intranet_posts;
CREATE POLICY "Internal read published posts" ON intranet_posts
  FOR SELECT TO authenticated
  USING (intranet_is_internal() AND (is_published = true OR intranet_can_post()));

DROP POLICY IF EXISTS "Poster insert own posts" ON intranet_posts;
CREATE POLICY "Poster insert own posts" ON intranet_posts
  FOR INSERT TO authenticated
  WITH CHECK (intranet_can_post() AND author_user_id = auth.uid());

DROP POLICY IF EXISTS "Author or admin update posts" ON intranet_posts;
CREATE POLICY "Author or admin update posts" ON intranet_posts
  FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid() OR intranet_is_admin())
  WITH CHECK (author_user_id = auth.uid() OR intranet_is_admin());

DROP POLICY IF EXISTS "Author or admin delete posts" ON intranet_posts;
CREATE POLICY "Author or admin delete posts" ON intranet_posts
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR intranet_is_admin());

-- ------------------------------------------------------------
-- 4) Ansvarsroller (vem gör vad) - visas på Kontakter-sidan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intranet_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,                -- t.ex. 'Arbetsmiljö & skyddsombud'
  description text,                  -- kort förklaring av ansvaret
  person_name text NOT NULL,
  email text,
  phone text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_intranet_responsibilities_touch ON intranet_responsibilities;
CREATE TRIGGER trg_intranet_responsibilities_touch
  BEFORE UPDATE ON intranet_responsibilities
  FOR EACH ROW EXECUTE FUNCTION intranet_touch_updated_at();

ALTER TABLE intranet_responsibilities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON intranet_responsibilities TO authenticated;

DROP POLICY IF EXISTS "Internal read responsibilities" ON intranet_responsibilities;
CREATE POLICY "Internal read responsibilities" ON intranet_responsibilities
  FOR SELECT TO authenticated
  USING (intranet_is_internal());

DROP POLICY IF EXISTS "Admin manage responsibilities" ON intranet_responsibilities;
CREATE POLICY "Admin manage responsibilities" ON intranet_responsibilities
  FOR ALL TO authenticated
  USING (intranet_is_admin())
  WITH CHECK (intranet_is_admin());

-- Seed: ansvarsroller enligt arbetsmiljöpolicyn
INSERT INTO intranet_responsibilities (area, description, person_name, email, sort_order)
SELECT * FROM (VALUES
  ('Arbetsmiljö & skyddsombud', 'Systematiskt arbetsmiljöarbete och att arbetsmiljöregler efterlevs', 'Kristian Agnevik', 'kristian.agnevik@begone.se', 1),
  ('Kvalitet & miljö (KM-ansvarig)', 'Ledningssystemet enligt ISO 9001 och ISO 14001, KM-handboken', 'Christian Karlsson', 'christian.k@begone.se', 2),
  ('Reklamationer & kundfrågor', 'Kundrelaterade arbetsmiljöfrågor och reklamationer', 'Christian Karlsson', 'christian.k@begone.se', 3),
  ('Visselblåsning', 'Mottagare av visselblåsningar - rapportering kan ske anonymt', 'Sofia Pålshagen', 'sofia.palshagen@begone.se', 4),
  ('Portalen & IT', 'Frågor om kundportalen, konton och behörigheter', 'Christian Karlsson', 'christian.k@begone.se', 5)
) AS seed(area, description, person_name, email, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM intranet_responsibilities);

-- ------------------------------------------------------------
-- 5) KMA-statistik: aggregerade incidentsiffror för alla interna
--    (radnivå-RLS på case_incidents visar annars bara mottagarens
--    egna - aggregat läcker ingen känslig detalj)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION intranet_kma_stats()
RETURNS TABLE (open_count bigint, handled_this_year bigint, reported_this_year bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN intranet_is_internal() THEN
      (SELECT count(*) FROM case_incidents WHERE status IN ('ny', 'under_utredning'))
    ELSE 0 END,
    CASE WHEN intranet_is_internal() THEN
      (SELECT count(*) FROM case_incidents
       WHERE status IN ('atgardad', 'avslutad')
         AND date_part('year', COALESCE(closed_at, handled_at, updated_at)) = date_part('year', now()))
    ELSE 0 END,
    CASE WHEN intranet_is_internal() THEN
      (SELECT count(*) FROM case_incidents
       WHERE date_part('year', created_at) = date_part('year', now()))
    ELSE 0 END;
$$;
