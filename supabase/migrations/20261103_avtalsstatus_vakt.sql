-- Avtalsstatus: logg och spärr (3.118.0, 2026-11-03)
--
-- Princip (Christian 2026-11-03): Oneflow används bara fram till signering.
-- Efter signering styr portalen statusen, och bara Säga upp avslutar ett avtal.
-- Bakgrund: den gamla nattsynken trashade löpande avtal som saknades i
-- Oneflow-listan (docs/planer/utredning-avslutade-avtal-2026-11-03.md).
--
-- (a) contracts_status_log: varje statusändring på contracts skrivs i
--     contract_events (gammal och ny status, tid, auth.uid() eller 'system',
--     källa). Källan läses ur set_config('app.status_source', ..., true) eller
--     ur anropets header x-status-source (PostgREST, bara för loggen).
-- (b) contracts_status_guard: ett avtal (type 'contract') med status signed
--     eller active får ny status ended, trashed eller declined bara när
--     terminated_at är satt (Säg upp, expire-contracts) eller när källan är
--     'replaced' (ersatt av nytt avtal), 'manual' (administratör via
--     contract_set_status_manual) eller 'expire'. Allt annat stoppas.
-- (c) RPC:erna contract_mark_replaced (avtalskartans "ersatt av nytt avtal")
--     och contract_set_status_manual (administratör), som sätter källan i
--     samma transaktion. Webbklienten kan inte sätta config själv.
--
-- Bara tillägg: nya funktioner och triggers, inga ändrade rader.

-- Källan för en statusändring: sessionsinställningen först, sedan headern
create or replace function public.contract_status_source()
returns text
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v text := nullif(current_setting('app.status_source', true), '');
  h text;
begin
  if v is not null then
    return v;
  end if;
  h := nullif(current_setting('request.headers', true), '');
  if h is not null then
    begin
      v := nullif(h::json ->> 'x-status-source', '');
    exception when others then
      v := null;
    end;
  end if;
  return v;
end $$;

-- Statusen på svenska för loggen
create or replace function public.contract_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'draft' then 'Utkast'
    when 'pending' then 'Skickat'
    when 'overdue' then 'Signeringstiden ute'
    when 'signed' then 'Signerat'
    when 'active' then 'Aktivt'
    when 'ended' then 'Avslutat'
    when 'trashed' then 'Borttaget'
    when 'declined' then 'Avböjt'
    else coalesce(p_status, 'ingen status')
  end
$$;

-- (b) Spärren
create or replace function public.trg_contracts_status_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  -- Spärren godtar bara sessionsinställningen, inte headern
  v_src text := nullif(current_setting('app.status_source', true), '');
begin
  if coalesce(old.type, 'contract') = 'contract'
     and old.status in ('signed', 'active')
     and new.status in ('ended', 'trashed', 'declined')
     and new.terminated_at is null
     and coalesce(v_src, '') not in ('replaced', 'manual', 'expire') then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Avtalet är %s och kan inte få status %s här. Ett signerat avtal avslutas bara med Säg upp på avtalskartan, när uppsägningstiden löpt ut eller när det ersätts av ett nytt avtal.',
        lower(public.contract_status_label(old.status)),
        lower(public.contract_status_label(new.status))),
      hint = 'contracts_status_guard';
  end if;
  return new;
end $$;

-- Namnet sorterar sist bland BEFORE-triggarna, så den ser slutlig status
create trigger contracts_status_guard
  before update on public.contracts
  for each row
  when (old.status is distinct from new.status)
  execute function public.trg_contracts_status_guard();

-- (a) Loggen
create or replace function public.trg_contracts_status_log()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_src text := public.contract_status_source();
begin
  if v_uid is not null then
    select coalesce(nullif(p.display_name, ''), p.email) into v_name
    from public.profiles p where p.user_id = v_uid limit 1;
  end if;
  insert into public.contract_events (contract_id, event_type, title, detail, metadata, created_by, created_by_name)
  values (
    new.id,
    'other',
    'Status ändrad',
    format('%s till %s', public.contract_status_label(old.status), lower(public.contract_status_label(new.status)))
      || case when v_src is not null then format(' (källa: %s)', v_src) else '' end,
    jsonb_build_object(
      'kind', 'status_change',
      'from', old.status,
      'to', new.status,
      'source', v_src,
      'by', coalesce(v_uid::text, 'system'),
      'db_role', current_user,
      'terminated_at', new.terminated_at
    ),
    v_uid,
    coalesce(v_name, case when v_uid is null then 'system' end)
  );
  return null;
exception when others then
  -- Loggen får aldrig stoppa en statusändring
  raise warning 'contracts_status_log: % (%)', sqlerrm, sqlstate;
  return null;
end $$;

create trigger contracts_status_log
  after update on public.contracts
  for each row
  when (old.status is distinct from new.status)
  execute function public.trg_contracts_status_log();

-- (c) Ersatt av nytt avtal (ContractScopeService.inheritHistory). Körs som
-- anroparen (RLS på contracts gäller som förut).
create or replace function public.contract_mark_replaced(p_from uuid, p_to uuid)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_n int;
begin
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'Ange det gamla och det nya avtalet';
  end if;
  perform set_config('app.status_source', 'replaced', true);
  update public.contracts
     set status = 'ended',
         termination_reason = 'Ersatt av nytt avtal i portalen',
         updated_at = now()
   where id = p_from;
  get diagnostics v_n = row_count;
  perform set_config('app.status_source', '', true);
  if v_n = 0 then
    raise exception 'Det gamla avtalet kunde inte uppdateras (0 rader)';
  end if;
  insert into public.contract_events (contract_id, event_type, title, detail, metadata, created_by, created_by_name)
  values (
    p_from, 'other', 'Ersatt av nytt avtal',
    'Historiken flyttades till det nya avtalet och den här raden avslutades.',
    jsonb_build_object('kind', 'replaced', 'replaced_by', p_to),
    auth.uid(),
    (select coalesce(nullif(p.display_name, ''), p.email) from public.profiles p where p.user_id = auth.uid() limit 1)
  );
end $$;

-- (c) Administratör avslutar ett avtal för hand (rättelser). Ingen UI-väg
-- använder den i dag; vanliga avslut görs med Säg upp.
create or replace function public.contract_set_status_manual(p_contract_id uuid, p_status text, p_reason text)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_n int;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and (p.is_admin = true or p.role = 'admin')
  ) then
    raise exception using errcode = '42501', message = 'Bara administratörer kan ändra avtalsstatus för hand.';
  end if;
  if p_status not in ('ended', 'trashed', 'declined') then
    raise exception 'Bara ended, trashed eller declined kan sättas här';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Ange ett skäl';
  end if;
  perform set_config('app.status_source', 'manual', true);
  update public.contracts set status = p_status, updated_at = now() where id = p_contract_id;
  get diagnostics v_n = row_count;
  perform set_config('app.status_source', '', true);
  if v_n = 0 then
    raise exception 'Avtalet kunde inte uppdateras (0 rader)';
  end if;
  insert into public.contract_events (contract_id, event_type, title, detail, metadata, created_by, created_by_name)
  values (
    p_contract_id, 'other', 'Status ändrad för hand', btrim(p_reason),
    jsonb_build_object('kind', 'manual_status', 'to', p_status),
    auth.uid(),
    coalesce((select coalesce(nullif(p.display_name, ''), p.email) from public.profiles p where p.user_id = auth.uid() limit 1), 'system')
  );
end $$;

revoke all on function public.contract_mark_replaced(uuid, uuid) from public, anon;
grant execute on function public.contract_mark_replaced(uuid, uuid) to authenticated, service_role;
revoke all on function public.contract_set_status_manual(uuid, text, text) from public, anon;
grant execute on function public.contract_set_status_manual(uuid, text, text) to authenticated, service_role;
