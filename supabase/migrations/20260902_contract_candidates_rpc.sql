-- Avtalskartan som motor, fas 0: avtalskandidater för ALLA roller.
--
-- contractResolver (schemaläggning, kontrollsessioner, prissättning) läser
-- contracts direkt. Tekniker har bara läsrätt där begone_employee_email
-- matchar, så scheman och sessioner en tekniker skapar fick contract_id = null.
-- Samma mönster som get_price_list_contract_candidates: SECURITY DEFINER som
-- levererar kandidaterna med exakt de kolumner resolvern behöver; urvalet
-- (isLiveContract, importrester, nyast vinner) bor kvar i contractResolver.ts.
-- Applicerad mot live-DB 2026-09-02 via MCP.
CREATE OR REPLACE FUNCTION get_contract_candidates(p_customer_id uuid)
RETURNS TABLE (
  mechanism text,
  id uuid,
  created_at timestamptz,
  label text,
  address_label text,
  contract_type text,
  contract_start_date date,
  annual_value numeric,
  price_list_id uuid,
  visit_frequency text,
  visits_per_year smallint,
  oneflow_contract_id text,
  template_id text,
  display_order smallint,
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
  -- 1. Avtal som bor på kundraden
  SELECT 'owned'::text, c.id, c.created_at, c.label, c.address_label, c.contract_type,
         c.contract_start_date, c.annual_value, c.price_list_id, c.visit_frequency, c.visits_per_year,
         c.oneflow_contract_id, c.template_id, c.display_order,
         c.status, c.terminated_at, c.effective_end_date, c.contract_end_date,
         NULL::date, NULL::date
  FROM contracts c
  WHERE c.customer_id = p_customer_id
    AND c.status IN ('signed', 'active')

  UNION ALL

  -- 2. Avtal som täcker kundraden via contract_sites (datumfiltret görs i TS)
  SELECT 'site_scope', c.id, c.created_at, c.label, c.address_label, c.contract_type,
         c.contract_start_date, c.annual_value, c.price_list_id, c.visit_frequency, c.visits_per_year,
         c.oneflow_contract_id, c.template_id, c.display_order,
         c.status, c.terminated_at, c.effective_end_date, c.contract_end_date,
         cs.active_from, cs.active_to
  FROM contract_sites cs
  JOIN contracts c ON c.id = cs.contract_id
  WHERE cs.customer_id = p_customer_id
    AND c.status IN ('signed', 'active')

  UNION ALL

  -- 3. Huvudkontorets avtal med covers_all_sites
  SELECT 'covers_all_sites', c.id, c.created_at, c.label, c.address_label, c.contract_type,
         c.contract_start_date, c.annual_value, c.price_list_id, c.visit_frequency, c.visits_per_year,
         c.oneflow_contract_id, c.template_id, c.display_order,
         c.status, c.terminated_at, c.effective_end_date, c.contract_end_date,
         NULL::date, NULL::date
  FROM contracts c
  WHERE c.covers_all_sites = true
    AND c.status IN ('signed', 'active')
    AND c.customer_id = (
      SELECT parent_customer_id FROM customers WHERE id = p_customer_id
    )
$$;

REVOKE ALL ON FUNCTION get_contract_candidates(uuid) FROM public;
GRANT EXECUTE ON FUNCTION get_contract_candidates(uuid) TO authenticated;
