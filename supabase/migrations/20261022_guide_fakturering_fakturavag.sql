-- Guiden Fakturera från ärende till betalning (admin och koordinator):
-- fakturavägen (3.77.0). En faktura kan inte godkännas eller skickas till
-- Fortnox förrän kundens fakturaväg är bekräftad. Felsökningen får frågan med
-- portalens exakta text och knappnamn (InvoiceDeliveryPanel.tsx,
-- src/shared/invoiceDelivery.ts). De två Synka-frågorna slås ihop så att
-- felsökningen håller sig till fem punkter enligt guidemallen.

update intranet_documents
set
  source_updated_at = current_date,
  content = jsonb_set(
    content::jsonb,
    '{3,items}',
    $json$[
      {"fraga":"Godkänn går inte att trycka på","svar":"Står det Endast faktureringsansvarig kan godkänna: låt en faktureringsansvarig godkänna, eller be admin om behörigheten. Står det att fakturavägen inte är bekräftad: se nästa fråga."},
      {"fraga":"Det står Fakturavägen för kunden är inte bekräftad","svar":"Portalen vet inte hur kunden vill få fakturan. Under Fakturaväg i fakturan väljer du E-post, E-faktura eller Brev och fyller i det som efterfrågas. Står det kunden skrev i avtalet i Fakturaadress, till exempel en skanningsadress med en referens, flyttar du referensen till Er referens. Tryck [[Spara fakturaväg]], eller [[Spara och uppdatera Fortnox]] om kunden redan finns i Fortnox. Sedan går Godkänn att trycka på."},
      {"fraga":"Skapa utkast i Fortnox är låst","svar":"Fakturan väntar på godkännande. Knappen är låst tills fakturan godkänts av faktureringsansvarig."},
      {"fraga":"Det står Kunden saknar kundnummer","svar":"Lägg till kundnumret på kundkortet och tryck [[Skapa utkast i Fortnox]] igen."},
      {"fraga":"Det står Fakturan finns redan i Fortnox, eller statusen har inte ändrats efter bokföringen","svar":"Skicka inte igen. Tryck [[Synka]] i fakturan för att hämta dess status."}
    ]$json$::jsonb
  )
where slug = 'guide-fakturering-kontor'
  and content::jsonb -> 3 ->> 'type' = 'felsok';
