-- Google-omdömen för nya begone.se
-- Cron-jobbet api/cron/sync-google-reviews.ts hämtar Place Details (Places API New)
-- en gång per dygn och upsertar hit med service role. Sajten läser vid bygget
-- via Supabase REST med den publika anon-nyckeln.
-- Alla tider är timestamptz (UTC i databasen); visning sker i svensk tid.

create table if not exists public.google_place_stats (
  place_id        text primary key,
  namn            text,
  betyg           numeric(2,1),
  antal_omdomen   integer,
  google_maps_url text,
  hamtad_at       timestamptz not null default now()
);

create table if not exists public.google_reviews (
  id            text primary key,          -- Googles review name, places/{id}/reviews/{id}
  place_id      text not null,
  forfattare    text,
  betyg         integer check (betyg between 1 and 5),
  text          text,
  sprak         text,
  publicerad_at timestamptz,
  relativ_tid   text,
  hamtad_at     timestamptz not null default now()
);

create index if not exists google_reviews_place_publicerad_idx
  on public.google_reviews (place_id, publicerad_at desc);

comment on table public.google_place_stats is 'Betyg och antal omdömen för Begones Google-profil. Skrivs nattligen av cron sync-google-reviews, läses publikt av begone.se.';
comment on table public.google_reviews is 'Omdömen från Google Places API (högst fem per hämtning). Skrivs nattligen av cron sync-google-reviews, läses publikt av begone.se.';

alter table public.google_place_stats enable row level security;
alter table public.google_reviews enable row level security;

-- Publik läsning (data visas på begone.se). Inga skrivpolicies: bara service role
-- (som går förbi RLS) kan skriva.
create policy google_place_stats_publik_las on public.google_place_stats
  for select to anon, authenticated using (true);

create policy google_reviews_publik_las on public.google_reviews
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.google_place_stats from anon, authenticated;
revoke insert, update, delete, truncate on public.google_reviews from anon, authenticated;
grant select on public.google_place_stats to anon, authenticated;
grant select on public.google_reviews to anon, authenticated;
