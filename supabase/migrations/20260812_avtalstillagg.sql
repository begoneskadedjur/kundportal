-- ============================================================
-- Avtalstillägg: tekniker kan i ett avtalskundärende markera en
-- tjänsterad som tillägg till avtalet. Raden faktureras då som
-- pro rata (merförsäljning) fram till nästa fakturaperiod, och
-- kundens årspremie höjs från den perioden.
--
-- Tekniker får inte uppdatera customers (RLS) - premiehöjningen
-- går därför genom RPC:n apply_contract_addition (SECURITY
-- DEFINER) som validerar, är idempotent per fakturarad och
-- loggar allt i contract_additions för spårbarhet/revision.
-- ============================================================

-- Årsbelopp (exkl moms) för tillägget - sätts när teknikern
-- bekräftar markeringen. Radens eget pris = pro rata-beloppet.
ALTER TABLE case_billing_items
  ADD COLUMN IF NOT EXISTS contract_addition_annual numeric;

-- Revisionslogg: varje applicerat avtalstillägg
CREATE TABLE IF NOT EXISTS contract_additions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  case_id uuid,
  case_billing_item_id uuid NOT NULL UNIQUE,  -- idempotens: ett tillägg per rad
  description text NOT NULL,
  annual_amount numeric NOT NULL,
  prorated_amount numeric NOT NULL,
  effective_from date NOT NULL,
  previous_annual_value numeric NOT NULL,
  new_annual_value numeric NOT NULL,
  created_by uuid,
  created_by_name text,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_additions_customer ON contract_additions(customer_id);

ALTER TABLE contract_additions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON contract_additions TO authenticated;

-- Interna läser loggen; skrivning sker enbart via RPC:n
DROP POLICY IF EXISTS "Internal read contract additions" ON contract_additions;
CREATE POLICY "Internal read contract additions" ON contract_additions
  FOR SELECT TO authenticated
  USING (intranet_is_internal());

-- ------------------------------------------------------------
-- RPC: applicera ett avtalstillägg atomärt
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_contract_addition(
  p_case_billing_item_id uuid,
  p_customer_id uuid,
  p_case_id uuid,
  p_description text,
  p_annual_amount numeric,
  p_prorated_amount numeric,
  p_effective_from date,
  p_created_by_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing contract_additions%ROWTYPE;
  v_prev numeric;
  v_new numeric;
BEGIN
  -- Endast intern personal
  IF NOT intranet_is_internal() THEN
    RAISE EXCEPTION 'Behörighet saknas';
  END IF;

  IF p_annual_amount IS NULL OR p_annual_amount <= 0 THEN
    RAISE EXCEPTION 'Årsbeloppet måste vara större än 0';
  END IF;

  -- Idempotens: redan applicerad rad returnerar befintligt resultat
  SELECT * INTO v_existing FROM contract_additions
  WHERE case_billing_item_id = p_case_billing_item_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'already_applied', true,
      'previous_annual_value', v_existing.previous_annual_value,
      'new_annual_value', v_existing.new_annual_value,
      'effective_from', v_existing.effective_from
    );
  END IF;

  -- Lås kundraden och höj premien
  SELECT COALESCE(annual_value, 0) INTO v_prev
  FROM customers WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kunden hittades inte';
  END IF;

  v_new := v_prev + p_annual_amount;
  UPDATE customers SET annual_value = v_new WHERE id = p_customer_id;

  INSERT INTO contract_additions (
    customer_id, case_id, case_billing_item_id, description,
    annual_amount, prorated_amount, effective_from,
    previous_annual_value, new_annual_value,
    created_by, created_by_name
  ) VALUES (
    p_customer_id, p_case_id, p_case_billing_item_id, p_description,
    p_annual_amount, p_prorated_amount, p_effective_from,
    v_prev, v_new,
    auth.uid(), p_created_by_name
  );

  RETURN jsonb_build_object(
    'already_applied', false,
    'previous_annual_value', v_prev,
    'new_annual_value', v_new,
    'effective_from', p_effective_from
  );
END;
$$;
