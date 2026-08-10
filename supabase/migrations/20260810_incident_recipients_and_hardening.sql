-- 20260810_incident_recipients_and_hardening.sql
-- Mottagare per incidenttyp (tillbud/olycka/avvikelse), ny typ "olycka",
-- statusflöde för hantering samt RLS-härdning av incidenttabellerna.
-- Se docs/tillbud-mottagare-plan.md

-- ============================================================
-- 1) Mottagare per incidenttyp
-- ============================================================
CREATE TABLE IF NOT EXISTS incident_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_type text NOT NULL CHECK (incident_type IN ('tillbud','olycka','avvikelse')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, incident_type)
);

CREATE INDEX IF NOT EXISTS idx_incident_recipients_type ON incident_recipients(incident_type);

ALTER TABLE incident_recipients ENABLE ROW LEVEL SECURITY;

-- Läsning behövs av alla inloggade (egen mottagarstatus för badge/sida, admin-UI listar alla)
CREATE POLICY "Authenticated can read incident recipients" ON incident_recipients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert incident recipients" ON incident_recipients
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can delete incident recipients" ON incident_recipients
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Migrera ev. användare med gamla boolean-flaggan (0 st vid skrivande stund)
INSERT INTO incident_recipients (user_id, incident_type)
SELECT p.user_id, t.incident_type
FROM profiles p
CROSS JOIN (VALUES ('tillbud'),('olycka'),('avvikelse')) AS t(incident_type)
WHERE p.incident_recipient = true AND p.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2) Ny typ "olycka" + statusflöde på case_incidents
-- ============================================================
ALTER TABLE case_incidents DROP CONSTRAINT case_incidents_type_check;
ALTER TABLE case_incidents ADD CONSTRAINT case_incidents_type_check
  CHECK (type IN ('tillbud','olycka','avvikelse'));

ALTER TABLE case_incidents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ny'
    CHECK (status IN ('ny','under_utredning','atgardad')),
  ADD COLUMN IF NOT EXISTS action_taken text,
  ADD COLUMN IF NOT EXISTS handled_by_name text,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

-- ============================================================
-- 3) RLS-hjälpfunktioner
-- SECURITY DEFINER krävs för att undvika policy-rekursion mellan
-- case_incidents och incident_employees (policys som refererar varandra).
-- ============================================================
CREATE OR REPLACE FUNCTION can_view_incident(p_incident_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM case_incidents ci
    WHERE ci.id = p_incident_id
      AND (
        ci.reported_by_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM incident_recipients ir
          WHERE ir.user_id = auth.uid() AND ir.incident_type = ci.type
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.user_id = auth.uid()
            AND p.technician_id IS NOT NULL
            AND (
              p.technician_id::text = ci.technician_id
              OR EXISTS (
                SELECT 1 FROM incident_employees ie
                WHERE ie.incident_id = ci.id
                  AND ie.technician_id = p.technician_id::text
              )
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION is_incident_recipient_of(p_type text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM incident_recipients
    WHERE user_id = auth.uid() AND incident_type = p_type
  );
$$;

-- ============================================================
-- 4) RLS-härdning: case_incidents
-- Ersätter öppen läsning (USING true). Icke-mottagare ser bara
-- incidenter de rapporterat eller är berörda i.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read incidents" ON case_incidents;
CREATE POLICY "Read own or recipient incidents" ON case_incidents
  FOR SELECT TO authenticated USING (can_view_incident(id));

DROP POLICY IF EXISTS "Authenticated users can update own incidents" ON case_incidents;
CREATE POLICY "Reporter or recipient can update incidents" ON case_incidents
  FOR UPDATE TO authenticated
  USING (reported_by_id = auth.uid() OR is_incident_recipient_of(type))
  WITH CHECK (reported_by_id = auth.uid() OR is_incident_recipient_of(type));

-- INSERT-policyn (alla inloggade) och DELETE-policyn (admin/koordinator) behålls.

-- ============================================================
-- 5) RLS-härdning: incident_employees (hade RLS helt avstängt)
-- ============================================================
ALTER TABLE incident_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read employees for visible incidents" ON incident_employees
  FOR SELECT TO authenticated USING (can_view_incident(incident_id));

CREATE POLICY "Reporter or admins can add incident employees" ON incident_employees
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_incidents ci
      WHERE ci.id = incident_id AND ci.reported_by_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND (role IN ('admin','koordinator') OR is_admin = true)
    )
  );

CREATE POLICY "Admins can delete incident employees" ON incident_employees
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND (role IN ('admin','koordinator') OR is_admin = true)
    )
  );

-- ============================================================
-- 6) Realtid för meny-badgen (nya att hantera)
-- ============================================================
ALTER TABLE case_incidents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE case_incidents;
