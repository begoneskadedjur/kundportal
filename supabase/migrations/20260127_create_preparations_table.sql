-- Migration: Skapa tabell för preparat/bekämpningsmedel
-- Datum: 2026-01-27
-- Kör denna i Supabase SQL Editor

-- Skapa tabell för preparat/bekämpningsmedel
CREATE TABLE IF NOT EXISTS preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'biocidprodukt',
  registration_number TEXT,
  pest_types TEXT[] DEFAULT '{}',
  active_substances TEXT,
  dosage TEXT,
  is_active BOOLEAN DEFAULT true,
  show_on_website BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för sökning
CREATE INDEX IF NOT EXISTS idx_preparations_name ON preparations(name);
CREATE INDEX IF NOT EXISTS idx_preparations_pest_types ON preparations USING GIN(pest_types);
CREATE INDEX IF NOT EXISTS idx_preparations_is_active ON preparations(is_active);

-- RLS policies
ALTER TABLE preparations ENABLE ROW LEVEL SECURITY;

-- Alla autentiserade kan läsa
CREATE POLICY "Allow read for authenticated" ON preparations
  FOR SELECT TO authenticated
  USING (true);

-- Endast admin kan skapa
CREATE POLICY "Allow admin insert" ON preparations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Endast admin kan uppdatera
CREATE POLICY "Allow admin update" ON preparations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Endast admin kan ta bort
CREATE POLICY "Allow admin delete" ON preparations
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger för updated_at
CREATE OR REPLACE FUNCTION update_preparations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER preparations_updated_at
  BEFORE UPDATE ON preparations
  FOR EACH ROW
  EXECUTE FUNCTION update_preparations_updated_at();
