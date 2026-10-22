-- ============================================================
-- Läsloggen för handbokens guider (2026-10-22)
--
-- En rad per gång en medarbetare öppnar en guide. Raden skapas när guiden
-- öppnas och uppdateras medan den är öppen: aktiv tid, hur långt man kom i
-- Gör så här, om övningen startades och hur det gick på Kolla att du kan.
--
-- Bara admin läser alla rader (Läskvittenser > Guider). Var och en skriver
-- och läser sina egna. Personalen informeras i handboken om att loggen finns.
-- ============================================================

CREATE TABLE IF NOT EXISTS intranet_guide_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES intranet_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  user_name text,
  version int NOT NULL,
  /** Vyn guiden lästes i (technician, koordinator, admin, säljare) */
  active_view text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  /** Sekunder med fliken synlig och någon aktivitet senaste minuten */
  active_seconds int NOT NULL DEFAULT 0,
  /** Längst ner man scrollat, procent */
  scroll_pct int NOT NULL DEFAULT 0,
  /** Gör så här: antal steg och högsta steget man visat (1-baserat, 0 = inget) */
  steps_total int,
  max_step int NOT NULL DEFAULT 0,
  /** Prova själv: första gången man rörde övningen */
  exercise_started_at timestamptz,
  /** Kolla att du kan: frågor, besvarade, rätt nu och rätt på första valet */
  quiz_total int,
  quiz_answered int NOT NULL DEFAULT 0,
  quiz_correct int NOT NULL DEFAULT 0,
  quiz_first_correct int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_intranet_guide_views_user ON intranet_guide_views(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_intranet_guide_views_document ON intranet_guide_views(document_id);

ALTER TABLE intranet_guide_views ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON intranet_guide_views TO authenticated;

CREATE POLICY "Own or admin read guide views" ON intranet_guide_views
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR intranet_is_admin());

CREATE POLICY "Internal insert own guide view" ON intranet_guide_views
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND intranet_is_internal());

CREATE POLICY "Own update guide view" ON intranet_guide_views
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------------
-- Sammanställning per person och guide för admin
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION intranet_guide_stats()
RETURNS TABLE (
  user_id uuid,
  document_id uuid,
  opens int,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  active_seconds int,
  steps_total int,
  max_step int,
  exercise_started boolean,
  quiz_total int,
  quiz_best_correct int,
  quiz_best_first_correct int,
  max_scroll_pct int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT intranet_is_admin() THEN
    RAISE EXCEPTION 'Bara admin kan se läsloggen';
  END IF;
  RETURN QUERY
  SELECT v.user_id, v.document_id,
         count(*)::int,
         min(v.opened_at), max(v.opened_at),
         coalesce(sum(v.active_seconds), 0)::int,
         max(v.steps_total)::int,
         max(v.max_step)::int,
         bool_or(v.exercise_started_at IS NOT NULL),
         max(v.quiz_total)::int,
         max(v.quiz_correct)::int,
         max(v.quiz_first_correct)::int,
         max(v.scroll_pct)::int
  FROM intranet_guide_views v
  GROUP BY v.user_id, v.document_id;
END;
$$;

REVOKE ALL ON FUNCTION intranet_guide_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION intranet_guide_stats() TO authenticated;
