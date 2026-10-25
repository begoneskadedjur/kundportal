-- 20261025_rabatt_godkannande.sql
-- Rabatt i prisguiden med godkännande (3.97.0).
--
-- Rabatten ges i procent per tjänsterad (case_billing_items.discount_percent).
-- Varje rabatt godkänns av en rabattansvarig (profiles.can_approve_discounts),
-- även den som själv gav rabatten får godkänna. Godkännandet ligger på raden:
--   discount_approved_by       auth.uid() för den som godkände
--   discount_approved_by_name  namnet som visas ("Godkänd av N, ÅÅÅÅ-MM-DD")
--   discount_approved_at       när
--   discount_rejected_reason   avslagets anledning (raden väntar kvar)
--   discount_source_item_id    raden rabatten kopierades från (Boka in, offert
--                              ur ärende). Är källan godkänd med samma procent
--                              ärvs godkännandet.
--
-- Triggern äger requires_approval: klienten kan aldrig själv sätta false på en
-- rabattrad. Bara RPC:erna nedan (som kräver can_approve_discounts) släpper
-- spärren, via current_setting('app.discount_approval') = 'on' i transaktionen.
-- Avtalstillägg (contract_addition_annual) är ALDRIG rabatt.

alter table public.case_billing_items
  add column if not exists discount_approved_by uuid,
  add column if not exists discount_approved_by_name text,
  add column if not exists discount_approved_at timestamptz,
  add column if not exists discount_rejected_reason text,
  add column if not exists discount_rejected_by_name text,
  add column if not exists discount_rejected_at timestamptz,
  add column if not exists discount_source_item_id uuid;

comment on column public.case_billing_items.discount_approved_by is 'auth.uid() för rabattansvarig som godkände rabatten (sätts bara av approve_*_discounts)';
comment on column public.case_billing_items.discount_source_item_id is 'Raden rabatten kopierades från; godkännandet ärvs om källan är godkänd med samma procent';

create index if not exists case_billing_items_requires_approval_idx
  on public.case_billing_items (case_type, case_id)
  where requires_approval;

create or replace function public.cbi_discount_approval()
returns trigger
language plpgsql
-- security definer: källraden ska kunna läsas även när den ligger utanför
-- användarens RLS (bara läsning, raden som skrivs är alltid NEW)
security definer
set search_path = public
as $$
declare
  v_is_discount boolean := coalesce(new.discount_percent, 0) > 0 and new.contract_addition_annual is null;
  -- Ärvt godkännande: kopierad rad (discount_source_item_id) eller ROT/RUT-
  -- arbetsrad (labor_for_item_id) vars tjänsterad är godkänd med samma procent
  v_source_id uuid := coalesce(new.discount_source_item_id, new.labor_for_item_id);
  v_source record;
  v_reset boolean;
begin
  -- Godkännande-RPC:erna skriver fälten själva
  if coalesce(current_setting('app.discount_approval', true), '') = 'on' then
    return new;
  end if;

  -- INSERT, eller UPDATE med ny procent (eller raden blir/slutar vara
  -- avtalstillägg): godkännandet börjar om
  if tg_op = 'INSERT' then
    v_reset := true;
  else
    v_reset := new.discount_percent is distinct from old.discount_percent
      or (new.contract_addition_annual is null) is distinct from (old.contract_addition_annual is null);
  end if;

  if v_reset then
    if v_is_discount and v_source_id is not null and v_source_id <> new.id then
      select s.discount_percent, s.requires_approval, s.discount_approved_by,
             s.discount_approved_by_name, s.discount_approved_at
        into v_source
        from public.case_billing_items s
       where s.id = v_source_id;
      if found
         and v_source.requires_approval = false
         and v_source.discount_approved_at is not null
         and v_source.discount_percent = new.discount_percent then
        new.requires_approval := false;
        new.discount_approved_by := v_source.discount_approved_by;
        new.discount_approved_by_name := v_source.discount_approved_by_name;
        new.discount_approved_at := v_source.discount_approved_at;
        new.discount_rejected_reason := null;
        new.discount_rejected_by_name := null;
        new.discount_rejected_at := null;
        return new;
      end if;
    end if;
    new.requires_approval := v_is_discount;
    new.discount_approved_by := null;
    new.discount_approved_by_name := null;
    new.discount_approved_at := null;
    new.discount_rejected_reason := null;
    new.discount_rejected_by_name := null;
    new.discount_rejected_at := null;
    return new;
  end if;

  -- Annars ligger godkännandet kvar som det var, oavsett vad klienten skickar
  new.requires_approval := case when v_is_discount then old.requires_approval else false end;
  new.discount_approved_by := old.discount_approved_by;
  new.discount_approved_by_name := old.discount_approved_by_name;
  new.discount_approved_at := old.discount_approved_at;
  new.discount_rejected_reason := old.discount_rejected_reason;
  new.discount_rejected_by_name := old.discount_rejected_by_name;
  new.discount_rejected_at := old.discount_rejected_at;
  return new;
end;
$$;

create or replace trigger trg_cbi_discount_approval
  before insert or update on public.case_billing_items
  for each row execute function public.cbi_discount_approval();

-- ─── Behörighet ───

create or replace function public.can_approve_discounts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.can_approve_discounts
      from public.profiles p
     where p.user_id = (select auth.uid())
     limit 1
  ), false);
$$;

-- ─── Godkänn rader (offerter och avtal, ärenden) ───
-- Arbetsrader (labor_for_item_id) med samma procent följer sin tjänsterad.
create or replace function public.approve_billing_discounts(p_item_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_count integer;
begin
  if not public.can_approve_discounts() then
    raise exception 'Bara rabattansvariga kan godkänna rabatter' using errcode = '42501';
  end if;
  select coalesce(nullif(trim(p.display_name), ''), p.email, 'Rabattansvarig')
    into v_name
    from public.profiles p
   where p.user_id = auth.uid()
   limit 1;

  perform set_config('app.discount_approval', 'on', true);
  update public.case_billing_items c
     set requires_approval = false,
         discount_approved_by = auth.uid(),
         discount_approved_by_name = v_name,
         discount_approved_at = now(),
         discount_rejected_reason = null,
         discount_rejected_by_name = null,
         discount_rejected_at = null,
         updated_at = now()
   where c.requires_approval
     and coalesce(c.discount_percent, 0) > 0
     and c.contract_addition_annual is null
     and (
       c.id = any(p_item_ids)
       or exists (
         select 1 from public.case_billing_items parent
          where parent.id = c.labor_for_item_id
            and parent.id = any(p_item_ids)
            and parent.discount_percent = c.discount_percent
       )
     );
  get diagnostics v_count = row_count;
  perform set_config('app.discount_approval', 'off', true);
  return v_count;
end;
$$;

-- ─── Avslå rader: raden väntar kvar med anledningen ───
create or replace function public.reject_billing_discounts(p_item_ids uuid[], p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_count integer;
begin
  if not public.can_approve_discounts() then
    raise exception 'Bara rabattansvariga kan avslå rabatter' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Ange en anledning till avslaget' using errcode = '22023';
  end if;
  select coalesce(nullif(trim(p.display_name), ''), p.email, 'Rabattansvarig')
    into v_name
    from public.profiles p
   where p.user_id = auth.uid()
   limit 1;

  perform set_config('app.discount_approval', 'on', true);
  update public.case_billing_items c
     set requires_approval = true,
         discount_approved_by = null,
         discount_approved_by_name = null,
         discount_approved_at = null,
         discount_rejected_reason = trim(p_reason),
         discount_rejected_by_name = v_name,
         discount_rejected_at = now(),
         updated_at = now()
   where coalesce(c.discount_percent, 0) > 0
     and c.contract_addition_annual is null
     and (
       c.id = any(p_item_ids)
       or exists (
         select 1 from public.case_billing_items parent
          where parent.id = c.labor_for_item_id
            and parent.id = any(p_item_ids)
            and parent.discount_percent = c.discount_percent
       )
     );
  get diagnostics v_count = row_count;
  perform set_config('app.discount_approval', 'off', true);
  return v_count;
end;
$$;

-- ─── Godkänn fakturans rabatter (InvoiceService.approveInvoice) ───
-- Ingen väntande rabatt: inget händer (premiefakturor, vanliga fakturor).
-- Väntande rabatt och användaren är inte rabattansvarig: fel, fakturan
-- kan inte godkännas förbi rabatten.
create or replace function public.approve_invoice_discounts(p_invoice_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select array_agg(distinct c.id)
    into v_ids
    from public.invoice_items ii
    join public.case_billing_items c on c.id = ii.case_billing_item_id
   where ii.invoice_id = p_invoice_id
     and c.requires_approval
     and coalesce(c.discount_percent, 0) > 0
     and c.contract_addition_annual is null;

  if v_ids is null or array_length(v_ids, 1) is null then
    return 0;
  end if;
  if not public.can_approve_discounts() then
    raise exception 'Fakturan har en rabatt som väntar på godkännande av rabattansvarig' using errcode = '42501';
  end if;
  return public.approve_billing_discounts(v_ids);
end;
$$;

revoke all on function public.approve_billing_discounts(uuid[]) from public, anon;
revoke all on function public.reject_billing_discounts(uuid[], text) from public, anon;
revoke all on function public.approve_invoice_discounts(uuid) from public, anon;
grant execute on function public.can_approve_discounts() to authenticated;
grant execute on function public.approve_billing_discounts(uuid[]) to authenticated;
grant execute on function public.reject_billing_discounts(uuid[], text) to authenticated;
grant execute on function public.approve_invoice_discounts(uuid) to authenticated;
