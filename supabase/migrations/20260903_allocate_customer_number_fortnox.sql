-- Kundnummer från Fortnox, fas 5: portalens räknare (används av Oneflow-webhooken
-- för avtalskunder) får aldrig springa förbi Fortnox. Nästa nummer = max av
-- räknaren, Fortnox-spegelns högsta nummer i intervallet och portalens högsta
-- kundnummer i intervallet, plus ett.
--
-- SECURITY DEFINER eftersom customer_groups nu bara får skrivas av admin
-- (policy "Admins hanterar kundgrupper") men RPC:n anropas med service role
-- från webhooken och kan anropas av inloggad personal.

CREATE OR REPLACE FUNCTION allocate_customer_number(p_group_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start integer;
  v_end integer;
  v_fortnox_max integer;
  v_portal_max integer;
  v_next integer;
BEGIN
  SELECT series_start, series_end INTO v_start, v_end
  FROM customer_groups WHERE id = p_group_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kundgrupp % finns inte', p_group_id;
  END IF;

  SELECT max(numeric_value) INTO v_fortnox_max
  FROM fortnox_customer_numbers
  WHERE numeric_value BETWEEN v_start AND v_end;

  SELECT max(customer_number) INTO v_portal_max
  FROM customers
  WHERE customer_number BETWEEN v_start AND v_end;

  UPDATE customer_groups
  SET current_counter = GREATEST(
        current_counter,
        COALESCE(v_fortnox_max, v_start - 1),
        COALESCE(v_portal_max, v_start - 1)
      ) + 1,
      updated_at = now()
  WHERE id = p_group_id
  RETURNING current_counter INTO v_next;

  IF v_next > v_end THEN
    -- Exception rullar tillbaka UPDATE:n ovan
    RAISE EXCEPTION 'Serien är full för kundgrupp %', p_group_id;
  END IF;

  RETURN v_next;
END;
$$;
