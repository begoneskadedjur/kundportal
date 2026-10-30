-- Steg 12 i docs/planer/avtalsar-exakt-arsdag-teknik.md: gränssnittet.
-- Bara create or replace och en ny trigger, inga befintliga rader ändras.
-- Backning: 20261030_avtalsar_granssnitt_backning.sql.
--
-- 1. contract_customer_view (kundens avtalsblad): pli.price -> pli.custom_price
--    (befintligt prodfel, vyn föll för alla avtal: "column
--    pli.price does not exist") och premien får billing_anchor_mode och
--    anchor_day (avtalsdagen i exakt läge). next_invoice räknas som förut.
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

  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'code', s.code, 'price', pli.custom_price, 'unit', s.unit) order by s.name), '[]'::jsonb) into v_prices
  from public.price_list_items pli join public.services s on s.id = pli.service_id
  where pli.price_list_id = c.price_list_id and pli.service_id is not null and pli.custom_price is not null;

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
    'premium', jsonb_build_object('annual_value', v_premium, 'billing_frequency', c.billing_frequency, 'billing_anchor_month', c.billing_anchor_month, 'next_invoice', v_next_invoice,
      'billing_anchor_mode', c.billing_anchor_mode,
      'anchor_day', case when c.billing_anchor_mode = 'start_day' then c.contract_start_date end),
    'agreement_text', c.agreement_text, 'account_manager', c.account_manager_name);
end; $function$;


-- 2. Avtalsåret: följer avtalsdagen eller börjar den 1:a.
--    Kräver befogenheten att godkänna fakturor (addon_coverage_approver, samma
--    som täckningen i steg 8). Byte till avtalsdagen fyller kontrollmarkeringen
--    (billing_anchor_verified_at/by/note, by = profiles.id). Avtal med ramavtal
--    får contract_start_date i framework_overrides, så att ramavtalet aldrig
--    skriver över den kontrollerade avtalsdagen (apply_framework_to_contract).
create or replace function public.contract_set_billing_anchor_mode(p_contract_id uuid, p_mode text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
  v_name text;
  c public.contracts;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_mode text := nullif(trim(coalesce(p_mode, '')), '');
  v_overrides text[];
  v_added boolean := false;
  v_detail text;
begin
  select a.profile_id, a.display_name into v_profile, v_name from public.addon_coverage_approver() a;
  if v_mode is not null and v_mode <> 'start_day' then
    raise exception 'Okänt läge för avtalsåret: %', v_mode;
  end if;
  select * into c from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'Avtalet finns inte';
  end if;
  if v_mode = 'start_day' then
    if c.contract_start_date is null then
      raise exception 'Avtalet saknar startdatum. Sätt startdatum under Löptid först.';
    end if;
    if v_note is null then
      raise exception 'Skriv hur startdatumet kontrollerades mot Oneflow-avtalet.';
    end if;
  end if;

  v_overrides := coalesce(c.framework_overrides, '{}');
  if v_mode = 'start_day' and c.framework_id is not null and not ('contract_start_date' = any(v_overrides)) then
    v_overrides := array_append(v_overrides, 'contract_start_date');
    v_added := true;
  end if;

  perform set_config('app.contract_billing_rpc', 'on', true);
  if v_mode = 'start_day' then
    update public.contracts set
      billing_anchor_mode = 'start_day',
      billing_anchor_verified_at = now(),
      billing_anchor_verified_by = v_profile,
      billing_anchor_verified_note = v_note,
      framework_overrides = case when v_added then v_overrides else framework_overrides end
    where id = p_contract_id;
  else
    -- Tillbaka till den 1:a. Kontrollmarkeringen står kvar som historik.
    update public.contracts set billing_anchor_mode = null where id = p_contract_id;
  end if;
  perform set_config('app.contract_billing_rpc', 'off', true);

  v_detail := case
    when v_mode = 'start_day' and c.billing_anchor_mode is not distinct from 'start_day'
      then format('Avtalsdagen %s kontrollerad igen. %s', c.contract_start_date, v_note)
    when v_mode = 'start_day'
      then format('Avtalsåret följer avtalsdagen %s. Kontrollerat: %s', c.contract_start_date, v_note)
    else format('Avtalsåret börjar den 1:a som tidigare.%s', coalesce(' ' || v_note, ''))
  end || case when v_added then ' Startdatumet ärvs inte längre från ramavtalet.' else '' end;

  insert into public.contract_events (contract_id, event_type, title, detail, metadata, created_by, created_by_name)
  values (p_contract_id, 'billing', 'Avtalsår', v_detail,
          jsonb_build_object('billing_anchor_mode_before', c.billing_anchor_mode, 'billing_anchor_mode', v_mode,
                             'verified_by_profile', v_profile, 'framework_override_added', v_added),
          auth.uid(), v_name);

  return jsonb_build_object('contract_id', p_contract_id, 'billing_anchor_mode', v_mode,
                            'framework_override_added', v_added, 'verified_by', case when v_mode = 'start_day' then v_profile end);
end $$;

revoke all on function public.contract_set_billing_anchor_mode(uuid, text, text) from public, anon;
grant execute on function public.contract_set_billing_anchor_mode(uuid, text, text) to authenticated;

-- 3. Tilläggsreglerna: 'v2' (följer premien) eller som tidigare (NULL).
create or replace function public.contract_set_addon_rules(p_contract_id uuid, p_rules text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
  v_name text;
  c public.contracts;
  v_rules text := nullif(trim(coalesce(p_rules, '')), '');
begin
  select a.profile_id, a.display_name into v_profile, v_name from public.addon_coverage_approver() a;
  if v_rules is not null and v_rules <> 'v2' then
    raise exception 'Okända tilläggsregler: %', v_rules;
  end if;
  select * into c from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'Avtalet finns inte';
  end if;

  perform set_config('app.contract_billing_rpc', 'on', true);
  update public.contracts set addon_rules = v_rules where id = p_contract_id;
  perform set_config('app.contract_billing_rpc', 'off', true);

  insert into public.contract_events (contract_id, event_type, title, detail, metadata, created_by, created_by_name)
  values (p_contract_id, 'billing', 'Tilläggsregler',
          case when v_rules = 'v2' then 'Tilläggen följer premien (nya tilläggsregler).' else 'Tilläggen faktureras som tidigare.' end,
          jsonb_build_object('addon_rules_before', c.addon_rules, 'addon_rules', v_rules, 'profile', v_profile),
          auth.uid(), v_name);

  return jsonb_build_object('contract_id', p_contract_id, 'addon_rules', v_rules);
end $$;

revoke all on function public.contract_set_addon_rules(uuid, text) from public, anon;
grant execute on function public.contract_set_addon_rules(uuid, text) to authenticated;

-- 4. Vakt: avtalsåret, kontrollmarkeringen och tilläggsreglerna ändras från
--    appen bara via funktionerna ovan (koordinatorer har annars skrivrätt på
--    hela contracts-raden via RLS). Service role och SQL-editorn (ingen
--    inloggad användare) släpps igenom: signeringen och datastegen.
--    Ändras startdatumet på ett avtal som följer avtalsdagen tas
--    kontrollmarkeringen bort, så att avtalet hamnar i arbetslistan igen.
create or replace function public.trg_contract_billing_mode_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.billing_anchor_mode is distinct from old.billing_anchor_mode
      or new.billing_anchor_verified_at is distinct from old.billing_anchor_verified_at
      or new.billing_anchor_verified_by is distinct from old.billing_anchor_verified_by
      or new.billing_anchor_verified_note is distinct from old.billing_anchor_verified_note
      or new.addon_rules is distinct from old.addon_rules)
     and auth.uid() is not null
     and coalesce(current_setting('app.contract_billing_rpc', true), '') <> 'on' then
    raise exception using errcode = '42501',
      message = 'Avtalsår och tilläggsregler ändras i avtalskartan under Fakturering (kräver befogenheten att godkänna fakturor).';
  end if;

  if old.billing_anchor_mode = 'start_day'
     and new.billing_anchor_mode is not distinct from 'start_day'
     and old.billing_anchor_verified_at is not null
     and new.contract_start_date is distinct from old.contract_start_date then
    new.billing_anchor_verified_at := null;
    new.billing_anchor_verified_by := null;
    new.billing_anchor_verified_note := format('Startdatumet ändrades från %s till %s. Kontrollera igen mot Oneflow-avtalet.',
                                               old.contract_start_date, new.contract_start_date);
  end if;
  return new;
end $$;

revoke all on function public.trg_contract_billing_mode_guard() from public, anon, authenticated;

create or replace trigger contract_billing_mode_guard
  before update of billing_anchor_mode, billing_anchor_verified_at, billing_anchor_verified_by,
                   billing_anchor_verified_note, addon_rules, contract_start_date
  on public.contracts
  for each row execute function public.trg_contract_billing_mode_guard();
