-- ============================================================
-- Fakturering delas i två guider:
--   guide-fakturering        - omskriven för TEKNIKER: vad de
--                              gör och behöver känna till.
--                              Synlig för alla roller igen.
--   guide-fakturering-kontor - NY, för dem som fakturerar
--                              (admin + koordinator): alla
--                              ärendetyper, kundtyper,
--                              merförsäljning och hela kedjan,
--                              med interaktiv övning
--                              (fakturering-demo).
-- ============================================================

UPDATE intranet_documents SET
  title = 'Fakturering - din del som tekniker',
  summary = 'Du fakturerar inget själv, men fakturan byggs av det du fyller i. Det här behöver du göra och känna till.',
  audience_roles = NULL,
  audience_user_ids = NULL,
  content = $json$[
    {"type":"p","text":"Du skapar aldrig fakturor - det gör kontoret och Fortnox. Men varje faktura byggs av det DU fyller i i ärendet. Är ditt ärende komplett blir fakturan rätt utan att någon behöver jaga dig i efterhand."},
    {"type":"chain","title":"Din del av kedjan","steps":["Ditt ärende","Fakturarader","Kontoret godkänner","Fortnox","Kunden"],"labels":["Du","Du","Kontoret","Automatiskt","Betalar"]},
    {"type":"h2","text":"Det du gör i varje ärende"},
    {"type":"steps","items":[
      "Fyll i Tjänster & fakturarader med rätt priser innan du avslutar ärendet - det är detta som blir fakturan.",
      "Registrera förbrukade artiklar i artikel-kalkylatorn så att marginalen blir rätt.",
      "Markera ROT/RUT på raderna där kunden har rätt till avdrag - det styr avdraget på fakturan.",
      "Avsluta ärendet. Klart - kontoret tar det vidare."
    ]},
    {"type":"h2","text":"Det du behöver känna till"},
    {"type":"list","items":[
      "Avtalskunder: besök som INGÅR i avtalet (avtalsärenden, rondering, egenkontroller) faktureras aldrig separat - de täcks av kundens årspremie. Lägg inga fakturarader för själva avtalsbesöket.",
      "Merförsäljning: gör du något UTÖVER avtalet hos en avtalskund lägger du tjänsterader som vanligt - kundens prislista styr priset, och kontoret fakturerar det separat från premien.",
      "Engångsärenden (privat och företag) faktureras när du avslutar ärendet - underlaget är exakt de rader du fyllt i.",
      "Alla priser du anger är exklusive moms - momsen läggs på fakturan automatiskt."
    ]},
    {"type":"callout","variant":"success","title":"Tumregeln","text":"Ett komplett ifyllt ärende blir en korrekt faktura utan handpåläggning. Saknas rader eller priser måste kontoret jaga uppgifter i efterhand - och fakturan till kunden försenas."},
    {"type":"callout","variant":"info","title":"Det du INTE behöver göra","text":"Skapa fakturor, skicka dem, bevaka betalningar eller hantera påminnelser - allt det sköter kontoret och Fortnox. Din insats är ärendet."},
    {"type":"link","slug":"guide-prissattning","label":"Prissättning, marginaler och interna kostnader","description":"Hur du sätter rätt pris i ärendet - tjänsterader, artikel-kalkylatorn och Prisguiden."}
  ]$json$::jsonb
WHERE slug = 'guide-fakturering';

INSERT INTO intranet_documents (slug, title, summary, section, category, sort_order, requires_acknowledgement, audience_roles, content)
VALUES (
  'guide-fakturering-kontor',
  'Fakturering från ärende till betalning',
  'För dig som fakturerar: alla ärendetyper, kundtyper och merförsäljning - och hela kedjan från underlag till betald faktura.',
  'handbok',
  'ekonomi',
  18,
  false,
  ARRAY['admin', 'koordinator'],
  $json$[
    {"type":"p","text":"Den här guiden är för dig som sköter faktureringen. Allt utgår från sidan Fakturering, som har tre flikar: Privat & Företag, Avtalskunder och Merförsäljning Avtal. Vilken flik ett underlag hamnar i avgörs av ärendetyp och kundtyp - och det är det viktigaste att kunna."},
    {"type":"h2","text":"Hela kedjan"},
    {"type":"chain","title":"Från ärende till betalning","steps":["Ärende / Period","Underlag","Godkännande","Fortnox","Kunden","Betald"],"labels":["Teknikern / Avtalet","Fakturering-sidan","Du","Faktura + bokföring","Mail / adress","Klart"]},
    {"type":"h2","text":"Ärendetyper - vart tar de vägen?"},
    {"type":"list","items":[
      "Engångsärenden (privat och företag): teknikern avslutar ärendet och underlaget hamnar under Privat & Företag.",
      "Besök som ingår i avtal (avtalsärenden, rondering, egenkontroller): faktureras ALDRIG separat - de täcks av kundens årspremie. Ser du sådana rader är något fel.",
      "Extraarbeten hos avtalskunder (merförsäljning): tjänster utöver avtalet hamnar under Merförsäljning Avtal och faktureras separat från premien.",
      "Avtalens årspremier: genereras som perioder under Avtalskunder utifrån kundens faktureringsfrekvens."
    ]},
    {"type":"h2","text":"Kundtyper"},
    {"type":"list","items":[
      "Privatpersoner: engångsärenden med ROT/RUT-hantering - avdraget följer med till Fortnox automatiskt när raderna är rätt markerade.",
      "Företag: engångsärenden utan avdrag - fakturamail, adress och referens hämtas från kundens faktureringsinställningar.",
      "Avtalskunder: årspremie enligt frekvens (månads-, kvartals- eller årsvis) plus eventuell merförsäljning enligt kundens prislista.",
      "Kedjekunder (multisite): faktureras per enhet - systemet väljer rätt Fortnox-kund automatiskt, även när enheter delar organisationsnummer."
    ]},
    {"type":"h2","text":"Merförsäljning - extraintäkten på avtalen"},
    {"type":"p","text":"Merförsäljning är allt en avtalskund köper utöver sitt avtal. Priset styrs i första hand av kundens prislista (avtalade fasta priser per tjänst), annars av Prisguiden eller manuell prissättning i ärendet. Raderna samlas under Merförsäljning Avtal och faktureras separat från årspremien - sidan varnar med en banner om ofakturerade rader blir liggande."},
    {"type":"h2","text":"Prova själv"},
    {"type":"p","text":"Övningen nedan visar vägen för varje scenario och låter dig ta ett underlag genom hela statusresan:"},
    {"type":"interactive","component":"fakturering-demo"},
    {"type":"h2","text":"Statusarna under Privat & Företag"},
    {"type":"steps","items":[
      "Godkännas - underlaget väntar på din granskning: kontrollera rader, priser och ROT/RUT.",
      "Redo för Fortnox - godkänt och redo att skapas som faktura.",
      "Utkast i Fortnox - fakturan är skapad men inte bokförd ännu.",
      "Bokförd - låst i bokföringen, redo att skickas.",
      "Skickad - hos kunden. Passerar förfallodatumet flaggas den som Förfallen.",
      "Betald - betalningen registrerad, kedjan sluten."
    ]},
    {"type":"callout","variant":"warning","title":"Två saker att bevaka","text":"1. Merförsäljning Avtal-fliken: ofakturerade rader är intäkter som läcker - banner-varningen finns av en anledning. 2. Förfallna fakturor under Privat & Företag: följ upp dem innan de blir gamla."},
    {"type":"callout","variant":"info","title":"Fortnox gör tunga lyftet","text":"Kundkort skapas och uppdateras automatiskt vid fakturasändning, ROT/RUT-underlag följer med, och bokföringen sköts i Fortnox. Ditt jobb är att granska och godkänna rätt saker - inte att mata in dem igen."},
    {"type":"link","slug":"guide-fakturering","label":"Fakturering - din del som tekniker","description":"Teknikerns del av kedjan - bra att känna till när du jagar kompletta underlag."},
    {"type":"link","slug":"guide-prissattning","label":"Prissättning, marginaler och interna kostnader","description":"Hur priserna sätts i ärendet - prislistor, Prisguiden och marginaler."}
  ]$json$::jsonb
)
ON CONFLICT (slug) DO NOTHING;
