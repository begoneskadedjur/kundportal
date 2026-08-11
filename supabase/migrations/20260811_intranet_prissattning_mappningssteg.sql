-- ============================================================
-- Prissättningsguiden: demon har nu fyra uppdrag inklusive
-- kopplingen artikel -> tjänst i Prisguiden. Texten före övningen
-- och stegen för riktiga ärendet uppdateras så att mappningssteget
-- ingår. (Applicerat i två steg i migrationshistoriken:
-- mappningssteg + mappningssteg_fix efter indexfel - detta är
-- nettoresultatet.)
-- ============================================================

UPDATE intranet_documents SET
  content = jsonb_set(
    jsonb_set(
      content,
      '{15}',
      $json${"type":"p","text":"Övningen nedan är en miniversion av kalkylatorn i ärendet, med två tjänster på samma faktura. Klara de fyra uppdragen så har du gjort exakt det du gör i ett riktigt ärende - inklusive kopplingen av artiklar till rätt tjänst:"}$json$::jsonb
    ),
    '{18}',
    $json${"type":"steps","items":[
      "Öppna ärendet och fäll ut Tjänster & fakturarader.",
      "Registrera förbrukade artiklar i artikel-kalkylatorn med antal.",
      "Lägg till tjänsterader och öppna Prisguiden.",
      "Koppla varje artikel till rätt tjänsterad - kopplingen styr prisförslag, marginal per tjänst och ärenderapporten.",
      "Applicera Prisguidens förslag och finjustera priset manuellt vid behov.",
      "Kontrollera marginalindikatorn, markera ROT/RUT där det är aktuellt och spara."
    ]}$json$::jsonb
  )
WHERE slug = 'guide-prissattning';
