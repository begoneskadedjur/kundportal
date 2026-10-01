-- Egen ikon per produkt. null = stationen visar stationstypens ikon.
-- Namnet kommer från ikonregistret i src/components/shared/stationIcons.tsx.
alter table public.articles add column if not exists icon text;

comment on column public.articles.icon is
  'Ikon för stationer med den här produkten (namn ur stationIcons.tsx). null = stationstypens ikon.';
