-- 20261006_cookie_consents_statistik.sql
-- Fält för en framtida statistiksida över samtycken (motsvarar det CookieYes visade):
-- land (ur Vercels x-vercel-ip-country, aldrig IP), status och vilken sorts val det var.
-- Inga sidvisningar loggas: en rad skrivs bara när besökaren gör ett val.

alter table public.cookie_consents add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
alter table public.cookie_consents add column if not exists status text check (status in ('accepted', 'rejected', 'partial'));
alter table public.cookie_consents add column if not exists action text check (action in ('first_choice', 'changed', 'withdrawn'));
create index if not exists cookie_consents_created_at_idx on public.cookie_consents (created_at desc);

comment on column public.cookie_consents.country is 'Landskod (ISO 3166-1 alfa-2) ur Vercels x-vercel-ip-country. IP-adressen sparas aldrig.';
comment on column public.cookie_consents.status is 'accepted: alla valbara kategorier som används, rejected: bara nödvändiga, partial: något men inte allt.';
comment on column public.cookie_consents.action is 'first_choice: första valet (eller nytt efter 12 månader eller ny version), changed: ändrat val, withdrawn: samtycke till marknadsföring återkallat.';
