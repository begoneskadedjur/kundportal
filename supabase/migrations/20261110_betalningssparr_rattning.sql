-- Betalningsspärr (3.128.1): två rättningar efter granskning.
-- 1. Undantagen i triggern (följeärende via parent_case_id och markeringen
--    created_despite_payment_block) gäller bara personal. En kund som skriver
--    direkt mot databasen kan inte längre sätta markeringen och kringgå spärren.
-- 2. Kunder med "konkurs" i uppsägningsorsaken undantas inte längre från
--    automatiken. Det var inte beslutat.

create or replace function public.payment_block_guard_case_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  v_blocked uuid;
  v_name text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  if v_role is null or v_role = 'service_role' then return new; end if;
  -- Följeärenden och ärenden skapade med varning: bara personal
  if public.is_internal_user() then
    if new.parent_case_id is not null then return new; end if;
    if coalesce(new.created_despite_payment_block, false) then return new; end if;
  end if;

  if tg_table_name = 'cases' then
    v_blocked := public.payment_block_effective_customer(new.customer_id);
  elsif tg_table_name = 'private_cases' then
    v_blocked := public.payment_block_customer_for_identity(new.personnummer);
  elsif tg_table_name = 'business_cases' then
    v_blocked := public.payment_block_customer_for_identity(new.org_nr);
  end if;

  if v_blocked is not null then
    select company_name into v_name from public.customers where id = v_blocked;
    raise exception 'BETALNINGSSPÄRR: % har betalningsspärr på grund av obetalda fakturor. Nya ärenden kan inte skapas förrän spärren hävs på kundkortet.', coalesce(v_name, 'Kunden')
      using errcode = 'P0001', hint = 'payment_block:' || v_blocked::text;
  end if;
  return new;
end $$;

create or replace function public.evaluate_payment_blocks()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  s record;
  v_today date := public.payment_block_today();
  r record;
  v_set jsonb := '[]'::jsonb;
  v_lifted jsonb := '[]'::jsonb;
  v_qualifying uuid[];
begin
  select * into s from public.payment_block_settings where id = 1;
  if s is null or not s.enabled then
    return jsonb_build_object('enabled', false);
  end if;

  perform pg_advisory_xact_lock(hashtext('evaluate_payment_blocks'));
  perform set_config('begone.payment_block_rpc', 'on', true);

  select coalesce(array_agg(q.customer_id), '{}') into v_qualifying
    from public.payment_block_qualifying(s.days_after_due, s.min_amount) q;

  for r in
    select q.*, c.company_name
      from public.payment_block_qualifying(s.days_after_due, s.min_amount) q
      join public.customers c on c.id = q.customer_id
     where not c.payment_block_active
       and (c.payment_block_paused_until is null or c.payment_block_paused_until < v_today)
  loop
    update public.customers
       set payment_block_active = true, payment_block_source = 'auto', payment_block_since = now()
     where id = r.customer_id;
    insert into public.customer_payment_blocks (customer_id, action, source, reason, invoice_ids, amount, days_overdue, created_by_name)
    values (r.customer_id, 'set', 'auto',
            format('Förfallen skuld %s kr, äldsta %s dagar efter förfallodagen (gräns %s dagar, %s kr).',
                   public.payment_block_kr(r.amount), r.days, s.days_after_due, public.payment_block_kr(s.min_amount)),
            r.invoice_ids, r.amount, r.days, 'Systemet');
    perform public.payment_block_notify(r.customer_id, 'Betalningsspärr satt',
      format('Förfallen skuld %s kr, %s dagar efter förfallodagen. Nya bokningar stoppas tills skulden är betald.',
             public.payment_block_kr(r.amount), r.days));
    v_set := v_set || jsonb_build_object('customer_id', r.customer_id, 'name', r.company_name, 'amount', r.amount, 'days', r.days);
  end loop;

  for r in
    select c.id, c.company_name from public.customers c
     where c.payment_block_active and c.payment_block_source = 'auto'
       and not (c.id = any (v_qualifying))
  loop
    update public.customers
       set payment_block_active = false, payment_block_source = null, payment_block_since = null
     where id = r.id;
    insert into public.customer_payment_blocks (customer_id, action, source, reason, created_by_name)
    values (r.id, 'lift', 'auto', 'Villkoret gäller inte längre: skulden är betald, undantagen eller under gränsen.', 'Systemet');
    perform public.payment_block_notify(r.id, 'Betalningsspärr hävd', 'Spärren hävdes automatiskt. Kunden kan bokas igen.');
    v_lifted := v_lifted || jsonb_build_object('customer_id', r.id, 'name', r.company_name);
  end loop;

  return jsonb_build_object('enabled', true, 'set', v_set, 'lifted', v_lifted, 'evaluated_at', now());
end $$;
