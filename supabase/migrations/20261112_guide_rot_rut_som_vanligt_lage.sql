-- Guiderna Skapa en ROT- eller RUT-offert (3.131.0): ROT/RUT-läget fungerar
-- som vanligt läge. Raderna läggs till som förval, alla interna kostnader
-- mappas i prisguiden (inget automatiskt, alla måste ligga på en rad), mallen
-- ger avdraget på arbetstiden (inget ROT/Inget-val), varje rad har pris,
-- antal och papperskorg (Arbetskostnad går inte att ta bort) och tillagda
-- tjänster blir egna rader utan avdrag.
-- Byter bara meningarna som sa motsatsen. Idempotent: replace() gör inget när
-- texten redan är bytt, och where-villkoret hoppar över redan uppdaterade rader.

update public.intranet_documents
set
  content = replace(replace(replace(replace(replace(content::text,
    'Portalen skapar raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader, lägger de interna kostnaderna på rätt rad och räknar priset.',
    'Portalen lägger till raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader. Du mappar alla interna kostnader i prisguiden, som föreslår priset, och kan skriva ett eget pris, ta bort rader och lägga till tjänster. En tillagd tjänst, till exempel Tippavgift, blir en egen rad utan avdrag. Arbetskostnad går inte att ta bort. Mallen ger avdraget på arbetstiden, du väljer det aldrig.'),
    'Under Interna kostnader: tryck [[ROT]] på Arbetstid Privatperson.',
    'Tryck [[Prisguide]], mappa Arbetstid Privatperson mot Arbetskostnad och övriga interna kostnader mot sina rader. Tryck [[Applicera priser]].'),
    'Arbetskostnad får priset från prisguiden. Timmarna',
    'Mallen ger avdraget på arbetstiden. Arbetskostnad får priset från prisguiden, du kan också skriva ett eget. Timmarna'),
    'arbetstid med avdrag, fastighet (bara ROT)',
    'arbetstid på Arbetskostnad och inget annat där, fastighet (bara ROT)'),
    'Underentreprenör och Övrigt hamnar på Övriga kostnader, utan avdrag.',
    'Underentreprenör och Övrigt mappar du mot Övriga kostnader i prisguiden, utan avdrag.')::jsonb,
  source_updated_at = now()
where slug = 'guide-rot-rut-offert-kontor'
  and content::text not like '%Tippavgift%';

update public.intranet_documents
set
  summary = replace(replace(summary,
    'välj avdraget på arbetstiden',
    'mappa arbetstiden mot Arbetskostnad i prisguiden'),
    'Raderna och priset sköts av portalen.',
    'Raderna läggs till åt dig och prisguiden föreslår priset.'),
  content = replace(replace(replace(replace(replace(replace(replace(replace(content::text,
    'Raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader skapas åt dig. Du väljer [[ROT]] eller [[RUT]] på arbetstiden och fyller i personnummer.',
    'Raderna Arbetskostnad, Material och utrustning, Servicebil och Övriga kostnader läggs till åt dig. Du mappar alla interna kostnader i prisguiden, arbetstiden mot Arbetskostnad, och mallen ger avdraget. Tjänster du lägger till, till exempel Tippavgift, blir egna rader utan avdrag. Du fyller i personnummer.'),
    'Under Interna kostnader: tryck [[ROT]] på Arbetstid Privatperson.',
    'Tryck [[Prisguide]], mappa Arbetstid Privatperson mot Arbetskostnad och övriga interna kostnader mot sina rader. Tryck [[Applicera priser]].'),
    'Arbetskostnad får sitt pris från timmarna.',
    'Mallen ger avdraget, du väljer det aldrig. Prisguiden föreslår priset på Arbetskostnad från timmarna, du kan också skriva ett eget.'),
    'Det står Bara arbetstid med ROT hör till Arbetskostnad',
    'Det står Bara arbetstid hör till Arbetskostnad'),
    'En kostnad som inte är arbetstid med ROT ligger på Arbetskostnad. Byt rad i Ligger på, eller tryck ROT på arbetstiden.',
    'En kostnad som inte är arbetstid ligger på Arbetskostnad. Mappa om den i prisguiden. Arbetstid får bara ligga på Arbetskostnad.'),
    'Interna kostnader hamnar på rätt rad av sig själva: Arbetstid på Arbetskostnad, Bekämpning, Tillbehör och Inspektion på Material och utrustning, Underentreprenör och Övrigt på Övriga kostnader. Du kan byta rad i Ligger på.',
    'Alla interna kostnader mappar du i prisguiden: Arbetstid på Arbetskostnad, Bekämpning, Tillbehör och Inspektion på Material och utrustning, Underentreprenör och Övrigt på Övriga kostnader. En kostnad utan rad stoppar offerten.'),
    'Servicebil skriver du in själv. Rader på 0 kr syns inte för kunden.',
    'Varje rad har pris, antal och papperskorg. Arbetskostnad går inte att ta bort. Rader på 0 kr syns inte för kunden.'),
    'Under Interna kostnader: tryck [[ROT]] på Arbetstid Privatperson.',
    'Tryck [[Prisguide]], mappa Arbetstid Privatperson mot Arbetskostnad och övriga interna kostnader mot sina rader. Tryck [[Applicera priser]].')::jsonb,
  source_updated_at = now()
where slug = 'guide-rot-rut-offert-tekniker'
  and content::text not like '%Tippavgift%';
