-- Faktureringsgrupper för tilläggsstationer (alternativ B, 2026-11-03).
--
-- Ett avtal med nya tilläggsregler (contracts.addon_rules = 'v2') kan ha egna
-- faktureringsgrupper: namn, intervall (följer premien, månad, kvartal,
-- halvår, år), startdag och märkning. En § 6-rad (case_billing_items) eller en
-- tilläggsstation pekar på en grupp; NULL betyder exakt dagens regler (steg 11
-- och steg 0). Fakturorna bär gruppen (invoices.addon_billing_group_id), så
-- två grupper kan ha fakturor för samma period.
--
-- Bara additiva ändringar: ny tabell, nya kolumner (NULL), nya funktioner och
-- nya villkor som är sanna när gruppen är NULL. Inga kunddata ändras.
--
-- Det gamla unika indexet invoices_contract_period_marking_key ligger kvar
-- (DROP körs inte via MCP). Så länge det finns kan två grupper inte ha en
-- tilläggsfaktura med samma typ, periodstart och märkning; planeringen håller
-- då tillbaka gruppens faktura (invoice_group_split_ready). Drop-raden står
-- längst ned, bortkommenterad, för Christian att köra.
--
-- Backning: 20261103_faktureringsgrupper_backning.sql.

-- ─── 1. Tabellen ───────────────────────────────────────────────────────────

create table if not exists public.contract_addon_billing_groups (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  cadence text not null default 'follows_premium'
    check (cadence in ('follows_premium', 'monthly', 'quarterly', 'semi_annual', 'annual')),
  anchor_date date null,
  marking text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null default auth.uid()
);

comment on table public.contract_addon_billing_groups is
  'Faktureringsgrupper för tilläggsstationer per avtal (bara addon_rules = v2). cadence follows_premium = tilläggens vanliga takt; anchor_date NULL = avtalsdagen (gamla läget: premiens månadsankare); marking NULL = dagens märkningsregel.';

create index if not exists contract_addon_billing_groups_contract_idx
  on public.contract_addon_billing_groups (contract_id);
create unique index if not exists contract_addon_billing_groups_name_key
  on public.contract_addon_billing_groups (contract_id, lower(trim(name)));

create or replace function public.contract_addon_billing_groups_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_contract_addon_billing_groups_touch
  before update on public.contract_addon_billing_groups
  for each row execute function public.contract_addon_billing_groups_touch();

-- Skriver: admin och koordinator (som is_privileged_writer, plus rollen i profiles)
create or replace function public.addon_billing_group_can_write()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select public.is_privileged_writer()
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.is_active = true and p.role in ('admin', 'koordinator'));
$$;

alter table public.contract_addon_billing_groups enable row level security;

create policy cabg_select_internal on public.contract_addon_billing_groups
  for select to authenticated using (public.intranet_is_internal());

create policy cabg_write_admin on public.contract_addon_billing_groups
  for all to authenticated
  using (public.addon_billing_group_can_write())
  with check (public.addon_billing_group_can_write());

revoke all on table public.contract_addon_billing_groups from anon;
grant select, insert, update, delete on table public.contract_addon_billing_groups to authenticated;
grant all on table public.contract_addon_billing_groups to service_role;

-- ─── 2. Kolumnerna ─────────────────────────────────────────────────────────

alter table public.equipment_placements
  add column if not exists addon_billing_group_id uuid null
  references public.contract_addon_billing_groups(id) on delete set null;
alter table public.indoor_stations
  add column if not exists addon_billing_group_id uuid null
  references public.contract_addon_billing_groups(id) on delete set null;
alter table public.case_billing_items
  add column if not exists addon_billing_group_id uuid null
  references public.contract_addon_billing_groups(id) on delete set null;
alter table public.invoices
  add column if not exists addon_billing_group_id uuid null
  references public.contract_addon_billing_groups(id) on delete set null;

create index if not exists equipment_placements_addon_billing_group_idx
  on public.equipment_placements (addon_billing_group_id) where addon_billing_group_id is not null;
create index if not exists indoor_stations_addon_billing_group_idx
  on public.indoor_stations (addon_billing_group_id) where addon_billing_group_id is not null;
create index if not exists case_billing_items_addon_billing_group_idx
  on public.case_billing_items (addon_billing_group_id) where addon_billing_group_id is not null;
create index if not exists invoices_addon_billing_group_idx
  on public.invoices (addon_billing_group_id) where addon_billing_group_id is not null;

comment on column public.case_billing_items.addon_billing_group_id is
  'Faktureringsgrupp för § 6-raden (contract_addon_billing_groups). NULL = tilläggens vanliga regler.';
comment on column public.invoices.addon_billing_group_id is
  'Faktureringsgruppen tilläggsfakturan hör till. NULL = vanliga tilläggsfakturor.';

-- Nytt unikt index med gruppen. Det gamla (utan grupp) ligger kvar tills
-- drop-raden längst ned körts; fram till dess är det det strängare.
create unique index if not exists invoices_contract_period_group_key
  on public.invoices (contract_id, billing_period_start, contract_invoice_kind,
                      coalesce(marking_key, ''::text), coalesce(addon_billing_group_id::text, ''::text))
  where invoice_type = 'contract'::text and contract_id is not null
    and contract_invoice_kind <> 'adjustment'::text and status <> 'cancelled'::text
    and invoice_number !~~ 'F-%'::text;

-- Kan två grupper ha fakturor med samma typ, periodstart och märkning?
create or replace function public.invoice_group_split_ready()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'invoices' and indexname = 'invoices_contract_period_marking_key');
$$;

-- ─── 3. Gruppens takt ──────────────────────────────────────────────────────

-- Gruppen om den hör till avtalet och avtalet har nya tilläggsregler, annars NULL
create or replace function public.addon_billing_group_valid(p_group_id uuid, p_contract_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select g.id
  from public.contract_addon_billing_groups g
  join public.contracts c on c.id = g.contract_id
  where p_group_id is not null and g.id = p_group_id and g.contract_id = p_contract_id and c.addon_rules = 'v2';
$$;

-- Gruppens startdag: anchor_date, annars avtalsdagen (exakt läge) eller
-- premiens månadsankare (gamla läget: årsvis ankarmånaden, annars
-- startmånadens första dag). TS-tvilling: billingGroupAnchor i addonBillingGroups.ts.
create or replace function public.contract_addon_billing_group_anchor(p_group_id uuid)
returns date
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    g.anchor_date,
    case
      when c.contract_start_date is null then null
      when c.billing_anchor_mode = 'start_day' then c.contract_start_date
      when g.cadence = 'annual' and c.billing_anchor_month between 1 and 12
        then make_date(extract(year from c.contract_start_date)::int, c.billing_anchor_month, 1)
      else date_trunc('month', c.contract_start_date)::date
    end)
  from public.contract_addon_billing_groups g
  join public.contracts c on c.id = g.contract_id
  where g.id = p_group_id;
$$;

-- Nästa periodstart med gruppens takt. Utan grupp, med "följer premien" eller
-- en grupp som inte hör till avtalet: samma svar som trepartsvarianten.
create or replace function public.contract_addon_next_period_start(
  p_contract_id uuid, p_from date, p_billing_model text, p_group_id uuid)
returns date
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  g record;
  v_anchor date;
  v date;
begin
  if p_group_id is null or p_from is null then
    return public.contract_addon_next_period_start(p_contract_id, p_from, p_billing_model);
  end if;
  select gr.* into g from public.contract_addon_billing_groups gr
  where gr.id = public.addon_billing_group_valid(p_group_id, p_contract_id);
  if not found or g.cadence = 'follows_premium' then
    return public.contract_addon_next_period_start(p_contract_id, p_from, p_billing_model);
  end if;
  v_anchor := public.contract_addon_billing_group_anchor(g.id);
  if v_anchor is null then
    return public.contract_addon_next_period_start(p_contract_id, p_from, p_billing_model);
  end if;
  if p_from < v_anchor then
    return v_anchor;
  end if;
  select p.period_end + 1 into v from public.contract_period_on_pure(v_anchor, g.cadence, p_from) p;
  return v;
end $$;

-- Stationens grupp (giltig för avtalet), utomhus eller inomhus
create or replace function public.addon_station_billing_group(p_station_id uuid, p_contract_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select public.addon_billing_group_valid(coalesce(
    (select ep.addon_billing_group_id from public.equipment_placements ep where ep.id = p_station_id),
    (select s.addon_billing_group_id from public.indoor_stations s where s.id = p_station_id)), p_contract_id);
$$;

-- ─── 4. Pro rata och glapp räknar till gruppens nästa periodstart ──────────

create or replace function public.addon_prorata_v2_end(p_contract_id uuid, p_station_id uuid, p_start date)
 returns table(end_day date, ordinary date, capped boolean, unknown_invoice text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  c record;
  inv record;
  v_end date;
  v_last date;
  v_guard int := 0;
  v_key text;
  v_model text;
  v_group uuid;
  v_group_key text;
begin
  select * into c from contracts where id = p_contract_id;
  if not found or p_start is null then
    return;
  end if;
  -- Stationens modell (steg 0): per månad räknar till nästa månadsstart
  select coalesce(
    (select ep.addon_billing_model from equipment_placements ep where ep.id = p_station_id),
    (select s.addon_billing_model from indoor_stations s where s.id = p_station_id)
  ) into v_model;
  -- Faktureringsgrupp (2026-11-03): gruppens takt och märkning, NULL = som förut
  v_group := addon_station_billing_group(p_station_id, p_contract_id);
  -- Steg 11: tilläggens takt (premiens perioder, eller årsdagen utan premie)
  ordinary := contract_addon_next_period_start(p_contract_id, p_start, v_model, v_group);
  v_key := addon_marking_key_for_unit((select l.unit_customer_id from addon_station_lookup(p_station_id, null) l limit 1), p_contract_id);
  if v_group is not null then
    select nullif(upper(trim(g.marking)), '') into v_group_key from contract_addon_billing_groups g where g.id = v_group;
    v_key := coalesce(v_group_key, v_key);
  end if;
  if ordinary is null then
    return;
  end if;
  v_end := ordinary;
  capped := false;
  unknown_invoice := null;
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 60;
    select i.id, coalesce(i.invoice_number, i.id::text) as nr,
           coalesce(i.billing_period_end, i.billing_period_start) as pe,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id and p_station_id = any(ii.station_ids)) as has_station,
           exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                   and (ii.line_kind in ('equipment_annual', 'equipment_monthly') or i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap'))
                   and coalesce(cardinality(ii.station_ids), 0) > 0) as has_ids
      into inv
    from invoices i
    where i.contract_id = p_contract_id
      and i.invoice_type = 'contract'
      and i.status in ('booked', 'sent', 'overdue', 'paid')
      and i.billing_period_start <= v_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= v_end
      and (i.marking_key is null or i.marking_key = v_key)
      and i.addon_billing_group_id is not distinct from v_group
      and (i.contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')
           or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
               and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                           and ii.line_kind in ('equipment_annual', 'equipment_monthly'))))
    order by i.billing_period_start desc, i.created_at desc
    limit 1;
    exit when not found;
    exit when inv.has_station;
    if not inv.has_ids then
      unknown_invoice := inv.nr;
      exit;
    end if;
    exit when inv.pe + 1 <= v_end;
    v_end := inv.pe + 1;
  end loop;

  if c.terminated_at is not null or c.renewal_mode = 'option' or c.status in ('ended', 'trashed', 'declined') then
    v_last := coalesce(c.effective_end_date, c.contract_end_date);
    if v_last is not null and v_last + 1 < v_end then
      v_end := v_last + 1;
      capped := true;
    end if;
  end if;
  end_day := v_end;
  return next;
end $function$;

-- Glappen: stationens grupp avgör slutdagen (via addon_prorata_v2_end),
-- gruppens märkning nyckeln, och bara gruppens öppna utkast räknas.
create or replace function public.addon_gap_candidates(p_contract_id uuid)
 returns table(station_kind text, station_id uuid, unit_id uuid, unit_name text, station_type_id uuid, type_name text, model text, annual numeric, start_day date, gap_from date, gap_to date, days integer, end_day date, marking_key text, on_open_gap_invoice uuid)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  if not addon_coverage_can_read() then
    raise exception 'Behörighet saknas';
  end if;
  if not exists (select 1 from contracts c where c.id = p_contract_id and c.addon_rules = 'v2') then
    return;
  end if;
  return query
  with st as (
    select 'outdoor'::text as skind, ep.id, ep.customer_id as uid, ep.station_type_id as tid,
           ep.addon_billing_model as m, ep.addon_unit_price_annual as a, ep.placed_case_id as pcase,
           coalesce(ep.addon_effective_from, (coalesce(ep.addon_marked_at, ep.placed_at) at time zone 'Europe/Stockholm')::date) as sday,
           addon_billing_group_valid(ep.addon_billing_group_id, p_contract_id) as gid
    from equipment_placements ep
    where ep.addon_contract_id = p_contract_id and ep.is_addon and ep.status = 'active'
      and ep.addon_contract_mode = 'separate' and ep.addon_billing_model in ('per_year', 'per_month')
      and ep.placed_case_id is not null
    union all
    select 'indoor', s2.id, fp.customer_id, s2.station_type_id, s2.addon_billing_model, s2.addon_unit_price_annual,
           s2.placed_case_id,
           coalesce(s2.addon_effective_from, (coalesce(s2.addon_marked_at, s2.placed_at) at time zone 'Europe/Stockholm')::date),
           addon_billing_group_valid(s2.addon_billing_group_id, p_contract_id)
    from indoor_stations s2 join floor_plans fp on fp.id = s2.floor_plan_id
    where s2.addon_contract_id = p_contract_id and s2.is_addon and s2.status = 'active'
      and s2.addon_contract_mode = 'separate' and s2.addon_billing_model in ('per_year', 'per_month')
      and s2.placed_case_id is not null
  ), cand as (
    select st.* from st
    where st.sday is not null
      and not addon_case_is_open(st.pcase)
      and not exists (
        select 1 from case_billing_items b
        where b.is_addon_prorata_line and not coalesce(b.is_addon_labour_line, false)
          and b.status = 'pending' and st.id = any(b.station_ids))
      and not exists (
        select 1 from invoices i
        where i.contract_id = p_contract_id and i.invoice_type = 'contract'
          and i.status in ('draft', 'pending_approval', 'ready')
          and coalesce(i.is_consolidated, false) = false
          and i.billing_period_start <= st.sday
          and coalesce(i.billing_period_end, i.billing_period_start) >= st.sday
          and i.addon_billing_group_id is not distinct from st.gid
          and (i.contract_invoice_kind in ('equipment', 'equipment_monthly')
               or (coalesce(i.contract_invoice_kind, 'premium') = 'premium'
                   and exists (select 1 from invoice_items ii where ii.invoice_id = i.id
                               and ii.line_kind in ('equipment_annual', 'equipment_monthly')))))
  ), e as (
    select cand.*, en.end_day as eday
    from cand cross join lateral addon_prorata_v2_end(p_contract_id, cand.id, cand.sday) en
    where en.end_day is not null and en.end_day > cand.sday
  ), d as (
    select e.*, g.day
    from e cross join lateral (
      select gs::date as day from generate_series(e.sday, e.eday - 1, interval '1 day') gs
      where not exists (
        select 1 from addon_station_coverage a
        where a.station_id = e.id and a.station_kind = e.skind and a.released_at is null
          and gs::date between a.covered_from and a.covered_to)
    ) g
  )
  select d.skind, d.id, d.uid,
         max(coalesce(nullif(trim(cu.site_name), ''), cu.company_name)),
         d.tid, max(stt.name),
         d.m, coalesce(max(d.a), addon_annual_price_for_type(d.tid, d.uid, p_contract_id)),
         d.sday, min(d.day), max(d.day), count(*)::int, d.eday,
         coalesce((select nullif(upper(trim(gr.marking)), '') from contract_addon_billing_groups gr where gr.id = d.gid),
                  addon_marking_key_for_unit(d.uid, p_contract_id)),
         (select i.id from invoices i join invoice_items ii on ii.invoice_id = i.id
          where i.contract_id = p_contract_id and i.invoice_type = 'contract'
            and i.contract_invoice_kind = 'equipment_gap'
            and i.status in ('draft', 'pending_approval', 'ready')
            and d.id = any(ii.station_ids)
          order by i.created_at desc limit 1)
  from d
  left join customers cu on cu.id = d.uid
  left join station_types stt on stt.id = d.tid
  group by d.skind, d.id, d.uid, d.tid, d.m, d.sday, d.eday, d.gid;
end $function$;

-- ─── 5. Överlappsvakten och överlappsvyn tar gruppen ───────────────────────

create or replace function public.guard_contract_invoice_overlap()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_new_end date := coalesce(new.billing_period_end, new.billing_period_start);
  v_share numeric;
  v_restore boolean := false;
begin
  if new.invoice_type is distinct from 'contract'
     or new.status = 'cancelled'
     or coalesce(new.is_historical, false)
     or coalesce(new.invoice_number, '') like 'F-%'
     or new.billing_period_start is null
     or coalesce(new.contract_invoice_kind, 'premium') not in ('premium', 'equipment', 'equipment_monthly') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_restore := old.status is not distinct from 'cancelled';
    if not v_restore
       and old.billing_period_start is not distinct from new.billing_period_start
       and old.billing_period_end is not distinct from new.billing_period_end
       and old.contract_invoice_kind is not distinct from new.contract_invoice_kind
       and old.contract_id is not distinct from new.contract_id
       and old.is_consolidated is not distinct from new.is_consolidated
       and old.marking_key is not distinct from new.marking_key
       and old.addon_billing_group_id is not distinct from new.addon_billing_group_id
       and old.invoice_type is not distinct from new.invoice_type
       and coalesce(old.is_historical, false) = coalesce(new.is_historical, false)
       and (coalesce(old.invoice_number, '') like 'F-%') = (coalesce(new.invoice_number, '') like 'F-%') then
      -- Bara statusbyte eller andra fält: perioden är redan prövad
      return new;
    end if;
  end if;

  if coalesce(current_setting('app.allow_period_overlap', true), '') = 'on' then
    return new;
  end if;

  for r in
    select i.id, i.invoice_number, i.status, i.billing_period_start as s,
           coalesce(i.billing_period_end, i.billing_period_start) as e
    from invoices i
    where i.id <> new.id
      and i.invoice_type = 'contract'
      and i.status <> 'cancelled'
      and coalesce(i.contract_invoice_kind, 'premium') = coalesce(new.contract_invoice_kind, 'premium')
      -- Steg 11: tilläggsfakturor delas per märkning; samma period med olika märkning är ingen dubblett
      and coalesce(i.marking_key, '') = coalesce(new.marking_key, '')
      -- Faktureringsgrupper: två grupper får ha fakturor för samma period
      and i.addon_billing_group_id is not distinct from new.addon_billing_group_id
      and (
        (new.contract_id is not null and i.contract_id = new.contract_id and not coalesce(i.is_consolidated, false))
        or (coalesce(new.is_consolidated, false) and coalesce(i.is_consolidated, false) and i.customer_id = new.customer_id)
      )
      and i.billing_period_start <= v_new_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= new.billing_period_start
  loop
    -- Steg 7: samma andel som portalens matchning (periodOverlapShare i
    -- src/shared/contractInvoiceMatch.ts), räknad i en gemensam funktion.
    v_share := public.contract_period_overlap_share(r.s, r.e, new.billing_period_start, v_new_end);

    if v_restore and new.fortnox_document_number is not null then
      if v_share >= 0.5 then
        raise warning 'Återställd faktura % (% t.o.m. %) överlappar faktura % (% t.o.m. %)',
          coalesce(new.invoice_number, new.id::text), new.billing_period_start, v_new_end,
          coalesce(r.invoice_number, r.id::text), r.s, r.e;
      end if;
      continue;
    end if;

    if v_share >= 0.5 then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s finns redan på faktura %s (%s t.o.m. %s)',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;

    if tg_op = 'INSERT'
       and r.status not in ('booked', 'sent', 'overdue', 'paid')
       and coalesce(r.invoice_number, '') not like 'F-%' then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s överlappar utkastet %s (%s t.o.m. %s). Ändra utkastet i stället.',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;
  end loop;

  return new;
end $function$;

create or replace view public.contract_invoice_overlaps with (security_invoker = true) as
 SELECT a.id AS invoice_a,
    a.invoice_number AS number_a,
    a.status AS status_a,
    b.id AS invoice_b,
    b.invoice_number AS number_b,
    b.status AS status_b,
    a.customer_id,
    a.contract_id,
    COALESCE(a.contract_invoice_kind, 'premium'::text) AS kind,
    GREATEST(a.billing_period_start, b.billing_period_start) AS overlap_from,
    LEAST(COALESCE(a.billing_period_end, a.billing_period_start), COALESCE(b.billing_period_end, b.billing_period_start)) AS overlap_to
   FROM invoices a
     JOIN invoices b ON a.id < b.id AND a.invoice_type = 'contract'::text AND b.invoice_type = 'contract'::text AND a.status <> 'cancelled'::text AND b.status <> 'cancelled'::text AND COALESCE(a.contract_invoice_kind, 'premium'::text) = COALESCE(b.contract_invoice_kind, 'premium'::text) AND (COALESCE(a.contract_invoice_kind, 'premium'::text) <> ALL (ARRAY['adjustment'::text, 'equipment_gap'::text])) AND a.customer_id = b.customer_id AND NOT a.contract_id IS DISTINCT FROM b.contract_id AND COALESCE(a.is_consolidated, false) = COALESCE(b.is_consolidated, false) AND COALESCE(a.marking_key, ''::text) = COALESCE(b.marking_key, ''::text) AND NOT a.addon_billing_group_id IS DISTINCT FROM b.addon_billing_group_id AND a.billing_period_start <= COALESCE(b.billing_period_end, b.billing_period_start) AND b.billing_period_start <= COALESCE(a.billing_period_end, a.billing_period_start);

-- ─── 6. Synken av § 6-raderna och pro rata tar gruppen ─────────────────────
-- Funktionerna är långa; de skrivs om genom exakta textbyten på den
-- nuvarande definitionen. Varje byte kontrolleras (annars avbryts migrationen).

do $mig$
declare
  v_def text;
  v_new text;
  v_prev text;
  v_pairs text[][];
  i int;
begin
  -- sync_addon_period_lines: en rad per enhet, stationstyp, modell OCH grupp
  v_def := pg_get_functiondef('public.sync_addon_period_lines(uuid,uuid,numeric)'::regprocedure);
  v_pairs := array[
    array[$a$select ep.customer_id, ep.station_type_id, ep.addon_billing_model as model, ep.addon_unit_price_annual as annual
      from equipment_placements ep$a$,
          $a$select ep.customer_id, ep.station_type_id, ep.addon_billing_model as model, ep.addon_unit_price_annual as annual,
             addon_billing_group_valid(ep.addon_billing_group_id, v_contract_id) as gid
      from equipment_placements ep$a$],
    array[$a$select fp.customer_id, s.station_type_id, s.addon_billing_model, s.addon_unit_price_annual
      from indoor_stations s$a$,
          $a$select fp.customer_id, s.station_type_id, s.addon_billing_model, s.addon_unit_price_annual,
             addon_billing_group_valid(s.addon_billing_group_id, v_contract_id)
      from indoor_stations s$a$],
    array[$a$select customer_id, station_type_id, model, count(*) as n, sum(annual) as annual_sum, count(*) filter (where annual is null) as missing
      from stations group by customer_id, station_type_id, model$a$,
          $a$select customer_id, station_type_id, model, gid, count(*) as n, sum(annual) as annual_sum, count(*) filter (where annual is null) as missing
      from stations group by customer_id, station_type_id, model, gid$a$],
    array[$a$select site_customer_id as customer_id, station_type_id, billing_model as model, 0::bigint as n,$a$,
          $a$select site_customer_id as customer_id, station_type_id, billing_model as model,
             addon_billing_group_valid(addon_billing_group_id, v_contract_id) as gid, 0::bigint as n,$a$],
    array[$a$select customer_id, station_type_id, model, max(n) as n, sum(annual_sum) as annual_sum, sum(missing) as missing
    from (select * from counted union all select * from existing) x
    group by customer_id, station_type_id, model$a$,
          $a$select customer_id, station_type_id, model, gid, max(n) as n, sum(annual_sum) as annual_sum, sum(missing) as missing
    from (select * from counted union all select * from existing) x
    group by customer_id, station_type_id, model, gid$a$],
    array[$a$and station_type_id is not distinct from r.station_type_id and billing_model = r.model and status <> 'cancelled'
      and not is_addon_labour_line
    limit 1;$a$,
          $a$and station_type_id is not distinct from r.station_type_id and billing_model = r.model and status <> 'cancelled'
      and not is_addon_labour_line
      and addon_billing_group_valid(addon_billing_group_id, v_contract_id) is not distinct from r.gid
    limit 1;$a$],
    array[$a$addon_annual_unit_price, notes
      ) values ($a$,
          $a$addon_annual_unit_price, notes, addon_billing_group_id
      ) values ($a$],
    array[$a$case when r.model = 'per_month' then (date_trunc('month', v_today) + interval '1 month')::date else v_next_start end,$a$,
          $a$case when r.gid is not null then contract_addon_next_period_start(v_contract_id, v_today, r.model, r.gid)
             when r.model = 'per_month' then (date_trunc('month', v_today) + interval '1 month')::date else v_next_start end,$a$],
    array[$a$'Synkas från utplacerade tilläggsstationer'
      );$a$,
          $a$'Synkas från utplacerade tilläggsstationer', r.gid
      );$a$]
  ];
  v_new := v_def;
  for i in 1 .. array_length(v_pairs, 1) loop
    v_prev := v_new;
    v_new := replace(v_new, v_pairs[i][1], v_pairs[i][2]);
    if v_new = v_prev then
      raise exception 'sync_addon_period_lines: byte % hittades inte', i;
    end if;
  end loop;
  execute v_new;

  -- sync_addon_prorata_line_v2: bara stationens grupps öppna utkast räknas
  v_def := pg_get_functiondef('public.sync_addon_prorata_line_v2(uuid,numeric,uuid,text,uuid)'::regprocedure);
  v_pairs := array[
    array[$a$select 'outdoor'::text as kind, ep.id, ep.station_type_id, ep.addon_billing_model as model,$a$,
          $a$select 'outdoor'::text as kind, ep.id, ep.station_type_id, ep.addon_billing_model as model, ep.addon_billing_group_id as gid,$a$],
    array[$a$select 'indoor', s2.id, s2.station_type_id, s2.addon_billing_model,$a$,
          $a$select 'indoor', s2.id, s2.station_type_id, s2.addon_billing_model, s2.addon_billing_group_id,$a$],
    array[$a$      and coalesce(i.is_consolidated, false) = false
      and i.billing_period_start <= s.start_day$a$,
          $a$      and coalesce(i.is_consolidated, false) = false
      and i.addon_billing_group_id is not distinct from addon_billing_group_valid(s.gid, s.addon_contract_id)
      and i.billing_period_start <= s.start_day$a$]
  ];
  v_new := v_def;
  for i in 1 .. array_length(v_pairs, 1) loop
    v_prev := v_new;
    v_new := replace(v_new, v_pairs[i][1], v_pairs[i][2]);
    if v_new = v_prev then
      raise exception 'sync_addon_prorata_line_v2: byte % hittades inte', i;
    end if;
  end loop;
  execute v_new;
end $mig$;

-- ─── 7. Byta grupp från avtalskartan ───────────────────────────────────────

-- § 6-raden och stationerna bakom den byter grupp. Raden behåller sin
-- startdag; nästa planering fakturerar raden med den nya gruppens takt.
create or replace function public.set_addon_line_billing_group(p_line_id uuid, p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  l record;
  v_old uuid;
  v_out int := 0;
  v_in int := 0;
begin
  if not addon_billing_group_can_write() then
    raise exception 'Behörighet saknas: kräver admin eller koordinator';
  end if;
  select * into l from case_billing_items where id = p_line_id;
  if not found or l.case_type is distinct from 'contract' or coalesce(l.billing_model, '') not in ('per_year', 'per_month') then
    raise exception 'Raden är ingen tilläggsrad i § 6';
  end if;
  if p_group_id is not null and addon_billing_group_valid(p_group_id, l.case_id) is null then
    raise exception 'Gruppen hör inte till avtalet, eller avtalet har inte nya tilläggsregler';
  end if;
  v_old := addon_billing_group_valid(l.addon_billing_group_id, l.case_id);
  if v_old is not distinct from p_group_id then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  if l.site_customer_id is not null and exists (
    select 1 from case_billing_items x
    where x.id <> l.id and x.case_id = l.case_id and x.site_customer_id = l.site_customer_id
      and x.station_type_id is not distinct from l.station_type_id and x.billing_model = l.billing_model
      and x.status <> 'cancelled' and not coalesce(x.is_addon_labour_line, false)
      and addon_billing_group_valid(x.addon_billing_group_id, l.case_id) is not distinct from p_group_id) then
    raise exception 'Enheten har redan en rad för stationstypen i den gruppen. Byt grupp på stationerna i stället.';
  end if;
  update case_billing_items set addon_billing_group_id = p_group_id, updated_at = now() where id = l.id;
  if l.site_customer_id is not null then
    update equipment_placements ep set addon_billing_group_id = p_group_id
    where ep.addon_contract_id = l.case_id and ep.customer_id = l.site_customer_id and ep.is_addon and ep.status = 'active'
      and ep.station_type_id is not distinct from l.station_type_id and ep.addon_billing_model = l.billing_model
      and coalesce(ep.addon_contract_mode, 'separate') = 'separate'
      and addon_billing_group_valid(ep.addon_billing_group_id, l.case_id) is not distinct from v_old;
    get diagnostics v_out = row_count;
    update indoor_stations s set addon_billing_group_id = p_group_id
    from floor_plans fp
    where fp.id = s.floor_plan_id and s.addon_contract_id = l.case_id and fp.customer_id = l.site_customer_id
      and s.is_addon and s.status = 'active'
      and s.station_type_id is not distinct from l.station_type_id and s.addon_billing_model = l.billing_model
      and coalesce(s.addon_contract_mode, 'separate') = 'separate'
      and addon_billing_group_valid(s.addon_billing_group_id, l.case_id) is not distinct from v_old;
    get diagnostics v_in = row_count;
  end if;
  return jsonb_build_object('ok', true, 'changed', true, 'stations', v_out + v_in);
end $$;

-- Stationer byter grupp (utsättningen i Besluta tillägg). § 6-raderna synkas
-- efteråt: stationerna hamnar på gruppens rad, med gruppens nästa periodstart.
create or replace function public.set_addon_station_billing_group(p_outdoor_ids uuid[], p_indoor_ids uuid[], p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contracts uuid[];
  v_c uuid;
  v_n int := 0;
  v_m int := 0;
begin
  if not addon_billing_group_can_write() then
    raise exception 'Behörighet saknas: kräver admin eller koordinator';
  end if;
  select coalesce(array_agg(distinct x.cid), '{}') into v_contracts from (
    select ep.addon_contract_id as cid from equipment_placements ep where ep.id = any(coalesce(p_outdoor_ids, '{}'))
    union
    select s.addon_contract_id from indoor_stations s where s.id = any(coalesce(p_indoor_ids, '{}'))
  ) x where x.cid is not null;
  if p_group_id is not null then
    if cardinality(v_contracts) <> 1 or addon_billing_group_valid(p_group_id, v_contracts[1]) is null then
      raise exception 'Gruppen hör inte till stationernas avtal, eller avtalet har inte nya tilläggsregler';
    end if;
  end if;
  update equipment_placements set addon_billing_group_id = p_group_id where id = any(coalesce(p_outdoor_ids, '{}'));
  get diagnostics v_n = row_count;
  update indoor_stations set addon_billing_group_id = p_group_id where id = any(coalesce(p_indoor_ids, '{}'));
  get diagnostics v_m = row_count;
  foreach v_c in array v_contracts loop
    perform sync_addon_period_lines(null, v_c, null);
  end loop;
  return jsonb_build_object('ok', true, 'stations', v_n + v_m);
end $$;

revoke all on function public.set_addon_line_billing_group(uuid, uuid) from public, anon;
revoke all on function public.set_addon_station_billing_group(uuid[], uuid[], uuid) from public, anon;
grant execute on function public.set_addon_line_billing_group(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_addon_station_billing_group(uuid[], uuid[], uuid) to authenticated, service_role;
revoke all on function public.contract_addon_next_period_start(uuid, date, text, uuid) from anon;
revoke all on function public.addon_billing_group_valid(uuid, uuid) from anon;
revoke all on function public.contract_addon_billing_group_anchor(uuid) from anon;
revoke all on function public.addon_station_billing_group(uuid, uuid) from anon;
revoke all on function public.invoice_group_split_ready() from anon;
revoke all on function public.addon_billing_group_can_write() from anon;

-- ─── Drop-raden (körs INTE här; Christian kör den i SQL-editorn) ───────────
-- När den är körd tar databasen två grupper med samma typ, periodstart och
-- märkning (invoices_contract_period_group_key gäller i stället), och
-- invoice_group_split_ready() blir sann.
--
--   drop index if exists public.invoices_contract_period_marking_key;
