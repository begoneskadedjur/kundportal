-- Verifiering mot Fortnox sätts automatiskt: en kund är verifierad när kundnumret
-- finns som aktiv rad i Fortnox-spegeln med samma org.nr (siffror). Stämpeln tas
-- bort när matchningen försvinner (nummer saknas, inaktiv, annat org.nr).
-- Enheter utan eget kundnummer rörs inte (de ärver huvudkontorets läge i UI).
create or replace function public.refresh_fortnox_verification(p_customer_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set int := 0;
  v_cleared int := 0;
begin
  with matched as (
    select c.id
    from customers c
    join fortnox_customer_numbers f
      on f.customer_number = c.customer_number::text
     and f.active = true
     and f.missing_since is null
     and f.org_digits = regexp_replace(coalesce(c.organization_number, ''), '\D', '', 'g')
     and length(f.org_digits) > 0
    where c.customer_number is not null
      and (p_customer_id is null or c.id = p_customer_id)
  ),
  upd as (
    update customers c set fortnox_verified_at = now()
    where c.id in (select id from matched) and c.fortnox_verified_at is null
    returning c.id
  )
  select count(*) into v_set from upd;

  with matched as (
    select c.id
    from customers c
    join fortnox_customer_numbers f
      on f.customer_number = c.customer_number::text
     and f.active = true
     and f.missing_since is null
     and f.org_digits = regexp_replace(coalesce(c.organization_number, ''), '\D', '', 'g')
     and length(f.org_digits) > 0
    where c.customer_number is not null
  ),
  upd as (
    update customers c set fortnox_verified_at = null
    where c.customer_number is not null
      and c.fortnox_verified_at is not null
      and c.id not in (select id from matched)
      and (p_customer_id is null or c.id = p_customer_id)
    returning c.id
  )
  select count(*) into v_cleared from upd;

  return jsonb_build_object('set', v_set, 'cleared', v_cleared);
end;
$$;

comment on function public.refresh_fortnox_verification(uuid) is
  'Sätter/tar bort customers.fortnox_verified_at utifrån Fortnox-spegeln (kundnummer + org.nr, aktiv). Anropas av kundsynken och av triggern på customers.';

-- När kundnummer eller org.nr ändras på en kund räknas dennes stämpel om direkt.
create or replace function public.trg_customer_fortnox_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_fortnox_verification(new.id);
  return null;
end;
$$;

drop trigger if exists customer_fortnox_verification on public.customers;
create trigger customer_fortnox_verification
  after insert or update of customer_number, organization_number on public.customers
  for each row execute function public.trg_customer_fortnox_verification();

grant execute on function public.refresh_fortnox_verification(uuid) to service_role;
