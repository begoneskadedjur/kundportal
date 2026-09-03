-- Tilläggsstationer: tre betalningsmodeller (per år, per månad, per kontroll)
-- och två avtalslägen (inbakat i premien, tillägg utöver avtalet på egna fakturor).
-- Plan: docs/tillaggsstationer-tre-modeller-plan.md. Applicerad via MCP 2026-09-03.

-- ─────────────────────────────────────────────────────────────
-- 1. Rättelse: "Lägg till i avtalet" räknade dubbelt
--    RPC:n höjde årspremien (trappsteg) OCH lade en § 6-rad per_year med
--    samma belopp; planeraren summerar båda. Raden blir nu en § 4-rad
--    (premium): innehåll som ingår i premien, beloppet kommer ur trappan.
-- ─────────────────────────────────────────────────────────────
create or replace function apply_contract_addition(
  p_case_billing_item_id uuid,
  p_customer_id uuid,
  p_case_id uuid,
  p_description text,
  p_annual_amount numeric,
  p_prorated_amount numeric,
  p_effective_from date,
  p_created_by_name text default null,
  p_contract_id uuid default null,
  p_service_id uuid default null,
  p_service_code text default null,
  p_service_name text default null,
  p_quantity numeric default 1,
  p_vat_rate numeric default 25
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev numeric;
  v_new numeric;
  v_addition_id uuid;
  v_qty numeric := greatest(coalesce(p_quantity, 1), 1);
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  if p_annual_amount is null or p_annual_amount <= 0 then
    raise exception 'Årsbeloppet måste vara större än noll';
  end if;

  -- Idempotens: samma rad ger aldrig två tillägg
  select id into v_addition_id from contract_additions
  where case_billing_item_id = p_case_billing_item_id;
  if v_addition_id is not null then
    return jsonb_build_object('addition_id', v_addition_id, 'already_applied', true);
  end if;

  if p_contract_id is not null then
    select coalesce(annual_value, 0) into v_prev
    from contracts where id = p_contract_id for update;
    if not found then
      raise exception 'Avtalet hittades inte';
    end if;
    v_new := v_prev + p_annual_amount;
    update contracts set annual_value = v_new, total_value = v_new where id = p_contract_id;
    update customers set annual_value = coalesce(annual_value, 0) + p_annual_amount where id = p_customer_id;
  else
    select coalesce(annual_value, 0) into v_prev
    from customers where id = p_customer_id for update;
    if not found then
      raise exception 'Kunden hittades inte';
    end if;
    v_new := v_prev + p_annual_amount;
    update customers set annual_value = v_new where id = p_customer_id;
  end if;

  insert into contract_additions (
    customer_id, contract_id, case_id, case_billing_item_id, description,
    annual_amount, prorated_amount, effective_from,
    previous_annual_value, new_annual_value,
    created_by, created_by_name
  ) values (
    p_customer_id, p_contract_id, p_case_id, p_case_billing_item_id, p_description,
    p_annual_amount, p_prorated_amount, p_effective_from,
    v_prev, v_new,
    auth.uid(), p_created_by_name
  )
  returning id into v_addition_id;

  if p_contract_id is not null then
    insert into contract_premium_events (
      contract_id, effective_from, annual_value, event_type, note, source_addition_id, created_by
    ) values (
      p_contract_id, p_effective_from, v_new, 'addition', p_description, v_addition_id, p_created_by_name
    )
    on conflict (contract_id, effective_from, event_type) do update
      set annual_value = excluded.annual_value,
          note = coalesce(contract_premium_events.note, '') || ' · ' || excluded.note;

    -- § 4 Tjänster i avtalet: innehållsrad som ingår i premien. Beloppet
    -- faktureras via trappan, aldrig som egen rad (rättelse 2026-09-03).
    if p_service_id is not null then
      insert into case_billing_items (
        case_id, case_type, customer_id, item_type, service_id, service_code, service_name,
        article_name, quantity, unit_price, total_price, vat_rate, discount_percent,
        price_source, status, billing_model, added_by_technician_name, notes
      ) values (
        p_contract_id, 'contract', p_customer_id, 'service', p_service_id, p_service_code, p_service_name,
        p_service_name, v_qty, round(p_annual_amount / v_qty, 2), p_annual_amount, coalesce(p_vat_rate, 25), 0,
        'standard', 'pending', 'premium', p_created_by_name,
        'Avtalstillägg från ärende, ingår i premien från ' || p_effective_from::text
      );
    end if;
  end if;

  return jsonb_build_object(
    'addition_id', v_addition_id,
    'previous_annual_value', v_prev,
    'new_annual_value', v_new,
    'already_applied', false
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Datamodell
-- ─────────────────────────────────────────────────────────────
alter table public.equipment_placements
  add column if not exists addon_billing_model text,
  add column if not exists addon_contract_mode text;
alter table public.indoor_stations
  add column if not exists addon_billing_model text,
  add column if not exists addon_contract_mode text;

-- Befintliga tilläggsstationer: dagens beteende (per kontroll)
update public.equipment_placements set addon_billing_model = 'per_round' where is_addon = true and addon_billing_model is null;
update public.indoor_stations set addon_billing_model = 'per_round' where is_addon = true and addon_billing_model is null;

alter table public.equipment_placements drop constraint if exists ep_addon_model_check;
alter table public.equipment_placements add constraint ep_addon_model_check check (
  (coalesce(is_addon, false) = false and addon_billing_model is null and addon_contract_mode is null)
  or (is_addon = true and addon_billing_model in ('per_year', 'per_month', 'per_round')
      and (addon_contract_mode is null or addon_contract_mode in ('included', 'separate'))
      and (addon_billing_model <> 'per_round' or addon_contract_mode is null))
);
alter table public.indoor_stations drop constraint if exists is_addon_model_check;
alter table public.indoor_stations add constraint is_addon_model_check check (
  (coalesce(is_addon, false) = false and addon_billing_model is null and addon_contract_mode is null)
  or (is_addon = true and addon_billing_model in ('per_year', 'per_month', 'per_round')
      and (addon_contract_mode is null or addon_contract_mode in ('included', 'separate'))
      and (addon_billing_model <> 'per_round' or addon_contract_mode is null))
);

comment on column public.equipment_placements.addon_billing_model is 'Tilläggsstation: per_year, per_month eller per_round (valt av tekniker vid utsättning). Null för avtalsstationer.';
comment on column public.equipment_placements.addon_contract_mode is 'Tilläggsstation per år/månad: included = inbakad i årspremien (§ 7), separate = tillägg utöver avtalet på egna fakturor (§ 6), null = ej beslutat i avtalskartan.';
comment on column public.indoor_stations.addon_billing_model is 'Se equipment_placements.addon_billing_model';
comment on column public.indoor_stations.addon_contract_mode is 'Se equipment_placements.addon_contract_mode';

alter table public.contracts
  add column if not exists equipment_invoice_mode text not null default 'with_premium';
alter table public.contracts drop constraint if exists contracts_equipment_invoice_mode_check;
alter table public.contracts add constraint contracts_equipment_invoice_mode_check
  check (equipment_invoice_mode in ('with_premium', 'separate'));
comment on column public.contracts.equipment_invoice_mode is 'with_premium = § 6-rader per år ligger på premiefakturan; separate = egna fakturor (contract_invoice_kind equipment). Per månad-rader får alltid egna månadsfakturor.';

alter table public.case_billing_items
  add column if not exists site_customer_id uuid references public.customers(id) on delete set null;
comment on column public.case_billing_items.site_customer_id is '§ 6-rad för tilläggsstationer: enheten raden avser (antal synkas från enhetens stationer).';

alter table public.case_billing_items drop constraint if exists cbi_billing_model_check;
alter table public.case_billing_items add constraint cbi_billing_model_check
  check (billing_model in ('premium', 'per_year', 'per_month', 'per_round'));

-- Startdatum för § 6-rader: raden tas med i perioder som börjar från och med
-- detta datum (första delperioden täcks av pro rata på etableringsärendet).
alter table public.case_billing_items add column if not exists billing_start_date date;
comment on column public.case_billing_items.billing_start_date is '§ 6-rad: första periodstart raden faktureras i (pro rata dessförinnan). Null = alla perioder.';

-- Egna fakturor för tillägg: per år följer avtalets perioder (equipment),
-- per månad får egna månadsperioder (equipment_monthly).
alter table public.invoices drop constraint if exists invoices_contract_invoice_kind_check;
alter table public.invoices add constraint invoices_contract_invoice_kind_check
  check (contract_invoice_kind in ('premium', 'equipment', 'equipment_monthly', 'adjustment'));

alter table public.invoice_items drop constraint if exists invoice_items_line_kind_check;
alter table public.invoice_items add constraint invoice_items_line_kind_check
  check (line_kind is null or line_kind in ('premium', 'equipment_annual', 'equipment_monthly', 'index_note', 'addon_round', 'service', 'article', 'generic'));

-- En synkad tilläggsrad per (avtal, enhet, stationstyp, modell)
create unique index if not exists cbi_addon_period_line_key
  on public.case_billing_items (case_id, site_customer_id, station_type_id, billing_model)
  where site_customer_id is not null and station_type_id is not null and billing_model in ('per_year', 'per_month') and status <> 'cancelled';

-- Årspristjänsten för tilläggsstationer (tjänst 43 fortsätter betyda per kontroll)
alter table public.services add column if not exists used_for_addon_stations_annual boolean not null default false;
create unique index if not exists services_one_addon_annual_service
  on public.services (used_for_addon_stations_annual) where used_for_addon_stations_annual;
comment on column public.services.used_for_addon_stations_annual is 'Bär årspriset för tilläggsstationer (per år, per månad = /12). Bara en aktiv tjänst kan ha flaggan.';

insert into public.services (code, name, unit, is_active, used_for_addon_stations_annual)
select '144', 'Tilläggsstation per år', 'st', true, true
where not exists (select 1 from public.services where used_for_addon_stations_annual);

-- ─────────────────────────────────────────────────────────────
-- 3. Etableringsraden räknar bara per kontroll-stationer
-- ─────────────────────────────────────────────────────────────
create or replace function sync_addon_station_line(
  p_customer_id uuid,
  p_unit_price numeric default null,
  p_technician_id uuid default null,
  p_technician_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  select count(*) into v_open_count
  from cases
  where customer_id = p_customer_id
    and service_type = 'establishment'
    and status not ilike '%avslutat%'
    and deleted_at is null;

  select id, created_at into v_case_id, v_created
  from cases
  where customer_id = p_customer_id
    and service_type = 'establishment'
    and status not ilike '%avslutat%'
    and deleted_at is null
  order by created_at desc
  limit 1;

  if v_case_id is null then
    return jsonb_build_object('found', false, 'open_count', v_open_count);
  end if;

  select id, code, name, base_price
  into v_service_id, v_service_code, v_service_name, v_base_price
  from services
  where used_for_addon_stations = true and is_active = true
  limit 1;

  if v_service_id is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id,
      'open_count', v_open_count, 'service_missing', true);
  end if;

  -- Aktiva tilläggsstationer PER KONTROLL placerade sedan ärendet öppnades.
  -- Per år/månad får ingen etableringsavgift (första periodfaktura i stället).
  select
    (select count(*) from equipment_placements ep
      where ep.customer_id = p_customer_id and ep.is_addon = true
        and coalesce(ep.addon_billing_model, 'per_round') = 'per_round'
        and ep.status = 'active' and ep.placed_at >= v_created)
    +
    (select count(*) from indoor_stations s
      join floor_plans fp on fp.id = s.floor_plan_id
      where fp.customer_id = p_customer_id and s.is_addon = true
        and coalesce(s.addon_billing_model, 'per_round') = 'per_round'
        and s.status = 'active' and s.placed_at >= v_created)
  into v_count;

  select id, status into v_row_id, v_row_status
  from case_billing_items
  where case_id = v_case_id and is_addon_station_line = true
  limit 1;

  if v_row_id is not null then
    if v_row_status = 'pending' then
      update case_billing_items
      set quantity = v_count,
          total_price = coalesce(discounted_price, unit_price) * v_count
      where id = v_row_id;
    end if;
  elsif v_count > 0 then
    v_price := coalesce(p_unit_price, v_base_price, 0);
    insert into case_billing_items (
      case_id, case_type, customer_id, item_type,
      service_id, service_code, service_name,
      article_id, article_code, article_name,
      quantity, unit_price, discount_percent, discounted_price, total_price,
      vat_rate, price_source, added_by_technician_id, added_by_technician_name,
      status, requires_approval, notes, is_addon_station_line
    ) values (
      v_case_id, 'contract', p_customer_id, 'service',
      v_service_id, v_service_code, v_service_name || ' – Etablering',
      null, null, v_service_name || ' – Etablering',
      v_count, v_price, 0, v_price, v_price * v_count,
      25, 'standard', p_technician_id, p_technician_name,
      'pending', false, 'Tilläggsstationer placerade i etableringen', true
    )
    on conflict (case_id) where is_addon_station_line do update
      set quantity = excluded.quantity,
          total_price = coalesce(case_billing_items.discounted_price, case_billing_items.unit_price) * excluded.quantity
      where case_billing_items.status = 'pending';

    select id into v_row_id from case_billing_items
    where case_id = v_case_id and is_addon_station_line = true limit 1;
  end if;

  return jsonb_build_object(
    'found', true,
    'case_id', v_case_id,
    'count', v_count,
    'row_id', v_row_id,
    'open_count', v_open_count,
    'already_billed', v_row_status is not null and v_row_status <> 'pending'
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Avtalskoppling och normalisering på stationstabellerna
--    addon_contract_id sätts av avtalskartan (släpp av brickan). Null = RPC:n
--    löser avtal per enhet (eget avtal → § 1 → huvudkontorets covers_all_sites).
--    Triggern håller kolumnerna konsekventa oavsett vilken skrivväg som
--    används (formulär, admin-modaler, äldre kod utan modell).
-- ─────────────────────────────────────────────────────────────
alter table public.equipment_placements add column if not exists addon_contract_id uuid references public.contracts(id) on delete set null;
alter table public.indoor_stations add column if not exists addon_contract_id uuid references public.contracts(id) on delete set null;

create or replace function addon_station_normalize()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.is_addon, false) = false then
    new.addon_billing_model := null;
    new.addon_contract_mode := null;
    new.addon_contract_id := null;
  else
    if new.addon_billing_model is null then
      new.addon_billing_model := 'per_round';
    end if;
    if new.addon_billing_model = 'per_round' then
      new.addon_contract_mode := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipment_placements_addon_normalize on public.equipment_placements;
create trigger trg_equipment_placements_addon_normalize
  before insert or update on public.equipment_placements
  for each row execute function addon_station_normalize();
drop trigger if exists trg_indoor_stations_addon_normalize on public.indoor_stations;
create trigger trg_indoor_stations_addon_normalize
  before insert or update on public.indoor_stations
  for each row execute function addon_station_normalize();

-- Stationspolicyer: profiles.id är inte alltid auth.uid() (7 av 26 profiler).
-- Uppdatering/borttag ska gå på profiles.user_id som läsningen redan gör.
drop policy if exists "Staff can update equipment" on public.equipment_placements;
create policy "Staff can update equipment" on public.equipment_placements
  for update using (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and profiles.role in ('admin', 'koordinator', 'technician'))
  );
drop policy if exists "Admin och koordinator kan ta bort utrustning" on public.equipment_placements;
create policy "Admin och koordinator kan ta bort utrustning" on public.equipment_placements
  for delete using (
    exists (select 1 from profiles where profiles.user_id = auth.uid()
            and (profiles.role in ('admin', 'koordinator') or profiles.is_admin = true or profiles.is_koordinator = true))
  );
drop policy if exists "Tekniker kan ta bort egen utrustning" on public.equipment_placements;
create policy "Tekniker kan ta bort egen utrustning" on public.equipment_placements
  for delete using (
    placed_by_technician_id in (select profiles.technician_id from profiles where profiles.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Nästa periodstart för ett avtal (SQL-port av planerarens periodisering)
-- ─────────────────────────────────────────────────────────────
create or replace function contract_next_period_start(p_contract_id uuid, p_from date)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. § 6-rader för per år/per månad: en rad per (avtal, enhet, stationstyp,
--    modell) med antal = aktiva tilläggsstationer med läge "tillägg".
--    Anropas vid utsättning/borttag (enhet) och vid planering (avtal).
--    Nya rader får billing_start_date = nästa periodstart: perioden fram
--    dit täcks av pro rata-raden på etableringsärendet.
-- ─────────────────────────────────────────────────────────────
create or replace function sync_addon_period_lines(
  p_customer_id uuid default null,
  p_contract_id uuid default null,
  p_annual_price numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_contract_id uuid := p_contract_id;
  v_contract_customer uuid;
  v_service_id uuid;
  v_service_code text;
  v_service_name text;
  v_base_price numeric;
  v_rows int := 0;
  r record;
  v_unit_price numeric;
  v_existing_id uuid;
  v_existing_price numeric;
  v_annual numeric;
  v_next_start date;
begin
  if not intranet_is_internal() and auth.role() <> 'service_role' then
    raise exception 'Behörighet saknas';
  end if;

  select id, code, name, base_price
  into v_service_id, v_service_code, v_service_name, v_base_price
  from services
  where used_for_addon_stations_annual = true and is_active = true
  limit 1;
  if v_service_id is null then
    return jsonb_build_object('ok', false, 'reason', 'service_missing');
  end if;

  if v_contract_id is null then
    if p_customer_id is null then
      raise exception 'Ange enhet eller avtal';
    end if;
    -- Avtalskartans val vinner, annars samma ordning som get_contract_candidates
    select coalesce(
      (select ep.addon_contract_id from equipment_placements ep
        where ep.customer_id = p_customer_id and ep.is_addon and ep.status = 'active' and ep.addon_contract_id is not null
        order by ep.placed_at desc limit 1),
      (select s.addon_contract_id from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
        where fp.customer_id = p_customer_id and s.is_addon and s.status = 'active' and s.addon_contract_id is not null
        order by s.placed_at desc limit 1)
    ) into v_contract_id;
    if v_contract_id is null then
      select c.id into v_contract_id
      from contracts c
      where c.type = 'contract'
        and c.status in ('signed', 'active')
        and c.terminated_at is null
        and (
          c.customer_id = p_customer_id
          or exists (
            select 1 from contract_sites cs
            where cs.contract_id = c.id and cs.customer_id = p_customer_id
              and (cs.active_to is null or cs.active_to >= v_today)
              and (cs.active_from is null or cs.active_from <= v_today)
          )
          or (c.covers_all_sites = true and c.customer_id = (select parent_customer_id from customers where id = p_customer_id))
        )
      order by (c.customer_id = p_customer_id) desc, c.display_order nulls last, c.created_at
      limit 1;
    end if;
    if v_contract_id is null then
      return jsonb_build_object('ok', false, 'reason', 'no_contract');
    end if;
  end if;

  select customer_id into v_contract_customer from contracts where id = v_contract_id;
  v_next_start := contract_next_period_start(v_contract_id, v_today);

  for r in
    with units as (
      select p_customer_id as customer_id where p_customer_id is not null
      union
      select c.customer_id from contracts c where c.id = v_contract_id and p_customer_id is null
      union
      select cs.customer_id from contract_sites cs
        where cs.contract_id = v_contract_id and p_customer_id is null
          and (cs.active_to is null or cs.active_to >= v_today)
      union
      select u.id from customers u
        join contracts c on c.id = v_contract_id and c.covers_all_sites = true and u.parent_customer_id = c.customer_id
        where p_customer_id is null
    ),
    stations as (
      select ep.customer_id, ep.station_type_id, ep.addon_billing_model as model
      from equipment_placements ep
      join units u on u.customer_id = ep.customer_id
      where ep.is_addon = true and ep.status = 'active'
        and ep.addon_billing_model in ('per_year', 'per_month')
        and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
        and (ep.addon_contract_id is null or ep.addon_contract_id = v_contract_id)
      union all
      select fp.customer_id, s.station_type_id, s.addon_billing_model
      from indoor_stations s
      join floor_plans fp on fp.id = s.floor_plan_id
      join units u on u.customer_id = fp.customer_id
      where s.is_addon = true and s.status = 'active'
        and s.addon_billing_model in ('per_year', 'per_month')
        and coalesce(s.addon_contract_mode, 'separate') = 'separate'
        and (s.addon_contract_id is null or s.addon_contract_id = v_contract_id)
    ),
    counted as (
      select customer_id, station_type_id, model, count(*) as n
      from stations group by customer_id, station_type_id, model
    ),
    existing as (
      select site_customer_id as customer_id, station_type_id, billing_model as model, 0::bigint as n
      from case_billing_items
      where case_id = v_contract_id and site_customer_id is not null
        and billing_model in ('per_year', 'per_month') and status <> 'cancelled'
        and (p_customer_id is null or site_customer_id = p_customer_id)
    )
    select customer_id, station_type_id, model, max(n) as n
    from (select * from counted union all select * from existing) x
    group by customer_id, station_type_id, model
  loop
    select id, unit_price into v_existing_id, v_existing_price
    from case_billing_items
    where case_id = v_contract_id and site_customer_id = r.customer_id
      and station_type_id is not distinct from r.station_type_id
      and billing_model = r.model and status <> 'cancelled'
    limit 1;

    v_annual := coalesce(p_annual_price, v_base_price);
    if v_annual is null and v_existing_price is not null then
      v_unit_price := v_existing_price;
    else
      v_unit_price := case
        when r.model = 'per_month' then round(coalesce(v_annual, 0) / 12, 2)
        else coalesce(v_annual, 0)
      end;
      if p_annual_price is null and v_existing_price is not null then
        v_unit_price := v_existing_price;
      end if;
    end if;

    if v_existing_id is not null then
      update case_billing_items
      set quantity = r.n,
          unit_price = v_unit_price,
          discounted_price = v_unit_price,
          total_price = round(v_unit_price * r.n, 2),
          updated_at = now()
      where id = v_existing_id;
    elsif r.n > 0 then
      insert into case_billing_items (
        case_id, case_type, customer_id, site_customer_id, station_type_id, item_type,
        service_id, service_code, service_name, article_name,
        quantity, unit_price, discount_percent, discounted_price, total_price,
        vat_rate, price_source, status, requires_approval, billing_model, billing_start_date, notes
      ) values (
        v_contract_id, 'contract', v_contract_customer, r.customer_id, r.station_type_id, 'service',
        v_service_id, v_service_code,
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        coalesce((select name from station_types where id = r.station_type_id), 'Tilläggsstationer') || ' (tilläggsstation)',
        r.n, v_unit_price, 0, v_unit_price, round(v_unit_price * r.n, 2),
        25, 'standard', 'pending', false, r.model,
        case when r.model = 'per_month' then (date_trunc('month', v_today) + interval '1 month')::date else v_next_start end,
        'Synkas från utplacerade tilläggsstationer'
      );
    end if;
    v_rows := v_rows + 1;
  end loop;

  return jsonb_build_object('ok', true, 'contract_id', v_contract_id, 'rows', v_rows, 'next_period_start', v_next_start);
end;
$$;

revoke all on function sync_addon_period_lines(uuid, uuid, numeric) from public;
grant execute on function sync_addon_period_lines(uuid, uuid, numeric) to authenticated;
grant execute on function sync_addon_period_lines(uuid, uuid, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. Pro rata-rad på etableringsärendet för per år/per månad-stationer:
--    årspris × dagar från utsättning till nästa periodstart / 365, per station.
--    Egen markör och partiellt unikt index (per ärende, bara pending-rader
--    så en ny rad kan skapas för tillkommande stationer efter fakturering).
--    Hoppas över när periodens faktura fortfarande är redigerbar: då tar den
--    fakturan upp stationerna i stället (ingen dubbeldebitering).
-- ─────────────────────────────────────────────────────────────
alter table public.case_billing_items add column if not exists is_addon_prorata_line boolean not null default false;
create unique index if not exists case_billing_items_one_prorata_line_per_case
  on public.case_billing_items (case_id) where is_addon_prorata_line and status = 'pending';

create or replace function sync_addon_prorata_line(
  p_customer_id uuid,
  p_annual_price numeric default null,
  p_technician_id uuid default null,
  p_technician_name text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_case_id uuid;
  v_created timestamptz;
  v_contract_id uuid;
  v_service_id uuid;
  v_service_code text;
  v_service_name text;
  v_base_price numeric;
  v_annual numeric;
  v_next_start date;
  v_count int := 0;
  v_sum numeric := 0;
  v_row_id uuid;
  v_open_invoice uuid;
  r record;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  select id, created_at into v_case_id, v_created
  from cases
  where customer_id = p_customer_id
    and service_type = 'establishment'
    and status not ilike '%avslutat%'
    and deleted_at is null
  order by created_at desc
  limit 1;
  if v_case_id is null then
    return jsonb_build_object('found', false);
  end if;

  select id, code, name, base_price
  into v_service_id, v_service_code, v_service_name, v_base_price
  from services where used_for_addon_stations_annual = true and is_active = true limit 1;
  if v_service_id is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'service_missing', true);
  end if;
  v_annual := coalesce(p_annual_price, v_base_price, 0);

  -- Avtalet: samma upplösning som period-synken (skriver inga rader här)
  select (sync_addon_period_lines(p_customer_id, null, p_annual_price) ->> 'contract_id')::uuid into v_contract_id;
  if v_contract_id is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'no_contract', true);
  end if;
  v_next_start := contract_next_period_start(v_contract_id, v_today);
  if v_next_start is null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'no_period', true);
  end if;

  -- Redigerbar faktura för innevarande period: den tar upp stationerna, ingen pro rata
  select id into v_open_invoice from invoices
  where contract_id = v_contract_id and invoice_type = 'contract'
    and billing_period_start <= v_today and billing_period_end >= v_today
    and status in ('draft', 'pending_approval', 'ready')
  limit 1;
  if v_open_invoice is not null then
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'covered_by_open_invoice', v_open_invoice);
  end if;

  -- Per station: dagar från utsättning till nästa periodstart
  for r in
    select ep.placed_at::date as placed
    from equipment_placements ep
    where ep.customer_id = p_customer_id and ep.is_addon = true and ep.status = 'active'
      and ep.addon_billing_model in ('per_year', 'per_month')
      and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
      and ep.placed_at >= v_created
    union all
    select s.placed_at::date
    from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
    where fp.customer_id = p_customer_id and s.is_addon = true and s.status = 'active'
      and s.addon_billing_model in ('per_year', 'per_month')
      and coalesce(s.addon_contract_mode, 'separate') = 'separate'
      and s.placed_at >= v_created
  loop
    v_count := v_count + 1;
    v_sum := v_sum + v_annual * greatest(v_next_start - r.placed, 0) / 365.0;
  end loop;
  v_sum := round(v_sum, 2);

  select id into v_row_id from case_billing_items
  where case_id = v_case_id and is_addon_prorata_line = true and status = 'pending' limit 1;

  if v_count = 0 then
    if v_row_id is not null then
      update case_billing_items set quantity = 0, total_price = 0, updated_at = now() where id = v_row_id;
    end if;
    return jsonb_build_object('found', true, 'case_id', v_case_id, 'count', 0, 'row_id', v_row_id);
  end if;

  if v_row_id is not null then
    update case_billing_items
    set quantity = v_count,
        unit_price = round(v_sum / v_count, 2),
        discounted_price = round(v_sum / v_count, 2),
        total_price = v_sum,
        service_name = v_service_name || ' – pro rata ' || v_today::text || ' till ' || (v_next_start - 1)::text,
        article_name = v_service_name || ' – pro rata ' || v_today::text || ' till ' || (v_next_start - 1)::text,
        updated_at = now()
    where id = v_row_id;
  else
    insert into case_billing_items (
      case_id, case_type, customer_id, item_type,
      service_id, service_code, service_name, article_name,
      quantity, unit_price, discount_percent, discounted_price, total_price,
      vat_rate, price_source, added_by_technician_id, added_by_technician_name,
      status, requires_approval, notes, is_addon_prorata_line
    ) values (
      v_case_id, 'contract', p_customer_id, 'service',
      v_service_id, v_service_code,
      v_service_name || ' – pro rata ' || v_today::text || ' till ' || (v_next_start - 1)::text,
      v_service_name || ' – pro rata ' || v_today::text || ' till ' || (v_next_start - 1)::text,
      v_count, round(v_sum / v_count, 2), 0, round(v_sum / v_count, 2), v_sum,
      25, 'standard', p_technician_id, p_technician_name,
      'pending', false,
      'Tilläggsstationer per år/månad: perioden fram till nästa premie. Därefter på avtalets § 6.',
      true
    )
    returning id into v_row_id;
  end if;

  return jsonb_build_object('found', true, 'case_id', v_case_id, 'count', v_count, 'row_id', v_row_id,
    'total', v_sum, 'next_period_start', v_next_start, 'contract_id', v_contract_id);
end;
$$;

revoke all on function sync_addon_prorata_line(uuid, numeric, uuid, text) from public;
grant execute on function sync_addon_prorata_line(uuid, numeric, uuid, text) to authenticated;
