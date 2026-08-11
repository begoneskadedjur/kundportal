-- ============================================================
-- Handbok: två nya ekonomiguider som länkar till varandra.
--   guide-prissattning  - prissättning, marginaler, interna
--                         kostnader och Tjänster & fakturarader
--   guide-fakturering   - hur faktureringen fungerar
-- Ny kategori 'ekonomi' för filterpiller i handboken.
-- ============================================================

ALTER TABLE intranet_documents DROP CONSTRAINT IF EXISTS intranet_documents_category_check;
ALTER TABLE intranet_documents ADD CONSTRAINT intranet_documents_category_check
  CHECK (category IN ('introduktion', 'policy', 'rutin', 'guide', 'kommunikation', 'arenden', 'utrustning', 'sakerhet', 'ekonomi'));

INSERT INTO intranet_documents (slug, title, summary, section, category, sort_order, requires_acknowledgement, content)
VALUES
(
  'guide-prissattning',
  'Prissättning, marginaler och interna kostnader',
  'Så fungerar Tjänster & fakturarader, artikel-kalkylatorn, marginalindikatorn och Prisguiden.',
  'handbok',
  'ekonomi',
  16,
  false,
  $json$[
    {"type":"h2","text":"Två prisvärldar: kundens pris och våra kostnader"},
    {"type":"p","text":"Prissättningen i ett ärende bygger på två helt separata delar. Tjänsterna är det kunden ser och betalar - de blir fakturarader. Artiklarna är våra interna inköpskostnader - de hamnar ALDRIG på fakturan utan används bara för att räkna ut vad ärendet kostar oss och vilken marginal vi gör."},
    {"type":"h2","text":"Tjänster & fakturarader - det kunden betalar"},
    {"type":"p","text":"I sektionen Tjänster & fakturarader i ärendet lägger du till rader från vårt tjänsteutbud och sätter pris. Varje rad kan ha antal, rabatt och ROT/RUT-markering. Summan av raderna är det som faktureras kunden."},
    {"type":"h2","text":"Artikel-kalkylatorn - våra interna kostnader"},
    {"type":"p","text":"I artikel-sektionen registrerar du de artiklar du förbrukat - preparat, fällor, material - med inköpspris. Artiklarnas pris är alltid vår interna kostnad, aldrig ett kundpris."},
    {"type":"callout","variant":"warning","title":"Registrera artiklarna även om de inte faktureras","text":"Interna kostnader visas inte på fakturan - de används för att beräkna inköpskostnad och marginal. Hoppar du över artiklarna ser ärendet mer lönsamt ut än det är, och marginalsiffrorna i statistiken blir fel."},
    {"type":"h2","text":"Marginalindikatorn"},
    {"type":"p","text":"Marginalen räknas som tjänsternas pris exklusive moms minus artiklarnas inköpskostnad - momsen är aldrig bolagets intäkt. Indikatorn visar marginalen i procent direkt i panelen, så att du ser om prissättningen håller innan ärendet avslutas."},
    {"type":"h2","text":"Prisguiden - förslag och koppling"},
    {"type":"p","text":"Knappen Prisguide öppnar en panel som gör två saker. Den kopplar ihop artiklarna med rätt tjänsterad (kopplingen används för marginalberäkning och ärenderapporten), och den föreslår priser genom påslag på artikelkostnaden - du styr påslaget och applicerar förslagen per fakturarad."},
    {"type":"callout","variant":"info","title":"Fast pris vinner alltid","text":"Har kunden en prislista med fast pris för en tjänst pausas Prisguidens prisförslag för den raden - det avtalade priset gäller. Kopplingen artikel till tjänst är dock alltid aktiv, så marginalen räknas rätt ändå."},
    {"type":"h2","text":"Var kommer priset ifrån? Ordningen"},
    {"type":"steps","items":[
      "Kundens prislista - har kunden ett avtalat fast pris för tjänsten används det.",
      "Prisguidens förslag - annars kan du låta Prisguiden föreslå pris via påslag på artikelkostnaden.",
      "Manuellt pris - du kan alltid sätta priset själv direkt på raden."
    ]},
    {"type":"callout","variant":"info","title":"Avtalet är en separat sak","text":"Avtalskundens årspremie och indexjustering styrs av avtalet och rörs inte av prislistor eller Prisguiden. Prislistan gäller extratjänster utöver avtalet."},
    {"type":"h2","text":"Så prissätter du ett ärende"},
    {"type":"steps","items":[
      "Öppna ärendet och fäll ut Tjänster & fakturarader.",
      "Lägg till tjänsterader från tjänsteutbudet - det här är det kunden faktureras för.",
      "Registrera förbrukade artiklar i artikel-kalkylatorn med antal.",
      "Kontrollera marginalindikatorn - ser procenten låg ut, se över priset.",
      "Använd Prisguiden om du vill ha prisförslag utifrån artikelkostnaden.",
      "Markera ROT/RUT på raderna där det är aktuellt och spara."
    ]},
    {"type":"link","slug":"guide-fakturering","label":"Så fungerar faktureringen","description":"Vad som händer med fakturaraderna när ärendet är klart - flöden, statusar och Fortnox."}
  ]$json$::jsonb
),
(
  'guide-fakturering',
  'Så fungerar faktureringen',
  'De tre faktureringsflödena, statusarna från underlag till betald faktura och Fortnox-synken.',
  'handbok',
  'ekonomi',
  17,
  false,
  $json$[
    {"type":"h2","text":"Tre faktureringsflöden"},
    {"type":"list","items":[
      "Engångsärenden (privat och företag) - faktureras när ärendet är klart. Underlaget är ärendets Tjänster & fakturarader, och ROT/RUT-avdrag följer med automatiskt.",
      "Avtalskunder - årspremien faktureras återkommande enligt kundens faktureringsfrekvens (t.ex. månadsvis, kvartalsvis eller årsvis) i perioder.",
      "Extraarbeten hos avtalskunder - tjänster utöver avtalet faktureras separat från årspremien, med kundens prislista som grund."
    ]},
    {"type":"h2","text":"Från underlag till betald faktura"},
    {"type":"steps","items":[
      "Väntande - fakturaunderlaget skapas från ärendet eller avtalsperioden och väntar på granskning.",
      "Godkänd - kontoret har granskat raderna och godkänt underlaget för fakturering.",
      "Fakturerad - fakturan är skapad och skickad till kunden via Fortnox.",
      "Betald - betalningen är registrerad. (Underlag kan även makuleras om något blivit fel.)"
    ]},
    {"type":"h2","text":"Fortnox sköter det sista steget"},
    {"type":"p","text":"Fakturorna skapas och bokförs i Fortnox. Kundkortet i Fortnox uppdateras automatiskt med rätt uppgifter, ROT/RUT-underlag följer med, och fakturan går till kundens faktura-mail eller fakturaadress enligt kundens faktureringsinställningar."},
    {"type":"callout","variant":"info","title":"Multisite-kunder","text":"Kedjekunder med flera enheter faktureras per enhet - systemet håller själv reda på rätt Fortnox-kund för varje enhet, även när flera enheter delar organisationsnummer."},
    {"type":"h2","text":"Vad du som tekniker behöver göra"},
    {"type":"steps","items":[
      "Fyll i Tjänster & fakturarader med rätt priser innan ärendet avslutas.",
      "Registrera förbrukade artiklar så att marginalen blir rätt.",
      "Markera ROT/RUT där kunden har rätt till avdrag.",
      "Avsluta ärendet - kontoret granskar, godkänner och fakturerar."
    ]},
    {"type":"callout","variant":"success","title":"Tumregeln","text":"Ett komplett ifyllt ärende blir en korrekt faktura utan handpåläggning. Saknas rader eller priser måste kontoret jaga uppgifter i efterhand - och fakturan till kunden försenas."},
    {"type":"link","slug":"guide-prissattning","label":"Prissättning, marginaler och interna kostnader","description":"Hur du sätter rätt pris i ärendet - tjänsterader, artikel-kalkylatorn och Prisguiden."}
  ]$json$::jsonb
)
ON CONFLICT (slug) DO NOTHING;
