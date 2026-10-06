-- Gallring av samtyckesloggen: val sparas i tre år (beslut 2026-10-06, står i
-- integritetspolicyn på begone.se, avsnitt 6). Körs varje natt 03:15 UTC.
select cron.schedule(
  'gallra-cookie-consents',
  '15 3 * * *',
  $$delete from public.cookie_consents where created_at < now() - interval '3 years'$$
);
