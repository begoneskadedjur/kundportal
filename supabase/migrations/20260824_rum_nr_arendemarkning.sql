-- Ärendemärkning "Rum nr" — för kunder med boendeverksamhet (hotell,
-- studentbostäder). Samma mönster som work_order_number/work_object:
-- flaggan på kunden (enheter ärver vid läsning), värdet på ärendet.
-- APPLICERAD i produktion 2026-08-24 via MCP (apply_migration rum_nr_arendemarkning).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS room_number_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS room_number text;
COMMENT ON COLUMN customers.room_number_enabled IS 'Ärendemärkning: kräver Rum nr på ärenden (boendeverksamheter)';
COMMENT ON COLUMN cases.room_number IS 'Ärendemärkning: rumsnummer (kunder med room_number_enabled)';
