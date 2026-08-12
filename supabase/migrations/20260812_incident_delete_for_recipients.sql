-- Radering av tillbud/olyckor/avvikelser: tidigare bara admin/koordinator.
-- Nu får även utsedda handläggare (incident_recipients, via
-- is_incident_recipient_of) radera inkomna rapporter av sina typer.

DROP POLICY IF EXISTS "Admins can delete incidents" ON case_incidents;
CREATE POLICY "Admins or recipients can delete incidents" ON case_incidents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'koordinator')
    )
    OR is_incident_recipient_of(type)
  );

DROP POLICY IF EXISTS "Admins can delete incident employees" ON incident_employees;
CREATE POLICY "Admins or recipients can delete incident employees" ON incident_employees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND (profiles.role IN ('admin', 'koordinator') OR profiles.is_admin = true)
    )
    OR EXISTS (
      SELECT 1 FROM case_incidents ci
      WHERE ci.id = incident_employees.incident_id
        AND is_incident_recipient_of(ci.type)
    )
  );
