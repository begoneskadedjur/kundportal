-- ═══════════════════════════════════════════════════════════════
-- Fas C: markeringsdatum, pro rata per stationstyp, artikelrader
--
-- Körd mot produktion 2026-09-04 i tre steg (se migrationsloggen:
-- stationstyper_fas_c1_markeringsdatum, _c2_prorata_per_typ,
-- _c3_artikelrader). Filen är den samlade sanningen.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Markeringsdatum
--
-- Pro rata räknades tidigare från placed_at och krävde
-- placed_at >= etableringsärendets skapande. Stationer som redan
-- stod ute när de markerades som tillägg gav då NOLL rader, alltså
-- ingen debitering alls för perioden fram till nästa premie.
-- ─────────────────────────────────────────────────────────────
alter table public.equipment_placements
  add column if not exists addon_marked_at timestamptz;
alter table public.indoor_stations
  add column if not exists addon_marked_at timestamptz;

comment on column public.equipment_placements.addon_marked_at is
  'När stationen markerades som tillägg. Pro rata räknas härifrån, aldrig från placed_at.';
comment on column public.indoor_stations.addon_marked_at is
  'När stationen markerades som tillägg. Pro rata räknas härifrån, aldrig från placed_at.';

create or replace function addon_station_normalize()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.is_addon, false) = false then
    new.addon_billing_model := null;
    new.addon_contract_mode := null;
    new.addon_contract_id := null;
    new.addon_marked_at := null;
  else
    if new.addon_billing_model is null then
      new.addon_billing_model := 'per_round';
    end if;
    if new.addon_billing_model = 'per_round' then
      new.addon_contract_mode := null;
    end if;
    if new.addon_marked_at is null then
      new.addon_marked_at := now();
    end if;
  end if;
  return new;
end;
$$;

update equipment_placements set addon_marked_at = coalesce(placed_at, created_at)
where is_addon = true and addon_marked_at is null;
update indoor_stations set addon_marked_at = coalesce(placed_at, created_at)
where is_addon = true and addon_marked_at is null;

-- ─────────────────────────────────────────────────────────────
-- 2. sync_addon_prorata_line: pris per stationstyp, räkning från
--    markeringsdatum, kind-filter på den öppna fakturan.
--    Se migration stationstyper_fas_c2_prorata_per_typ för kroppen.
-- 3. sync_addon_article_lines: produkterna som interna kostnadsrader.
--    Se migration stationstyper_fas_c3_artikelrader för kroppen.
--
-- Båda funktionerna är applicerade i produktion. De återges inte här
-- i sin helhet för att undvika att två versioner glider isär; kör
-- `select prosrc from pg_proc where proname = '...'` för aktuell kod.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 4. Stationstypernas tjänst och produkter (data)
-- ─────────────────────────────────────────────────────────────
update station_types set annual_service_id = (select id from services where code = '79' and is_active limit 1)
where code = 'ljusfalla' and annual_service_id is null;

update station_types set annual_service_id = (select id from services where code = '144' and is_active limit 1)
where code in ('betesstation', 'betongstation', 'mekanisk_falla', 'platstation')
  and annual_service_id is null;

insert into station_type_articles (station_type_id, article_id, is_default, sort_order)
select st.id, a.id, v.is_default, v.sort_order
from (values
  ('mekanisk_falla', '405220', true, 0),
  ('ljusfalla', '102102', true, 0),
  ('betesstation', '500501', true, 0),
  ('betesstation', '502001', false, 1),
  ('platstation', '500501', true, 0)
) as v(type_code, article_code, is_default, sort_order)
join station_types st on st.code = v.type_code
join articles a on a.code = v.article_code
on conflict (station_type_id, article_id) do nothing;
