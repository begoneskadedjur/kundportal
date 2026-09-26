-- Search Console-data för begone.se
-- Cron-jobbet api/cron/sync-search-console.ts hämtar Search Analytics (searchType web,
-- dataState final) en gång per dygn och upsertar hit med service role. ?backfill=1
-- fyller 16 månader bakåt i etapper och sparar var den är i gsc_synk_status.
--
-- Datumen är Search Consoles egna datum (Stillahavstid enligt Google), lagrade som date.
-- sida är normaliserad: https://begone.se och https://www.begone.se är bortplockade,
-- avslutande snedstreck behålls. Adresser på andra värdnamn behålls hela.
-- Sökdata är intern: bara admin läser, bara service role skriver, anon får inget.

create table if not exists public.gsc_sida_fraga_manad (
  manad      date    not null,              -- första dagen i månaden
  sida       text    not null,
  fraga      text    not null,
  klick      integer not null default 0,
  visningar  integer not null default 0,
  ctr        numeric,
  position   numeric,
  hamtad_at  timestamptz not null default now(),
  primary key (manad, sida, fraga)
);

create table if not exists public.gsc_sida_dag (
  dag        date    not null,
  sida       text    not null,
  klick      integer not null default 0,
  visningar  integer not null default 0,
  ctr        numeric,
  position   numeric,
  hamtad_at  timestamptz not null default now(),
  primary key (dag, sida)
);

create table if not exists public.gsc_fraga_dag (
  dag        date    not null,
  fraga      text    not null,
  klick      integer not null default 0,
  visningar  integer not null default 0,
  ctr        numeric,
  position   numeric,
  hamtad_at  timestamptz not null default now(),
  primary key (dag, fraga)
);

-- Ett rad per läge: 'daglig' och 'backfill'. Backfill-raden bär progress mellan anropen.
create table if not exists public.gsc_synk_status (
  id              text primary key check (id in ('daglig', 'backfill')),
  fas             text,                   -- backfill: manad | sida_dag | fraga_dag | klar
  nasta_datum     date,                   -- backfill: första dagen i nästa månad att hämta i aktuell fas
  fonster_start   date,
  fonster_slut    date,
  klar            boolean not null default false,
  senast_start_at timestamptz,
  senast_klar_at  timestamptz,
  senast_fel      text,
  rader           jsonb,                  -- antal rader per steg i senaste körningen
  uppdaterad_at   timestamptz not null default now()
);

create index if not exists gsc_sida_fraga_manad_sida_idx  on public.gsc_sida_fraga_manad (sida, manad);
create index if not exists gsc_sida_fraga_manad_fraga_idx on public.gsc_sida_fraga_manad (fraga, manad);
create index if not exists gsc_sida_dag_sida_idx          on public.gsc_sida_dag (sida, dag);
create index if not exists gsc_fraga_dag_fraga_idx        on public.gsc_fraga_dag (fraga, dag);

comment on table public.gsc_sida_fraga_manad is 'Search Console per månad, sida och fråga för begone.se. Skrivs av cron sync-search-console. Intern, bara admin läser.';
comment on table public.gsc_sida_dag is 'Search Console per dag och sida för begone.se. Skrivs av cron sync-search-console. Intern, bara admin läser.';
comment on table public.gsc_fraga_dag is 'Search Console per dag och fråga för begone.se. Skrivs av cron sync-search-console. Intern, bara admin läser.';
comment on table public.gsc_synk_status is 'Status och backfill-progress för cron sync-search-console.';

alter table public.gsc_sida_fraga_manad enable row level security;
alter table public.gsc_sida_dag enable row level security;
alter table public.gsc_fraga_dag enable row level security;
alter table public.gsc_synk_status enable row level security;

-- Läsning för admin. Inga skrivpolicies: bara service role (går förbi RLS) skriver.
create policy gsc_sida_fraga_manad_admin_las on public.gsc_sida_fraga_manad
  for select to authenticated using (public.is_current_user_admin());
create policy gsc_sida_dag_admin_las on public.gsc_sida_dag
  for select to authenticated using (public.is_current_user_admin());
create policy gsc_fraga_dag_admin_las on public.gsc_fraga_dag
  for select to authenticated using (public.is_current_user_admin());
create policy gsc_synk_status_admin_las on public.gsc_synk_status
  for select to authenticated using (public.is_current_user_admin());

revoke all on public.gsc_sida_fraga_manad from anon;
revoke all on public.gsc_sida_dag from anon;
revoke all on public.gsc_fraga_dag from anon;
revoke all on public.gsc_synk_status from anon;
revoke insert, update, delete, truncate on public.gsc_sida_fraga_manad from authenticated;
revoke insert, update, delete, truncate on public.gsc_sida_dag from authenticated;
revoke insert, update, delete, truncate on public.gsc_fraga_dag from authenticated;
revoke insert, update, delete, truncate on public.gsc_synk_status from authenticated;
grant select on public.gsc_sida_fraga_manad to authenticated;
grant select on public.gsc_sida_dag to authenticated;
grant select on public.gsc_fraga_dag to authenticated;
grant select on public.gsc_synk_status to authenticated;
grant all on public.gsc_sida_fraga_manad, public.gsc_sida_dag, public.gsc_fraga_dag, public.gsc_synk_status to service_role;
