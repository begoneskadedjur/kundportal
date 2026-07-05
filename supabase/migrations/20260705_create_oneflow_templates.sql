-- Dynamiska Oneflow-mallar: ersätter de hårdkodade mall-ID-listorna som fanns
-- kopierade i 7 filer. Källan för vilka mallar som är godkända (webhook/sync)
-- och valbara (avtals-/offertwizarden).
--
-- VIKTIG SEMANTIK: is_active styr BARA wizard-synlighet. Nattsyncen och
-- webhooken känner igen ALLA rader (aktiva + inaktiva) - annars trashar
-- sync-oneflow alla avtal på en avaktiverad mall natten efter. Hård radering
-- av en rad ska bara ske när inga contracts refererar mallen (spärras i UI).

CREATE TABLE IF NOT EXISTS oneflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oneflow_template_id text UNIQUE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('contract', 'offer')),
  category text CHECK (category IN ('company', 'individual')),
  popular boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: alla inloggade läser (wizarden används av admin/koordinator/säljare),
-- bara admin skriver. Samma mönster som preparations-tabellen.
ALTER TABLE oneflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated" ON oneflow_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow admin insert" ON oneflow_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

CREATE POLICY "Allow admin update" ON oneflow_templates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

CREATE POLICY "Allow admin delete" ON oneflow_templates
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

-- updated_at-trigger
CREATE OR REPLACE FUNCTION update_oneflow_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oneflow_templates_updated_at
  BEFORE UPDATE ON oneflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_oneflow_templates_updated_at();

-- Seed: exakt dagens 9 mallar (från api/constants/oneflowTemplates.js)
INSERT INTO oneflow_templates (oneflow_template_id, name, type, category, popular) VALUES
  ('8598798', 'Offertförslag – Exkl Moms (Företag)', 'offer', 'company', false),
  ('8919037', 'Offertförslag – Inkl moms (Privatperson)', 'offer', 'individual', false),
  ('8919012', 'Offertförslag – ROT (Privatperson)', 'offer', 'individual', false),
  ('8919059', 'Offertförslag – RUT (Privatperson)', 'offer', 'individual', false),
  ('8486368', 'Skadedjursavtal', 'contract', NULL, true),
  ('9324573', 'Avtal Betesstationer', 'contract', NULL, false),
  ('8465556', 'Avtal Betongstationer', 'contract', NULL, false),
  ('8462854', 'Avtal Mekaniska fällor', 'contract', NULL, false),
  ('8732196', 'Avtal Indikationsfällor', 'contract', NULL, false)
ON CONFLICT (oneflow_template_id) DO NOTHING;
