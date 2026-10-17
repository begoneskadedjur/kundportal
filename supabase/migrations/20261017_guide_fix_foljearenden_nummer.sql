-- Följeärenden bär samma ärendenummer som ursprunget (beslut Christian 2026-10-17).
-- case_number är unikt per tabell, så numret ligger i titeln och case_number lämnas tomt,
-- precis som före 3.69.0. Guiderna från 20261017_guide_fix_arenden.sql sa "eget
-- ärendenummer"; här byts de meningarna. Idempotent: replace gör inget andra gången.

update public.intranet_documents
set content = replace(replace(replace(replace(replace(replace(content::text,
      'Det nya ärendet får eget ärendenummer, eget pris och egen arbetstid.',
      'Det nya ärendet har samma ärendenummer som det första, men eget pris och egen arbetstid.'),
      'Det står till exempel Följeärende BE-0001235 skapat för Getingar! och det nya ärendet visas med sitt eget nummer och raden Detta är ett följeärende.',
      'Det står till exempel Följeärende skapat för Getingar! och det nya ärendet visas med samma nummer som det första och raden Detta är ett följeärende.'),
      'Det nya ärendet får ett eget ärendenummer, status Bokad, ingen arbetstid och inget pris. Fyll i det som vanligt.',
      'Det nya ärendet har samma ärendenummer som det första och får status Bokad, ingen arbetstid och inget pris. Fyll i det som vanligt.'),
      'Det nya ärendet får eget ärendenummer och hamnar på samma tid i schemat.',
      'Det nya ärendet har samma ärendenummer som det första och hamnar på samma tid i schemat.'),
      'Det står till exempel Följeärende BE-0001235 skapat för Getingar!.',
      'Det står till exempel Följeärende skapat för Getingar!.'),
      'Det nya ärendet får ett eget ärendenummer, status Bokad, ingen arbetstid och inget pris. Det första ärendet behåller sitt nummer.',
      'Det nya ärendet har samma ärendenummer som det första och får status Bokad, ingen arbetstid och inget pris.')::jsonb,
    source_updated_at = now()
where slug in ('guide-foljearenden', 'guide-foljearenden-kontor');
