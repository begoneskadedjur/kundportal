-- Guiden Tilläggsstationer: "Betalas nu" som begrepp i löptext är obegripligt,
-- skriv ut vad det betyder.
update intranet_documents
set content = replace(content::text,
  'skapas merförsäljningsfakturan för Betalas nu direkt',
  'skapas merförsäljningsfakturan för tiden fram till avtalets nästa periodstart direkt')::jsonb,
    updated_at = now()
where slug = 'guide-tillaggsstationer';
