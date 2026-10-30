-- Steg 15 i docs/planer/avtalsar-exakt-arsdag-teknik.md:
-- nya avtal får avtalsdag och nya tilläggsregler från början.
-- Bara tillägg: en ny läsfunktion och en ny vakt vid INSERT. Inga befintliga
-- rader ändras, ingen drop.

-- 1. Tilläggsregler för ett nytt avtal på kunden.
--    'v2' (följer premien) när kunden, dess huvudkontor och dess enheter
--    saknar andra levande avtal med de gamla reglerna. Annars NULL:
--    sync_addon_prorata_line väljer version 2 för hela enheten så snart ett
--    avtal på enheten har 'v2', och då hade det gamla avtalets stationer
--    slutat få pro rata (contract_not_v2). Sådana kunder ställs om i datasteg 19.
create or replace function public.contract_default_addon_rules(
  p_customer_id uuid,
  p_exclude_contract_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_root uuid;
begin
  if auth.uid() is not null and not public.intranet_is_internal() then
    raise exception 'Behörighet saknas';
  end if;
  if p_customer_id is null then
    return 'v2';
  end if;
  select coalesce(c.parent_customer_id, c.id) into v_root from public.customers c where c.id = p_customer_id;
  if v_root is null then
    return 'v2';
  end if;
  if exists (
    select 1
    from public.contracts k
    where k.type = 'contract'
      and k.status in ('signed', 'active')
      and k.addon_rules is null
      and (p_exclude_contract_id is null or k.id <> p_exclude_contract_id)
      and k.customer_id in (
        select v_root
        union all
        select u.id from public.customers u where u.parent_customer_id = v_root
      )
  ) then
    return null;
  end if;
  return 'v2';
end $$;

revoke all on function public.contract_default_addon_rules(uuid, uuid) from public, anon;
grant execute on function public.contract_default_addon_rules(uuid, uuid) to authenticated, service_role;

-- 2. Vakt vid INSERT (steg 12:s vakt contract_billing_mode_guard gäller bara
--    UPDATE). En inloggad användare får skapa ett avtal med avtalsdagen och de
--    nya tilläggsreglerna (beslutets standard), men aldrig med
--    kontrollmarkeringen satt, och 'v2' bara när kunden får det enligt
--    contract_default_addon_rules. Service role och SQL-editorn (signeringen,
--    importer, datasteg) släpps igenom som i steg 12.
create or replace function public.trg_contract_billing_mode_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(current_setting('app.contract_billing_rpc', true), '') = 'on' then
    return new;
  end if;
  if new.billing_anchor_verified_at is not null
     or new.billing_anchor_verified_by is not null
     or new.billing_anchor_verified_note is not null then
    raise exception using errcode = '42501',
      message = 'Avtalsdagen markeras som kontrollerad i avtalskartan under Fakturering (kräver befogenheten att godkänna fakturor).';
  end if;
  if new.addon_rules = 'v2' and public.contract_default_addon_rules(new.customer_id, new.id) is distinct from 'v2' then
    raise exception using errcode = '42501',
      message = 'Kunden har ett annat avtal med de gamla tilläggsreglerna. Nya tilläggsregler väljs i avtalskartan under Fakturering.';
  end if;
  return new;
end $$;

revoke all on function public.trg_contract_billing_mode_insert_guard() from public, anon, authenticated;

create or replace trigger contract_billing_mode_insert_guard
  before insert on public.contracts
  for each row execute function public.trg_contract_billing_mode_insert_guard();
