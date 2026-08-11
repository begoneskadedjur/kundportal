-- ============================================================
-- Intranät: interna dokument (policys, introduktion, arbetssätt)
-- med läs- och förståelsekvittens per version.
--
-- Tabeller:
--   intranet_documents        - dokumenten som strukturerat innehåll (jsonb)
--   intranet_acknowledgements - kvittenser (en per användare, dokument och version)
--
-- Åtkomst:
--   - Alla interna roller (admin, koordinator, technician, säljare) läser
--     publicerade dokument och kvitterar för egen räkning.
--   - Admin hanterar dokument och ser alla kvittenser (läsmatris).
--   - Kunder (role = 'customer' utan adminflagga) ser ingenting.
-- ============================================================

-- ------------------------------------------------------------
-- 1) RLS-hjälpfunktioner (SECURITY DEFINER för att kringgå
--    profiles-RLS i policyernas subqueries)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION intranet_is_internal()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_active = true
      AND (
        p.role IN ('admin', 'koordinator', 'technician', 'säljare')
        OR p.is_admin = true
        OR p.is_koordinator = true
      )
  );
$$;

CREATE OR REPLACE FUNCTION intranet_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_active = true
      AND (p.role = 'admin' OR p.is_admin = true)
  );
$$;

-- ------------------------------------------------------------
-- 2) Dokumenttabell
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intranet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  -- section: var dokumentet hör hemma på intranätsidan
  section text NOT NULL DEFAULT 'obligatoriskt' CHECK (section IN ('obligatoriskt', 'handbok')),
  -- category: typ av dokument (styr ikon/färg i UI)
  category text NOT NULL DEFAULT 'policy' CHECK (category IN ('introduktion', 'policy', 'rutin', 'guide')),
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  version int NOT NULL DEFAULT 1,
  requires_acknowledgement boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  source_updated_at date,        -- "Senast uppdaterad" från originaldokumentet
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION intranet_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intranet_documents_touch ON intranet_documents;
CREATE TRIGGER trg_intranet_documents_touch
  BEFORE UPDATE ON intranet_documents
  FOR EACH ROW EXECUTE FUNCTION intranet_touch_updated_at();

-- ------------------------------------------------------------
-- 3) Kvittenstabell (immutabel revisionslogg för ISO-arbetet)
--    Namn och e-post snapshotas vid kvittens så att historiken
--    står sig även om profilen ändras eller tas bort.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intranet_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES intranet_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  user_email text,
  version int NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id, version)
);

CREATE INDEX IF NOT EXISTS idx_intranet_acks_user ON intranet_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_intranet_acks_document ON intranet_acknowledgements(document_id);

-- ------------------------------------------------------------
-- 4) RLS
-- ------------------------------------------------------------
ALTER TABLE intranet_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet_acknowledgements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON intranet_documents TO authenticated;
GRANT SELECT, INSERT ON intranet_acknowledgements TO authenticated;

-- Dokument: interna läser publicerade, admin ser och hanterar allt
DROP POLICY IF EXISTS "Internal read published documents" ON intranet_documents;
CREATE POLICY "Internal read published documents" ON intranet_documents
  FOR SELECT TO authenticated
  USING (intranet_is_internal() AND (is_published = true OR intranet_is_admin()));

DROP POLICY IF EXISTS "Admin manage documents" ON intranet_documents;
CREATE POLICY "Admin manage documents" ON intranet_documents
  FOR ALL TO authenticated
  USING (intranet_is_admin())
  WITH CHECK (intranet_is_admin());

-- Kvittenser: egen kvittens skrivs och läses; admin läser alla.
-- Ingen UPDATE/DELETE - kvittenser är en revisionslogg.
DROP POLICY IF EXISTS "Own or admin read acknowledgements" ON intranet_acknowledgements;
CREATE POLICY "Own or admin read acknowledgements" ON intranet_acknowledgements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR intranet_is_admin());

DROP POLICY IF EXISTS "Internal insert own acknowledgement" ON intranet_acknowledgements;
CREATE POLICY "Internal insert own acknowledgement" ON intranet_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND intranet_is_internal());

-- ------------------------------------------------------------
-- 5) Realtime för badge-uppdatering (interval-fallback finns i klienten)
-- ------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE intranet_documents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE intranet_acknowledgements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
