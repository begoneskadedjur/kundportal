-- Handboken efter 3.132.3–3.132.6 (2026-11-13).
--   guide-prissattning       Låst av avtal finns inte längre: bara Fast pris låser.
--                            Nytt svar: medel anges i ml eller g.
--   guide-placera-stationer  Nytt svar: Tillägg utöver avtal förvalt på avropsavtal.
--   guide-tillaggsstationer  Samma svar.
-- Felsök är fjärde blocket (index 3) i alla tre guiderna. Version höjs inte,
-- guiderna kräver ingen läskvittens.

update public.intranet_documents
set content = jsonb_set(
      content, '{3,items}',
      jsonb_build_array(
        jsonb_build_object(
          'fraga', 'Prisrutan går inte att ändra och det står Fast pris',
          'svar', 'Tjänsten har fast pris i kundens prislista och ändras inte i ärendet. Lägg ändå in artiklarna under Interna kostnader, de behövs för marginalen. Har tjänsten inget fast pris sätter du priset själv, även när en artikel med kundens avtalspris är kopplad.'
        ),
        content->3->'items'->1,
        jsonb_build_object(
          'fraga', 'Jag ser ingen Dela upp för ROT/RUT',
          'svar', 'Den finns bara i privatärenden, och inte på rader med Fast pris. På själva arbetstidstjänsten väljer du ROT eller RUT direkt på raden.'
        ),
        content->3->'items'->3,
        content->3->'items'->4,
        jsonb_build_object(
          'fraga', 'Ett medel som K-Othrine kostar flera tusen kronor',
          'svar', 'Medel anges i ml eller g, inte i flaskor eller kilo. Raden startar på 1. Skriv in det du faktiskt använde, till exempel 25 ml. Priset per ml står under artikelns namn.'
        )
      )
    ),
    source_updated_at = now()
where slug = 'guide-prissattning'
  and content->3->>'type' = 'felsok'
  and content::text like '%Låst av avtal%';

update public.intranet_documents
set content = jsonb_set(
      content, '{3,items}',
      (content->3->'items') || jsonb_build_array(jsonb_build_object(
        'fraga', 'Tillägg utöver avtal är redan ikryssat',
        'svar', 'Etableringen gäller ett avropsavtal och det är kundens enda avtal. Avropsavtalet omfattar inga stationer, så alla stationer är tillägg och Per år är förvalt. Har kunden fler avtal är rutan inte förvald.'
      ))
    ),
    source_updated_at = now()
where slug in ('guide-placera-stationer', 'guide-tillaggsstationer')
  and content->3->>'type' = 'felsok'
  and content::text not like '%Tillägg utöver avtal är redan ikryssat%';
