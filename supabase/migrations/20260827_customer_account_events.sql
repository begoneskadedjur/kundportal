-- Kontohändelser för kundkonton: vad som skickats till en person och när.
--
-- Bakgrunden: inbjudningar och lösenordsutskick var osynliga i portalen.
-- create-multisite-users skapade konton utan att skriva en inbjudningsrad,
-- och send-new-password loggade bara till konsolen. I auth.audit_log_entries
-- syns utskicken som anonyma user_modified av service_role - ingen avsändare,
-- ingen orsak, omöjliga att skilja från ett e-postbyte.
--
-- Insert-only revisionslogg, samma mönster som intranet_acknowledgements.

create table if not exists public.customer_account_events (
  id uuid primary key default gen_random_uuid(),
  -- Personen händelsen gäller. Ingen FK mot auth.users: raden ska överleva
  -- att kontot raderas, annars förlorar vi just den historik som förklarar
  -- varför kontot ströks.
  user_id uuid not null,
  -- Kundraden personen hör till. Används för att hitta alla händelser i en
  -- kundfamilj utan att gå via profiles (som kan hinna ändras).
  customer_id uuid references public.customers(id) on delete set null,
  organization_id uuid,
  event_type text not null check (event_type in (
    'invited',          -- inbjudan skickad (konto skapat eller inbjudningslänk)
    'password_sent',    -- admin skickade nytt lösenord
    'email_changed',    -- e-postadressen byttes
    'role_changed',     -- roll eller enhetsomfattning ändrad
    'deactivated',      -- åtkomsten stängdes av
    'reactivated'       -- åtkomsten öppnades igen
  )),
  -- Snapshot: överlever att profilen ändras eller raderas.
  target_email text,
  target_name text,
  -- Vem som utförde händelsen. null = systemet (cron, webhook).
  actor_id uuid,
  actor_email text,
  -- Fritext för sammanhang, t.ex. "Regionchef - 4 enheter" eller gamla
  -- e-postadressen vid ett byte.
  note text,
  created_at timestamptz not null default now()
);

comment on table public.customer_account_events is
  'Insert-only logg över kontohändelser (inbjudan, lösenordsutskick, roll- och e-poständringar) för kund- och multisite-konton. Läses av kundkortets flik Åtkomst & konton.';

create index if not exists idx_cae_user on public.customer_account_events (user_id, created_at desc);
create index if not exists idx_cae_customer on public.customer_account_events (customer_id, created_at desc);
create index if not exists idx_cae_org on public.customer_account_events (organization_id, created_at desc)
  where organization_id is not null;

alter table public.customer_account_events enable row level security;

-- Admin och koordinator läser allt. Personen själv ser sina egna händelser.
-- Ingen UPDATE- eller DELETE-policy: händelserna är en revisionslogg.
drop policy if exists cae_select on public.customer_account_events;
create policy cae_select on public.customer_account_events
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_admin = true or p.role in ('admin', 'koordinator', 'säljare'))
    )
  );

-- Skrivning sker uteslutande från API:erna med service role, som går förbi RLS.
-- Policyn finns för tydlighet: ingen inloggad roll får skriva direkt.
drop policy if exists cae_no_client_insert on public.customer_account_events;
create policy cae_no_client_insert on public.customer_account_events
  for insert
  with check (false);

-- ---------------------------------------------------------------------------
-- Inloggningsstatistik ur auth.audit_log_entries.
--
-- Varken authenticated eller service_role har SELECT på auth-schemat, så
-- PostgREST kommer inte åt loggen. En SECURITY DEFINER-funktion i public är
-- enda vägen - samma mönster som befintliga get_user_login_status.

-- OBS prestanda: vi äger inte auth.audit_log_entries och kan därför inte
-- indexera den ("must be owner of table audit_log_entries"). Varje anrop blir
-- en seq scan - uppmätt till 226 ms över 13 789 rader 2026-08-27. Det håller
-- idag men växer linjärt med loggen. Blir det för trögt: låt ett cron-jobb
-- spegla login-raderna till en egen tabell i public som vi får indexera.

create or replace function public.get_customer_login_stats(p_user_ids uuid[])
returns table (
  user_id uuid,
  login_count bigint,
  first_login timestamptz,
  last_login timestamptz,
  active_months bigint,
  -- En rad per månad med minst en inloggning: {"month": "2026-02-01", "count": 6}
  monthly jsonb
)
language sql
security definer
set search_path = public, auth
stable
as $$
  -- SECURITY DEFINER kringgår RLS, så behörigheten måste kontrolleras här.
  -- Utan det kunde vilken inloggad användare som helst läsa av vem som
  -- helst annans inloggningsmönster.
  with allowed as (
    select exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_admin = true or p.role in ('admin', 'koordinator', 'säljare'))
    ) as ok
  ),
  logins as (
    select
      (a.payload ->> 'actor_id')::uuid as uid,
      a.created_at
    from auth.audit_log_entries a, allowed
    where allowed.ok
      and a.payload ->> 'action' = 'login'
      and (a.payload ->> 'actor_id')::uuid = any(p_user_ids)
  ),
  per_month as (
    select uid, date_trunc('month', created_at) as m, count(*) as c
    from logins
    group by uid, date_trunc('month', created_at)
  )
  select
    u.uid as user_id,
    count(l.created_at) as login_count,
    min(l.created_at) as first_login,
    max(l.created_at) as last_login,
    (select count(*) from per_month pm where pm.uid = u.uid) as active_months,
    coalesce(
      (select jsonb_agg(jsonb_build_object('month', pm.m, 'count', pm.c) order by pm.m)
       from per_month pm where pm.uid = u.uid),
      '[]'::jsonb
    ) as monthly
  from (select unnest(p_user_ids) as uid) u
  left join logins l on l.uid = u.uid
  group by u.uid;
$$;

comment on function public.get_customer_login_stats(uuid[]) is
  'Inloggningsstatistik per användare ur auth.audit_log_entries. SECURITY DEFINER eftersom auth-schemat inte är läsbart för vanliga roller.';

revoke all on function public.get_customer_login_stats(uuid[]) from public, anon;
grant execute on function public.get_customer_login_stats(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- multisite_user_invitations: två fel som gjorde tabellen omöjlig att skriva
-- till, och därför stod tom trots utskickade inbjudningar.

-- 1) upsert(onConflict: 'organization_id,email') i send-multisite-invitation.ts
--    förutsätter en unik constraint som saknades.
delete from public.multisite_user_invitations a
using public.multisite_user_invitations b
where a.ctid < b.ctid
  and a.organization_id = b.organization_id
  and lower(a.email) = lower(b.email);

alter table public.multisite_user_invitations
  drop constraint if exists multisite_user_invitations_org_email_key;
alter table public.multisite_user_invitations
  add constraint multisite_user_invitations_org_email_key
  unique (organization_id, email);

-- 2) Check-constrainten var kvar från en äldre rollnamngivning
--    (verksamhetsansvarig/platschef/tekniker/customer). Ingen av dem används
--    längre - multisite_user_roles har verksamhetschef/regionchef/platsansvarig.
alter table public.multisite_user_invitations
  drop constraint if exists multisite_user_invitations_role_type_check;
alter table public.multisite_user_invitations
  add constraint multisite_user_invitations_role_type_check
  check (role_type in ('verksamhetschef', 'regionchef', 'platsansvarig'));
