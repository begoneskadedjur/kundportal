-- Preparat per station: sparas vid utplacering så kontrollflödet kan förvälja
-- "det som sitter i stationen" (tidigare fanns kopplingen bara per ärende).
-- Applicerad mot live-DB 2026-08-31 via MCP (station_preparation_columns).
ALTER TABLE equipment_placements
  ADD COLUMN IF NOT EXISTS preparation_id uuid REFERENCES preparations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preparation_quantity numeric,
  ADD COLUMN IF NOT EXISTS preparation_unit text;

ALTER TABLE indoor_stations
  ADD COLUMN IF NOT EXISTS preparation_id uuid REFERENCES preparations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preparation_quantity numeric,
  ADD COLUMN IF NOT EXISTS preparation_unit text;
