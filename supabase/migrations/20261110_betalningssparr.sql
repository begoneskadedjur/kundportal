-- 20261110_betalningssparr.sql
-- Betalningsspärr (3.128.0, beslut Christian 2026-11-10).
-- Bara additivt: nya tabeller, nya kolumner med default, nya funktioner,
-- triggers och ett cron-jobb. Inget tas bort.
--
-- Avgränsning: spärren räknas ENBART på portalens egna fakturor
-- (invoices med fortnox_document_number och is_historical = false).
-- Kundens verkliga skuld per faktura = max(0, saldo minus ROT/RUT-avdrag som
-- väntar hos Skatteverket). Spärren sitter på fakturans customer_id; en kund
-- är spärrad om den själv ELLER dess huvudkontor (parent_customer_id) är det.

-- ─── Inställningar (en rad) ─────────────────────────────────────────────
create table if not exists public.payment_block_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  days_after_due integer not null default 20 check (days_after_due between 0 and 365),
  min_amount numeric not null default 100 check (min_amount >= 0),
  default_pause_days integer not null default 14 check (default_pause_days between 1 and 365),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.payment_block_settings (id) values (1) on conflict (id) do nothing;

alter table public.payment_block_settings enable row level security;

create policy payment_block_settings_select on public.payment_block_settings
  for select using (public.is_internal_user());

create policy payment_block_settings_update on public.payment_block_settings
  for update using (exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role::text = any (array['admin', 'koordinator'])
  ));

comment on table public.payment_block_settings is 'Betalningsspärren: på/av, dagar efter förfallodag, lägsta skuld, standardpaus (en rad).';

-- ─── Historik ───────────────────────────────────────────────────────────
create table if not exists public.customer_payment_blocks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  action text not null check (action in ('set', 'lift', 'pause', 'exempt', 'unexempt')),
  source text not null check (source in ('auto', 'manual')),
  reason text,
  invoice_ids uuid[] not null default '{}',
  amount numeric,
  days_overdue integer,
  paused_until date,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists customer_payment_blocks_customer_idx
  on public.customer_payment_blocks (customer_id, created_at desc);

alter table public.customer_payment_blocks enable row level security;

-- Interna roller läser historiken; kunder aldrig (kommentaren är intern).
-- Skrivning sker bara via SECURITY DEFINER-funktionerna nedan.
create policy customer_payment_blocks_select on public.customer_payment_blocks
  for select using (public.is_internal_user());

comment on table public.customer_payment_blocks is 'Betalningsspärrens historik: set/lift/pause/exempt, auto eller manuell, med kommentar, fakturor och belopp.';

-- ─── Kolumner på kunder och fakturor ────────────────────────────────────
alter table public.customers
  add column if not exists payment_block_active boolean not null default false,
  add column if not exists payment_block_source text check (payment_block_source is null or payment_block_source in ('auto', 'manual')),
  add column if not exists payment_block_since timestamptz,
  add column if not exists payment_block_paused_until date;

comment on column public.customers.payment_block_active is 'Betalningsspärr aktiv (3.128.0). Gäller även kundens enheter om kunden är huvudkontor.';
comment on column public.customers.payment_block_source is 'auto = satt av evaluate_payment_blocks, manual = satt på kundkortet.';
comment on column public.customers.payment_block_paused_until is 'Automatiken spärrar inte kunden till och med detta datum.';

alter table public.invoices
  add column if not exists payment_block_exempt boolean not null default false;
comment on column public.invoices.payment_block_exempt is 'Fakturan räknas inte i betalningsspärren (undantag med logg i customer_payment_blocks).';

alter table public.cases
  add column if not exists created_despite_payment_block boolean not null default false;
alter table public.private_cases
  add column if not exists created_despite_payment_block boolean not null default false;
alter table public.business_cases
  add column if not exists created_despite_payment_block boolean not null default false;
comment on column public.cases.created_despite_payment_block is 'Skapat med varning trots betalningsspärr (följeärende, återkommande schema).';
comment on column public.private_cases.created_despite_payment_block is 'Skapat med varning trots betalningsspärr (följeärende).';
comment on column public.business_cases.created_despite_payment_block is 'Skapat med varning trots betalningsspärr (följeärende).';

-- ─── Hjälpfunktioner ────────────────────────────────────────────────────

-- Dagens datum i svensk tid
create or replace function public.payment_block_today()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Europe/Stockholm')::date $$;

-- Belopp i hela kronor med mellanslag som tusentalsavgränsare (1 000)
create or replace function public.payment_block_kr(p numeric)
returns text language sql immutable set search_path = ''
as $ select replace(to_char(round(coalesce(p, 0)), 'FM999,999,999,990'), ',', ' ') $;

-- Org.nr/personnummer till jämförbar nyckel: sista tio siffrorna
create or replace function public.payment_block_identity_key(p text)
returns text language sql immutable set search_path = ''
as $$
  select case
    when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10
      then right(regexp_replace(p, '\D', '', 'g'), 10)
    else null
  end
$$;

-- Öppna portalfakturor med kundens verkliga skuld (alla förfallodagar)
create or replace function public.payment_block_open_invoices(p_customer_ids uuid[] default null)
returns table (
  customer_id uuid,
  invoice_id uuid,
  invoice_number text,
  fortnox_document_number text,
  debt numeric,
  due_date date,
  days_overdue integer,
  exempt boolean
)
language sql stable security definer set search_path = public
as $$
  select
    i.customer_id,
    i.id,
    i.invoice_number,
    i.fortnox_document_number,
    greatest(0, coalesce(i.balance_due, i.total_amount, 0)
      - case when coalesce(i.rot_rut_fortnox_amount, 0) > 0
               and coalesce(i.rot_rut_claim_status, '') <> 'rejected'
             then i.rot_rut_fortnox_amount else 0 end) as debt,
    i.due_date,
    (public.payment_block_today() - i.due_date)::int as days_overdue,
    i.payment_block_exempt
  from public.invoices i
  where i.customer_id is not null
    and i.fortnox_document_number is not null
    and coalesce(i.is_historical, false) = false
    and i.status in ('booked', 'sent', 'overdue')
    and i.due_date is not null
    and (p_customer_ids is null or i.customer_id = any (p_customer_ids))
    and greatest(0, coalesce(i.balance_due, i.total_amount, 0)
      - case when coalesce(i.rot_rut_fortnox_amount, 0) > 0
               and coalesce(i.rot_rut_claim_status, '') <> 'rejected'
             then i.rot_rut_fortnox_amount else 0 end) > 0
$$;

-- Kunder som uppfyller villkoret för auto-spärr (summa per fakturans kund)
create or replace function public.payment_block_qualifying(p_days integer, p_min numeric)
returns table (customer_id uuid, amount numeric, invoice_ids uuid[], days integer)
language sql stable security definer set search_path = public
as $
  select o.customer_id, sum(o.debt), array_agg(o.invoice_id order by o.due_date), max(o.days_overdue)
    from public.payment_block_open_invoices(null) o
   where not o.exempt and o.days_overdue > p_days
   group by o.customer_id
  having sum(o.debt) > p_min
$;

-- Kunden (eller huvudkontoret) som bär en gällande spärr för p_customer_id
create or replace function public.payment_block_effective_customer(p_customer_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select c.id
  from public.customers c
  where (select enabled from public.payment_block_settings where id = 1)
    and c.payment_block_active
    and c.id in (
      p_customer_id,
      (select parent_customer_id from public.customers where id = p_customer_id)
    )
  order by (c.id = p_customer_id) desc
  limit 1
$$;

-- Spärrad kund för ett org.nr/personnummer (privat- och företagsärenden).
-- Kunder utan huvudkontor matchas först; en enhet med eget nummer bara om
-- ingen fristående kund/huvudkontor har numret.
create or replace function public.payment_block_customer_for_identity(p_identity text)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_key text := public.payment_block_identity_key(p_identity);
  v_top uuid[];
  v_id uuid;
begin
  if v_key is null then return null; end if;
  select array_agg(id) into v_top from public.customers
   where parent_customer_id is null and public.payment_block_identity_key(organization_number) = v_key;
  if v_top is null then
    select array_agg(id) into v_top from public.customers
     where public.payment_block_identity_key(organization_number) = v_key;
  end if;
  if v_top is null then return null; end if;
  select public.payment_block_effective_customer(x) into v_id
    from unnest(v_top) x
   where public.payment_block_effective_customer(x) is not null
   limit 1;
  return v_id;
end $$;

-- Fullständig status för UI (kundkortet, Skapa ärende, varningar)
create or replace function public.payment_block_status_for(p_blocked_customer_id uuid, p_asked_customer_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_c record;
  v_inv jsonb;
  v_amount numeric;
  v_days int;
begin
  if p_blocked_customer_id is null then
    return jsonb_build_object('blocked', false);
  end if;
  select id, company_name, payment_block_source, payment_block_since, payment_block_paused_until
    into v_c from public.customers where id = p_blocked_customer_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.invoice_id, 'invoice_number', o.invoice_number,
           'fortnox_document_number', o.fortnox_document_number,
           'debt', o.debt, 'due_date', o.due_date, 'days_overdue', o.days_overdue,
           'exempt', o.exempt) order by o.due_date), '[]'::jsonb),
         coalesce(sum(o.debt) filter (where not o.exempt and o.days_overdue > 0), 0),
         max(o.days_overdue) filter (where not o.exempt)
    into v_inv, v_amount, v_days
    from public.payment_block_open_invoices(array[p_blocked_customer_id]) o
   where o.days_overdue > 0;
  return jsonb_build_object(
    'blocked', true,
    'customer_id', v_c.id,
    'customer_name', v_c.company_name,
    'via_parent', p_asked_customer_id is not null and p_asked_customer_id <> v_c.id,
    'source', v_c.payment_block_source,
    'since', v_c.payment_block_since,
    'amount', v_amount,
    'max_days_overdue', v_days,
    'invoices', v_inv
  );
end $$;

-- Interna: status för en kund (egen spärr eller huvudkontorets)
create or replace function public.get_payment_block_status(p_customer_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_internal_user() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Behörighet saknas';
  end if;
  return public.payment_block_status_for(public.payment_block_effective_customer(p_customer_id), p_customer_id);
end $$;

-- Interna: status för ett org.nr/personnummer (privat/företag i Skapa ärende)
create or replace function public.get_payment_block_status_by_identity(p_identity text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_internal_user() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Behörighet saknas';
  end if;
  return public.payment_block_status_for(public.payment_block_customer_for_identity(p_identity), null);
end $$;

-- Kundportalen: vilka kunder i min behörighet som är spärrade (ingen intern info)
create or replace function public.my_payment_blocked_customer_ids()
returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(x), '{}'::uuid[])
  from unnest(public.my_scope_customer_ids()) x
  where public.payment_block_effective_customer(x) is not null
$$;

-- ─── Notiser ────────────────────────────────────────────────────────────
create or replace function public.payment_block_notify(p_customer_id uuid, p_title text, p_preview text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_am text;
  p record;
begin
  select company_name, lower(nullif(trim(account_manager_email), '')) into v_name, v_am
    from public.customers where id = p_customer_id;
  for p in
    select distinct pr.id from public.profiles pr
     where pr.is_active
       and (pr.can_approve_invoices or (v_am is not null and lower(pr.email) = v_am))
       and pr.role::text in ('admin', 'koordinator', 'säljare', 'technician')
  loop
    insert into public.notifications (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read)
    values (p.id, p_customer_id, 'customer', p_title || ' · ' || coalesce(v_name, 'kund'), p_preview, v_name, p.id, 'Systemet', false);
  end loop;
end $$;

-- ─── Automatiken ────────────────────────────────────────────────────────
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

  -- Sätt auto-spärr
  for r in
    select q.*, c.company_name
      from public.payment_block_qualifying(s.days_after_due, s.min_amount) q
      join public.customers c on c.id = q.customer_id
     where not c.payment_block_active
       and (c.payment_block_paused_until is null or c.payment_block_paused_until < v_today)
       and coalesce(c.termination_reason, '') !~* 'konkurs'
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

  -- Häv auto-spärr när villkoret inte längre gäller
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

-- ─── Manuella åtgärder (kundkortet) ─────────────────────────────────────
create or replace function public.payment_block_actor()
returns table (id uuid, name text)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  select p.id, coalesce(nullif(p.display_name, ''), p.email)::text
    from public.profiles p
   where p.user_id = auth.uid()
     and p.is_active
     and (p.role::text in ('admin', 'koordinator') or p.can_approve_invoices)
   limit 1;
  if not found then
    raise exception 'Behörighet saknas: bara admin, koordinator eller fakturagodkännare kan ändra betalningsspärren';
  end if;
  -- Släpper igenom skyddstriggern på spärrkolumnerna i denna transaktion
  perform set_config('begone.payment_block_rpc', 'on', true);
end $$;

create or replace function public.payment_block_set_manual(p_customer_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare a record;
begin
  select * into a from public.payment_block_actor();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Kommentar krävs'; end if;
  update public.customers
     set payment_block_active = true, payment_block_source = 'manual',
         payment_block_since = case when payment_block_active then payment_block_since else now() end
   where id = p_customer_id;
  if not found then raise exception 'Kunden finns inte'; end if;
  insert into public.customer_payment_blocks (customer_id, action, source, reason, created_by, created_by_name)
  values (p_customer_id, 'set', 'manual', trim(p_reason), a.id, a.name);
  return public.payment_block_status_for(p_customer_id, p_customer_id);
end $$;

create or replace function public.payment_block_lift(p_customer_id uuid, p_reason text, p_pause_until date default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  v_source text;
  v_pause date := p_pause_until;
begin
  select * into a from public.payment_block_actor();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Kommentar krävs'; end if;
  select payment_block_source into v_source from public.customers where id = p_customer_id and payment_block_active;
  if v_source is null then raise exception 'Kunden har ingen aktiv spärr'; end if;
  -- Hävd auto-spärr pausar automatiken, annars spärras kunden igen inom 15 minuter
  if v_source = 'auto' and v_pause is null then
    v_pause := public.payment_block_today() + (select default_pause_days from public.payment_block_settings where id = 1);
  end if;
  if v_pause is not null and v_pause < public.payment_block_today() then
    raise exception 'Pausdatumet kan inte ligga bakåt i tiden';
  end if;
  update public.customers
     set payment_block_active = false, payment_block_source = null, payment_block_since = null,
         payment_block_paused_until = coalesce(v_pause, payment_block_paused_until)
   where id = p_customer_id;
  insert into public.customer_payment_blocks (customer_id, action, source, reason, paused_until, created_by, created_by_name)
  values (p_customer_id, 'lift', 'manual', trim(p_reason), v_pause, a.id, a.name);
  return jsonb_build_object('blocked', false, 'paused_until', v_pause);
end $$;

create or replace function public.payment_block_pause(p_customer_id uuid, p_reason text, p_until date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare a record; v_source text;
begin
  select * into a from public.payment_block_actor();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Kommentar krävs'; end if;
  if p_until is null or p_until < public.payment_block_today() then
    raise exception 'Välj ett datum från och med i dag';
  end if;
  select case when payment_block_active then payment_block_source end into v_source
    from public.customers where id = p_customer_id;
  if not found then raise exception 'Kunden finns inte'; end if;
  -- En aktiv auto-spärr hävs av pausen; en manuell spärr ligger kvar
  update public.customers
     set payment_block_paused_until = p_until,
         payment_block_active = case when v_source = 'auto' then false else payment_block_active end,
         payment_block_source = case when v_source = 'auto' then null else payment_block_source end,
         payment_block_since = case when v_source = 'auto' then null else payment_block_since end
   where id = p_customer_id;
  insert into public.customer_payment_blocks (customer_id, action, source, reason, paused_until, created_by, created_by_name)
  values (p_customer_id, 'pause', 'manual', trim(p_reason), p_until, a.id, a.name);
  return jsonb_build_object('paused_until', p_until, 'lifted_auto', v_source = 'auto');
end $$;

create or replace function public.payment_block_set_invoice_exempt(p_invoice_id uuid, p_exempt boolean, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare a record; v_inv record;
begin
  select * into a from public.payment_block_actor();
  if coalesce(trim(p_reason), '') = '' then raise exception 'Kommentar krävs'; end if;
  select id, customer_id, coalesce(balance_due, total_amount) as amount into v_inv from public.invoices where id = p_invoice_id;
  if v_inv.id is null or v_inv.customer_id is null then raise exception 'Fakturan finns inte eller saknar kund'; end if;
  update public.invoices set payment_block_exempt = p_exempt where id = p_invoice_id;
  insert into public.customer_payment_blocks (customer_id, action, source, reason, invoice_ids, amount, created_by, created_by_name)
  values (v_inv.customer_id, case when p_exempt then 'exempt' else 'unexempt' end, 'manual', trim(p_reason),
          array[p_invoice_id], v_inv.amount, a.id, a.name);
end $$;

-- ─── Server-side stopp: BEFORE INSERT på ärendetabellerna ───────────────
-- Undantag: service_role och direkta databasanrop (cron, återkommande
-- scheman, api/create-case som själv svarar 423), följeärenden
-- (parent_case_id) och rader som uttryckligen skapats med varning
-- (created_despite_payment_block).
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
  if new.parent_case_id is not null then return new; end if;
  if coalesce(new.created_despite_payment_block, false) then return new; end if;

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

create trigger trg_payment_block_guard before insert on public.cases
  for each row execute function public.payment_block_guard_case_insert();
create trigger trg_payment_block_guard before insert on public.private_cases
  for each row execute function public.payment_block_guard_case_insert();
create trigger trg_payment_block_guard before insert on public.business_cases
  for each row execute function public.payment_block_guard_case_insert();

-- ─── Skydd: spärrkolumnerna ändras bara via funktionerna ovan ───────────
-- (så att varje ändring hamnar i historiken). service_role och direkta
-- databasanrop släpps igenom.
create or replace function public.payment_block_guard_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_role text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  if v_role is null or v_role = 'service_role' then return new; end if;
  if coalesce(current_setting('begone.payment_block_rpc', true), '') = 'on' then return new; end if;
  if tg_table_name = 'customers' then
    if new.payment_block_active is distinct from old.payment_block_active
       or new.payment_block_source is distinct from old.payment_block_source
       or new.payment_block_since is distinct from old.payment_block_since
       or new.payment_block_paused_until is distinct from old.payment_block_paused_until then
      raise exception 'Betalningsspärren ändras bara på kundkortet (med kommentar)';
    end if;
  elsif tg_table_name = 'invoices' then
    if new.payment_block_exempt is distinct from old.payment_block_exempt then
      raise exception 'Undantag från betalningsspärren görs bara på kundkortet (med kommentar)';
    end if;
  end if;
  return new;
end $$;

create trigger trg_payment_block_guard_columns before update on public.customers
  for each row execute function public.payment_block_guard_columns();
create trigger trg_payment_block_guard_columns before update on public.invoices
  for each row execute function public.payment_block_guard_columns();

-- ─── Behörigheter ───────────────────────────────────────────────────────
revoke all on function public.evaluate_payment_blocks() from public, anon, authenticated;
grant execute on function public.evaluate_payment_blocks() to service_role;
revoke all on function public.payment_block_notify(uuid, text, text) from public, anon, authenticated;
revoke all on function public.payment_block_open_invoices(uuid[]) from public, anon;
revoke all on function public.payment_block_qualifying(integer, numeric) from public, anon, authenticated;
revoke all on function public.payment_block_status_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.payment_block_customer_for_identity(text) from public, anon;
revoke all on function public.payment_block_effective_customer(uuid) from public, anon;
revoke all on function public.get_payment_block_status(uuid) from public, anon;
revoke all on function public.get_payment_block_status_by_identity(text) from public, anon;
revoke all on function public.my_payment_blocked_customer_ids() from public, anon;
revoke all on function public.payment_block_set_manual(uuid, text) from public, anon;
revoke all on function public.payment_block_lift(uuid, text, date) from public, anon;
revoke all on function public.payment_block_pause(uuid, text, date) from public, anon;
revoke all on function public.payment_block_set_invoice_exempt(uuid, boolean, text) from public, anon;
grant execute on function public.get_payment_block_status(uuid) to authenticated;
grant execute on function public.get_payment_block_status_by_identity(text) to authenticated;
grant execute on function public.my_payment_blocked_customer_ids() to authenticated;
grant execute on function public.payment_block_set_manual(uuid, text) to authenticated;
grant execute on function public.payment_block_lift(uuid, text, date) to authenticated;
grant execute on function public.payment_block_pause(uuid, text, date) to authenticated;
grant execute on function public.payment_block_set_invoice_exempt(uuid, boolean, text) to authenticated;
revoke all on function public.payment_block_open_invoices(uuid[]) from authenticated;
revoke all on function public.payment_block_effective_customer(uuid) from authenticated;
revoke all on function public.payment_block_customer_for_identity(text) from authenticated;
revoke all on function public.payment_block_actor() from public, anon;
grant execute on function public.payment_block_actor() to authenticated;

-- ─── Cron: utvärdera var 15:e minut ─────────────────────────────────────
select cron.schedule('evaluate-payment-blocks', '*/15 * * * *', 'select public.evaluate_payment_blocks()');
