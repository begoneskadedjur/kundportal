-- Skicka godkända till Fortnox skapar utkast (3.125.0). Knappen i flikarna
-- Avtalskunder och Merförsäljning Avtal laddade ner en exportfil; nu skapar
-- den ett utkast i Fortnox för varje godkänd faktura, en i taget, samma väg
-- som Skapa utkast i Fortnox i fakturan. Två guider beskrev den gamla filen.
-- Idempotent: replace gör ingenting när texten redan är bytt.

-- ─── Skicka avtalsfakturor i tid ───
update public.intranet_documents d
set content = replace(
      d.content::text,
      '[[Skicka godkända till Fortnox|rapport.skicka]] laddar ner en exportfil med de godkända fakturorna. Utan markering tas alla godkända. Ett utkast direkt i Fortnox skapar du i fakturan.',
      '[[Skicka godkända till Fortnox|rapport.skicka]] skapar ett utkast i Fortnox för varje godkänd faktura, en i taget, på samma sätt som Skapa utkast i Fortnox i fakturan. Utan markering tas alla godkända. Portalen visar listan innan något skickas och efteråt vilka som blev utkast, vilka som misslyckades och varför.'
    )::jsonb,
    source_updated_at = current_date
where d.slug = 'guide-avtalsfakturor-kontor'
  and d.content::text like '%laddar ner en exportfil med de godkända fakturorna%';

-- ─── Fakturera från ärende till betalning ───
update public.intranet_documents d
set content = replace(
      d.content::text,
      '[[Till Fortnox]] uppe till höger laddar ner en exportfil med fakturorna som är Redo för Fortnox. Den skapar inga utkast.',
      '[[Till Fortnox]] uppe till höger under Privat & Företag laddar ner en exportfil med fakturorna som är Redo för Fortnox. Den skapar inga utkast. Under Avtalskunder och Merförsäljning Avtal skapar [[Skicka godkända till Fortnox|rapport.skicka]] ett utkast i Fortnox för varje godkänd faktura, en i taget.'
    )::jsonb,
    source_updated_at = current_date
where d.slug = 'guide-fakturering-kontor'
  and d.content::text like '%laddar ner en exportfil med fakturorna som är Redo för Fortnox. Den skapar inga utkast."%';
