-- ============================================================
-- Två nya koordinatorguider (admin + koordinator), båda med
-- interaktiva övningar:
--   guide-skapa-arenden - ärendetyperna i Skapa ärende-väljaren
--                         och när varje typ ska användas
--                         (adresserar felet att engångsjobb
--                         skapats som etableringsärenden)
--   guide-schemavyn     - vyerna, sök, filter, ärenden att boka
--                         in och drag & drop
-- ============================================================

INSERT INTO intranet_documents (slug, title, summary, section, category, sort_order, requires_acknowledgement, audience_roles, content)
VALUES
(
  'guide-skapa-arenden',
  'Skapa ärenden - välj rätt ärendetyp',
  'Vad varje val i Skapa ärende-väljaren betyder, när du använder dem - och varför fel typ ger fel i hela kedjan.',
  'handbok',
  'arenden',
  19,
  false,
  ARRAY['admin', 'koordinator'],
  $json$[
    {"type":"p","text":"Ärendetypen du väljer när du skapar ett ärende styr allt som händer sen: vilken tabell ärendet hamnar i, hur det faktureras, hur det räknas i statistiken och vad teknikern ser. Väljer du fel typ blir det fel i hela kedjan - och det syns ofta inte förrän vid faktureringen."},
    {"type":"h2","text":"Väljaren - två rader, två världar"},
    {"type":"p","text":"Skapa ärende-väljaren i schemat har två rader. Rad ett är engångsärenden för kunder UTAN avtal. Rad två är enbart för avtalskunder."},
    {"type":"h2","text":"Rad 1: Engångsärenden"},
    {"type":"list","items":[
      "Privatperson - engångsjobb åt en privatperson. Faktureras separat när ärendet avslutas, med ROT/RUT där det är aktuellt.",
      "Företag - engångsjobb åt ett företag utan avtal. Faktureras separat på samma sätt."
    ]},
    {"type":"h2","text":"Rad 2: Avtalskundernas ärenden"},
    {"type":"list","items":[
      "Servicebesök - återkommande besök som ingår i avtalet. Täcks av årspremien. Även EXTRA arbeten hos avtalskunder skapas som Servicebesök - med fakturarader blir de merförsäljning.",
      "Inspektion stationer - kontroll av utplacerade fällor och stationer hos en avtalskund.",
      "Etablering - utplacering av stationer hos en avtalskund, normalt vid avtalsstart. Tjänsten Etableringskostnad förväljs automatiskt.",
      "Rondering Trafikkontoret och Egenkontroll - regionalkundernas egenkontrollprogram (t.ex. Stockholms Kommun)."
    ]},
    {"type":"callout","variant":"warning","title":"Vanligaste misstaget: Etablering för engångsjobb","text":"Etablering är ENBART utplacering av stationer hos en avtalskund - aldrig ett engångsjobb. Skapas ett engångsjobb som Etablering hamnar det i avtalsflödet: det faktureras inte som engångsärende, får fel förvald tjänst och smutsar ner avtalsstatistiken. Kund utan avtal = alltid Privatperson eller Företag."},
    {"type":"callout","variant":"info","title":"Extraarbete hos avtalskund","text":"Vill en avtalskund ha något utöver avtalet? Skapa ett Servicebesök på avtalskunden och lägg fakturarader i ärendet - då prissätts det via kundens prislista och faktureras som merförsäljning, separat från premien. Skapa INTE ett företagsärende - då tappas avtalskopplingen."},
    {"type":"h2","text":"Prova själv"},
    {"type":"interactive","component":"arendetyper-demo"},
    {"type":"h2","text":"Så skapar du ett ärende"},
    {"type":"steps","items":[
      "Öppna schemat och klicka Skapa ärende - eller klicka direkt på en ledig tid i schemat.",
      "Välj rätt ärendetyp enligt reglerna ovan - det här valet går inte att ändra i efterhand.",
      "Fyll i kund- och kontaktuppgifter. För avtalstyperna väljer du kund i den sökbara listan (multisite-kunder: välj även enhet).",
      "Sätt tid och tekniker - eller lämna obokat så hamnar ärendet under Ärenden att boka in.",
      "Spara. Ärendet dyker upp i schemat och i teknikerns vy."
    ]},
    {"type":"link","slug":"guide-schemavyn","label":"Schemavyn - vyer, sök, filter och drag & drop","description":"Så arbetar du effektivt i schemat när ärendena väl är skapade."},
    {"type":"link","slug":"guide-fakturering-kontor","label":"Fakturering från ärende till betalning","description":"Vad ärendetypen betyder för faktureringen - hela kedjan."}
  ]$json$::jsonb
),
(
  'guide-schemavyn',
  'Schemavyn - vyer, sök, filter och drag & drop',
  'Dag, vecka och månad, teknikerfiltret, ärendesöket, Ärenden att boka in - och hur du flyttar ärenden med drag & drop.',
  'handbok',
  'arenden',
  20,
  false,
  ARRAY['admin', 'koordinator'],
  $json$[
    {"type":"p","text":"Schemat är koordinatorns hemmaplan. Här bokas, flyttas och bevakas alla ärenden - och nästan allt går snabbare än du tror när du kan vyerna, filtren och drag & drop."},
    {"type":"h2","text":"De tre vyerna"},
    {"type":"list","items":[
      "Dag - teknikerna som kolumner med sina bokningar timme för timme. Bäst för att boka in dagens och morgondagens ärenden och se exakta tider.",
      "Vecka - hela veckan i ett svep. Bäst för att jämna ut belastningen mellan dagar och hitta luckor.",
      "Månad - överblicken: hur fullbokat det är längre fram och var det finns utrymme för större jobb."
    ]},
    {"type":"h2","text":"Sök och filter"},
    {"type":"list","items":[
      "Sök ärende - sökfältet hittar ärenden på kundnamn, adress eller ärendenummer och tar dig direkt till rätt plats i schemat.",
      "Teknikerfiltret - visa bara en eller några tekniker när du planerar för ett specifikt område eller vill se en teknikers hela dag.",
      "Frånvaro syns direkt i schemat så att du inte bokar på semester eller sjukdom."
    ]},
    {"type":"h2","text":"Ärenden att boka in"},
    {"type":"p","text":"Panelen Ärenden att boka in samlar ärenden som saknar tid - t.ex. nya ärenden och återbesök. Sortera på status eller antal kontaktförsök, dokumentera kontaktförsök direkt i panelen, och boka in ärendet genom att välja tid i schemat."},
    {"type":"h2","text":"Drag & drop - snabbaste sättet att boka om"},
    {"type":"steps","items":[
      "Ta tag i ett ärendekort i schemat.",
      "Dra det till en ny tid - eller till en annan tekniker.",
      "Släpp. Både tid och tekniker sparas direkt, i alla tre vyerna och för alla ärendetyper.",
      "Behöver du finjustera exakta klockslag? Öppna ärendet och ändra tiden där."
    ]},
    {"type":"callout","variant":"info","title":"Om något går fel","text":"Skulle en flytt inte kunna sparas får du ett tydligt felmeddelande och schemat laddas om till verkligt läge - en flytt som ser lyckad ut ÄR sparad."},
    {"type":"h2","text":"Prova själv"},
    {"type":"interactive","component":"schema-demo"},
    {"type":"link","slug":"guide-skapa-arenden","label":"Skapa ärenden - välj rätt ärendetyp","description":"Vilken ärendetyp du väljer när du skapar ärenden - och varför det spelar roll."}
  ]$json$::jsonb
)
ON CONFLICT (slug) DO NOTHING;
