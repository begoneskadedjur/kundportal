-- Notiser om webbförfrågningar från begone.se (Leads (Webb)) till koordinatorerna.
-- Christian godkände 2026-10-05 att villkoret för notisernas ärendetyp byts så att 'web_inquiry' tillåts.
-- Inga rader ändras; samma fem värden som förut plus web_inquiry.
alter table public.notifications drop constraint if exists notifications_case_type_check;
alter table public.notifications add constraint notifications_case_type_check
  check (case_type = any (array['private'::text, 'business'::text, 'contract'::text, 'customer'::text, 'procurement'::text, 'web_inquiry'::text]));
