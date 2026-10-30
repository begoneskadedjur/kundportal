-- Steg 10 (avtalsåret på avtalsdag): beslutsspärr och arbetslista.
--
-- Beslutsspärren för pro rata finns redan i version 2 av
-- sync_addon_prorata_line (steg 9: obeslutade stationer hoppas över med skälet
-- undecided). Gamla avtal (addon_rules NULL) går dagens väg ordagrant; den här
-- migrationen rör inte sync_addon_prorata_line.
--
-- Nytt:
--   contract_work_items_internal(root)  arbetslistan (del 1, egen fil)
--   contract_work_items(root)           samma för klienten, kräver
--                                       can_approve_invoices eller rollen admin
--   addon_station_set_case              Välj ärende för station utan ärende
--   addon_coverage_conflict_resolve     markera en täckningskonflikt som hanterad
--   addon_pending_refresh_notifications räknar hela arbetslistan (ersatt)
--   triggrar som uppdaterar notisen när täckning, konflikter eller avtalsdagen
--   ändras, och stationstriggrarna lyssnar också på placed_case_id och
--   addon_contract_mode.
-- Alla triggrar fångar fel (raise warning) så att stationer, fakturor och
-- Fortnox-synk aldrig stoppas av notisen.
-- Backning: 20261030_arbetslista_avtalskartan_backning.sql.

-- 1. Arbetslistan: contract_work_items_internal ligger i 20261030_arbetslista_funktion.sql (del 1).

-- 2. Arbetslistan för klienten ---------------------------------------------------
create or replace function public.contract_work_items(p_root_customer_id uuid default null)
returns table(
  kind text, root_customer_id uuid, root_name text, unit_id uuid, unit_name text, contract_id uuid,
  station_kind text, station_ids uuid[], station_count int, case_id uuid, case_number text,
  invoice_id uuid, invoice_number text, coverage_ids uuid[], conflict_ids uuid[],
  period_from date, period_to date, annual_kr numeric, v2 boolean, instruction text,
  sort_order int, sort_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not intranet_is_internal() or not exists (
    select 1 from profiles p
    where p.user_id = auth.uid() and coalesce(p.is_active, false)
      and (coalesce(p.can_approve_invoices, false) or p.role = 'admin')
  ) then
    raise exception 'Behörighet saknas';
  end if;
  return query
    select w.* from contract_work_items_internal(p_root_customer_id) w
    order by w.root_name, w.sort_order, w.sort_at nulls last, w.unit_name;
end $$;

revoke all on function public.contract_work_items(uuid) from public, anon;
grant execute on function public.contract_work_items(uuid) to authenticated, service_role;

-- 3. Välj ärende för stationer utan ärende ---------------------------------------
create or replace function public.addon_station_set_case(p_station_ids uuid[], p_kind text, p_case_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_case_customer uuid;
  v_case_root uuid;
  v_n int := 0;
begin
  select * into me from addon_coverage_approver();
  if p_kind not in ('outdoor', 'indoor') then
    raise exception 'Okänd stationstyp: %', p_kind;
  end if;
  if p_station_ids is null or cardinality(p_station_ids) = 0 then
    raise exception 'Inga stationer valda';
  end if;
  select c.customer_id into v_case_customer from cases c where c.id = p_case_id and c.deleted_at is null;
  if v_case_customer is null then
    raise exception 'Ärendet finns inte';
  end if;
  select coalesce(parent_customer_id, id) into v_case_root from customers where id = v_case_customer;
  if p_kind = 'outdoor' then
    update equipment_placements ep set placed_case_id = p_case_id
    from customers cu
    where ep.id = any(p_station_ids) and ep.placed_case_id is null and cu.id = ep.customer_id
      and (ep.customer_id = v_case_customer or coalesce(cu.parent_customer_id, cu.id) = v_case_root);
  else
    update indoor_stations s set placed_case_id = p_case_id
    from floor_plans fp, customers cu
    where s.id = any(p_station_ids) and s.placed_case_id is null and fp.id = s.floor_plan_id and cu.id = fp.customer_id
      and (fp.customer_id = v_case_customer or coalesce(cu.parent_customer_id, cu.id) = v_case_root);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.addon_station_set_case(uuid[], text, uuid) from public, anon;
grant execute on function public.addon_station_set_case(uuid[], text, uuid) to authenticated, service_role;

-- 4. Konflikt hanterad -------------------------------------------------------------
create or replace function public.addon_coverage_conflict_resolve(p_conflict_ids uuid[])
returns int
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_n int;
begin
  select * into me from addon_coverage_approver();
  if p_conflict_ids is null or cardinality(p_conflict_ids) = 0 then
    raise exception 'Inga rader valda';
  end if;
  update addon_coverage_conflicts k
  set resolved_at = now(), resolved_by = me.profile_id
  where k.id = any(p_conflict_ids) and k.resolved_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.addon_coverage_conflict_resolve(uuid[]) from public, anon;
grant execute on function public.addon_coverage_conflict_resolve(uuid[]) to authenticated, service_role;

-- 5. Notisen räknar hela arbetslistan ----------------------------------------------
create or replace function public.addon_pending_refresh_notifications(p_root_customer_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  p record;
  v_n int := 0;
  v_first text;
  v_name text;
  v_title text;
begin
  begin
    select count(*)::int, (array_agg(w.instruction order by w.sort_order, w.sort_at nulls last, w.unit_name))[1]
      into v_n, v_first
    from contract_work_items_internal(p_root_customer_id) w
    where w.root_customer_id = p_root_customer_id;
  exception when others then
    raise warning 'Arbetslistan kunde inte räknas för %: %', p_root_customer_id, sqlerrm;
    return;
  end;

  if coalesce(v_n, 0) = 0 then
    update notifications
      set is_read = true, read_at = coalesce(read_at, now())
    where case_type = 'customer' and case_id = p_root_customer_id and not is_read
      and (title like 'Tillägg att besluta%' or title like '% att göra på avtalskartan · %');
    return;
  end if;

  select company_name into v_name from customers where id = p_root_customer_id;
  v_title := v_n || ' att göra på avtalskartan · ' || coalesce(v_name, 'kund');

  for p in select id from profiles where can_approve_invoices and is_active loop
    update notifications
      set title = v_title, preview = v_first, case_title = coalesce(v_name, case_title), created_at = now()
    where recipient_id = p.id and case_type = 'customer' and case_id = p_root_customer_id and not is_read
      and (title like 'Tillägg att besluta%' or title like '% att göra på avtalskartan · %');
    if not found then
      insert into notifications (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read)
      values (p.id, p_root_customer_id, 'customer', v_title, v_first, v_name, p.id, 'Systemet', false);
    end if;
  end loop;
end $$;

-- 6. Triggrar som håller notisen aktuell -------------------------------------------
create or replace function public.work_items_root_of(p_customer_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(parent_customer_id, id) from customers where id = p_customer_id
$$;
revoke all on function public.work_items_root_of(uuid) from public, anon, authenticated;

create or replace function public.work_items_notify_coverage()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_root uuid;
begin
  begin
    v_root := work_items_root_of(new.unit_customer_id);
    if v_root is not null then
      perform addon_pending_refresh_notifications(v_root);
    end if;
  exception when others then
    raise warning 'Notisen för arbetslistan kunde inte uppdateras: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.work_items_notify_conflict()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_unit uuid;
  v_root uuid;
begin
  begin
    select l.unit_customer_id into v_unit from addon_station_lookup(new.station_id, new.station_kind) l limit 1;
    v_root := work_items_root_of(v_unit);
    if v_root is not null then
      perform addon_pending_refresh_notifications(v_root);
    end if;
  exception when others then
    raise warning 'Notisen för arbetslistan kunde inte uppdateras: %', sqlerrm;
  end;
  return new;
end $$;

create or replace function public.work_items_notify_contract()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_root uuid;
begin
  if new.billing_anchor_mode is not distinct from old.billing_anchor_mode
     and new.billing_anchor_verified_at is not distinct from old.billing_anchor_verified_at then
    return new;
  end if;
  begin
    v_root := work_items_root_of(new.customer_id);
    if v_root is not null then
      perform addon_pending_refresh_notifications(v_root);
    end if;
  exception when others then
    raise warning 'Notisen för arbetslistan kunde inte uppdateras: %', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.work_items_notify_coverage() from public, anon, authenticated;
revoke all on function public.work_items_notify_conflict() from public, anon, authenticated;
revoke all on function public.work_items_notify_contract() from public, anon, authenticated;

create or replace trigger trg_work_items_coverage
  after insert or update of released_at, invoice_cancelled_at on public.addon_station_coverage
  for each row execute function public.work_items_notify_coverage();

create or replace trigger trg_work_items_conflicts
  after insert or update of resolved_at on public.addon_coverage_conflicts
  for each row execute function public.work_items_notify_conflict();

create or replace trigger trg_work_items_contract_anchor
  after update of billing_anchor_mode, billing_anchor_verified_at on public.contracts
  for each row execute function public.work_items_notify_contract();

-- Stationstriggrarna lyssnar också på ärendet och beslutsläget
create or replace trigger trg_equipment_placements_addon_pending
  after insert or update of is_addon, addon_contract_id, status, placed_case_id, addon_contract_mode
  on public.equipment_placements
  for each row execute function public.addon_pending_notify();

create or replace trigger trg_indoor_stations_addon_pending
  after insert or update of is_addon, addon_contract_id, status, placed_case_id, addon_contract_mode
  on public.indoor_stations
  for each row execute function public.addon_pending_notify();
