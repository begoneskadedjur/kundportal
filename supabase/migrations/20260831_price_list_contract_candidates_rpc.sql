-- Prisuppslag: avtalets prislista måste kunna resolvas av ALLA roller.
-- Tekniker saknar läsrätt på contracts (RLS) vilket gjorde att avtalsprisliste-
-- steget i getEffectiveServicePrice/getServicePricesForCase hoppades tyst för
-- tekniker → 0 kr i tilläggsstations- och ärendeflöden trots korrekt koppling
-- i avtalskartan. Denna SECURITY DEFINER-funktion exponerar ENBART de fält
-- prisresolvern behöver (inga ekonomiska avtalsvillkor) — urvalslogiken
-- (isLiveContract m.m.) bor kvar i priceListService.ts.
-- Applicerad mot live-DB 2026-08-31 via MCP (price_list_contract_candidates_rpc).
CREATE OR REPLACE FUNCTION get_price_list_contract_candidates(
  p_customer_id uuid,
  p_contract_id uuid DEFAULT NULL
)
RETURNS TABLE (
  source text,
  contract_id uuid,
  price_list_id uuid,
  created_at timestamptz,
  status text,
  terminated_at timestamptz,
  effective_end_date date,
  contract_end_date date,
  active_from date,
  active_to date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Ärendet vet redan vilket avtal det hör till
  SELECT 'chosen'::text, c.id, c.price_list_id, c.created_at, c.status,
         c.terminated_at, c.effective_end_date, c.contract_end_date,
         NULL::date, NULL::date
  FROM contracts c
  WHERE p_contract_id IS NOT NULL AND c.id = p_contract_id

  UNION ALL

  -- 1. Avtal som bor på kundraden
  SELECT 'owned', c.id, c.price_list_id, c.created_at, c.status,
         c.terminated_at, c.effective_end_date, c.contract_end_date,
         NULL::date, NULL::date
  FROM contracts c
  WHERE p_contract_id IS NULL
    AND c.customer_id = p_customer_id
    AND c.status IN ('signed', 'active')
    AND c.price_list_id IS NOT NULL

  UNION ALL

  -- 2. Avtal som täcker kundraden via contract_sites
  SELECT 'covering', c.id, c.price_list_id, c.created_at, c.status,
         c.terminated_at, c.effective_end_date, c.contract_end_date,
         cs.active_from, cs.active_to
  FROM contract_sites cs
  JOIN contracts c ON c.id = cs.contract_id
  WHERE p_contract_id IS NULL
    AND cs.customer_id = p_customer_id
    AND c.status IN ('signed', 'active')
    AND c.price_list_id IS NOT NULL

  UNION ALL

  -- 3. HK-avtal med covers_all_sites (när kundraden är en enhet)
  SELECT 'parent', c.id, c.price_list_id, c.created_at, c.status,
         c.terminated_at, c.effective_end_date, c.contract_end_date,
         NULL::date, NULL::date
  FROM contracts c
  WHERE p_contract_id IS NULL
    AND c.covers_all_sites = true
    AND c.status IN ('signed', 'active')
    AND c.price_list_id IS NOT NULL
    AND c.customer_id = (
      SELECT parent_customer_id FROM customers WHERE id = p_customer_id
    )
$$;

REVOKE ALL ON FUNCTION get_price_list_contract_candidates(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION get_price_list_contract_candidates(uuid, uuid) TO authenticated;
