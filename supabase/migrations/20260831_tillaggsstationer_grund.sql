-- Tilläggsstationer: kommersiell märkning per station + dynamisk tjänstkoppling
-- Applicerad mot live-DB 2026-08-31 via MCP (apply_migration: tillaggsstationer_grund)
ALTER TABLE equipment_placements ADD COLUMN IF NOT EXISTS is_addon boolean NOT NULL DEFAULT false;
ALTER TABLE indoor_stations ADD COLUMN IF NOT EXISTS is_addon boolean NOT NULL DEFAULT false;

-- Vilken tjänst som används för rundfakturering av tilläggsstationer (max en åt gången)
ALTER TABLE services ADD COLUMN IF NOT EXISTS used_for_addon_stations boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS services_one_addon_station_service
  ON services (used_for_addon_stations) WHERE used_for_addon_stations;

-- Automatiska interna kostnader per enhet av en tjänst (artikelrader vid förifyllnad)
CREATE TABLE IF NOT EXISTS service_default_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  quantity_per_unit numeric NOT NULL DEFAULT 1 CHECK (quantity_per_unit > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (service_id, article_id)
);

ALTER TABLE service_default_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla kan läsa tjänsteartiklar" ON service_default_articles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins kan hantera tjänsteartiklar" ON service_default_articles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
            AND ((profiles.role)::text = 'admin' OR profiles.is_admin = true))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()
            AND ((profiles.role)::text = 'admin' OR profiles.is_admin = true))
  );

-- Markera tjänsten Betesstation Månadskostnad som tilläggsstations-tjänst
UPDATE services SET used_for_addon_stations = true
WHERE id = '886e26cf-0c4d-4628-afb9-2c285750ecc5';
