-- Rum som riktiga datapunkter (per rum-statistik) + justerbara trösklar för
-- återkommande-flaggan. cases.room_number behålls som synkad visningssträng.
-- APPLICERAD i produktion 2026-08-24 via MCP (case_rooms_och_trosklar + case_rooms_sync_trigger).
CREATE TABLE IF NOT EXISTS case_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  room_number text NOT NULL,
  position int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, room_number)
);
CREATE INDEX IF NOT EXISTS idx_case_rooms_customer_room ON case_rooms (customer_id, room_number);
ALTER TABLE case_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON case_rooms;
CREATE POLICY "Allow all for authenticated users" ON case_rooms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS room_flag_thresholds jsonb;

INSERT INTO case_rooms (case_id, customer_id, room_number, position)
SELECT c.id, c.customer_id, trim(r.val), r.ord
FROM cases c, LATERAL unnest(string_to_array(c.room_number, ',')) WITH ORDINALITY AS r(val, ord)
WHERE c.room_number IS NOT NULL AND trim(r.val) <> ''
ON CONFLICT (case_id, room_number) DO NOTHING;

-- Trigger: håller case_rooms i synk med cases.room_number oavsett skrivväg
CREATE OR REPLACE FUNCTION sync_case_rooms() RETURNS trigger AS $$
BEGIN
  DELETE FROM case_rooms WHERE case_id = NEW.id;
  IF NEW.room_number IS NOT NULL AND trim(NEW.room_number) <> '' THEN
    INSERT INTO case_rooms (case_id, customer_id, room_number, position)
    SELECT NEW.id, NEW.customer_id, trim(r.val), r.ord
    FROM unnest(string_to_array(NEW.room_number, ',')) WITH ORDINALITY AS r(val, ord)
    WHERE trim(r.val) <> ''
    ON CONFLICT (case_id, room_number) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_case_rooms ON cases;
CREATE TRIGGER trg_sync_case_rooms
  AFTER INSERT OR UPDATE OF room_number, customer_id ON cases
  FOR EACH ROW EXECUTE FUNCTION sync_case_rooms();
