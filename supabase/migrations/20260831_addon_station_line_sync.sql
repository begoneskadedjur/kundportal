-- Tilläggsstationer i etableringsärenden: egen markerad tjänsterad + atomär synk.
-- Beslut efter dubbel specialistgranskning 2026-08-31:
-- * Etableringskostnad-raden (ärendets primärtjänst) lämnas HELT orörd.
-- * Tilläggsstationerna får en EGEN rad med den flaggade tjänsten
--   (services.used_for_addon_stations), identifierad via markörkolumn —
--   aldrig via namnmatchning (krock med t.ex. "Avetablering avtal").
-- * Partiellt unikt index stoppar dubbelrader vid parallella placeringar.
-- * SECURITY DEFINER: synken fungerar även för vikarier som inte kan läsa
--   ärendet (cases-RLS) och kan inte ge dubbelrader (ON CONFLICT).
-- Applicerad mot live-DB 2026-08-31 via MCP (addon_station_line_sync).
ALTER TABLE case_billing_items ADD COLUMN IF NOT EXISTS is_addon_station_line boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS case_billing_items_one_addon_line_per_case
  ON case_billing_items (case_id) WHERE is_addon_station_line;

CREATE OR REPLACE FUNCTION sync_addon_station_line(
  p_customer_id uuid,
  p_unit_price numeric DEFAULT NULL,
  p_technician_id uuid DEFAULT NULL,
  p_technician_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id uuid;
  v_created timestamptz;
  v_open_count int;
  v_service_id uuid;
  v_service_code text;
  v_service_name text;
  v_base_price numeric;
  v_count int;
  v_row_id uuid;
  v_row_status text;
  v_price numeric;
BEGIN
  -- Senaste öppna etableringsärendet för kunden (soft-deletade exkluderas)
  SELECT count(*) INTO v_open_count
  FROM cases
  WHERE customer_id = p_customer_id
    AND service_type = 'establishment'
    AND status NOT ILIKE '%avslutat%'
    AND deleted_at IS NULL;

  SELECT id, created_at INTO v_case_id, v_created
  FROM cases
  WHERE customer_id = p_customer_id
    AND service_type = 'establishment'
    AND status NOT ILIKE '%avslutat%'
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_case_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'open_count', v_open_count);
  END IF;

  SELECT id, code, name, base_price
  INTO v_service_id, v_service_code, v_service_name, v_base_price
  FROM services
  WHERE used_for_addon_stations = true AND is_active = true
  LIMIT 1;

  IF v_service_id IS NULL THEN
    RETURN jsonb_build_object('found', true, 'case_id', v_case_id,
      'open_count', v_open_count, 'service_missing', true);
  END IF;

  -- Aktiva tilläggsstationer placerade sedan ärendet öppnades
  SELECT
    (SELECT count(*) FROM equipment_placements ep
      WHERE ep.customer_id = p_customer_id AND ep.is_addon = true
        AND ep.status = 'active' AND ep.placed_at >= v_created)
    +
    (SELECT count(*) FROM indoor_stations s
      JOIN floor_plans fp ON fp.id = s.floor_plan_id
      WHERE fp.customer_id = p_customer_id AND s.is_addon = true
        AND s.status = 'active' AND s.placed_at >= v_created)
  INTO v_count;

  SELECT id, status INTO v_row_id, v_row_status
  FROM case_billing_items
  WHERE case_id = v_case_id AND is_addon_station_line = true
  LIMIT 1;

  IF v_row_id IS NOT NULL THEN
    -- Rad finns: synka antal (även NER till 0 — 0-total ger ingen faktura).
    -- Fakturerade rader rörs aldrig.
    IF v_row_status = 'pending' THEN
      UPDATE case_billing_items
      SET quantity = v_count,
          total_price = COALESCE(discounted_price, unit_price) * v_count
      WHERE id = v_row_id;
    END IF;
  ELSIF v_count > 0 THEN
    v_price := COALESCE(p_unit_price, v_base_price, 0);
    INSERT INTO case_billing_items (
      case_id, case_type, customer_id, item_type,
      service_id, service_code, service_name,
      article_id, article_code, article_name,
      quantity, unit_price, discount_percent, discounted_price, total_price,
      vat_rate, price_source, added_by_technician_id, added_by_technician_name,
      status, requires_approval, notes, is_addon_station_line
    ) VALUES (
      v_case_id, 'contract', p_customer_id, 'service',
      v_service_id, v_service_code, v_service_name || ' – etablering',
      NULL, NULL, v_service_name || ' – etablering',
      v_count, v_price, 0, v_price, v_price * v_count,
      25, 'standard', p_technician_id, p_technician_name,
      'pending', false, 'Tilläggsstationer placerade i etableringen', true
    )
    ON CONFLICT (case_id) WHERE is_addon_station_line DO UPDATE
      SET quantity = EXCLUDED.quantity,
          total_price = COALESCE(case_billing_items.discounted_price, case_billing_items.unit_price) * EXCLUDED.quantity
      WHERE case_billing_items.status = 'pending';

    SELECT id INTO v_row_id FROM case_billing_items
    WHERE case_id = v_case_id AND is_addon_station_line = true LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'case_id', v_case_id,
    'count', v_count,
    'row_id', v_row_id,
    'open_count', v_open_count,
    'already_billed', v_row_status IS NOT NULL AND v_row_status <> 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION sync_addon_station_line(uuid, numeric, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION sync_addon_station_line(uuid, numeric, uuid, text) TO authenticated;
