-- 20260810_fix_incident_insert_returning.sql
-- Fix: INSERT ... RETURNING på case_incidents föll på RLS för rapportören.
-- SELECT-policyn förlitade sig helt på can_view_incident(id), som gör en
-- subquery mot case_incidents - men vid INSERT ... RETURNING är den nya raden
-- inte synlig i satsens snapshot, så funktionen returnerade false.
-- Lösning: radlokala villkor (rapportör, mottagare av typen) utvärderas direkt
-- mot raden; funktionen behövs bara för berörd tekniker-fallet.

DROP POLICY "Read own or recipient incidents" ON case_incidents;
CREATE POLICY "Read own or recipient incidents" ON case_incidents
  FOR SELECT TO authenticated
  USING (
    reported_by_id = auth.uid()
    OR is_incident_recipient_of(type)
    OR can_view_incident(id)
  );
