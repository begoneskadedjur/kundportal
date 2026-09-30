-- 20260930_tillagg_arbetstid_tidslinje.sql
-- Tillägg bredvid avtalet: tidslinje i stället för "pro rata", en rad per
-- stationstyp, "Arbetstid för att hantera tilläggen" och tillägg som slutar
-- när avtalet slutar. Plan: BE-0008974 (WBAB Bylandet), godkänd 2026-09-30.
--
-- 1. Kolumner på case_billing_items:
--    is_addon_labour_line      arbetstidsrad (§ 6 på avtalet, pro rata på ärendet, intern kostnad)
--    addon_labour_hours        timmar per år (§ 6: beslutat, ärendet: teknikerns förslag totalt)
--    addon_labour_hours_before timmar per år som redan debiterades när förslaget gjordes (fryst)
--    addon_annual_unit_price   årspris per enhet (per station, per timme) som tidslinjen ritas ur
--    addon_model               per_year | per_month för pro rata-rader per stationstyp
-- 2. services.used_for_addon_labour (tjänst 135) och articles.used_for_addon_labour_cost (ARB-FOR).
-- 3. Index: pro rata per stationstyp, en arbetstidsrad per avtal+enhet.
-- 4. Funktioner: addon_service_price (prislistetrappan), timpris, internkostnad,
--    addon_contract_for_unit, sync_addon_period_lines (hoppar över arbetstidsrader,
--    nollar arbetstid utan stationer, avslutar rader på avslutade avtal),
--    sync_addon_article_lines (intern kostnad för arbetstiden),
--    sync_addon_prorata_line (en rad per typ, bara det nya, per månad till nästa månad),
--    set_addon_labour_proposal, addon_completion_summary, decide_addon_labour.
-- 5. Trigger: avtal som avslutas avslutar sina tilläggsrader.

-- ─── 1. Kolumner ───────────────────────────────────────────────────────────
alter table public.case_billing_items
  add column if not exists is_addon_labour_line boolean not null default false,
  add column if not exists addon_labour_hours numeric,
  add column if not exists addon_labour_hours_before numeric,
  add column if not exists addon_annual_unit_price numeric,
  add column if not exists addon_model text;

alter table public.case_billing_items drop constraint if exists cbi_addon_model_check;
alter table public.case_billing_items add constraint cbi_addon_model_check
  check (addon_model is null or addon_model in ('per_year', 'per_month'));

comment on column public.case_billing_items.is_addon_labour_line is
  'Arbetstid för att hantera tilläggen. Service-rad per_year på avtalet (§ 6, en per enhet), pro rata-rad på ärendet (med is_addon_prorata_line) eller intern kostnad (item_type article). sync_addon_period_lines hoppar över dessa.';
comment on column public.case_billing_items.addon_labour_hours is
  'Timmar per år. § 6: beslutat. Ärendets pro rata-rad: teknikerns förslag (nytt totalt). Intern kostnad: timmar bakom beloppet.';
comment on column public.case_billing_items.addon_labour_hours_before is
  'Timmar per år som redan debiterades när teknikern lämnade förslaget. Bara ökningen faktureras pro rata.';
comment on column public.case_billing_items.addon_annual_unit_price is
  'Årspris per enhet (per station eller per timme). Pro rata-andelen = unit_price / addon_annual_unit_price.';
comment on column public.case_billing_items.addon_model is
  'per_year eller per_month för pro rata-rader per stationstyp.';

-- ─── 2. Tjänst och artikel för arbetstiden ────────────────────────────────
alter table public.services add column if not exists used_for_addon_labour boolean not null default false;
create unique index if not exists services_one_addon_labour
  on public.services (used_for_addon_labour) where used_for_addon_labour;
comment on column public.services.used_for_addon_labour is
  'Kundens timpris för "Arbetstid för att hantera tilläggen" (tjänst 135). Priset slås upp i kundens prislista.';
update public.services set used_for_addon_labour = true
where code = '135' and is_active
  and not exists (select 1 from public.services where used_for_addon_labour);

alter table public.articles add column if not exists used_for_addon_labour_cost boolean not null default false;
create unique index if not exists articles_one_addon_labour_cost
  on public.articles (used_for_addon_labour_cost) where used_for_addon_labour_cost;
comment on column public.articles.used_for_addon_labour_cost is
  'Intern timkostnad för arbetstiden kring tilläggen (Arbetstid Företag). default_price läses, hårdkodas aldrig.';
update public.articles set used_for_addon_labour_cost = true
where code = 'ARB-FOR'
  and not exists (select 1 from public.articles where used_for_addon_labour_cost);

-- ─── 3. Index ─────────────────────────────────────────────────────────────
drop index if exists public.case_billing_items_one_prorata_line_per_case;
create unique index if not exists cbi_prorata_line_per_type
  on public.case_billing_items (case_id, station_type_id, coalesce(addon_model, 'per_year'))
  where is_addon_prorata_line and not is_addon_labour_line and status = 'pending';
create unique index if not exists cbi_prorata_labour_per_case
  on public.case_billing_items (case_id)
  where is_addon_prorata_line and is_addon_labour_line and status <> 'cancelled';
create unique index if not exists cbi_addon_labour_line_key
  on public.case_billing_items (case_id, site_customer_id)
  where is_addon_labour_line and not is_addon_prorata_line and item_type = 'service' and status <> 'cancelled';
create unique index if not exists cbi_addon_labour_cost_key
  on public.case_billing_items (case_id, site_customer_id)
  where is_addon_labour_line and item_type = 'article' and status <> 'cancelled';

-- ─── 4. Funktioner ────────────────────────────────────────────────────────

-- Prislistetrappan för en tjänst: avtalets lista → kundens (eller huvudkontorets)
-- → standardlistan → tjänstens baspris. Samma trappa som tilläggsstationerna.
create or replace function public.addon_service_price(p_service_id uuid, p_customer_id uuid, p_contract_id uuid default null)
returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  v_list uuid;
  v_parent uuid;
  v_price numeric;
begin
  if p_service_id is null then return null; end if;
  if p_contract_id is not null then
    select price_list_id into v_list from contracts where id = p_contract_id;
    if v_list is not null then
      select custom_price into v_price from price_list_items
      where price_list_id = v_list and service_id = p_service_id limit 1;
      if v_price is not null and v_price > 0 then return v_price; end if;
    end if;
  end if;
  select price_list_id, parent_customer_id into v_list, v_parent from customers where id = p_customer_id;
  if v_list is null and v_parent is not null then
    select price_list_id into v_list from customers where id = v_parent;
  end if;
  if v_list is not null then
    select custom_price into v_price from price_list_items
    where price_list_id = v_list and service_id = p_service_id limit 1;
    if v_price is not null and v_price > 0 then return v_price; end if;
  end if;
  select pli.custom_price into v_price from price_list_items pli
  join price_lists pl on pl.id = pli.price_list_id
  where pl.is_default = true and pl.is_active = true and pli.service_id = p_service_id
  limit 1;
  if v_price is not null and v_price > 0 then return v_price; end if;
  select base_price into v_price from services where id = p_service_id;
  if v_price is not null and v_price > 0 then return v_price; end if;
  return null;
end;
$$;

create or replace function public.addon_annual_price_for_type(p_station_type_id uuid, p_customer_id uuid, p_contract_id uuid default null)
returns numeric
language sql stable
set search_path = public
as $$
  select public.addon_service_price(public.addon_service_id_for_type(p_station_type_id), p_customer_id, p_contract_id);
$$;

create or replace function public.addon_labour_service_id()
returns uuid language sql stable set search_path = public as $$
  select id from services where used_for_addon_labour and is_active limit 1;
$$;

-- Kundens fasta timpris (tjänst 135) ur prislistetrappan. Null = saknas.
create or replace function public.addon_labour_hourly_price(p_customer_id uuid, p_contract_id uuid default null)
returns numeric language sql stable set search_path = public as $$
  select public.addon_service_price(public.addon_labour_service_id(), p_customer_id, p_contract_id);
$$;

create or replace function public.addon_labour_cost_article_id()
returns uuid language sql stable set search_path = public as $$
  select id from articles where used_for_addon_labour_cost limit 1;
$$;

-- Intern timkostnad (Arbetstid Företag, articles.default_price)
create or replace function public.addon_labour_hourly_cost()
returns numeric language sql stable security definer set search_path = public as $$
  select default_price from articles where used_for_addon_labour_cost limit 1;
$$;

-- Avtalet vars omfattning enheten ligger i (samma ordning som tidigare i
-- sync_addon_period_lines): stationernas beslutade avtal först, sedan aktivt
-- avtal på enheten, via contract_sites eller huvudkontorets covers_all_sites.
create or replace function public.addon_contract_for_unit(p_unit_id uuid)
returns uuid
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_contract uuid;
begin
  if p_unit_id is null then return null; end if;
  select coalesce(
    (select ep.addon_contract_id from equipment_placements ep where ep.customer_id = p_unit_id and ep.is_addon and ep.status = 'active' and ep.addon_contract_id is not null order by ep.placed_at desc limit 1),
    (select s.addon_contract_id from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id where fp.customer_id = p_unit_id and s.is_addon and s.status = 'active' and s.addon_contract_id is not null order by s.placed_at desc limit 1)
  ) into v_contract;
  if v_contract is null then
    select c.id into v_contract from contracts c
    where c.type = 'contract' and c.status in ('signed', 'active') and c.terminated_at is null
      and (c.customer_id = p_unit_id
        or exists (select 1 from contract_sites cs where cs.contract_id = c.id and cs.customer_id = p_unit_id and (cs.active_to is null or cs.active_to >= v_today) and (cs.active_from is null or cs.active_from <= v_today))
        or (c.covers_all_sites = true and c.customer_id = (select parent_customer_id from customers where id = p_unit_id)))
    order by (c.customer_id = p_unit_id) desc, c.display_order nulls last, c.created_at limit 1;
  end if;
  return v_contract;
end;
$$;

-- Timmar per år som enheten debiteras i dag (§ 6-raden på avtalet)
create or replace function public.addon_unit_labour_hours(p_contract_id uuid, p_unit_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select addon_labour_hours from case_billing_items
    where case_id = p_contract_id and site_customer_id = p_unit_id
      and is_addon_labour_line and not is_addon_prorata_line and item_type = 'service'
      and status <> 'cancelled'
    limit 1), 0);
$$;

-- Avtalet har slutat: tilläggen slutar med det (regel 2026-09-30).
create or replace function public.addon_contract_has_ended(p_contract_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from contracts c
    where c.id = p_contract_id
      and (c.status in ('ended', 'trashed', 'declined')
        or (c.terminated_at is not null
            and coalesce(c.effective_end_date, c.contract_end_date) < (now() at time zone 'Europe/Stockholm')::date))
  );
$$;

create or replace function public.addon_cancel_lines_for_ended_contract(p_contract_id uuid)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare v_n int := 0;
begin
  if not public.addon_contract_has_ended(p_contract_id) then return 0; end if;
  update case_billing_items
  set status = 'cancelled', updated_at = now()
  where case_id = p_contract_id and status = 'pending'
    and (billing_model in ('per_year', 'per_month')
      or (item_type = 'article' and (is_addon_labour_line or site_customer_id is not null)));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.addon_cancel_lines_for_ended_contract(uuid) from public, anon;

create or replace function public.trg_contract_end_addon_lines()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     or new.terminated_at is distinct from old.terminated_at
     or new.effective_end_date is distinct from old.effective_end_date then
    perform public.addon_cancel_lines_for_ended_contract(new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists contract_end_addon_lines on public.contracts;
create trigger contract_end_addon_lines
  after update of status, terminated_at, effective_end_date on public.contracts
  for each row execute function public.trg_contract_end_addon_lines();

-- § 6-rader per enhet/typ/modell ur BESLUTADE stationer. Arbetstidsraderna
-- (is_addon_labour_line) synkas aldrig här: antalet styrs av beslutet, inte
-- av stationerna. De nollas när enhetens sista stationer på avtalet tas bort.
create or replace function public.sync_addon_period_lines(p_customer_id uuid default null, p_contract_id uuid default null, p_annual_price numeric default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_contract_id uuid := p_contract_id;
  v_contract_customer uuid;
  v_service_id uuid; v_service_code text; v_service_name text; v_base_price numeric;
  v_rows int := 0; r record;
  v_unit_price numeric; v_existing_id uuid; v_existing_price numeric; v_annual numeric; v_next_start date;
  v_missing jsonb := '[]'::jsonb; v_type_name text; v_type_service uuid;
  v_ended int;
begin
  -- Personal, service_role eller databasens egen trigger (auth.uid() saknas)
  if not intranet_is_internal() and auth.role() <> 'service_role' and auth.uid() is not null then
    raise exception 'Behörighet saknas';
  end if;

  select id, code, name, base_price into v_service_id, v_service_code, v_service_name, v_base_price
  from services where used_for_addon_stations_annual = true and is_active = true limit 1;
  if v_service_id is null then return jsonb_build_object('ok', false, 'reason', 'service_missing'); end if;

  if v_contract_id is null then
    if p_customer_id is null then raise exception 'Ange enhet eller avtal'; end if;
    v_contract_id := addon_contract_for_unit(p_customer_id);
    if v_contract_id is null then return jsonb_build_object('ok', false, 'reason', 'no_contract'); end if;
  end if;

  -- Tilläggen slutar när avtalet slutar
  if addon_contract_has_ended(v_contract_id) then
    v_ended := addon_cancel_lines_for_ended_contract(v_contract_id);
    return jsonb_build_object('ok', true, 'contract_id', v_contract_id, 'rows', 0, 'ended', true, 'cancelled', v_ended, 'price_missing', '[]'::jsonb);
  end if;

  select customer_id into v_contract_customer from contracts where id = v_contract_id;
  v_next_start := contract_next_period_start(v_contract_id, v_today);

  for r in
    with units as (
      select p_customer_id as customer_id where p_customer_id is not null
      union select c.customer_id from contracts c where c.id = v_contract_id and p_customer_id is null
      union select cs.customer_id from contract_sites cs where cs.contract_id = v_contract_id and p_customer_id is null and (cs.active_to is null or cs.active_to >= v_today)
      union select u.id from customers u join contracts c on c.id = v_contract_id and c.covers_all_sites = true and u.parent_customer_id = c.customer_id where p_customer_id is null
    ),
    -- BESLUTADE stationer på avtalet. Obeslutade (addon_contract_id null) är brickor, aldrig rader.
    stations as (
      select ep.customer_id, ep.station_type_id, ep.addon_billing_model as model, ep.addon_unit_price_annual as annual
      from equipment_placements ep join units u on u.customer_id = ep.customer_id
      where ep.is_addon = true and ep.status = 'active' and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate' and ep.addon_contract_id = v_contract_id
      union all
      select fp.customer_id, s.station_type_id, s.addon_billing_model, s.addon_unit_price_annual
      from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id join units u on u.customer_id = fp.customer_id
      where s.is_addon = true and s.status = 'active' and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate' and s.addon_contract_id = v_contract_id
    ),
    counted as (
      select customer_id, station_type_id, model, count(*) as n, sum(annual) as annual_sum, count(*) filter (where annual is null) as missing
      from stations group by customer_id, station_type_id, model
    ),
    existing as (
      select site_customer_id as customer_id, station_type_id, billing_model as model, 0::bigint as n, null::numeric as annual_sum, 0::bigint as missing
      from case_billing_items
      where case_id = v_contract_id and site_customer_id is not null and billing_model in ('per_year', 'per_month') and status <> 'cancelled'
        and not is_addon_labour_line
        and (p_customer_id is null or site_customer_id = p_customer_id)
    )
    select customer_id, station_type_id, model, max(n) as n, sum(annual_sum) as annual_sum, sum(missing) as missing
    from (select * from counted union all select * from existing) x
    group by customer_id, station_type_id, model
  loop
    v_existing_id := null; v_existing_price := null;
    select id, unit_price into v_existing_id, v_existing_price
    from case_billing_items
    where case_id = v_contract_id and site_customer_id = r.customer_id
      and station_type_id is not distinct from r.station_type_id and billing_model = r.model and status <> 'cancelled'
      and not is_addon_labour_line
    limit 1;

    -- Priset ur stationernas låsta årspris, annars prislistan
    v_annual := coalesce(
      p_annual_price,
      case when r.n > 0 and r.missing = 0 and r.annual_sum is not null then round(r.annual_sum / r.n, 2) end,
      addon_annual_price_for_type(r.station_type_id, r.customer_id, v_contract_id),
      v_base_price
    );

    if v_existing_id is not null then
      v_unit_price := coalesce(
        case when r.n > 0 and (p_annual_price is not null or (r.missing = 0 and r.annual_sum is not null))
             then (case when r.model = 'per_month' then round(v_annual / 12, 2) else v_annual end) end,
        v_existing_price
      );
      update case_billing_items
      set quantity = r.n, unit_price = v_unit_price, discounted_price = v_unit_price, total_price = round(v_unit_price * r.n, 2),
          addon_annual_unit_price = case when r.model = 'per_month' then round(v_unit_price * 12, 2) else v_unit_price end,
          updated_at = now()
      where id = v_existing_id;
      v_rows := v_rows + 1;
    elsif r.n > 0 then
      if v_annual is null or v_annual <= 0 then
        select name into v_type_name from station_types where id = r.station_type_id;
        v_missing := v_missing || jsonb_build_object('station_type_id', r.station_type_id, 'station_type', coalesce(v_type_name, 'Okänd stationstyp'), 'site_customer_id', r.customer_id, 'model', r.model, 'quantity', r.n);
        continue;
      end if;
      v_unit_price := case when r.model = 'per_month' then round(v_annual / 12, 2) else v_annual end;
      v_type_service := coalesce(addon_service_id_for_type(r.station_type_id), v_service_id);
      insert into case_billing_items (
        case_id, case_type, customer_id, site_customer_id, station_type_id, item_type, service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price, vat_rate, price_source, status, requires_approval, billing_model, billing_start_date,
        addon_annual_unit_price, notes
      ) values (
        v_contract_id, 'contract', v_contract_customer, r.customer_id, r.station_type_id, 'service', v_type_service,
        coalesce((select s2.code from services s2 where s2.id = v_type_service), v_service_code),
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        r.n, v_unit_price, 0, v_unit_price, round(v_unit_price * r.n, 2), 25, 'standard', 'pending', false, r.model,
        case when r.model = 'per_month' then (date_trunc('month', v_today) + interval '1 month')::date else v_next_start end,
        v_annual,
        'Synkas från utplacerade tilläggsstationer'
      );
      v_rows := v_rows + 1;
    end if;
  end loop;

  -- Arbetstiden följer stationerna: utan aktiva beslutade tillägg på enheten
  -- finns inget att hantera, raden går till noll.
  update case_billing_items l
  set quantity = 0, unit_price = 0, discounted_price = 0, total_price = 0, addon_labour_hours = 0, updated_at = now()
  where l.case_id = v_contract_id and l.is_addon_labour_line and not l.is_addon_prorata_line
    and l.item_type = 'service' and l.status <> 'cancelled'
    and (p_customer_id is null or l.site_customer_id = p_customer_id)
    and coalesce(l.addon_labour_hours, 0) > 0
    and not exists (
      select 1 from equipment_placements ep
      where ep.customer_id = l.site_customer_id and ep.is_addon and ep.status = 'active'
        and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate' and ep.addon_contract_id = v_contract_id
      union all
      select 1 from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
      where fp.customer_id = l.site_customer_id and s.is_addon and s.status = 'active'
        and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate' and s.addon_contract_id = v_contract_id
    );

  return jsonb_build_object('ok', jsonb_array_length(v_missing) = 0, 'contract_id', v_contract_id, 'rows', v_rows, 'next_period_start', v_next_start, 'price_missing', v_missing);
end;
$$;

-- Interna kostnadsrader för tilläggen: produkterna per enhet/typ/artikel som
-- förut, plus arbetstiden (timmar × Arbetstid Företag) mappad mot § 6-raden.
create or replace function public.sync_addon_article_lines(p_contract_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_contract_customer uuid;
  v_rows int := 0;
  r record;
  v_service_row uuid;
  v_existing_id uuid;
  v_cost numeric;
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_labour_article uuid;
  v_labour_cost numeric;
  v_total numeric;
begin
  if not intranet_is_internal() and auth.role() <> 'service_role' then
    raise exception 'Behörighet saknas';
  end if;
  if p_contract_id is null then
    raise exception 'Ange avtal';
  end if;

  select customer_id into v_contract_customer from contracts where id = p_contract_id;

  for r in
    with units as (
      select c.customer_id from contracts c where c.id = p_contract_id
      union
      select cs.customer_id from contract_sites cs
        where cs.contract_id = p_contract_id
          and (cs.active_to is null or cs.active_to >= v_today)
      union
      select u.id from customers u
        join contracts c on c.id = p_contract_id and c.covers_all_sites = true
        where u.parent_customer_id = c.customer_id
    ),
    stations as (
      select ep.customer_id as site_id, ep.station_type_id, ep.article_id,
             ep.addon_billing_model as model
      from equipment_placements ep
      join units u on u.customer_id = ep.customer_id
      where ep.is_addon = true and ep.status = 'active' and ep.article_id is not null
        and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
        and (ep.addon_contract_id is null or ep.addon_contract_id = p_contract_id)
      union all
      select fp.customer_id, s.station_type_id, s.article_id, s.addon_billing_model
      from indoor_stations s
      join floor_plans fp on fp.id = s.floor_plan_id
      join units u on u.customer_id = fp.customer_id
      where s.is_addon = true and s.status = 'active' and s.article_id is not null
        and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate'
        and (s.addon_contract_id is null or s.addon_contract_id = p_contract_id)
    )
    select site_id, station_type_id, article_id, count(*) as n
    from stations group by site_id, station_type_id, article_id
  loop
    v_service_row := null; v_existing_id := null;
    -- Tjänsteraden som artikeln hör till (marginalgruppering)
    select id into v_service_row from case_billing_items
    where case_id = p_contract_id and site_customer_id = r.site_id
      and station_type_id is not distinct from r.station_type_id
      and item_type = 'service' and billing_model in ('per_year', 'per_month')
      and not is_addon_labour_line
      and status <> 'cancelled'
    limit 1;

    select default_price into v_cost from articles where id = r.article_id;
    v_cost := coalesce(v_cost, 0);

    select id into v_existing_id from case_billing_items
    where case_id = p_contract_id and site_customer_id = r.site_id
      and station_type_id is not distinct from r.station_type_id
      and article_id = r.article_id and item_type = 'article'
      and billing_model = 'premium' and status <> 'cancelled'
      and not is_addon_labour_line
    limit 1;

    if v_existing_id is not null then
      update case_billing_items
      set quantity = r.n,
          unit_price = v_cost,
          discounted_price = v_cost,
          total_price = round(v_cost * r.n, 2),
          mapped_service_id = v_service_row,
          updated_at = now()
      where id = v_existing_id;
    else
      insert into case_billing_items (
        case_id, case_type, customer_id, site_customer_id, station_type_id, item_type,
        article_id, article_name, service_name,
        quantity, unit_price, discount_percent, discounted_price, total_price,
        vat_rate, price_source, status, requires_approval, billing_model,
        mapped_service_id, notes
      ) values (
        p_contract_id, 'contract', v_contract_customer, r.site_id, r.station_type_id, 'article',
        r.article_id,
        coalesce((select name from articles where id = r.article_id), 'Produkt'),
        coalesce((select name from articles where id = r.article_id), 'Produkt'),
        r.n, v_cost, 0, v_cost, round(v_cost * r.n, 2),
        25, 'standard', 'pending', false, 'premium',
        v_service_row,
        'Intern kostnad för utplacerade tilläggsstationer. Visas aldrig för kund.'
      );
    end if;
    v_rows := v_rows + 1;
  end loop;

  -- Nolla rader vars produkt inte längre står ute
  update case_billing_items cbi
  set quantity = 0, total_price = 0, updated_at = now()
  where cbi.case_id = p_contract_id and cbi.item_type = 'article'
    and cbi.billing_model = 'premium' and cbi.station_type_id is not null
    and not cbi.is_addon_labour_line
    and cbi.status <> 'cancelled'
    and not exists (
      select 1 from equipment_placements ep
      where ep.customer_id = cbi.site_customer_id and ep.article_id = cbi.article_id
        and ep.station_type_id is not distinct from cbi.station_type_id
        and ep.is_addon and ep.status = 'active'
      union all
      select 1 from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
      where fp.customer_id = cbi.site_customer_id and s.article_id = cbi.article_id
        and s.station_type_id is not distinct from cbi.station_type_id
        and s.is_addon and s.status = 'active'
    );

  -- Arbetstiden: intern kostnad = timmar × Arbetstid Företag, knuten till
  -- § 6-raden. Räknas i tilläggets kalkyl, aldrig avtalets (§ 4).
  v_labour_article := addon_labour_cost_article_id();
  v_labour_cost := coalesce(addon_labour_hourly_cost(), 0);
  if v_labour_article is not null then
    for r in
      select id, site_customer_id, coalesce(addon_labour_hours, 0) as h
      from case_billing_items
      where case_id = p_contract_id and is_addon_labour_line and not is_addon_prorata_line
        and item_type = 'service' and status <> 'cancelled'
    loop
      v_existing_id := null;
      v_total := round(r.h * v_labour_cost, 2);
      select id into v_existing_id from case_billing_items
      where case_id = p_contract_id and is_addon_labour_line and item_type = 'article'
        and site_customer_id = r.site_customer_id and status <> 'cancelled'
      limit 1;
      if v_existing_id is not null then
        update case_billing_items
        set quantity = case when r.h > 0 then 1 else 0 end,
            unit_price = v_total, discounted_price = v_total, total_price = v_total,
            addon_labour_hours = r.h, mapped_service_id = r.id, updated_at = now()
        where id = v_existing_id;
      elsif r.h > 0 then
        insert into case_billing_items (
          case_id, case_type, customer_id, site_customer_id, item_type,
          article_id, article_code, article_name, service_name,
          quantity, unit_price, discount_percent, discounted_price, total_price,
          vat_rate, price_source, status, requires_approval, billing_model,
          mapped_service_id, is_addon_labour_line, addon_labour_hours, notes
        ) values (
          p_contract_id, 'contract', v_contract_customer, r.site_customer_id, 'article',
          v_labour_article,
          (select code from articles where id = v_labour_article),
          coalesce((select name from articles where id = v_labour_article), 'Arbetstid'),
          coalesce((select name from articles where id = v_labour_article), 'Arbetstid'),
          1, v_total, 0, v_total, v_total,
          25, 'standard', 'pending', false, 'premium',
          r.id, true, r.h,
          'Intern kostnad för arbetstiden kring tilläggen. Timmar i addon_labour_hours. Visas aldrig för kund.'
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

-- Arbetstidens pro rata på ärendet: bara ÖKNINGEN i timmar mot vad enheten
-- redan debiterades när förslaget gjordes, från första nya stationens dag
-- till avtalets nästa periodstart. Inga nya tillägg utöver avtalet = 0.
create or replace function public.addon_labour_prorata_recalc(p_case_id uuid, p_contract_id uuid)
returns numeric
language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  l record;
  v_unit uuid;
  v_created timestamptz;
  v_start date;
  v_next date;
  v_rate numeric;
  v_delta numeric;
  v_total numeric := 0;
begin
  select * into l from case_billing_items
  where case_id = p_case_id and is_addon_prorata_line and is_addon_labour_line and status = 'pending'
  limit 1;
  if not found then return null; end if;

  select customer_id, created_at into v_unit, v_created from cases where id = p_case_id;
  v_next := case when p_contract_id is not null then contract_next_period_start(p_contract_id, v_today) end;
  v_rate := addon_labour_hourly_price(v_unit, p_contract_id);

  select min(start_day) into v_start from (
    select greatest(coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365) as start_day
    from equipment_placements ep
    where ep.customer_id = v_unit and ep.is_addon and ep.status = 'active'
      and ep.addon_billing_model = 'per_year'
      and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
      and coalesce(ep.addon_marked_at, ep.placed_at) >= v_created
    union all
    select greatest(coalesce(s.addon_effective_from, (coalesce(s.addon_marked_at, s.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365)
    from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
    where fp.customer_id = v_unit and s.is_addon and s.status = 'active'
      and s.addon_billing_model = 'per_year'
      and coalesce(s.addon_contract_mode, 'separate') = 'separate'
      and coalesce(s.addon_marked_at, s.placed_at) >= v_created
  ) x;

  v_delta := greatest(coalesce(l.addon_labour_hours, 0) - coalesce(l.addon_labour_hours_before, 0), 0);
  if v_start is not null and v_next is not null and v_rate is not null and v_delta > 0 then
    v_total := round(v_delta * v_rate * greatest(v_next - v_start, 0) / 365.0, 2);
  end if;

  update case_billing_items
  set quantity = 1,
      unit_price = v_total, discounted_price = v_total, total_price = v_total,
      addon_annual_unit_price = v_rate,
      billing_start_date = v_next,
      updated_at = now()
  where id = l.id;
  return v_total;
end;
$$;
revoke all on function public.addon_labour_prorata_recalc(uuid, uuid) from public, anon;

-- Pro rata på ärendet: EN rad per stationstyp och modell, bara stationer
-- markerade under ärendet ("nya"). Per år: till avtalets nästa periodstart.
-- Per månad: till nästa månadsskifte (sedan tar månadsfakturan vid).
-- p_case_id: kontrollrundan när stationerna sätts ut där; annars det öppna
-- etableringsärendet som förut.
drop function if exists public.sync_addon_prorata_line(uuid, numeric, uuid, text);
create or replace function public.sync_addon_prorata_line(
  p_customer_id uuid,
  p_annual_price numeric default null,
  p_technician_id uuid default null,
  p_technician_name text default null,
  p_case_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_case_id uuid;
  v_created timestamptz;
  v_contract_id uuid;
  v_service_id uuid;
  v_next_start date;
  v_next_month date := (date_trunc('month', (now() at time zone 'Europe/Stockholm')) + interval '1 month')::date;
  v_open_invoice uuid;
  v_missing jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_keep uuid[] := '{}';
  v_count int := 0;
  v_sum numeric := 0;
  v_row_id uuid;
  v_billed int;
  v_n int;
  v_unit numeric;
  v_total numeric;
  v_type_service uuid;
  v_name text;
  v_legacy uuid;
  r record;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  if p_case_id is not null then
    select id, created_at into v_case_id, v_created
    from cases
    where id = p_case_id and customer_id = p_customer_id
      and status not ilike '%avslutat%' and deleted_at is null;
  else
    select id, created_at into v_case_id, v_created
    from cases
    where customer_id = p_customer_id
      and service_type = 'establishment'
      and status not ilike '%avslutat%'
      and deleted_at is null
    order by created_at desc
    limit 1;
  end if;
  if v_case_id is null then
    return jsonb_build_object('found', false);
  end if;

  select id into v_service_id from services where used_for_addon_stations_annual = true and is_active = true limit 1;
  if v_service_id is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'service_missing', true);
  end if;

  select (sync_addon_period_lines(p_customer_id, null, p_annual_price) ->> 'contract_id')::uuid into v_contract_id;
  if v_contract_id is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'no_contract', true);
  end if;
  v_next_start := contract_next_period_start(v_contract_id, v_today);
  if v_next_start is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'no_period', true);
  end if;

  -- Redigerbar PREMIEfaktura för innevarande period tar upp stationerna.
  select id into v_open_invoice from invoices
  where contract_id = v_contract_id and invoice_type = 'contract'
    and coalesce(contract_invoice_kind, 'premium') = 'premium'
    and coalesce(is_consolidated, false) = false
    and billing_period_start <= v_today and billing_period_end >= v_today
    and status in ('draft', 'pending_approval', 'ready')
  limit 1;
  if v_open_invoice is not null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'covered_by_open_invoice', v_open_invoice);
  end if;

  -- Äldre sammanslagen rad (utan typ) tas över av första typen så att
  -- mappningar och historik följer med.
  select id into v_legacy from case_billing_items
  where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
    and status = 'pending' and station_type_id is null
  limit 1;

  for r in
    with st as (
      select ep.station_type_id, ep.addon_billing_model as model,
             greatest(coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365) as start_day
      from equipment_placements ep
      where ep.customer_id = p_customer_id and ep.is_addon = true and ep.status = 'active'
        and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
        and coalesce(ep.addon_marked_at, ep.placed_at) >= v_created
      union all
      select s.station_type_id, s.addon_billing_model,
             greatest(coalesce(s.addon_effective_from, (coalesce(s.addon_marked_at, s.placed_at) at time zone 'Europe/Stockholm')::date), v_today - 365)
      from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
      where fp.customer_id = p_customer_id and s.is_addon = true and s.status = 'active'
        and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate'
        and coalesce(s.addon_marked_at, s.placed_at) >= v_created
    )
    select station_type_id, model, count(*)::int as n,
           sum(greatest((case when model = 'per_month' then v_next_month else v_next_start end) - start_day, 0))::numeric as day_sum,
           case when model = 'per_month' then v_next_month else v_next_start end as end_day
    from st
    group by station_type_id, model
  loop
    v_unit := coalesce(p_annual_price, addon_annual_price_for_type(r.station_type_id, p_customer_id, v_contract_id));
    if v_unit is null or v_unit <= 0 then
      v_missing := v_missing || jsonb_build_object(
        'station_type_id', r.station_type_id,
        'station_type', coalesce((select name from station_types where id = r.station_type_id), 'Okänd stationstyp')
      );
      continue;
    end if;

    -- Redan fakturerat på ärendet (återöppnat): bara resten
    select coalesce(sum(quantity), 0)::int into v_billed from case_billing_items
    where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
      and station_type_id is not distinct from r.station_type_id
      and coalesce(addon_model, 'per_year') = r.model
      and status not in ('pending', 'cancelled');
    v_n := greatest(r.n - v_billed, 0);

    v_row_id := null;
    select id into v_row_id from case_billing_items
    where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
      and station_type_id is not distinct from r.station_type_id
      and coalesce(addon_model, 'per_year') = r.model
      and status = 'pending'
    limit 1;
    if v_row_id is null and v_legacy is not null then
      v_row_id := v_legacy;
      v_legacy := null;
    end if;

    if v_n = 0 then
      continue;
    end if;

    -- Snittandel av året per station (stationerna kan vara utsatta olika dagar)
    v_unit := round(v_unit * (r.day_sum / r.n) / 365.0, 2);
    v_total := round(v_unit * v_n, 2);
    v_type_service := coalesce(addon_service_id_for_type(r.station_type_id), v_service_id);
    v_name := coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)';

    if v_row_id is not null then
      update case_billing_items
      set quantity = v_n,
          unit_price = v_unit, discounted_price = v_unit, total_price = v_total,
          service_id = v_type_service,
          service_code = (select code from services where id = v_type_service),
          service_name = v_name, article_name = v_name,
          station_type_id = r.station_type_id,
          addon_model = r.model,
          addon_annual_unit_price = coalesce(p_annual_price, addon_annual_price_for_type(r.station_type_id, p_customer_id, v_contract_id)),
          billing_start_date = r.end_day,
          notes = 'Tilläggsstationer fram till avtalets nästa periodstart. Därefter på en egen faktura i samband med årsfakturan.',
          updated_at = now()
      where id = v_row_id;
    else
      insert into case_billing_items (
        case_id, case_type, customer_id, item_type,
        service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price,
        vat_rate, price_source, added_by_technician_id, added_by_technician_name,
        status, requires_approval, notes, is_addon_prorata_line,
        station_type_id, addon_model, addon_annual_unit_price, billing_start_date
      ) values (
        v_case_id, 'contract', p_customer_id, 'service',
        v_type_service, (select code from services where id = v_type_service), v_name, v_name,
        v_n, v_unit, 0, v_unit, v_total,
        25, 'standard', p_technician_id, p_technician_name,
        'pending', false,
        'Tilläggsstationer fram till avtalets nästa periodstart. Därefter på en egen faktura i samband med årsfakturan.',
        true,
        r.station_type_id, r.model,
        coalesce(p_annual_price, addon_annual_price_for_type(r.station_type_id, p_customer_id, v_contract_id)),
        r.end_day
      )
      returning id into v_row_id;
    end if;
    v_keep := v_keep || v_row_id;
    v_count := v_count + v_n;
    v_sum := v_sum + v_total;
    v_rows := v_rows || jsonb_build_object('row_id', v_row_id, 'station_type_id', r.station_type_id, 'model', r.model, 'quantity', v_n, 'total', v_total);
  end loop;

  -- Typer som inte längre står ute: raden tas bort (mappade artiklar släpps)
  update case_billing_items set mapped_service_id = null, updated_at = now()
  where mapped_service_id in (
    select id from case_billing_items
    where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
      and status = 'pending' and not (id = any(v_keep))
  );
  delete from case_billing_items
  where case_id = v_case_id and is_addon_prorata_line and not is_addon_labour_line
    and status = 'pending' and not (id = any(v_keep));

  perform addon_labour_prorata_recalc(v_case_id, v_contract_id);

  return jsonb_build_object('found', true, 'case_id', v_case_id, 'count', v_count,
    'row_id', (v_rows -> 0 ->> 'row_id'), 'rows', v_rows,
    'total', round(v_sum, 2), 'next_period_start', v_next_start, 'contract_id', v_contract_id,
    'price_missing', v_missing);
end;
$$;

-- Teknikerns förslag: timmar per år för enheten (nytt totalt). Sparas på
-- ärendets pro rata-rad för arbetstiden tills kontoret beslutar i kartan.
create or replace function public.set_addon_labour_proposal(p_case_id uuid, p_hours numeric)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_unit uuid;
  v_contract uuid;
  v_rate numeric;
  v_before numeric;
  v_service uuid;
  v_row record;
  v_row_id uuid;
  v_total numeric;
  v_tech uuid;
  v_tech_name text;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  if p_hours is null or p_hours < 0 or p_hours > 1000 or (p_hours * 2) <> floor(p_hours * 2) then
    raise exception 'Ange timmar i halva timmar (0 till 1000)';
  end if;

  select customer_id into v_unit from cases where id = p_case_id and deleted_at is null;
  if v_unit is null then raise exception 'Ärendet finns inte'; end if;

  v_service := addon_labour_service_id();
  if v_service is null then
    return jsonb_build_object('ok', false, 'reason', 'service_missing');
  end if;
  v_contract := addon_contract_for_unit(v_unit);
  if v_contract is null then
    return jsonb_build_object('ok', false, 'reason', 'no_contract');
  end if;
  v_rate := addon_labour_hourly_price(v_unit, v_contract);

  select * into v_row from case_billing_items
  where case_id = p_case_id and is_addon_prorata_line and is_addon_labour_line and status <> 'cancelled'
  limit 1;
  if found and v_row.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_billed', 'row_id', v_row.id);
  end if;

  select p.technician_id into v_tech from profiles p where p.user_id = auth.uid() limit 1;
  if v_tech is not null then select name into v_tech_name from technicians where id = v_tech; end if;

  if v_row.id is null then
    v_before := addon_unit_labour_hours(v_contract, v_unit);
    insert into case_billing_items (
      case_id, case_type, customer_id, item_type,
      service_id, service_code, service_name, article_name,
      quantity, unit_price, discount_percent, discounted_price, total_price,
      vat_rate, price_source, added_by_technician_id, added_by_technician_name,
      status, requires_approval, notes,
      is_addon_prorata_line, is_addon_labour_line,
      addon_labour_hours, addon_labour_hours_before, addon_annual_unit_price
    ) values (
      p_case_id, 'contract', v_unit, 'service',
      v_service, (select code from services where id = v_service),
      'Arbetstid för att hantera tilläggen', 'Arbetstid för att hantera tilläggen',
      1, 0, 0, 0, 0,
      25, 'standard', v_tech, v_tech_name,
      'pending', false,
      'Teknikerns förslag på arbetstid per år. Kontoret beslutar tilläggen i avtalskartan. Bara ökningen faktureras fram till avtalets nästa periodstart.',
      true, true,
      p_hours, v_before, v_rate
    )
    returning id into v_row_id;
  else
    v_row_id := v_row.id;
    v_before := coalesce(v_row.addon_labour_hours_before, addon_unit_labour_hours(v_contract, v_unit));
    update case_billing_items
    set addon_labour_hours = p_hours,
        addon_labour_hours_before = v_before,
        updated_at = now()
    where id = v_row_id;
  end if;

  v_total := addon_labour_prorata_recalc(p_case_id, v_contract);

  return jsonb_build_object('ok', true, 'row_id', v_row_id, 'hours', p_hours, 'hours_before', v_before,
    'hourly_price', v_rate, 'total', coalesce(v_total, 0), 'price_missing', v_rate is null);
end;
$$;

-- Underlag för teknikerns avslutssteg (och kontorets beslut): stationer
-- innan/nya per typ, arbetstid i dag, förslag, timpris och periodstart.
-- SECURITY DEFINER: teknikern kan inte läsa avtal eller prislistor direkt.
create or replace function public.addon_completion_summary(p_case_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_unit uuid;
  v_created timestamptz;
  v_case_number text;
  v_contract uuid;
  v_next date;
  v_types jsonb;
  v_proposal record;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  select customer_id, created_at, case_number into v_unit, v_created, v_case_number
  from cases where id = p_case_id and deleted_at is null;
  if v_unit is null then
    return jsonb_build_object('ok', false, 'reason', 'no_case');
  end if;
  v_contract := addon_contract_for_unit(v_unit);
  if v_contract is not null then
    v_next := contract_next_period_start(v_contract, v_today);
  end if;

  with st as (
    select ep.station_type_id, ep.addon_billing_model as model, ep.addon_contract_mode as mode,
           ep.addon_contract_id is null as undecided,
           coalesce(ep.addon_marked_at, ep.placed_at) >= v_created as is_new
    from equipment_placements ep
    where ep.customer_id = v_unit and ep.is_addon and ep.status = 'active'
      and ep.addon_billing_model in ('per_year', 'per_month')
    union all
    select s.station_type_id, s.addon_billing_model, s.addon_contract_mode,
           s.addon_contract_id is null,
           coalesce(s.addon_marked_at, s.placed_at) >= v_created
    from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
    where fp.customer_id = v_unit and s.is_addon and s.status = 'active'
      and s.addon_billing_model in ('per_year', 'per_month')
  ),
  agg as (
    select st.station_type_id, st.model,
      count(*) filter (where not is_new and coalesce(mode, 'separate') <> 'included') as before_count,
      count(*) filter (where not is_new and undecided) as before_pending,
      count(*) filter (where is_new and coalesce(mode, 'separate') <> 'included') as new_count,
      count(*) filter (where coalesce(mode, 'separate') = 'included') as included_count
    from st group by st.station_type_id, st.model
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'station_type_id', a.station_type_id,
    'station_type_name', coalesce(t.name, 'Station'),
    'model', a.model,
    'before', a.before_count,
    'before_pending', a.before_pending,
    'new', a.new_count,
    'included', a.included_count,
    'annual_price', addon_annual_price_for_type(a.station_type_id, v_unit, v_contract)
  ) order by t.name), '[]'::jsonb)
  into v_types
  from agg a left join station_types t on t.id = a.station_type_id;

  select addon_labour_hours, addon_labour_hours_before, status, total_price into v_proposal
  from case_billing_items
  where case_id = p_case_id and is_addon_prorata_line and is_addon_labour_line and status <> 'cancelled'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'case_id', p_case_id,
    'case_number', v_case_number,
    'case_created_at', v_created,
    'unit_id', v_unit,
    'unit_name', (select coalesce(site_name, company_name) from customers where id = v_unit),
    'contract_id', v_contract,
    'contract_name', (select coalesce(nullif(trim(display_name), ''), label, contract_type) from contracts where id = v_contract),
    'contract_end_date', (select contract_end_date from contracts where id = v_contract),
    'today', v_today,
    'next_period_start', v_next,
    'hourly_price', case when v_contract is not null then addon_labour_hourly_price(v_unit, v_contract) end,
    'hourly_cost', addon_labour_hourly_cost(),
    'labour_hours_before', case when v_contract is not null then addon_unit_labour_hours(v_contract, v_unit) else 0 end,
    'proposal_hours', v_proposal.addon_labour_hours,
    'proposal_hours_before', v_proposal.addon_labour_hours_before,
    'proposal_status', v_proposal.status,
    'proposal_total', v_proposal.total_price,
    'types', v_types
  );
end;
$$;

-- Kontorets beslut om arbetstiden för en enhet på ett avtal.
-- separate: § 6-raden (timmar × låst timpris) + intern kostnad via artikelsynken.
-- included: bara ÖKNINGEN mot dagens § 6-timmar läggs som intern kostnad i § 4
--           (mappad mot bärande raden). Premiehöjningen görs av klienten i
--           premietrappan (ContractScopeService), samma väg som stationerna.
-- Öppna ärendens förslag följer beslutet och deras pro rata räknas om.
create or replace function public.decide_addon_labour(
  p_contract_id uuid,
  p_unit_id uuid,
  p_hours numeric,
  p_mode text default 'separate'
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_rate numeric;
  v_next date;
  v_service uuid;
  v_contract_customer uuid;
  v_row record;
  v_total numeric;
  v_before numeric;
  v_add numeric := 0;
  v_cost numeric;
  v_article uuid;
  v_carrier uuid;
  v_unit_name text;
  c record;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  if p_mode not in ('separate', 'included') then raise exception 'Okänt läge'; end if;
  if p_hours is null or p_hours < 0 or p_hours > 1000 or (p_hours * 2) <> floor(p_hours * 2) then
    raise exception 'Ange timmar i halva timmar (0 till 1000)';
  end if;

  v_service := addon_labour_service_id();
  if v_service is null then return jsonb_build_object('ok', false, 'reason', 'service_missing'); end if;
  select customer_id into v_contract_customer from contracts where id = p_contract_id;
  if v_contract_customer is null then raise exception 'Avtalet finns inte'; end if;
  v_rate := addon_labour_hourly_price(p_unit_id, p_contract_id);
  v_next := contract_next_period_start(p_contract_id, v_today);
  v_before := addon_unit_labour_hours(p_contract_id, p_unit_id);
  select coalesce(site_name, company_name) into v_unit_name from customers where id = p_unit_id;

  if p_mode = 'separate' then
    select * into v_row from case_billing_items
    where case_id = p_contract_id and site_customer_id = p_unit_id
      and is_addon_labour_line and not is_addon_prorata_line and item_type = 'service' and status <> 'cancelled'
    limit 1;
    -- Timpriset låses vid första beslutet (som stationernas årspris)
    v_rate := coalesce(v_row.addon_annual_unit_price, v_rate);
    if p_hours > 0 and v_rate is null then
      return jsonb_build_object('ok', false, 'reason', 'price_missing');
    end if;
    v_total := round(p_hours * coalesce(v_rate, 0), 2);
    if v_row.id is not null then
      update case_billing_items
      set quantity = case when p_hours > 0 then 1 else 0 end,
          unit_price = v_total, discounted_price = v_total, total_price = v_total,
          addon_labour_hours = p_hours, addon_annual_unit_price = v_rate,
          updated_at = now()
      where id = v_row.id;
    elsif p_hours > 0 then
      insert into case_billing_items (
        case_id, case_type, customer_id, site_customer_id, item_type,
        service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price,
        vat_rate, price_source, status, requires_approval, billing_model, billing_start_date,
        is_addon_labour_line, addon_labour_hours, addon_annual_unit_price, notes
      ) values (
        p_contract_id, 'contract', v_contract_customer, p_unit_id, 'service',
        v_service, (select code from services where id = v_service),
        'Arbetstid för att hantera tilläggen', 'Arbetstid för att hantera tilläggen',
        1, v_total, 0, v_total, v_total,
        25, 'standard', 'pending', false, 'per_year', v_next,
        true, p_hours, v_rate,
        'Arbetstid för att hantera tilläggen på enheten, timmar per år × kundens timpris.'
      );
    end if;
    perform sync_addon_article_lines(p_contract_id);
  else
    v_add := greatest(p_hours - v_before, 0);
    if v_add > 0 then
      v_article := addon_labour_cost_article_id();
      v_cost := coalesce(addon_labour_hourly_cost(), 0);
      select id into v_carrier from case_billing_items
      where case_id = p_contract_id and is_premium_carrier and status <> 'cancelled' limit 1;
      if v_article is not null then
        insert into case_billing_items (
          case_id, case_type, customer_id, item_type,
          article_id, article_code, article_name, service_name,
          quantity, unit_price, discount_percent, discounted_price, total_price,
          vat_rate, price_source, status, requires_approval, billing_model,
          mapped_service_id, addon_labour_hours, notes
        ) values (
          p_contract_id, 'contract', v_contract_customer, 'article',
          v_article, (select code from articles where id = v_article),
          coalesce((select name from articles where id = v_article), 'Arbetstid'),
          coalesce((select name from articles where id = v_article), 'Arbetstid'),
          1, round(v_add * v_cost, 2), 0, round(v_add * v_cost, 2), round(v_add * v_cost, 2),
          25, 'standard', 'pending', false, 'premium',
          v_carrier, v_add,
          'Arbetstid för att hantera tilläggen på ' || coalesce(v_unit_name, 'enheten') || ', ' || v_add || ' h per år, inlagd i avtalet ' || v_today
        );
      end if;
    end if;
  end if;

  -- Öppna ärendens förslag följer beslutet
  for c in
    select distinct cbi.case_id from case_billing_items cbi
    join cases cs on cs.id = cbi.case_id
    where cs.customer_id = p_unit_id and cbi.is_addon_prorata_line and cbi.status = 'pending'
      and cs.deleted_at is null and cs.status not ilike '%avslutat%'
  loop
    if p_mode = 'separate' then
      update case_billing_items set addon_labour_hours = p_hours, updated_at = now()
      where case_id = c.case_id and is_addon_prorata_line and is_addon_labour_line and status = 'pending';
    end if;
    perform sync_addon_prorata_line(p_unit_id, null, null, null, c.case_id);
  end loop;

  return jsonb_build_object('ok', true, 'mode', p_mode, 'hours', p_hours, 'hours_before', v_before,
    'hourly_price', v_rate, 'added_hours', v_add,
    'annual_add', round(v_add * coalesce(v_rate, 0), 2),
    'annual_total', round(p_hours * coalesce(v_rate, 0), 2));
end;
$$;

grant execute on function public.addon_service_price(uuid, uuid, uuid) to authenticated;
grant execute on function public.addon_labour_hourly_price(uuid, uuid) to authenticated;
grant execute on function public.addon_labour_hourly_cost() to authenticated;
grant execute on function public.addon_contract_for_unit(uuid) to authenticated;
grant execute on function public.addon_unit_labour_hours(uuid, uuid) to authenticated;
grant execute on function public.sync_addon_prorata_line(uuid, numeric, uuid, text, uuid) to authenticated;
grant execute on function public.set_addon_labour_proposal(uuid, numeric) to authenticated;
grant execute on function public.addon_completion_summary(uuid) to authenticated;
grant execute on function public.decide_addon_labour(uuid, uuid, numeric, text) to authenticated;
revoke execute on function public.set_addon_labour_proposal(uuid, numeric) from anon;
revoke execute on function public.addon_completion_summary(uuid) from anon;
revoke execute on function public.decide_addon_labour(uuid, uuid, numeric, text) from anon;
revoke execute on function public.addon_labour_hourly_cost() from anon;
