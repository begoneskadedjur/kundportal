-- Rättad semantik i ärendetypguiden (verifierad mot kod + drift):
-- återkommande stationskontroller genereras som Inspektion stationer
-- via Rondering & Schema; Servicebesök är enstaka tjänster hos
-- avtalskund som inte är stationskontroll. Index 6 = Rad 2-listan
-- (verifierat med jsonb_array_elements före uppdatering).
UPDATE intranet_documents SET
  content = jsonb_set(
    content,
    '{6,items}',
    $json$[
      "Servicebesök - enstaka besök eller tjänster hos en avtalskund som INTE är stationskontroll, t.ex. en extra sanering. Med fakturarader blir det merförsäljning enligt kundens prislista.",
      "Inspektion stationer - kontroll av utplacerade fällor och stationer. De ÅTERKOMMANDE kontrollerna schemaläggs automatiskt via Rondering & Schema - manuellt skapar du bara enstaka extra kontrollbesök.",
      "Etablering - utplacering av stationer hos en avtalskund, normalt vid avtalsstart. Tjänsten Etableringskostnad förväljs automatiskt.",
      "Rondering Trafikkontoret och Egenkontroll - regionalkundernas egenkontrollprogram (t.ex. Stockholms Kommun)."
    ]$json$::jsonb
  )
WHERE slug = 'guide-skapa-arenden';
