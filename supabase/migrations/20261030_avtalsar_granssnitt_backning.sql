-- Backning för 20261030_avtalsar_granssnitt.sql (steg 12, avtalsåret på avtalsdag).
-- Dagens definition av contract_customer_view, ordagrant ur pg_get_functiondef
-- 2026-10-30 före migrationen. OBS: den här definitionen faller i prod på
-- pli.price (kolumnen heter custom_price), så backning återinför felet.
-- De nya funktionerna (contract_set_billing_anchor_mode, contract_set_addon_rules,
-- trg_contract_billing_mode_guard) kan stå kvar oanvända. Triggern tas bort av
-- Christian i SQL-editorn om den ska bort:
--   drop trigger contract_billing_mode_guard on public.contracts;

CREATE OR REPLACE FUNCTION public.contract_customer_view(p_contract_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.contracts; v_scope jsonb; v_prices jsonb; v_followup jsonb; v_premium numeric; v_next_invoice date; v_owner text; v_year_start date;
begin
  if not public.contract_customer_access(p_contract_id) then raise exception 'Behörighet saknas'; end if;
  select * into c from public.contracts where id = p_contract_id;
  if not found then return null; end if;
  select coalesce(cu.site_name, cu.company_name) into v_owner from public.customers cu where cu.id = c.customer_id;
  v_premium := public.contract_annual_value_in_force(p_contract_id);
  v_year_start := coalesce(c.contract_start_date, c.start_date, date_trunc('year', current_date)::date);
  while v_year_start + interval '1 year' <= current_date loop v_year_start := (v_year_start + interval '1 year')::date; end loop;

  select coalesce(jsonb_agg(jsonb_build_object('unit_id', cu.id, 'name', coalesce(cu.site_name, cu.company_name), 'address', cu.contact_address, 'active_from', cs.active_from, 'reference', cu.billing_reference)
    order by cs.active_from, coalesce(cu.site_name, cu.company_name)), '[]'::jsonb) into v_scope
  from public.contract_sites cs join public.customers cu on cu.id = cs.customer_id
  where cs.contract_id = p_contract_id and (cs.active_to is null or cs.active_to >= current_date);

  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'code', s.code, 'price', pli.price, 'unit', s.unit) order by s.name), '[]'::jsonb) into v_prices
  from public.price_list_items pli join public.services s on s.id = pli.service_id
  where pli.price_list_id = c.price_list_id and pli.service_id is not null and pli.price is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
      'unit_id', u.unit_id, 'name', u.name, 'service_mode', coalesce(u.service_mode, 'inspection'),
      'frequency', coalesce(u.visit_frequency, c.visit_frequency), 'visits_per_year', coalesce(u.visits_per_year, c.visits_per_year),
      'done_this_year', (select count(*) from public.station_inspection_sessions s where s.customer_id = u.unit_id and s.completed_at is not null and s.completed_at::date >= v_year_start and (s.contract_id = p_contract_id or s.contract_id is null)),
      'next_visit_at', (select min(s.scheduled_at) from public.station_inspection_sessions s where s.customer_id = u.unit_id and s.completed_at is null and s.scheduled_at >= now() and (s.contract_id = p_contract_id or s.contract_id is null))
    ) order by u.name), '[]'::jsonb) into v_followup
  from (
    select cs.customer_id as unit_id, coalesce(cu.site_name, cu.company_name) as name, cs.service_mode, cs.visit_frequency, cs.visits_per_year
    from public.contract_sites cs join public.customers cu on cu.id = cs.customer_id
    where cs.contract_id = p_contract_id and (cs.active_to is null or cs.active_to >= current_date)
    union
    select c.customer_id, v_owner, null, null, null
    where not coalesce(c.covers_all_sites, false) and not exists (select 1 from public.contract_sites cs where cs.contract_id = p_contract_id)
  ) u;

  -- Exakt avtalsdag: nästa periodstart räknad från svensk dag i dag.
  if c.billing_anchor_mode = 'start_day' and c.contract_start_date is not null then
    v_next_invoice := public.contract_next_period_start(p_contract_id, (now() at time zone 'Europe/Stockholm')::date);
  elsif c.billing_anchor_month is not null then
    v_next_invoice := make_date(extract(year from current_date)::int, c.billing_anchor_month, 1);
    if v_next_invoice <= current_date then v_next_invoice := (v_next_invoice + interval '1 year')::date; end if;
  end if;

  return jsonb_build_object(
    'id', c.id, 'name', coalesce(c.display_name, c.label, c.contract_type, 'Avtal'), 'contract_type', c.contract_type, 'owner', v_owner,
    'status', case when c.terminated_at is not null then 'uppsagt' when c.status in ('signed', 'active') then 'aktivt' else c.status end,
    'signed_at', c.signed_at, 'start_date', coalesce(c.contract_start_date, c.start_date), 'end_date', c.contract_end_date,
    'notice_period_months', c.notice_period_months, 'renewal_mode', c.renewal_mode, 'option_until', c.option_until,
    'diary_number', c.diary_number, 'invoice_reference', c.invoice_reference,
    'price_list', (select name from public.price_lists where id = c.price_list_id), 'covers_all_sites', c.covers_all_sites,
    'scope', v_scope, 'prices', v_prices, 'followup', v_followup, 'contract_year_start', v_year_start,
    'premium', jsonb_build_object('annual_value', v_premium, 'billing_frequency', c.billing_frequency, 'billing_anchor_month', c.billing_anchor_month, 'next_invoice', v_next_invoice),
    'agreement_text', c.agreement_text, 'account_manager', c.account_manager_name);
end; $function$;
