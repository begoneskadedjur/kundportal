-- Premien har en källa
--
-- Årspremien låg på fyra ställen: contracts.annual_value, contracts.total_value,
-- premietrappan (contract_premium_events) och customers.annual_value (summa).
-- Härifrån är TRAPPAN enda källan. contracts.annual_value sätts av trigger
-- (steget i kraft i dag), customers.annual_value sätts av trigger (summan av
-- kundens levande avtal), en pg_cron-körning varje natt låter framtida steg
-- träda i kraft. Klienten skriver aldrig annual_value på ett avtal med trappa.
-- total_value lämnas: kolumnen är offertvärdet på contracts-raden som offert.
-- contracts.equipment_invoice_mode (deprecated sedan 2026-09-04) tas bort.

-- 1. Backfill: avtal med premie men utan trappa får ett startsteg
insert into public.contract_premium_events (contract_id, effective_from, annual_value, event_type, note, created_by)
select c.id, coalesce(c.contract_start_date, c.start_date, current_date), c.annual_value, 'start', 'Backfill ur annual_value 2026-09-10', 'system'
from public.contracts c
where c.annual_value is not null and c.annual_value > 0
  and not exists (select 1 from public.contract_premium_events e where e.contract_id = c.id);

-- 2. Steget i kraft ett givet datum
create or replace function public.contract_annual_value_in_force(p_contract_id uuid, p_asof date default current_date)
returns numeric
language sql
stable
as $$
  select e.annual_value
  from public.contract_premium_events e
  where e.contract_id = p_contract_id and e.effective_from <= p_asof
  order by e.effective_from desc, e.created_at desc
  limit 1
$$;

-- 3. Levande avtal (samma regel som src/utils/contractLifecycle.ts isLiveContract + ej importerat)
create or replace function public.contract_is_live(c public.contracts, p_asof date default current_date)
returns boolean
language sql
immutable
as $$
  select c.status in ('signed', 'active')
    and coalesce(c.template_id, '') <> 'imported'
    and coalesce(c.oneflow_contract_id, '') not like 'imported-%'
    and (
      c.terminated_at is null
      or (coalesce(c.effective_end_date, c.contract_end_date) is not null
          and coalesce(c.effective_end_date, c.contract_end_date) >= p_asof)
    )
$$;

-- 4. Kundens summa: skrivs bara när kunden har minst ett levande avtal,
--    kundradsavtal utan contracts-rad behåller sitt eget värde
create or replace function public.refresh_customer_annual_value(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sum numeric;
  v_count int;
begin
  if p_customer_id is null then return; end if;
  select coalesce(sum(c.annual_value), 0), count(*) into v_sum, v_count
  from public.contracts c
  where c.customer_id = p_customer_id and public.contract_is_live(c);
  if v_count = 0 then return; end if;
  update public.customers set annual_value = case when v_sum > 0 then v_sum else null end
  where id = p_customer_id and annual_value is distinct from (case when v_sum > 0 then v_sum else null end);
end;
$$;

-- 5. Avtalets årsvärde ur trappan
create or replace function public.refresh_contract_annual_value(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value numeric;
  v_customer uuid;
  v_has_events boolean;
begin
  if p_contract_id is null then return; end if;
  select exists (select 1 from public.contract_premium_events where contract_id = p_contract_id) into v_has_events;
  if not v_has_events then
    -- Ingen trappa (t.ex. offert eller avropsavtal): kolumnen lämnas
    return;
  end if;
  v_value := public.contract_annual_value_in_force(p_contract_id);
  update public.contracts set annual_value = v_value
  where id = p_contract_id and annual_value is distinct from v_value
  returning customer_id into v_customer;
  if v_customer is null then
    select customer_id into v_customer from public.contracts where id = p_contract_id;
  end if;
  perform public.refresh_customer_annual_value(v_customer);
end;
$$;

-- 6. Triggers
create or replace function public.trg_premium_events_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.refresh_contract_annual_value(old.contract_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.refresh_contract_annual_value(new.contract_id); end if;
  return null;
end;
$$;
drop trigger if exists premium_events_refresh on public.contract_premium_events;
create trigger premium_events_refresh
  after insert or update or delete on public.contract_premium_events
  for each row execute function public.trg_premium_events_refresh();

create or replace function public.trg_contracts_refresh_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.refresh_customer_annual_value(old.customer_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.refresh_customer_annual_value(new.customer_id); end if;
  return null;
end;
$$;
drop trigger if exists contracts_refresh_customer on public.contracts;
create trigger contracts_refresh_customer
  after insert or delete or update of annual_value, status, terminated_at, effective_end_date, contract_end_date, customer_id, template_id on public.contracts
  for each row execute function public.trg_contracts_refresh_customer();

-- 7. Nattlig körning: framtida steg träder i kraft, kundsummor följer
create or replace function public.refresh_all_contract_annual_values()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in select distinct contract_id from public.contract_premium_events loop
    perform public.refresh_contract_annual_value(r.contract_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
select cron.unschedule(jobid) from cron.job where jobname = 'refresh-contract-annual-values';
select cron.schedule('refresh-contract-annual-values', '15 0 * * *', $$select public.refresh_all_contract_annual_values()$$);

-- 8. Initial synk
select public.refresh_all_contract_annual_values();

-- 9. Städning
alter table public.contracts drop column if exists equipment_invoice_mode;

-- 10. Stationens två avtalsfält hålls lika tills de slås ihop
--     (contract_id = fas 8a "står under avtal", addon_contract_id = tilläggets avtal;
--     i data skiljer de sig aldrig). Sammanslagningen kräver ändring av sex
--     SQL-funktioner och en FK-select, tas i ett eget steg.
update public.equipment_placements set addon_contract_id = contract_id where is_addon and addon_contract_id is null and contract_id is not null;
update public.equipment_placements set contract_id = addon_contract_id where addon_contract_id is not null and contract_id is null;
create or replace function public.trg_station_contract_fields_align()
returns trigger
language plpgsql
as $$
begin
  if new.addon_contract_id is distinct from old.addon_contract_id and new.addon_contract_id is not null then
    new.contract_id := new.addon_contract_id;
  elsif new.contract_id is distinct from old.contract_id and new.contract_id is not null and coalesce(new.is_addon, false) then
    new.addon_contract_id := new.contract_id;
  end if;
  return new;
end;
$$;
drop trigger if exists station_contract_fields_align on public.equipment_placements;
create trigger station_contract_fields_align
  before update of contract_id, addon_contract_id on public.equipment_placements
  for each row execute function public.trg_station_contract_fields_align();

-- 11. apply_contract_addition skriver inte längre kolumnerna direkt: v_prev ur trappan,
--     steget (event_type addition) bär det nya värdet och triggern sätter kolumn + kundsumma.
--     Funktionskroppen i sin helhet: se pg_get_functiondef('apply_contract_addition') efter 2026-09-10.
