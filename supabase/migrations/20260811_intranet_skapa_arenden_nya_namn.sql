-- Nya ärendetypnamn i guiden Skapa ärenden (index verifierade med
-- jsonb_array_elements före uppdatering: 2=p väljaren, 4=Rad 1-lista,
-- 6=Rad 2-lista, 7=varningscallout, 8=infocallout)
UPDATE intranet_documents SET
  content = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
    content,
    '{2}', $json${"type":"p","text":"Skapa ärende-väljaren i schemat har två rader. Rad ett är engångsjobb för kunder UTAN avtal. Rad två är enbart för avtalskunder."}$json$::jsonb),
    '{4}', $json${"type":"list","items":[
      "Engångsjobb Privatperson - engångsjobb åt en privatperson. Faktureras separat när ärendet avslutas, med ROT/RUT där det är aktuellt.",
      "Engångsjobb Företag - engångsjobb åt ett företag utan avtal. Faktureras separat på samma sätt."
    ]}$json$::jsonb),
    '{6}', $json${"type":"list","items":[
      "Extrabesök Avtalskund - enstaka besök eller tjänster hos en avtalskund som INTE är stationskontroll, t.ex. en extra sanering. Med fakturarader blir det merförsäljning enligt kundens prislista.",
      "Stationskontroll Avtalskund - kontroll av utplacerade fällor och stationer. De ÅTERKOMMANDE kontrollerna schemaläggs automatiskt via Rondering & Schema - manuellt skapar du bara enstaka extra kontrollbesök.",
      "Etablering Avtalskund - utplacering av stationer hos en avtalskund, normalt vid avtalsstart. Tjänsten Etableringskostnad förväljs automatiskt.",
      "Rondering Trafikkontoret och Egenkontroll - regionalkundernas egenkontrollprogram (t.ex. Stockholms Kommun)."
    ]}$json$::jsonb),
    '{7}', $json${"type":"callout","variant":"warning","title":"Vanligaste misstaget: Etablering för engångsjobb","text":"Etablering är ENBART utplacering av stationer hos en avtalskund - aldrig ett engångsjobb. Skapas ett engångsjobb som Etablering hamnar det i avtalsflödet: det faktureras inte som engångsärende, får fel förvald tjänst och smutsar ner avtalsstatistiken. Kund utan avtal = alltid Engångsjobb Privatperson eller Engångsjobb Företag."}$json$::jsonb),
    '{8}', $json${"type":"callout","variant":"info","title":"Extraarbete hos avtalskund","text":"Vill en avtalskund ha något utöver avtalet? Skapa ett Extrabesök Avtalskund och lägg fakturarader i ärendet - då prissätts det via kundens prislista och faktureras som merförsäljning, separat från premien. Skapa INTE ett Engångsjobb Företag - då tappas avtalskopplingen."}$json$::jsonb)
WHERE slug = 'guide-skapa-arenden';
