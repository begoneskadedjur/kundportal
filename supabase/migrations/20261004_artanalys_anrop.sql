-- Artanalysen på begone.se (/identifiera-skadedjur/): en rad per anrop till api/artanalys.
-- Används för taket per besökare och totalt per dygn, och för att mäta utfallet (plan i
-- docs/begone-se/kluster/artanalys.md, A.5). Inga bilder och inga råa IP-adresser sparas:
-- ip_hash är en HMAC av adressen med en hemlig nyckel i Vercel-miljön.
-- Bara service role (api/artanalys.ts) läser och skriver. RLS är påslagen utan policyer,
-- och anon och authenticated saknar rättigheter.

create table if not exists public.artanalys_anrop (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  skapad timestamptz not null default now(),
  -- Referenssamlingens id (t.ex. tysk_kackerlacka), null när arten inte avgjordes eller anropet föll.
  art text,
  -- Analysens egen skattning 0 till 100, null när anropet föll.
  konfidens smallint check (konfidens between 0 and 100),
  -- identifierad, osaker, inget_djur eller felkoden (t.ex. upstream_error). Null medan anropet pågår.
  utfall text
);

create index if not exists artanalys_anrop_ip_skapad_idx on public.artanalys_anrop (ip_hash, skapad desc);
create index if not exists artanalys_anrop_skapad_idx on public.artanalys_anrop (skapad desc);

alter table public.artanalys_anrop enable row level security;

revoke all on table public.artanalys_anrop from anon, authenticated;
revoke all on sequence public.artanalys_anrop_id_seq from anon, authenticated;

comment on table public.artanalys_anrop is
  'Artanalysen på begone.se: ett anrop per rad för tak och mätning. Inga bilder, ingen rå IP. Bara service role.';
