-- Avtalstillägg-funktionen dokumenteras i faktureringsguiderna
-- (jsonb_insert före länkkorten - index verifierade med
-- jsonb_array_elements: tekniker=8, kontor=16)
UPDATE intranet_documents SET
  content = jsonb_insert(
    content,
    '{8}',
    $json${"type":"callout","variant":"info","title":"Sålt något som ska ingå i avtalet?","text":"Har kunden köpt något som ska bli en fast del av avtalet - t.ex. en extra station - markerar du tjänsteraden med knappen Lägg till i avtalet. Du bekräftar årsbeloppet, ser exakt vad kunden faktureras nu (pro rata fram till nästa period) och vad nya årspremien blir. När ärendet avslutas höjs premien automatiskt och allt loggas. Använd bara när det är överenskommet med kunden."}$json$::jsonb
  )
WHERE slug = 'guide-fakturering';

UPDATE intranet_documents SET
  content = jsonb_insert(
    content,
    '{16}',
    $json${"type":"callout","variant":"info","title":"Avtalstillägg från fält","text":"Tekniker kan markera en tjänsterad som Avtalstillägg i avtalskundärenden. Då faktureras raden som pro rata (hamnar under Merförsäljning Avtal som vanligt), årspremien höjs automatiskt från nästa olåsta period när ärendet avslutas, och kommande avtalsfakturor räknas om. Varje tillägg loggas med belopp, datum och vem som gjorde det - historiken finns i kundens faktureringsunderlag om något behöver redas ut."}$json$::jsonb
  )
WHERE slug = 'guide-fakturering-kontor';
