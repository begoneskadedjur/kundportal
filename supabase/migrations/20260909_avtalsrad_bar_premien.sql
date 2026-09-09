-- Avtalstypen bär premien: § 4 får en bärande rad per avtal
--
-- Modell (docs/paragraf-4-7-2-rollfordelning.md, tillägg 2026-09-09):
--   § 7 äger priset (annual_value + contract_premium_events).
--   § 4 äger innehåll och kostnad. Varje avtal med avtalstyp har exakt en
--   bärande rad (tjänsten med is_contract_service som matchar typen). Raden
--   lagrar ALDRIG ett belopp utan en andel av premien (premium_share); den
--   bärande raden är restposten: 1 minus övriga raders andelar. Övriga
--   § 4-rader har andel 0 som standard (ingår utan debitering).
--   contracts.display_name: användarsatt namn som skyddas mot Oneflow-synk,
--   används på fakturaraden ("Årspremie <namn>") och i listor.

alter table public.contracts add column if not exists display_name text;
comment on column public.contracts.display_name is 'Avtalets namn, satt av användaren. Tomt = avtalstypen. Skrivs aldrig av synk.';

alter table public.case_billing_items add column if not exists premium_share numeric;
alter table public.case_billing_items add column if not exists is_premium_carrier boolean not null default false;
comment on column public.case_billing_items.premium_share is 'Andel av årspremien (0..1) för en § 4-rad. Null = 0. Bärande raden räknas som rest.';
comment on column public.case_billing_items.is_premium_carrier is 'Bärande § 4-rad: avtalstypens tjänst. Beloppet är härlett ur § 7, aldrig lagrat.';

alter table public.case_billing_items drop constraint if exists cbi_premium_share_range;
alter table public.case_billing_items add constraint cbi_premium_share_range
  check (premium_share is null or (premium_share >= 0 and premium_share <= 1));

-- Högst en bärande rad per avtal (bland icke-makulerade)
create unique index if not exists cbi_one_premium_carrier_per_contract
  on public.case_billing_items (case_id)
  where is_premium_carrier and case_type = 'contract' and status <> 'cancelled';

-- Skapa eller uppdatera den bärande raden för ett avtal. Byte av avtalstyp
-- byter tjänst på den befintliga raden, aldrig en ny rad (annars dubblas
-- fakturan). Avropsavtal och avtal utan känd typ får ingen rad.
create or replace function public.ensure_contract_carrier_row(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  s record;
  v_existing uuid;
  v_same_service uuid;
begin
  select id, customer_id, contract_type, label, status into c from public.contracts where id = p_contract_id;
  if c.id is null then return; end if;
  if coalesce(c.contract_type, c.label) is null then return; end if;
  if coalesce(c.contract_type, c.label) ilike 'Avropsavtal%' then return; end if;

  select id, code, name into s from public.services
  where is_active and is_contract_service and name = coalesce(c.contract_type, c.label)
  order by created_at limit 1;
  if s.id is null then return; end if;

  select id into v_existing from public.case_billing_items
  where case_id = p_contract_id and case_type = 'contract' and is_premium_carrier and status <> 'cancelled'
  limit 1;

  if v_existing is not null then
    update public.case_billing_items
      set service_id = s.id, service_code = s.code, service_name = s.name, article_name = s.name, updated_at = now()
    where id = v_existing;
    return;
  end if;

  -- Finns tjänsten redan som vanlig premierad blir den bärande
  select id into v_same_service from public.case_billing_items
  where case_id = p_contract_id and case_type = 'contract' and item_type = 'service'
    and status <> 'cancelled' and coalesce(billing_model, 'premium') = 'premium' and service_id = s.id
  order by created_at limit 1;

  if v_same_service is not null then
    update public.case_billing_items set is_premium_carrier = true, premium_share = null, updated_at = now() where id = v_same_service;
    return;
  end if;

  insert into public.case_billing_items (
    case_id, case_type, customer_id, item_type, service_id, service_code, service_name, article_name,
    quantity, unit_price, discount_percent, discounted_price, total_price, vat_rate, price_source,
    status, requires_approval, billing_model, is_premium_carrier, premium_share
  ) values (
    p_contract_id, 'contract', c.customer_id, 'service', s.id, s.code, s.name, s.name,
    1, 0, 0, 0, 0, 25, 'standard',
    'pending', false, 'premium', true, null
  );
end;
$$;

create or replace function public.contracts_ensure_carrier_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_contract_carrier_row(new.id);
  return new;
end;
$$;

drop trigger if exists trg_contracts_ensure_carrier on public.contracts;
create trigger trg_contracts_ensure_carrier
  after insert or update of contract_type, label on public.contracts
  for each row execute function public.contracts_ensure_carrier_trigger();

-- Backfill: alla aktiva avtal med avtalstyp får sin bärande rad. Avtal med
-- tom § 4 fakturerar exakt som förut (en rad "Årspremie ..."). Rader som
-- tidigare bar ett pris behåller sitt unit_price som historik men räknas
-- inte längre in; § 4 flaggar dem för granskning.
do $$
declare r record;
begin
  for r in select id from public.contracts where status = 'active' loop
    perform public.ensure_contract_carrier_row(r.id);
  end loop;
end $$;
