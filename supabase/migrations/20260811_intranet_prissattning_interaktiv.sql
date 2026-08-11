-- ============================================================
-- Prissättningsguiden görs interaktiv och mer pedagogisk:
-- ny blocktyp interactive renderar en spelbar miniversion av
-- kalkylatorn (komponent prissattning-demo i dokumentläsaren),
-- innehållet förenklas språkligt och det förtydligas att priset
-- alltid kan knappas in manuellt efter Prisguiden (undantagsfall).
-- ============================================================

UPDATE intranet_documents SET
  content = $json$[
    {"type":"p","text":"Det svåraste med prissättningen är att hålla isär två saker som ser likadana ut men betyder helt olika: tjänster (det kunden betalar) och artiklar (det ärendet kostar oss). Den här guiden reder ut det - och längre ner får du prova hela flödet själv i en interaktiv övning."},
    {"type":"h2","text":"Två prisvärldar"},
    {"type":"chain","title":"Så hänger det ihop","steps":["Tjänsterader","Fakturan till kund","Artiklar","Marginalen"],"labels":["Kundens pris","Det kunden ser","Vår kostnad","Internt"]},
    {"type":"list","items":[
      "Tjänster & fakturarader = det kunden ser och betalar. Varje rad har pris, antal, eventuell rabatt och ROT/RUT-markering. Summan blir fakturan.",
      "Artiklar = vad ärendet kostar oss: preparat, fällor, material med inköpspris. Artiklar hamnar ALDRIG på fakturan - de finns bara för att räkna ut marginalen."
    ]},
    {"type":"callout","variant":"warning","title":"Registrera artiklarna även om de inte faktureras","text":"Hoppar du över artiklarna ser ärendet mer lönsamt ut än det är, och marginalsiffrorna i statistiken blir fel. Artiklarna är gratis att registrera - det tar tio sekunder."},
    {"type":"h2","text":"Marginalen - så räknas den"},
    {"type":"p","text":"Marginal = tjänsternas pris exklusive moms minus artiklarnas inköpskostnad. Momsen är aldrig bolagets intäkt, så den räknas alltid bort. Marginalindikatorn i ärendet visar procenten live medan du fyller i - ser den låg ut, se över priset innan du sparar."},
    {"type":"h2","text":"Prisguiden - förslag, inte facit"},
    {"type":"p","text":"Knappen Prisguide öppnar en panel som föreslår priser genom påslag på artikelkostnaden - du styr påslaget med ett reglage och applicerar förslaget per fakturarad. Prisguiden kopplar också ihop artiklarna med rätt tjänsterad, vilket används för marginalberäkningen och ärenderapporten."},
    {"type":"callout","variant":"info","title":"Priset går alltid att justera manuellt i efterhand","text":"Prisguidens förslag är en startpunkt, inte ett lås. Efter att du applicerat förslaget kan du klicka i prisfältet och knappa in ett eget pris - t.ex. för att avrunda, matcha en offert eller hantera undantagsfall där påslaget inte passar. Det manuella priset gäller."},
    {"type":"callout","variant":"info","title":"Fast pris vinner alltid","text":"Har kunden en prislista med avtalat fast pris för en tjänst pausas Prisguidens förslag för den raden - det avtalade priset gäller. Artikelkopplingen är dock alltid aktiv, så marginalen räknas rätt ändå."},
    {"type":"h2","text":"Var kommer priset ifrån? Ordningen"},
    {"type":"steps","items":[
      "Kundens prislista - har kunden ett avtalat fast pris för tjänsten används det.",
      "Prisguidens förslag - annars kan du låta Prisguiden föreslå pris via påslag på artikelkostnaden.",
      "Manuellt pris - du kan alltid sätta eller justera priset själv direkt på raden, även efter att Prisguiden använts."
    ]},
    {"type":"callout","variant":"info","title":"Avtalet är en separat sak","text":"Avtalskundens årspremie och indexjustering styrs av avtalet och rörs inte av prislistor eller Prisguiden. Prislistan gäller extratjänster utöver avtalet."},
    {"type":"h2","text":"Prova hela flödet själv"},
    {"type":"p","text":"Övningen nedan är en miniversion av kalkylatorn i ärendet. Klara de tre uppdragen så har du gjort exakt det du gör i ett riktigt ärende:"},
    {"type":"interactive","component":"prissattning-demo"},
    {"type":"h2","text":"Samma sak i riktiga ärendet"},
    {"type":"steps","items":[
      "Öppna ärendet och fäll ut Tjänster & fakturarader.",
      "Registrera förbrukade artiklar i artikel-kalkylatorn med antal.",
      "Lägg till tjänsterader och sätt pris - via kundens prislista, Prisguiden eller manuellt.",
      "Finjustera priset manuellt vid behov, även efter Prisguiden.",
      "Kontrollera marginalindikatorn och markera ROT/RUT där det är aktuellt.",
      "Spara - raderna blir fakturaunderlaget när ärendet avslutas."
    ]},
    {"type":"link","slug":"guide-fakturering","label":"Så fungerar faktureringen","description":"Vad som händer med fakturaraderna när ärendet är klart - flöden, statusar och Fortnox."}
  ]$json$::jsonb
WHERE slug = 'guide-prissattning';
