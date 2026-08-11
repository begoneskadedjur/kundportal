-- ============================================================
-- Intranät: målgruppsstyrning per dokument.
--
-- audience_roles / audience_user_ids på intranet_documents:
--   båda NULL          -> dokumentet syns för alla interna roller
--   audience_roles     -> syns för användare med någon av rollerna
--   audience_user_ids  -> syns även för specifikt utvalda användare
-- (roller och användare är ett ELLER - träff på någon räcker)
-- Admin ser alltid allt och styr synligheten från dokumentsidan.
-- RLS uppdateras så att begränsningen gäller på radnivå - badge,
-- listor och onboarding följer automatiskt.
-- ============================================================

ALTER TABLE intranet_documents
  ADD COLUMN IF NOT EXISTS audience_roles text[],
  ADD COLUMN IF NOT EXISTS audience_user_ids uuid[];

-- Hjälpfunktion: matchar inloggad användare dokumentets målgrupp?
CREATE OR REPLACE FUNCTION intranet_matches_audience(aud_roles text[], aud_users uuid[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (aud_roles IS NULL AND aud_users IS NULL)
    OR auth.uid() = ANY(COALESCE(aud_users, '{}'::uuid[]))
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND (
          p.role = ANY(COALESCE(aud_roles, '{}'::text[]))
          OR (p.is_admin = true AND 'admin' = ANY(COALESCE(aud_roles, '{}'::text[])))
          OR COALESCE(p.extra_roles, '{}'::text[]) && COALESCE(aud_roles, '{}'::text[])
        )
    );
$$;

-- Läspolicyn tar hänsyn till målgruppen (admin ser alltid allt)
DROP POLICY IF EXISTS "Internal read published documents" ON intranet_documents;
CREATE POLICY "Internal read published documents" ON intranet_documents
  FOR SELECT TO authenticated
  USING (
    intranet_is_internal()
    AND (is_published = true OR intranet_is_admin())
    AND (intranet_is_admin() OR intranet_matches_audience(audience_roles, audience_user_ids))
  );

-- Standard enligt verksamheten: faktureringsguiden är inte relevant
-- för tekniker/säljare - admin kan ändra i portalen
UPDATE intranet_documents
SET audience_roles = ARRAY['admin', 'koordinator']
WHERE slug = 'guide-fakturering' AND audience_roles IS NULL;
