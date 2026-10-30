-- BACKNING för 20261030_avtalsar_perioder.sql (steg 6, avtalsåret på avtalsdag).
-- KÖRS INTE som migration. Dagens definitioner (hämtade ur prod 2026-10-30
-- före steg 6) av de tre funktioner steg 6 ersätter. Kör filen i
-- SQL-editorn för att återställa dem. contract_period_on och
-- contract_period_on_pure kan stå kvar (ingen annan funktion läser dem efter
-- backningen); vill man ta bort dem kör Christian
--   drop function public.contract_period_on(uuid, date);
--   drop function public.contract_period_on_pure(date, text, date);

CREATE OR REPLACE FUNCTION public.contract_next_period_start(p_contract_id uuid, p_from date)
 RETURNS date
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_freq text;
  v_anchor int;
  v_start date;
  v_months int;
  v_k int;
  v_candidate date;
  v_step int;
begin
  select billing_frequency, billing_anchor_month, contract_start_date
    into v_freq, v_anchor, v_start
  from contracts where id = p_contract_id;
  if v_freq is null or v_freq = 'on_demand' then
    return null;
  end if;
  if v_freq = 'monthly' then
    return (date_trunc('month', p_from) + interval '1 month')::date;
  end if;
  if v_freq = 'annual' then
    v_anchor := coalesce(v_anchor, extract(month from coalesce(v_start, p_from))::int);
    v_candidate := make_date(extract(year from p_from)::int, v_anchor, 1);
    if v_candidate <= p_from then
      v_candidate := make_date(extract(year from p_from)::int + 1, v_anchor, 1);
    end if;
    return v_candidate;
  end if;
  v_step := case when v_freq = 'quarterly' then 3 else 6 end;
  v_start := coalesce(date_trunc('month', v_start), date_trunc('month', p_from))::date;
  v_months := (extract(year from p_from)::int - extract(year from v_start)::int) * 12
            + (extract(month from p_from)::int - extract(month from v_start)::int);
  v_k := floor(v_months::numeric / v_step)::int + 1;
  v_candidate := (v_start + (v_k * v_step) * interval '1 month')::date;
  return v_candidate;
end;
$function$;

CREATE OR REPLACE FUNCTION public.contract_next_unplanned_period(p_contract_id uuid, p_today date DEFAULT CURRENT_DATE)
 RETURNS date
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  c record;
  v_step int;
  v_notice int;
  v_current_end date;
  v_deadline date;
  v_plan_end date;
  v_open boolean := false;
  v_full boolean;
  v_anchor int;
  v_first date;
  v_p date;
  v_k int;
begin
  select contract_start_date, start_date, contract_end_date, effective_end_date, terminated_at, renewal_mode,
         billing_frequency, billing_anchor_month, notice_period_months
    into c from public.contracts where id = p_contract_id;
  if c is null or coalesce(c.contract_start_date, c.start_date) is null then return null; end if;
  if c.billing_frequency is null or c.billing_frequency = 'on_demand' then return null; end if;

  v_step := case c.billing_frequency when 'monthly' then 1 when 'quarterly' then 3 when 'semi_annual' then 6 else 12 end;
  v_full := c.billing_frequency in ('annual', 'semi_annual');
  v_notice := coalesce(c.notice_period_months, 2);

  if c.terminated_at is not null then
    v_plan_end := coalesce(c.effective_end_date, c.contract_end_date);
    if v_plan_end is null then return null; end if;
  elsif c.contract_end_date is null then
    v_open := true;
    v_plan_end := p_today + (v_notice || ' months')::interval;
  elsif coalesce(c.renewal_mode, 'rolling') = 'option' then
    v_plan_end := c.contract_end_date;
  else
    v_current_end := c.contract_end_date;
    v_k := 0;
    while v_current_end < p_today and v_k < 100 loop
      v_current_end := v_current_end + interval '1 year';
      v_k := v_k + 1;
    end loop;
    v_deadline := v_current_end - (v_notice || ' months')::interval;
    v_plan_end := case when p_today > v_deadline then v_current_end + interval '12 months' else v_current_end end;
  end if;

  -- Första periodstart
  if c.billing_frequency = 'annual' then
    v_anchor := coalesce(c.billing_anchor_month, extract(month from coalesce(c.contract_start_date, c.start_date))::int);
    v_first := make_date(extract(year from coalesce(c.contract_start_date, c.start_date))::int, v_anchor, 1);
    if v_first < date_trunc('month', coalesce(c.contract_start_date, c.start_date))::date then
      v_first := v_first + interval '1 year';
    end if;
  else
    v_first := date_trunc('month', coalesce(c.contract_start_date, c.start_date))::date;
  end if;

  for v_k in 0..600 loop
    v_p := (v_first + (v_k * v_step) * interval '1 month')::date;
    if v_p >= v_plan_end then exit; end if;
    if v_full and (v_p + ((v_step - 1) || ' months')::interval)::date > v_plan_end then exit; end if;
    if v_p > p_today then
      -- Finns en faktura som täcker perioden?
      if not exists (
        select 1 from public.invoices i left join public.invoice_items ii on ii.invoice_id = i.id
        where i.invoice_type = 'contract' and i.status <> 'cancelled'
          and (i.contract_id = p_contract_id or ii.contract_id = p_contract_id)
          and i.billing_period_start < (v_p + (v_step || ' months')::interval)::date
          and coalesce(i.billing_period_end, i.billing_period_start) >= v_p
      ) then
        return v_p;
      end if;
      return null; -- nästa framtida period är planerad; längre fram bedöms inte
    end if;
  end loop;
  return null;
end;
$function$;

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

  if c.billing_anchor_month is not null then
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
