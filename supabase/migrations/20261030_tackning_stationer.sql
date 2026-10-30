-- Avtalsåret på exakt avtalsdag, steg 8: täckningsmotorn för tilläggsstationer.
-- docs/planer/avtalsar-exakt-arsdag-teknik.md, avsnitt 6 och steg 8.
--
-- Additivt. Inga befintliga rader får täckning här (det är datasteg 16).
-- Triggrarna skriver bara för nya händelser och bara när avtalet har
-- addon_rules = 'v2' eller stationen redan har täckningsrader, så att
-- befintliga avtal och stationer beter sig som i dag. Triggrarna på invoices
-- och case_billing_items fångar alla fel och stoppar aldrig fakturering,
-- Fortnox-synk, makulering eller import (bara raise warning).
--
-- addon_station_paid_through svarar exakt som förut för stationer utan
-- täckningsrader: den gamla koden ligger ordagrant i
-- addon_station_paid_through_legacy. Backning: 20261030_tackning_stationer_backning.sql.

-- 1. Konflikter: låst faktura eller pro rata som täcker redan täckta dagar.
create table if not exists public.addon_coverage_conflicts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  case_billing_item_id uuid references public.case_billing_items(id) on delete cascade,
  station_id uuid not null,
  station_kind text not null check (station_kind in ('outdoor', 'indoor')),
  covered_from date,
  covered_to date,
  source text,
  conflict_with uuid references public.addon_station_coverage(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

comment on table public.addon_coverage_conflicts is
  'Täckning som inte kunde skrivas eftersom dagarna redan var täckta. Visas i arbetslistan (steg 10). Skrivs bara av triggers.';

create index if not exists acc_invoice_idx on public.addon_coverage_conflicts (invoice_id);
create index if not exists acc_open_idx on public.addon_coverage_conflicts (station_id) where resolved_at is null;

alter table public.addon_coverage_conflicts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'addon_coverage_conflicts' and policyname = 'acc_select_internal'
  ) then
    create policy acc_select_internal on public.addon_coverage_conflicts
      for select using (public.intranet_is_internal());
  end if;
end $$;

revoke all on public.addon_coverage_conflicts from anon;

-- 2. Hjälpfunktioner (bara för andra funktioner, ingen körrätt för klienter).

-- Läsrätt: intern personal, service role eller direkt databasanslutning
-- (SQL-editorn, inga JWT-claims).
create or replace function public.addon_coverage_can_read()
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  if v_claims is null then
    return true;
  end if;
  if coalesce(v_claims::jsonb ->> 'role', '') = 'service_role' then
    return true;
  end if;
  return intranet_is_internal();
end $$;

-- Skrivrätt: intern och profiles.can_approve_invoices. Returnerar profilen.
create or replace function public.addon_coverage_approver()
returns table(profile_id uuid, display_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  return query
    select p.id, coalesce(nullif(trim(p.display_name), ''), p.email)
    from profiles p
    where p.user_id = auth.uid() and p.is_active and coalesce(p.can_approve_invoices, false)
    limit 1;
  if not found then
    raise exception 'Behörighet saknas: kräver befogenheten att godkänna fakturor';
  end if;
end $$;

-- Stationens enhet, typ, avtal och svenska startdag. p_kind null = sök båda.
create or replace function public.addon_station_lookup(p_station_id uuid, p_kind text default null)
returns table(station_kind text, unit_customer_id uuid, contract_id uuid, start_day date, effective_from date)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind is null or p_kind = 'outdoor' then
    return query
      select 'outdoor'::text, ep.customer_id,
             coalesce(ep.addon_contract_id, addon_contract_for_unit(ep.customer_id)),
             coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date),
             ep.addon_effective_from
      from equipment_placements ep where ep.id = p_station_id;
    if found then return; end if;
  end if;
  if p_kind is null or p_kind = 'indoor' then
    return query
      select 'indoor'::text, fp.customer_id,
             coalesce(s.addon_contract_id, addon_contract_for_unit(fp.customer_id)),
             coalesce(s.addon_effective_from, (coalesce(s.addon_marked_at, s.placed_at) at time zone 'Europe/Stockholm')::date),
             s.addon_effective_from
      from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id where s.id = p_station_id;
  end if;
end $$;

-- Text som pekar ut en täckningsrad i felmeddelanden och svar.
create or replace function public.addon_coverage_ref(p_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(i.invoice_number, asc_.fortnox_document_number, c.case_number, i.fortnox_document_number, asc_.id::text)
  from addon_station_coverage asc_
  left join invoices i on i.id = asc_.invoice_id
  left join case_billing_items cbi on cbi.id = asc_.case_billing_item_id
  left join cases c on c.id = cbi.case_id
  where asc_.id = p_id
$$;

revoke all on function public.addon_coverage_can_read() from public, anon, authenticated;
revoke all on function public.addon_coverage_approver() from public, anon, authenticated;
revoke all on function public.addon_station_lookup(uuid, text) from public, anon, authenticated;
revoke all on function public.addon_coverage_ref(uuid) from public, anon, authenticated;

-- 3. Vakt: två aktiva rader för samma station får inte dela en enda dag.
create or replace function public.trg_asc_no_overlap()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.released_at is not null then
    return new;
  end if;
  -- Samtidiga skrivningar för samma station köas.
  perform pg_advisory_xact_lock(hashtextextended('asc:' || new.station_kind || ':' || new.station_id::text, 0));
  select a.id, a.source, a.covered_from, a.covered_to into r
  from addon_station_coverage a
  where a.station_id = new.station_id
    and a.station_kind = new.station_kind
    and a.released_at is null
    and a.id <> new.id
    and a.covered_from <= new.covered_to
    and a.covered_to >= new.covered_from
  order by a.covered_from
  limit 1;
  if found then
    raise exception using errcode = '23P01',
      message = format('Stationen är redan täckt %s t.o.m. %s (%s %s). Den nya raden (%s, %s t.o.m. %s) skulle ta samma dagar.',
                       r.covered_from, r.covered_to, r.source, coalesce(addon_coverage_ref(r.id), ''),
                       new.source, new.covered_from, new.covered_to);
  end if;
  return new;
end $$;

create or replace trigger trg_asc_no_overlap
  before insert or update of covered_from, covered_to, released_at
  on public.addon_station_coverage
  for each row execute function public.trg_asc_no_overlap();

-- Skriv en täckningsrad, eller en konflikt om dagarna redan är täckta.
-- Bara för triggrarna nedan.
create or replace function public.addon_coverage_write_or_conflict(
  p_station_id uuid, p_kind text, p_unit uuid, p_contract uuid,
  p_from date, p_to date, p_source text,
  p_invoice_id uuid, p_invoice_item_id uuid, p_cbi_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_conflict uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('asc:' || p_kind || ':' || p_station_id::text, 0));
  -- Redan skriven för samma faktura eller rad: inget att göra.
  if exists (
    select 1 from addon_station_coverage a
    where a.station_id = p_station_id and a.station_kind = p_kind and a.released_at is null
      and ((p_invoice_id is not null and a.invoice_id = p_invoice_id and p_cbi_id is null)
        or (p_cbi_id is not null and a.case_billing_item_id = p_cbi_id))
  ) then
    return;
  end if;
  select a.id into v_conflict
  from addon_station_coverage a
  where a.station_id = p_station_id and a.station_kind = p_kind and a.released_at is null
    and a.covered_from <= p_to and a.covered_to >= p_from
  order by a.covered_from
  limit 1;
  if v_conflict is not null then
    if not exists (
      select 1 from addon_coverage_conflicts k
      where k.station_id = p_station_id and k.station_kind = p_kind and k.resolved_at is null
        and k.invoice_id is not distinct from p_invoice_id
        and k.case_billing_item_id is not distinct from p_cbi_id
    ) then
      insert into addon_coverage_conflicts (invoice_id, case_billing_item_id, station_id, station_kind,
                                            covered_from, covered_to, source, conflict_with)
      values (p_invoice_id, p_cbi_id, p_station_id, p_kind, p_from, p_to, p_source, v_conflict);
    end if;
    return;
  end if;
  insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id,
                                      covered_from, covered_to, source,
                                      invoice_id, invoice_item_id, case_billing_item_id, created_by_name)
  values (p_station_id, p_kind, p_unit, p_contract, p_from, p_to, p_source,
          p_invoice_id, p_invoice_item_id, p_cbi_id, 'System');
end $$;

revoke all on function public.addon_coverage_write_or_conflict(uuid, text, uuid, uuid, date, date, text, uuid, uuid, uuid)
  from public, anon, authenticated;

-- 4. Låst faktura skriver täckning (invoice eller gap_invoice).
create or replace function public.trg_invoice_locked_coverage()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_sid uuid;
  st record;
  v_kind text := coalesce(new.contract_invoice_kind, 'premium');
  v_source text;
  v_inv_v2 boolean := false;
  v_from date;
begin
  if new.invoice_type is distinct from 'contract'
     or new.billing_period_start is null
     or new.billing_period_end is null
     or v_kind not in ('premium', 'equipment', 'equipment_monthly', 'equipment_gap') then
    return new;
  end if;
  begin
    v_source := case when v_kind = 'equipment_gap' then 'gap_invoice' else 'invoice' end;
    if new.contract_id is not null then
      select coalesce(c.addon_rules = 'v2', false) into v_inv_v2 from contracts c where c.id = new.contract_id;
    end if;
    for it in
      select ii.id, ii.station_ids
      from invoice_items ii
      where ii.invoice_id = new.id
        and ii.station_ids is not null
        and cardinality(ii.station_ids) > 0
        and (v_kind <> 'premium' or ii.line_kind in ('equipment_annual', 'equipment_monthly'))
    loop
      foreach v_sid in array it.station_ids loop
        select * into st from addon_station_lookup(v_sid, null) limit 1;
        if st.unit_customer_id is null then
          continue;
        end if;
        -- Befintliga avtal och stationer (addon_rules NULL, ingen täckning) rörs inte.
        if not (coalesce(v_inv_v2, false)
                or exists (select 1 from contracts c where c.id = st.contract_id and c.addon_rules = 'v2')
                or exists (select 1 from addon_station_coverage a where a.station_id = v_sid and a.station_kind = st.station_kind)) then
          continue;
        end if;
        v_from := greatest(new.billing_period_start, coalesce(st.effective_from, new.billing_period_start));
        if v_from > new.billing_period_end then
          continue;
        end if;
        perform addon_coverage_write_or_conflict(v_sid, st.station_kind, st.unit_customer_id,
                                                 coalesce(new.contract_id, st.contract_id),
                                                 v_from, new.billing_period_end, v_source,
                                                 new.id, it.id, null);
      end loop;
    end loop;
  exception when others then
    raise warning 'trg_invoice_locked_coverage: täckning för faktura % kunde inte skrivas: %',
      coalesce(new.invoice_number, new.id::text), sqlerrm;
  end;
  return new;
end $$;

create or replace trigger trg_invoice_locked_coverage
  after update of status on public.invoices
  for each row
  when (old.status in ('draft', 'pending_approval', 'ready') and new.status in ('booked', 'sent', 'overdue', 'paid'))
  execute function public.trg_invoice_locked_coverage();

-- 5. Makulerad faktura släpper INTE täckningen, den markeras bara.
-- Återställd faktura tar bort markeringen på rader som inte släppts.
create or replace function public.trg_invoice_cancelled_coverage()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status = 'cancelled' then
      update addon_station_coverage a
      set invoice_cancelled_at = now()
      where a.invoice_cancelled_at is null
        and a.released_at is null
        and (a.invoice_id = new.id
             or a.case_billing_item_id in (
               select ii.case_billing_item_id from invoice_items ii
               where ii.invoice_id = new.id and ii.case_billing_item_id is not null));
    elsif old.status = 'cancelled' then
      update addon_station_coverage a
      set invoice_cancelled_at = null
      where a.invoice_cancelled_at is not null
        and a.released_at is null
        and (a.invoice_id = new.id
             or a.case_billing_item_id in (
               select ii.case_billing_item_id from invoice_items ii
               where ii.invoice_id = new.id and ii.case_billing_item_id is not null));
    end if;
  exception when others then
    raise warning 'trg_invoice_cancelled_coverage: faktura % kunde inte markeras: %',
      coalesce(new.invoice_number, new.id::text), sqlerrm;
  end;
  return new;
end $$;

create or replace trigger trg_invoice_cancelled_coverage
  after update of status on public.invoices
  for each row
  when (new.status is distinct from old.status and (new.status = 'cancelled' or old.status = 'cancelled'))
  execute function public.trg_invoice_cancelled_coverage();

-- 6. Pro rata-rad fakturerad skriver täckning från stationens startdag till
-- dagen före billing_start_date. Bara rader med station_ids (steg 9).
create or replace function public.trg_cbi_prorata_coverage()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sid uuid;
  st record;
  v_invoice uuid;
  v_item uuid;
  v_to date;
begin
  if new.billing_start_date is null then
    return new;
  end if;
  begin
    v_to := new.billing_start_date - 1;
    select ii.invoice_id, ii.id into v_invoice, v_item
    from invoice_items ii join invoices i on i.id = ii.invoice_id
    where ii.case_billing_item_id = new.id and i.status <> 'cancelled'
    order by i.created_at desc
    limit 1;
    foreach v_sid in array new.station_ids loop
      select * into st from addon_station_lookup(v_sid, null) limit 1;
      if st.unit_customer_id is null or st.start_day is null or st.start_day > v_to then
        continue;
      end if;
      perform addon_coverage_write_or_conflict(v_sid, st.station_kind, st.unit_customer_id, st.contract_id,
                                               st.start_day, v_to, 'prorata',
                                               v_invoice, v_item, new.id);
    end loop;
  exception when others then
    raise warning 'trg_cbi_prorata_coverage: täckning för rad % kunde inte skrivas: %', new.id, sqlerrm;
  end;
  return new;
end $$;

create or replace trigger trg_cbi_prorata_coverage
  after update of status on public.case_billing_items
  for each row
  when (coalesce(new.is_addon_prorata_line, false)
        and not coalesce(new.is_addon_labour_line, false)
        and new.status = 'billed'
        and old.status is distinct from 'billed'
        and new.station_ids is not null)
  execute function public.trg_cbi_prorata_coverage();

revoke all on function public.trg_asc_no_overlap() from public, anon, authenticated;
revoke all on function public.trg_invoice_locked_coverage() from public, anon, authenticated;
revoke all on function public.trg_invoice_cancelled_coverage() from public, anon, authenticated;
revoke all on function public.trg_cbi_prorata_coverage() from public, anon, authenticated;

-- 7. RPC: manuell Fortnox-faktura som täckning per station.
create or replace function public.addon_coverage_register_manual(
  p_station_ids uuid[], p_kind text, p_from date, p_to date, p_fortnox_document text, p_note text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_sid uuid;
  st record;
  v_n int := 0;
begin
  select * into me from addon_coverage_approver();
  if p_kind not in ('outdoor', 'indoor') then
    raise exception 'Okänd stationstyp: %', p_kind;
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Perioden saknas eller slutar före den börjar';
  end if;
  if nullif(trim(p_fortnox_document), '') is null then
    raise exception 'Fortnox-fakturans nummer saknas';
  end if;
  if p_station_ids is null or cardinality(p_station_ids) = 0 then
    raise exception 'Inga stationer valda';
  end if;
  for v_sid in select distinct unnest(p_station_ids) loop
    select * into st from addon_station_lookup(v_sid, p_kind) limit 1;
    if st.unit_customer_id is null then
      raise exception 'Stationen % finns inte', v_sid;
    end if;
    insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id,
                                        covered_from, covered_to, source, fortnox_document_number,
                                        note, created_by, created_by_name)
    values (v_sid, p_kind, st.unit_customer_id, st.contract_id, p_from, p_to, 'fortnox_manual',
            trim(p_fortnox_document), nullif(trim(p_note), ''), me.profile_id, me.display_name);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 8. RPC: efterskänk. Släpper överlappande rader och skriver waived över
-- perioden i samma transaktion. Delar av en släppt rad utanför perioden
-- skrivs tillbaka som egna rader med samma källa, så att inget tappas.
create or replace function public.addon_coverage_waive(
  p_station_ids uuid[], p_kind text, p_from date, p_to date, p_note text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_sid uuid;
  st record;
  r record;
  v_n int := 0;
begin
  select * into me from addon_coverage_approver();
  if p_kind not in ('outdoor', 'indoor') then
    raise exception 'Okänd stationstyp: %', p_kind;
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Perioden saknas eller slutar före den börjar';
  end if;
  if nullif(trim(p_note), '') is null then
    raise exception 'Skriv varför debiteringen efterskänks';
  end if;
  if p_station_ids is null or cardinality(p_station_ids) = 0 then
    raise exception 'Inga stationer valda';
  end if;
  for v_sid in select distinct unnest(p_station_ids) loop
    select * into st from addon_station_lookup(v_sid, p_kind) limit 1;
    if st.unit_customer_id is null then
      raise exception 'Stationen % finns inte', v_sid;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('asc:' || p_kind || ':' || v_sid::text, 0));
    for r in
      update addon_station_coverage a
      set released_at = now(), released_by = me.profile_id,
          release_reason = 'Efterskänkt: ' || trim(p_note)
      where a.station_id = v_sid and a.station_kind = p_kind and a.released_at is null
        and a.covered_from <= p_to and a.covered_to >= p_from
      returning a.*
    loop
      if r.covered_from < p_from then
        insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id,
          covered_from, covered_to, source, invoice_id, invoice_item_id, case_billing_item_id,
          fortnox_document_number, invoice_cancelled_at, note, created_by, created_by_name)
        values (r.station_id, r.station_kind, r.unit_customer_id, r.contract_id,
          r.covered_from, p_from - 1, r.source, r.invoice_id, r.invoice_item_id, r.case_billing_item_id,
          r.fortnox_document_number, r.invoice_cancelled_at, r.note, me.profile_id, me.display_name);
      end if;
      if r.covered_to > p_to then
        insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id,
          covered_from, covered_to, source, invoice_id, invoice_item_id, case_billing_item_id,
          fortnox_document_number, invoice_cancelled_at, note, created_by, created_by_name)
        values (r.station_id, r.station_kind, r.unit_customer_id, r.contract_id,
          p_to + 1, r.covered_to, r.source, r.invoice_id, r.invoice_item_id, r.case_billing_item_id,
          r.fortnox_document_number, r.invoice_cancelled_at, r.note, me.profile_id, me.display_name);
      end if;
    end loop;
    insert into addon_station_coverage (station_id, station_kind, unit_customer_id, contract_id,
                                        covered_from, covered_to, source, note, created_by, created_by_name)
    values (v_sid, p_kind, st.unit_customer_id, st.contract_id, p_from, p_to, 'waived',
            trim(p_note), me.profile_id, me.display_name);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 9. RPC: släpp täckning (Fakturera igen, eller backning). Dagarna blir ett
-- glapp som nästa planering fakturerar.
create or replace function public.addon_coverage_release(p_coverage_ids uuid[], p_reason text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_n int;
begin
  select * into me from addon_coverage_approver();
  if nullif(trim(p_reason), '') is null then
    raise exception 'Skriv varför täckningen släpps';
  end if;
  if p_coverage_ids is null or cardinality(p_coverage_ids) = 0 then
    raise exception 'Inga rader valda';
  end if;
  update addon_station_coverage a
  set released_at = now(), released_by = me.profile_id, release_reason = trim(p_reason)
  where a.id = any(p_coverage_ids) and a.released_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 10. RPC: täckningen för en enhet (eller huvudkund med enheter), för panelen.
create or replace function public.addon_station_coverage_list(p_unit_id uuid, p_include_released boolean default false)
returns table(
  id uuid, station_id uuid, station_kind text, unit_customer_id uuid, unit_name text,
  contract_id uuid, covered_from date, covered_to date, source text,
  invoice_id uuid, invoice_number text, case_billing_item_id uuid, case_number text,
  fortnox_document_number text, reference text, invoice_cancelled_at timestamptz, note text,
  created_by_name text, created_at timestamptz,
  released_at timestamptz, release_reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not addon_coverage_can_read() then
    raise exception 'Behörighet saknas';
  end if;
  return query
    select a.id, a.station_id, a.station_kind, a.unit_customer_id, cu.company_name,
           a.contract_id, a.covered_from, a.covered_to, a.source,
           a.invoice_id, i.invoice_number, a.case_billing_item_id, c.case_number,
           a.fortnox_document_number,
           coalesce(i.invoice_number, a.fortnox_document_number, c.case_number, i.fortnox_document_number),
           a.invoice_cancelled_at, a.note, a.created_by_name, a.created_at,
           a.released_at, a.release_reason
    from addon_station_coverage a
    join customers cu on cu.id = a.unit_customer_id
    left join invoices i on i.id = a.invoice_id
    left join case_billing_items cbi on cbi.id = a.case_billing_item_id
    left join cases c on c.id = cbi.case_id
    where (a.unit_customer_id = p_unit_id or cu.parent_customer_id = p_unit_id)
      and (coalesce(p_include_released, false) or a.released_at is null)
    order by cu.company_name, a.station_kind, a.station_id, a.covered_from;
end $$;

-- 11. Glappen: dagar i [p_from, p_to] som ingen aktiv rad täcker.
create or replace function public.addon_station_gaps(p_station_id uuid, p_kind text, p_from date, p_to date)
returns table(gap_from date, gap_to date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not addon_coverage_can_read() then
    raise exception 'Behörighet saknas';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    return;
  end if;
  return query
    with cov as (
      select a.covered_from, a.covered_to from addon_station_coverage a
      where a.station_id = p_station_id and a.station_kind = p_kind and a.released_at is null
        and a.covered_to >= p_from and a.covered_from <= p_to
    ), days as (
      select d::date as day from generate_series(p_from, p_to, interval '1 day') d
      where not exists (select 1 from cov where d::date between cov.covered_from and cov.covered_to)
    ), grp as (
      select day, day - (row_number() over (order by day))::int as g from days
    )
    select min(day), max(day) from grp group by g order by 1;
end $$;

revoke all on function public.addon_coverage_register_manual(uuid[], text, date, date, text, text) from public, anon;
revoke all on function public.addon_coverage_waive(uuid[], text, date, date, text) from public, anon;
revoke all on function public.addon_coverage_release(uuid[], text) from public, anon;
revoke all on function public.addon_station_coverage_list(uuid, boolean) from public, anon;
revoke all on function public.addon_station_gaps(uuid, text, date, date) from public, anon;
grant execute on function public.addon_coverage_register_manual(uuid[], text, date, date, text, text) to authenticated, service_role;
grant execute on function public.addon_coverage_waive(uuid[], text, date, date, text) to authenticated, service_role;
grant execute on function public.addon_coverage_release(uuid[], text) to authenticated, service_role;
grant execute on function public.addon_station_coverage_list(uuid, boolean) to authenticated, service_role;
grant execute on function public.addon_station_gaps(uuid, text, date, date) to authenticated, service_role;

-- 12. Betald till och med: dagens kod ordagrant under nytt namn ...
CREATE OR REPLACE FUNCTION public.addon_station_paid_through_legacy(p_station_id uuid, p_indoor boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_unit uuid;
  v_type uuid;
  v_is_addon boolean;
  v_model text;
  v_mode text;
  v_contract uuid;
  v_marked timestamptz;
  v_best date;
  v_source text;
  v_ref text;
  v_pending boolean := false;
  r record;
  v_end date;
begin
  if not intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;

  if coalesce(p_indoor, false) then
    select fp.customer_id, s.station_type_id, s.is_addon, s.addon_billing_model, s.addon_contract_mode,
           s.addon_contract_id, coalesce(s.addon_marked_at, s.placed_at)
      into v_unit, v_type, v_is_addon, v_model, v_mode, v_contract, v_marked
    from indoor_stations s join floor_plans fp on fp.id = s.floor_plan_id
    where s.id = p_station_id;
  else
    select ep.customer_id, ep.station_type_id, ep.is_addon, ep.addon_billing_model, ep.addon_contract_mode,
           ep.addon_contract_id, coalesce(ep.addon_marked_at, ep.placed_at)
      into v_unit, v_type, v_is_addon, v_model, v_mode, v_contract, v_marked
    from equipment_placements ep
    where ep.id = p_station_id;
  end if;

  if v_unit is null or not coalesce(v_is_addon, false)
     or v_model not in ('per_year', 'per_month')
     or coalesce(v_mode, 'separate') = 'included' then
    return jsonb_build_object('applies', false, 'model', v_model);
  end if;

  v_contract := coalesce(v_contract, addon_contract_for_unit(v_unit));

  for r in
    select cbi.status, cbi.billing_start_date, cbi.updated_at, c.case_number,
           c.completed_date, c.status as case_status
    from case_billing_items cbi
    join cases c on c.id = cbi.case_id
    where cbi.is_addon_prorata_line
      and not coalesce(cbi.is_addon_labour_line, false)
      and coalesce(cbi.site_customer_id, cbi.customer_id) = v_unit
      and (cbi.station_type_id is null or cbi.station_type_id is not distinct from v_type)
      and (cbi.addon_model is null or cbi.addon_model = v_model)
      and cbi.status <> 'cancelled'
      and c.deleted_at is null
      and v_marked >= c.created_at - interval '1 day'
      and (cbi.status = 'pending' or v_marked <= cbi.updated_at)
  loop
    if r.status = 'pending' then
      if r.case_status not ilike '%avslutat%' then
        v_pending := true;
      end if;
      continue;
    end if;
    v_end := r.billing_start_date;
    if v_end is null then
      if v_model = 'per_month' then
        v_end := (date_trunc('month', coalesce(r.completed_date::date, r.updated_at::date)) + interval '1 month')::date;
      elsif v_contract is not null then
        v_end := contract_next_period_start(v_contract, coalesce(r.completed_date::date, (r.updated_at at time zone 'Europe/Stockholm')::date));
      end if;
    end if;
    if v_end is null then
      continue;
    end if;
    v_end := v_end - 1;
    if v_end >= v_today and (v_best is null or v_end > v_best) then
      v_best := v_end;
      v_source := 'prorata';
      v_ref := r.case_number;
    end if;
  end loop;

  for r in
    select i.billing_period_end, coalesce(i.invoice_number, i.fortnox_document_number) as ref
    from invoices i
    join invoice_items ii on ii.invoice_id = i.id
    left join case_billing_items src on src.id = ii.case_billing_item_id
    where i.contract_invoice_kind in ('equipment', 'equipment_monthly')
      and i.status in ('booked', 'sent', 'overdue', 'paid')
      and i.billing_period_end is not null
      and i.billing_period_end >= v_today
      and (
        p_station_id = any(coalesce(ii.station_ids, '{}'::uuid[]))
        or (ii.station_ids is null
            and src.site_customer_id = v_unit
            and (src.station_type_id is null or src.station_type_id is not distinct from v_type))
      )
  loop
    if v_best is null or r.billing_period_end > v_best then
      v_best := r.billing_period_end;
      v_source := 'invoice';
      v_ref := r.ref;
    end if;
  end loop;

  return jsonb_build_object(
    'applies', true,
    'model', v_model,
    'paid_through', v_best,
    'next_billing_from', case when v_best is null then null else v_best + 1 end,
    'source', v_source,
    'reference', v_ref,
    'not_billed_yet', (v_best is null and v_pending)
  );
end;
$function$;

revoke all on function public.addon_station_paid_through_legacy(uuid, boolean) from public, anon, authenticated;

-- ... och den nya som läser täckningen först. Station utan täckningsrader
-- (aktiva eller släppta) får exakt det gamla svaret.
create or replace function public.addon_station_paid_through(p_station_id uuid, p_indoor boolean)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Stockholm')::date;
  v_legacy jsonb;
  v_kind text := case when coalesce(p_indoor, false) then 'indoor' else 'outdoor' end;
  v_end date;
  v_next date;
  v_last uuid;
  v_source text;
  v_cancelled boolean;
begin
  v_legacy := addon_station_paid_through_legacy(p_station_id, p_indoor);
  if not coalesce((v_legacy ->> 'applies')::boolean, false) then
    return v_legacy;
  end if;
  if not exists (
    select 1 from addon_station_coverage a
    where a.station_id = p_station_id and a.station_kind = v_kind
  ) then
    return v_legacy;
  end if;

  -- Sammanhängande täckning från idag: börja i raden som innehåller idag och
  -- följ rader som tar vid dagen efter.
  select a.covered_to, a.id into v_end, v_last
  from addon_station_coverage a
  where a.station_id = p_station_id and a.station_kind = v_kind and a.released_at is null
    and a.covered_from <= v_today and a.covered_to >= v_today
  order by a.covered_to desc
  limit 1;
  if v_end is not null then
    loop
      select a.covered_to, a.id into v_next, v_last
      from addon_station_coverage a
      where a.station_id = p_station_id and a.station_kind = v_kind and a.released_at is null
        and a.covered_from <= v_end + 1 and a.covered_to > v_end
      order by a.covered_to desc
      limit 1;
      exit when v_next is null;
      v_end := v_next;
      v_next := null;
    end loop;
    select a.id, a.source into v_last, v_source
    from addon_station_coverage a
    where a.station_id = p_station_id and a.station_kind = v_kind and a.released_at is null
      and a.covered_to = v_end
    order by a.covered_from
    limit 1;
  end if;

  select exists (
    select 1 from addon_station_coverage a
    where a.station_id = p_station_id and a.station_kind = v_kind
      and a.released_at is null and a.invoice_cancelled_at is not null
  ) into v_cancelled;

  return v_legacy || jsonb_build_object(
    'paid_through', v_end,
    'next_billing_from', case when v_end is null then null else v_end + 1 end,
    'source', case when v_end is null then null else v_source end,
    'reference', case when v_end is null then null else addon_coverage_ref(v_last) end,
    'not_billed_yet', (v_end is null and coalesce((v_legacy ->> 'not_billed_yet')::boolean, false)),
    'cancelled_unresolved', v_cancelled,
    'from_coverage', true
  );
end $$;

revoke all on function public.addon_station_paid_through(uuid, boolean) from public, anon;
grant execute on function public.addon_station_paid_through(uuid, boolean) to authenticated, service_role;
