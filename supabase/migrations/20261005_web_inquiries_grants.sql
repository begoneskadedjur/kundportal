-- 20261005_web_inquiries_grants.sql
-- Leads (Webb), säkerhetsgranskningen 2026-10-05: smalare tabellrättigheter som skydd utöver RLS.
-- Supabase ger anon och authenticated alla rättigheter på nya tabeller (även TRUNCATE, som RLS inte
-- stoppar). anon behöver ingenting här: förfrågningarna skrivs av api/forfragan.ts med service role.
-- Inloggad personal läser och ändrar förfrågningar och skriver anteckningar; resten går via RLS.
-- Inga DROP-satser.

revoke all on table public.web_inquiries from anon;
revoke all on table public.web_inquiry_events from anon;

revoke insert, delete, truncate, references, trigger on table public.web_inquiries from authenticated;
grant select, update on table public.web_inquiries to authenticated;

revoke update, delete, truncate, references, trigger on table public.web_inquiry_events from authenticated;
grant select, insert on table public.web_inquiry_events to authenticated;
