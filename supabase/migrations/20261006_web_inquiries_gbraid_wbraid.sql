-- 20261006_web_inquiries_gbraid_wbraid.sql
-- Klick-id från Google Ads utöver gclid: gbraid (appar och iOS) och wbraid (webb till app, iOS).
-- Följer med förfrågan från begone.se (api/forfragan.ts). Används för att stämma av konverteringar i Ads.

alter table public.web_inquiries add column if not exists gbraid text;
alter table public.web_inquiries add column if not exists wbraid text;

comment on column public.web_inquiries.gbraid is 'Google Ads klick-id gbraid ur annonslänken (iOS och appar).';
comment on column public.web_inquiries.wbraid is 'Google Ads klick-id wbraid ur annonslänken (webb till app, iOS).';
