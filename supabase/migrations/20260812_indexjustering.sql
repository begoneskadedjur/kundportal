-- Indexjustering av årspremie vid fakturagodkännande.
-- Loggas i contract_additions (samma historik som avtalstillägg) med
-- kind='index_adjustment' så avtalstidslinjen visar premieändringen.
-- RPC:n är SECURITY DEFINER: godkännare (admin/koordinator eller
-- rabattansvarig) får justera premien utan direkt UPDATE-rätt på customers.

ALTER TABLE contract_additions ALTER COLUMN case_billing_item_id DROP NOT NULL;
ALTER TABLE contract_additions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'addition'
  CHECK (kind IN ('addition', 'index_adjustment'));

COMMENT ON COLUMN contract_additions.kind IS
  'addition = avtalstillägg från ärende (pro rata + premiehöjning); index_adjustment = indexjustering av premien vid fakturagodkännande';

CREATE OR REPLACE FUNCTION apply_index_adjustment(
  p_customer_id uuid,
  p_new_annual_value numeric,
  p_effective_from date,
  p_description text,
  p_created_by_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev numeric;
  v_allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND (role IN ('admin', 'koordinator') OR can_approve_discounts = true)
  ) INTO v_allowed;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Du saknar behörighet att indexjustera premier';
  END IF;
  IF p_new_annual_value IS NULL OR p_new_annual_value <= 0 THEN
    RAISE EXCEPTION 'Ogiltig ny årspremie';
  END IF;

  SELECT annual_value INTO v_prev FROM customers WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kunden hittades inte';
  END IF;
  v_prev := COALESCE(v_prev, 0);

  UPDATE customers SET annual_value = p_new_annual_value, updated_at = now()
  WHERE id = p_customer_id;

  INSERT INTO contract_additions (
    customer_id, case_id, case_billing_item_id, description, annual_amount,
    prorated_amount, effective_from, previous_annual_value, new_annual_value,
    created_by, created_by_name, kind
  ) VALUES (
    p_customer_id, NULL, NULL, p_description, p_new_annual_value - v_prev,
    0, p_effective_from, v_prev, p_new_annual_value,
    auth.uid(), p_created_by_name, 'index_adjustment'
  );

  RETURN jsonb_build_object(
    'previous_annual_value', v_prev,
    'new_annual_value', p_new_annual_value
  );
END; $$;
