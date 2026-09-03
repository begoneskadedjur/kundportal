-- Kundnummer från Fortnox, fas 1: spegel av Fortnox kundregister
-- (docs/kundnummer-fortnox-plan.md). Spegeln fylls av api/_lib/fortnoxCustomerMirror.ts
-- (nattlig full synk, inkrementell synk via lastmodified, Fortnox-webhook på
-- customers). "Senaste per kundgrupp" räknas ur spegeln, inte ur portalens räknare.

CREATE TABLE IF NOT EXISTS fortnox_customer_numbers (
  customer_number text PRIMARY KEY,
  -- Bara rent numeriska nummer utan inledande nolla får ett numeriskt värde;
  -- alfanumeriska Fortnox-nummer lagras men ignoreras i max-beräkningen.
  numeric_value integer,
  name text,
  organisation_number text,
  -- Org-/personnummer som bara siffror (12-siffrigt personnummer trimmat till 10)
  org_digits text,
  active boolean NOT NULL DEFAULT true,
  customer_type text,
  email text,
  city text,
  seen_at timestamptz NOT NULL DEFAULT now(),
  -- Sätts av full synk när kunden inte längre finns i Fortnox (raderad).
  -- Numret är fortfarande upptaget: Fortnox återanvänder aldrig raderade nummer.
  missing_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fortnox_customer_numbers_numeric_idx
  ON fortnox_customer_numbers (numeric_value) WHERE numeric_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS fortnox_customer_numbers_org_idx
  ON fortnox_customer_numbers (org_digits) WHERE org_digits IS NOT NULL;

COMMENT ON TABLE fortnox_customer_numbers IS
  'Spegel av Fortnox kundregister. Källa för nästa lediga kundnummer per kundgrupp och för org.nr-uppslag vid Till Fortnox. Skrivs bara av servern (service role).';

CREATE TABLE IF NOT EXISTS fortnox_customer_mirror_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Fortnox lastmodified-vattenstämpel för inkrementell synk
  watermark timestamptz,
  last_full_sync_at timestamptz,
  last_incremental_at timestamptz,
  last_error text,
  total_active integer,
  total_inactive integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO fortnox_customer_mirror_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: admin och koordinator läser, ingen inloggad skriver (servern kör service role)
ALTER TABLE fortnox_customer_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fortnox_customer_mirror_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin och koordinator läser Fortnox-spegeln" ON fortnox_customer_numbers
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
            AND ((profiles.role)::text IN ('admin', 'koordinator') OR profiles.is_admin = true))
  );

CREATE POLICY "Admin och koordinator läser spegelstatus" ON fortnox_customer_mirror_state
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
            AND ((profiles.role)::text IN ('admin', 'koordinator') OR profiles.is_admin = true))
  );

-- Statistik per kundgrupp ur spegeln. Raderade (missing_since) räknas med i max
-- eftersom numret ändå aldrig får återanvändas, men inte i antalet.
CREATE OR REPLACE FUNCTION customer_group_fortnox_stats()
RETURNS TABLE (group_id uuid, fortnox_max integer, fortnox_count integer, fortnox_active integer)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    g.id,
    max(m.numeric_value),
    count(m.customer_number) FILTER (WHERE m.missing_since IS NULL)::int,
    count(m.customer_number) FILTER (WHERE m.missing_since IS NULL AND m.active)::int
  FROM customer_groups g
  LEFT JOIN fortnox_customer_numbers m
    ON m.numeric_value BETWEEN g.series_start AND g.series_end
  GROUP BY g.id
$$;

-- Täpp: "Allow authenticated write" lät ALLA inloggade (även kundkonton) skriva i
-- customer_groups. Bara admin får hantera kundgrupper. Servern (service role) och
-- SECURITY DEFINER-RPC:n allocate_customer_number påverkas inte.
DROP POLICY IF EXISTS "Allow authenticated write" ON customer_groups;
CREATE POLICY "Admins hanterar kundgrupper" ON customer_groups
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
            AND ((profiles.role)::text = 'admin' OR profiles.is_admin = true))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
            AND ((profiles.role)::text = 'admin' OR profiles.is_admin = true))
  );
