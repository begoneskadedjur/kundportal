-- visits var admin-only (is_current_user_admin) — koordinatorers och teknikers
-- besökssnapshots vid återbesöksbokning nekades tyst och panelen var oläsbar
-- för dem. Samma profiles-mönster som case_updates_log.
-- Applicerad i produktion 2026-08-25 via MCP (visits_rls_staff_access).
CREATE POLICY "visits_select_staff" ON visits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND (profiles.is_admin = true OR profiles.is_koordinator = true OR profiles.technician_id IS NOT NULL)
  ));

CREATE POLICY "visits_insert_staff" ON visits FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND (profiles.is_admin = true OR profiles.is_koordinator = true OR profiles.technician_id IS NOT NULL)
  ));
