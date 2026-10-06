-- 20261006_cookie_consents.sql
-- Bevis på cookiesamtycke från begone.se (cookiebannern, Google Consent Mode v2).
-- Skrivs bara av det publika API:t api/samtycke.ts med service role. Ingen IP-adress och inga
-- personuppgifter: ett slumpat id per webbläsare, bannerns version, valen, tidpunkt och sidans sökväg.
-- RLS på: ingen åtkomst för anon, läsning för admin, koordinator och säljare (is_web_inquiry_staff).
-- Inga DROP-satser.

create table if not exists public.cookie_consents (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  samtyckes_id uuid not null,
  version integer not null check (version between 1 and 1000),
  nodvandiga boolean not null default true,
  statistik boolean not null default false,
  marknadsforing boolean not null default false,
  handling text not null check (handling in ('godkann_alla', 'neka', 'eget_val')),
  lager text not null check (lager in ('banner', 'installningar')),
  sida text check (sida is null or char_length(sida) <= 300)
);

create index if not exists cookie_consents_samtyckes_id_idx on public.cookie_consents (samtyckes_id, created_at desc);
create index if not exists cookie_consents_created_at_idx on public.cookie_consents (created_at desc);

comment on table public.cookie_consents is 'Bevis på cookiesamtycke från begone.se. Skrivs bara av api/samtycke.ts (service role). Ingen IP, inga personuppgifter.';
comment on column public.cookie_consents.samtyckes_id is 'Slumpat id som webbläsaren sparar ihop med valet (localStorage begone-samtycke). Knyter ihop ändringar av samma val.';

alter table public.cookie_consents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cookie_consents' and policyname = 'cookie_consents_select_staff'
  ) then
    create policy cookie_consents_select_staff on public.cookie_consents
      for select to authenticated
      using (public.is_web_inquiry_staff());
  end if;
end $$;

revoke all on public.cookie_consents from anon;
revoke insert, update, delete on public.cookie_consents from authenticated;
