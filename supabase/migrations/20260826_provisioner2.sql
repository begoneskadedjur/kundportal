-- 20260826_provisioner2.sql
-- Provisioner 2.0: EN källa för utbetalningsmånad + backflytt vid makulerad faktura
-- + exportlogg för löneunderlag + spårbarhet vid utbetalning.
--
-- Regelbeslut (Christian): provision sammanställs till EN utbetalning per tekniker
-- och månad. Utbetalningsmånaden bestäms av när kundfakturan BETALAS, med brytdag
-- ur commission_settings.payout_cutoff_day (fallback 20):
--   * betald dag 1..brytdag  -> nästa månads lön        (t.ex. betald 2026-08-05, brytdag 20 -> 2026-09)
--   * betald efter brytdagen -> månaden därpå           (t.ex. betald 2026-08-25, brytdag 20 -> 2026-10)
-- Beräkningen finns på ETT ställe: compute_payout_month(). Trigger, service och UI
-- läser/skriver via den – aldrig egna +1-månadsimplementationer.

-- ────────────────────────────────────────────────────────────────────
-- 1) compute_payout_month(paid_date) -> 'YYYY-MM'
--    Läser brytdagen ur commission_settings (setting_key = 'payout_cutoff_day').
--    SECURITY DEFINER så att trigger (service_role) och admin-UI (rpc) kan läsa
--    settings oavsett RLS. STABLE: läser bara data, ändrar inget.
-- ────────────────────────────────────────────────────────────────────

create or replace function public.compute_payout_month(paid_date date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cutoff integer := 20;  -- fallback om inställningen saknas/är ogiltig
  v_raw numeric;
begin
  if paid_date is null then
    return null;
  end if;

  select setting_value::numeric into v_raw
  from commission_settings
  where setting_key = 'payout_cutoff_day';

  if v_raw is not null and v_raw >= 1 and v_raw <= 31 then
    v_cutoff := floor(v_raw)::integer;
  end if;

  if extract(day from paid_date)::integer <= v_cutoff then
    return to_char(date_trunc('month', paid_date::timestamp) + interval '1 month', 'YYYY-MM');
  else
    return to_char(date_trunc('month', paid_date::timestamp) + interval '2 months', 'YYYY-MM');
  end if;
end;
$$;

comment on function public.compute_payout_month(date) is
  'ENDA källan för provisionens utbetalningsmånad. Betald dag 1..brytdag -> nästa månad, efter brytdag -> månaden därpå. Brytdag ur commission_settings.payout_cutoff_day (fallback 20).';

grant execute on function public.compute_payout_month(date) to authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 2) handle_invoice_paid: ersätt den gamla "+1 månad"-logiken med
--    compute_payout_month(). Funktionen i övrigt identisk med
--    20260623_invoice_paid_automation.sql (pending_invoice-guard,
--    case_id-cast och kommentarslogik orörda).
-- ────────────────────────────────────────────────────────────────────

create or replace function public.handle_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_author uuid;
  v_moved integer := 0;
  v_payout_month text;
  v_comment_case_type text;
  v_amount_text text;
begin
  -- Ingen case-koppling -> inget att göra (t.ex. månadsbatch-adhoc utan case_id)
  if new.case_id is null then
    return new;
  end if;

  -- Provisioner 2.0: brytdagsregeln bor i compute_payout_month (ett ställe)
  v_payout_month := public.compute_payout_month(coalesce(new.paid_at, now())::date);

  -- 1) Flytta provision: bara poster som väntar på betalning
  update commission_posts cp
  set status = 'ready_for_payout',
      invoice_paid_date = coalesce(new.paid_at, now())::date,
      payout_month = v_payout_month,
      updated_at = now()
  where cp.case_id = new.case_id::text
    and cp.status = 'pending_invoice';

  get diagnostics v_moved = row_count;

  -- Härled case_type för kommentaren (case_comments.case_type är NOT NULL)
  v_comment_case_type := coalesce(new.case_type, 'contract');

  -- Svensk formatering: mellanslag som tusentalsavgränsare
  v_amount_text := replace(trim(to_char(coalesce(new.total_amount, 0), 'FM999G999G990')), ',', ' ');

  -- 2) Logga systemkommentar i kommunikationspanelen (en gång per faktura)
  if not exists (
    select 1 from case_comments
    where case_id = new.case_id
      and system_event_type = 'invoice_paid'
      and content like ('%' || coalesce(new.invoice_number, new.id::text) || '%')
  ) then
    select user_id into v_system_author from profiles where is_admin = true limit 1;

    if v_system_author is not null then
      insert into case_comments (
        case_id, case_type, author_id, author_name, author_role,
        content, is_system_comment, system_event_type,
        attachments, mentioned_user_ids, mentioned_roles, mentions_all
      ) values (
        new.case_id,
        v_comment_case_type,
        v_system_author,
        'System',
        'admin',
        'Faktura ' || coalesce(new.invoice_number, '') || ' betald (' || v_amount_text || ' kr)' ||
          case when v_moved > 0
               then ' — ' || v_moved || ' provisionspost' ||
                    case when v_moved = 1 then '' else 'er' end || ' flyttad till utbetalningsklar.'
               else '.' end,
        true,
        'invoice_paid',
        '[]'::jsonb, '{}'::uuid[], '{}'::text[], false
      );
    end if;
  end if;

  return new;
end;
$$;

-- Triggern (trg_invoice_paid) pekar redan på funktionen och behöver inte återskapas,
-- men görs om idempotent för säkerhets skull.
drop trigger if exists trg_invoice_paid on public.invoices;
create trigger trg_invoice_paid
  after update on public.invoices
  for each row
  when (old.status is distinct from new.status and new.status = 'paid')
  execute function public.handle_invoice_paid();

-- ────────────────────────────────────────────────────────────────────
-- 3) Backflytt vid makulerad faktura.
--    Faktura -> 'cancelled':
--      * ready_for_payout -> tillbaka till 'pending_invoice' med nollställd
--        payout_month + invoice_paid_date (betalningen gäller inte längre).
--      * pending_invoice  -> behåller status men payout_month + invoice_paid_date
--        nollställs (om de satts manuellt).
--    VARNING: poster i 'approved' eller 'paid_out' rörs AVSIKTLIGT INTE –
--    de är på väg in i eller redan med i ett löneunderlag och måste hanteras
--    manuellt (kreditering/lönejustering). Funktionen loggar en RAISE WARNING
--    i Postgres-loggen när sådana poster finns på en makulerad faktura.
-- ────────────────────────────────────────────────────────────────────

create or replace function public.handle_invoice_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked integer := 0;
begin
  if new.case_id is null then
    return new;
  end if;

  -- Backflytt: betald-markerade poster som ännu inte godkänts
  update commission_posts cp
  set status = 'pending_invoice',
      payout_month = null,
      invoice_paid_date = null,
      updated_at = now()
  where cp.case_id = new.case_id::text
    and cp.status = 'ready_for_payout';

  -- Städa: pending-poster ska inte bära betaldata från en makulerad faktura
  update commission_posts cp
  set payout_month = null,
      invoice_paid_date = null,
      updated_at = now()
  where cp.case_id = new.case_id::text
    and cp.status = 'pending_invoice'
    and (cp.payout_month is not null or cp.invoice_paid_date is not null);

  -- approved/paid_out rörs EJ – logga varning så det syns i DB-loggen
  select count(*) into v_locked
  from commission_posts cp
  where cp.case_id = new.case_id::text
    and cp.status in ('approved', 'paid_out');

  if v_locked > 0 then
    raise warning 'Faktura % makulerad: % provisionspost(er) i approved/paid_out rörs ej och kräver manuell hantering (case_id %)',
      coalesce(new.invoice_number, new.id::text), v_locked, new.case_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoice_cancelled on public.invoices;
create trigger trg_invoice_cancelled
  after update on public.invoices
  for each row
  when (old.status is distinct from new.status and new.status = 'cancelled')
  execute function public.handle_invoice_cancelled();

-- ────────────────────────────────────────────────────────────────────
-- 4) Exportlogg: varje löneunderlagsexport loggas (vem, när, vilka poster)
--    så samma post aldrig hamnar i två underlag utan spårbarhet.
--    RLS: samma profiles-mönster som case_updates_log/visits – admin + koordinator.
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.commission_export_log (
  id uuid primary key default gen_random_uuid(),
  exported_by uuid,
  exported_by_name text,
  exported_at timestamptz not null default now(),
  payout_month text,
  post_ids uuid[] not null default '{}'::uuid[],
  post_count integer not null default 0,
  total_amount numeric not null default 0
);

comment on table public.commission_export_log is
  'Logg över löneunderlagsexporter från /admin/provisioner: vem exporterade, när, vilken payout-månad och vilka commission_posts som ingick.';

alter table public.commission_export_log enable row level security;

drop policy if exists "commission_export_log_select_staff" on public.commission_export_log;
create policy "commission_export_log_select_staff" on public.commission_export_log
  for select using (exists (
    select 1 from profiles
    where profiles.user_id = auth.uid()
      and (profiles.is_admin = true or profiles.is_koordinator = true)
  ));

drop policy if exists "commission_export_log_insert_staff" on public.commission_export_log;
create policy "commission_export_log_insert_staff" on public.commission_export_log
  for insert with check (exists (
    select 1 from profiles
    where profiles.user_id = auth.uid()
      and (profiles.is_admin = true or profiles.is_koordinator = true)
  ));

create index if not exists idx_commission_export_log_month
  on public.commission_export_log (payout_month);

-- ────────────────────────────────────────────────────────────────────
-- 5) Spårbarhet vid utbetalning: vem markerade posten som utbetald.
-- ────────────────────────────────────────────────────────────────────

alter table public.commission_posts add column if not exists paid_out_by uuid;
alter table public.commission_posts add column if not exists paid_out_by_name text;

comment on column public.commission_posts.paid_out_by is 'profiles.user_id för den som markerade posten som utbetald';
comment on column public.commission_posts.paid_out_by_name is 'Visningsnamn (fryst) för den som markerade posten som utbetald';

-- ────────────────────────────────────────────────────────────────────
-- 6) Backfyllnad: räkna om payout_month enligt brytdagsregeln för poster
--    som ännu inte är utbetalda. paid_out-poster rörs EJ (lönehistorik –
--    deras payout_month speglar vad som faktiskt betalades ut).
-- ────────────────────────────────────────────────────────────────────

update commission_posts
set payout_month = public.compute_payout_month(invoice_paid_date),
    updated_at = now()
where invoice_paid_date is not null
  and status in ('ready_for_payout', 'approved')
  and payout_month is distinct from public.compute_payout_month(invoice_paid_date);
