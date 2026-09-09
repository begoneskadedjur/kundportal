-- Ramavtalet skrivs en gång, avtalen ärver
--
-- WBAB:s tre avtal hade § 2 prislista, § 8 löptid/option och standardreferens
-- identiskt på tre papper. Ett ramavtal (framework_agreements) bär dem, avtalen
-- pekar dit (contracts.framework_id). Avtalets kolumner FÖRBLIR de effektiva
-- värdena som planerare, generator och cron läser: databasen kopierar ur
-- ramavtalet till varje fält avtalet inte äger själv. Vilka fält avtalet
-- äger står i contracts.framework_overrides (null/tom = allt ärvs). Skriver
-- klienten ett eget värde på ett ärvt fält blir fältet en avvikelse; skriver
-- den null ärvs ramavtalet igen. EN resolver: apply_framework_to_contract().

create table if not exists public.framework_agreements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  diary_number text,
  customer_id uuid references public.customers(id) on delete set null,
  organization_id uuid,
  price_list_id uuid references public.price_lists(id) on delete set null,
  contract_start_date date,
  contract_end_date date,
  notice_period_months smallint,
  renewal_mode text,
  option_until date,
  option_decision_deadline date,
  renewal_reminder_days smallint,
  invoice_reference text,
  visit_frequency text,
  visits_per_year smallint,
  billing_frequency text,
  billing_anchor_month smallint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_name text
);
alter table public.framework_agreements enable row level security;
drop policy if exists framework_agreements_internal on public.framework_agreements;
create policy framework_agreements_internal on public.framework_agreements
  for all to authenticated using (public.intranet_is_internal()) with check (public.intranet_is_internal());

alter table public.contracts add column if not exists framework_id uuid references public.framework_agreements(id) on delete set null;
alter table public.contracts add column if not exists framework_overrides text[] not null default '{}';
create index if not exists contracts_framework_id_idx on public.contracts(framework_id);

-- Fälten ett ramavtal styr
create or replace function public.framework_fields()
returns text[] language sql immutable as $$
  select array['price_list_id','contract_start_date','contract_end_date','notice_period_months','renewal_mode','option_until',
               'option_decision_deadline','renewal_reminder_days','invoice_reference','diary_number','visit_frequency','visits_per_year',
               'billing_frequency','billing_anchor_month']
$$;

-- Resolvern: ärvda fält får ramavtalets värde, ägda fält lämnas
create or replace function public.apply_framework_to_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.contracts;
  f public.framework_agreements;
begin
  select * into c from public.contracts where id = p_contract_id;
  if not found or c.framework_id is null then return; end if;
  select * into f from public.framework_agreements where id = c.framework_id;
  if not found then return; end if;
  update public.contracts set
    price_list_id = case when 'price_list_id' = any(c.framework_overrides) then price_list_id else f.price_list_id end,
    contract_start_date = case when 'contract_start_date' = any(c.framework_overrides) then contract_start_date else coalesce(f.contract_start_date, contract_start_date) end,
    contract_end_date = case when 'contract_end_date' = any(c.framework_overrides) then contract_end_date else f.contract_end_date end,
    notice_period_months = case when 'notice_period_months' = any(c.framework_overrides) then notice_period_months else f.notice_period_months end,
    renewal_mode = case when 'renewal_mode' = any(c.framework_overrides) then renewal_mode else f.renewal_mode end,
    option_until = case when 'option_until' = any(c.framework_overrides) then option_until else f.option_until end,
    option_decision_deadline = case when 'option_decision_deadline' = any(c.framework_overrides) then option_decision_deadline else f.option_decision_deadline end,
    renewal_reminder_days = case when 'renewal_reminder_days' = any(c.framework_overrides) then renewal_reminder_days else f.renewal_reminder_days end,
    invoice_reference = case when 'invoice_reference' = any(c.framework_overrides) then invoice_reference else f.invoice_reference end,
    diary_number = case when 'diary_number' = any(c.framework_overrides) then diary_number else f.diary_number end,
    visit_frequency = case when 'visit_frequency' = any(c.framework_overrides) then visit_frequency else f.visit_frequency end,
    visits_per_year = case when 'visits_per_year' = any(c.framework_overrides) then visits_per_year else f.visits_per_year end,
    billing_frequency = case when 'billing_frequency' = any(c.framework_overrides) then billing_frequency else coalesce(f.billing_frequency, billing_frequency) end,
    billing_anchor_month = case when 'billing_anchor_month' = any(c.framework_overrides) then billing_anchor_month else coalesce(f.billing_anchor_month, billing_anchor_month) end
  where id = p_contract_id;
end;
$$;

-- Klienten skriver ett fält på ett avtal med ramavtal: eget värde = avvikelse,
-- null = ärv igen. Körs före uppdateringen så overrides och värden hänger ihop.
create or replace function public.trg_contract_framework_overrides()
returns trigger
language plpgsql
as $$
declare
  f public.framework_agreements;
  v_field text;
  v_new text;
  v_old text;
  v_fw text;
  v_over text[] := coalesce(new.framework_overrides, '{}');
begin
  if new.framework_id is null then
    new.framework_overrides := '{}';
    return new;
  end if;
  -- Nytt ramavtal: allt ärvs, resolvern fyller kolumnerna i AFTER-triggern
  if tg_op = 'INSERT' or new.framework_id is distinct from old.framework_id then
    new.framework_overrides := '{}';
    return new;
  end if;
  if pg_trigger_depth() > 1 then return new; end if;
  select * into f from public.framework_agreements where id = new.framework_id;
  if not found then return new; end if;
  foreach v_field in array public.framework_fields() loop
    execute format('select ($1).%I::text, ($2).%I::text, ($3).%I::text', v_field, v_field, v_field) into v_new, v_old, v_fw using new, old, f;
    if v_new is distinct from v_old then
      -- Fältet ändrades i den här skrivningen
      if v_new is null or v_new = v_fw then
        v_over := array_remove(v_over, v_field);
      else
        v_over := array_append(array_remove(v_over, v_field), v_field);
      end if;
    end if;
  end loop;
  new.framework_overrides := v_over;
  return new;
end;
$$;
drop trigger if exists contract_framework_overrides on public.contracts;
create trigger contract_framework_overrides
  before insert or update on public.contracts
  for each row execute function public.trg_contract_framework_overrides();

create or replace function public.trg_contract_framework_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if new.framework_id is not null then perform public.apply_framework_to_contract(new.id); end if;
  return null;
end;
$$;
drop trigger if exists contract_framework_apply on public.contracts;
create trigger contract_framework_apply
  after insert or update of framework_id, framework_overrides, price_list_id, contract_start_date, contract_end_date, notice_period_months,
    renewal_mode, option_until, option_decision_deadline, renewal_reminder_days, invoice_reference, diary_number,
    visit_frequency, visits_per_year, billing_frequency, billing_anchor_month on public.contracts
  for each row execute function public.trg_contract_framework_apply();

-- Ramavtalet ändras: alla avtal som ärver får de nya värdena
create or replace function public.trg_framework_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in select id from public.contracts where framework_id = new.id loop
    perform public.apply_framework_to_contract(r.id);
  end loop;
  new.updated_at := now();
  return null;
end;
$$;
drop trigger if exists framework_changed on public.framework_agreements;
create trigger framework_changed after update on public.framework_agreements
  for each row execute function public.trg_framework_changed();

-- Skapa ett ramavtal ur ett befintligt avtal och koppla avtalet
create or replace function public.create_framework_from_contract(p_contract_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare c public.contracts; v_id uuid;
begin
  if not public.intranet_is_internal() then raise exception 'Behörighet saknas'; end if;
  select * into c from public.contracts where id = p_contract_id;
  if not found then raise exception 'Avtalet hittades inte'; end if;
  insert into public.framework_agreements (name, diary_number, customer_id, organization_id, price_list_id, contract_start_date, contract_end_date,
    notice_period_months, renewal_mode, option_until, option_decision_deadline, renewal_reminder_days, invoice_reference,
    visit_frequency, visits_per_year, billing_frequency, billing_anchor_month, created_by_name)
  values (coalesce(nullif(p_name, ''), c.diary_number, 'Ramavtal'), c.diary_number, c.customer_id,
    (select organization_id from public.customers where id = c.customer_id), c.price_list_id, c.contract_start_date, c.contract_end_date,
    c.notice_period_months, c.renewal_mode, c.option_until, c.option_decision_deadline, c.renewal_reminder_days, c.invoice_reference,
    c.visit_frequency, c.visits_per_year, c.billing_frequency, c.billing_anchor_month, c.created_by_name)
  returning id into v_id;
  update public.contracts set framework_id = v_id where id = p_contract_id;
  return v_id;
end;
$$;
grant execute on function public.create_framework_from_contract(uuid, text) to authenticated;

-- Skriv avtalets nuvarande värden till ramavtalet: syskonen följer
create or replace function public.sync_framework_from_contract(p_contract_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  if not public.intranet_is_internal() then raise exception 'Behörighet saknas'; end if;
  select * into c from public.contracts where id = p_contract_id;
  if not found or c.framework_id is null then raise exception 'Avtalet har inget ramavtal'; end if;
  update public.framework_agreements set diary_number = c.diary_number, price_list_id = c.price_list_id, contract_start_date = c.contract_start_date, contract_end_date = c.contract_end_date,
    notice_period_months = c.notice_period_months, renewal_mode = c.renewal_mode, option_until = c.option_until, option_decision_deadline = c.option_decision_deadline,
    renewal_reminder_days = c.renewal_reminder_days, invoice_reference = c.invoice_reference, visit_frequency = c.visit_frequency, visits_per_year = c.visits_per_year,
    billing_frequency = c.billing_frequency, billing_anchor_month = c.billing_anchor_month, updated_at = now()
  where id = c.framework_id;
  update public.contracts set framework_overrides = '{}' where id = p_contract_id;
end; $$;
grant execute on function public.sync_framework_from_contract(uuid) to authenticated;
grant select, insert, update, delete on public.framework_agreements to authenticated;
