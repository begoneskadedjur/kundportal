-- Guiden Gör en stationskontroll (intranet_documents, slug guide-stationskontroll)
-- får samma statusord som portalen sedan 3.132.24: Ingen aktivitet, Låg aktivitet,
-- Måttlig aktivitet och Hög aktivitet. Snabb-OK sparar stationen som Ingen aktivitet,
-- ordet OK används bara om knappen och frågan Markera Station N som OK?.
-- Innehållet är JSONB (skrivet av 20261024_handbok_nyvy_03_stationer.sql, delvis
-- ändrat av 20261113_guide_rapporter_efter_avslut.sql). Ersättningen görs i texten
-- så att den träffar oavsett blockens position. Idempotent: bara UPDATE och replace.

update public.intranet_documents
set content = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      content::text,
      'Lite aktivitet', 'Låg aktivitet'),
      'lite aktivitet', 'låg aktivitet'),
      'Medelhög aktivitet', 'Måttlig aktivitet'),
      'medelhög aktivitet', 'måttlig aktivitet'),
      'Betydande aktivitet', 'Hög aktivitet'),
      'betydande aktivitet', 'hög aktivitet'),
      'OK - Inga fynd', 'Ingen aktivitet'),
      'Stationen sparas utan förbrukning, foto och anteckning.', 'Stationen sparas som Ingen aktivitet, utan förbrukning, foto och anteckning.'),
      'Snabb-OK sparar stationen som OK utan förbrukning.', 'Snabb-OK sparar stationen som Ingen aktivitet utan förbrukning.'),
      'station 6 sparas som OK', 'station 6 sparas som Ingen aktivitet'
    )::jsonb,
    source_updated_at = now()
where slug = 'guide-stationskontroll'
  and (
    content::text like '%ite aktivitet%'
    or content::text like '%edelhög aktivitet%'
    or content::text like '%etydande aktivitet%'
    or content::text like '%OK - Inga fynd%'
    or content::text like '%Stationen sparas utan förbrukning, foto och anteckning.%'
    or content::text like '%Snabb-OK sparar stationen som OK utan förbrukning.%'
    or content::text like '%station 6 sparas som OK%'
  );
