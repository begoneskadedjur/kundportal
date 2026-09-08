-- Tillägg att besluta: obeslutade tilläggsstationer letar upp faktureringsansvarig
--
-- En station som teknikern markerat "Tillägg utöver avtal" får sin § 6-rad
-- automatiskt, men beslutet om fakturering (tillägg eller inbakat i premien,
-- år 1 pro rata, koppling till avtalet) tas i avtalskartan. Tills dess står
-- den som en bricka "att besluta" som bara den ser som råkar öppna kunden.
--
-- 1. addon_pending_summary(): en rad per kund (huvudkontor) med antal
--    stationer, avtal, kronor per år och äldsta markering. Räknar bara
--    stationer vars enhet ligger i ett aktivt avtals omfattning. En markerad
--    station på en enhet utan avtal är ett annat fel ("saknar avtal").
-- 2. Notis per kund till alla med can_approve_invoices, uppdateras när fler
--    markeras och markeras läst när sista brickan är beslutad. Trigger på
--    stationstabellerna, SECURITY DEFINER så teknikerns markering får skapa
--    notiser till andra.

-- notifications.case_type får ett nytt värde för kundnotiser (case_id = kund)
alter table public.notifications drop constraint if exists notifications_case_type_check;
alter table public.notifications add constraint notifications_case_type_check
  check (case_type = any (array['private'::text, 'business'::text, 'contract'::text, 'customer'::text]));

create or replace function public.addon_pending_summary()
returns table (
  root_customer_id uuid,
  organization_id uuid,
  company_name text,
  stations integer,
  units integer,
  contracts integer,
  annual_kr numeric,
  first_marked_at timestamptz
)
language sql
stable
as $$
  with st as (
    select e.id, e.customer_id as unit_id, e.station_type_id, e.addon_marked_at
    from public.equipment_placements e
    where e.is_addon and e.addon_contract_id is null and coalesce(e.status, 'active') <> 'removed'
    union all
    select i.id, fp.customer_id, i.station_type_id, i.addon_marked_at
    from public.indoor_stations i
    join public.floor_plans fp on fp.id = i.floor_plan_id
    where i.is_addon and i.addon_contract_id is null and coalesce(i.status, 'active') <> 'removed'
  ),
  unit as (
    select st.*, coalesce(c.parent_customer_id, c.id) as root_id
    from st join public.customers c on c.id = st.unit_id
  ),
  covered as (
    select u.id as station_id, u.unit_id, u.root_id, u.station_type_id, u.addon_marked_at,
      (
        select ct.id from public.contracts ct
        where ct.status = 'active'
          and (
            ct.id in (
              select cs.contract_id from public.contract_sites cs
              where cs.customer_id = u.unit_id and (cs.active_to is null or cs.active_to >= current_date)
            )
            or ct.customer_id = u.unit_id
            or (ct.customer_id = u.root_id and ct.covers_all_sites)
          )
        order by ct.created_at
        limit 1
      ) as contract_id
    from unit u
  )
  select
    cv.root_id,
    r.organization_id,
    r.company_name,
    count(*)::integer,
    count(distinct cv.unit_id)::integer,
    count(distinct cv.contract_id)::integer,
    coalesce(sum(coalesce(public.addon_annual_price_for_type(cv.station_type_id, cv.unit_id, cv.contract_id), 0)), 0),
    min(cv.addon_marked_at)
  from covered cv
  join public.customers r on r.id = cv.root_id
  where cv.contract_id is not null
  group by cv.root_id, r.organization_id, r.company_name
$$;

grant execute on function public.addon_pending_summary() to authenticated;

-- Notiser: en per kund och faktureringsansvarig. Körs från triggern nedan.
create or replace function public.addon_pending_refresh_notifications(p_root_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  p record;
  v_title text;
  v_preview text;
begin
  select * into s from public.addon_pending_summary() where root_customer_id = p_root_customer_id;

  if s.root_customer_id is null then
    -- Inget kvar att besluta: notiserna är klara
    update public.notifications
      set is_read = true, read_at = coalesce(read_at, now())
    where case_type = 'customer' and case_id = p_root_customer_id and not is_read;
    return;
  end if;

  v_title := 'Tillägg att besluta · ' || s.company_name;
  v_preview := s.stations || ' tilläggsstation' || case when s.stations = 1 then '' else 'er' end
    || ' på ' || s.contracts || ' avtal väntar på beslut om fakturering, '
    || to_char(round(s.annual_kr), 'FM999G999G999') || ' kr/år.';

  for p in select id from public.profiles where can_approve_invoices and is_active loop
    update public.notifications
      set title = v_title, preview = v_preview, created_at = now()
    where recipient_id = p.id and case_type = 'customer' and case_id = p_root_customer_id and not is_read;
    if not found then
      insert into public.notifications (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read)
      values (p.id, p_root_customer_id, 'customer', v_title, v_preview, s.company_name, p.id, 'Systemet', false);
    end if;
  end loop;
end;
$$;

create or replace function public.addon_pending_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit uuid;
  v_root uuid;
begin
  if tg_table_name = 'indoor_stations' then
    select fp.customer_id into v_unit from public.floor_plans fp where fp.id = new.floor_plan_id;
  else
    v_unit := new.customer_id;
  end if;
  if v_unit is null then return new; end if;
  select coalesce(parent_customer_id, id) into v_root from public.customers where id = v_unit;
  if v_root is null then return new; end if;
  perform public.addon_pending_refresh_notifications(v_root);
  return new;
end;
$$;

drop trigger if exists trg_equipment_placements_addon_pending on public.equipment_placements;
create trigger trg_equipment_placements_addon_pending
  after insert or update of is_addon, addon_contract_id, status on public.equipment_placements
  for each row execute function public.addon_pending_notify();

drop trigger if exists trg_indoor_stations_addon_pending on public.indoor_stations;
create trigger trg_indoor_stations_addon_pending
  after insert or update of is_addon, addon_contract_id, status on public.indoor_stations
  for each row execute function public.addon_pending_notify();
