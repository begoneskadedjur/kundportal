-- Guiden Fakturera från ärende till betalning (admin och koordinator), 3.99.0:
-- raden Utfört på blir leveransadress i Fortnox när den skiljer sig från
-- fakturaadressen (src/shared/invoiceWorkAddress.ts), och rapporterna läses i
-- en panel från rutan Utfört arbete (CaseReportsPanel.tsx). Två punkter
-- läggs sist i Bra att veta.

update intranet_documents
set
  source_updated_at = current_date,
  content = jsonb_set(
    content::jsonb,
    '{4,items}',
    (content::jsonb -> 4 -> 'items') || $json$[
      "Raden Utfört på i rutan Utfört arbete visar var jobbet gjordes. Står det Blir leveransadress på fakturan skickas adressen till Fortnox och skrivs ut som Leveransadress på fakturan. Kundkortet ändras inte.",
      "Arbetsrapporten och specialrapporten läser du från fakturan: tryck Läs eller Visa i rutan Utfört arbete. Inget av det följer med till Fortnox."
    ]$json$::jsonb
  )
where slug = 'guide-fakturering-kontor'
  and content::jsonb -> 4 ->> 'type' = 'bra'
  and not (content::jsonb -> 4 -> 'items') @> '["Arbetsrapporten och specialrapporten läser du från fakturan: tryck Läs eller Visa i rutan Utfört arbete. Inget av det följer med till Fortnox."]'::jsonb;
