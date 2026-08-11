-- ============================================================
-- Korrigering av handboksguider efter verifiering mot dagens UI.
--
-- guide-avbryta-arenden: guiden beskrev det gamla flödet med
-- statusen "Slaskad", obligatoriskt dokumentationsfält och en
-- Danger Zone med permanent radering. Inget av det finns idag:
-- flödet är knappen "Ta bort ärende" -> mjuk borttagning
-- (status 'Borttaget', all data behålls, kunden ser
-- "Avslutat utan åtgärd"). Permanent radering går inte att
-- göra från portalen.
--
-- guide-foljearenden: följeärenden kan numera skapas även från
-- avtalsärenden och rondering (EditContractCaseModal,
-- RonderingCaseModal), inte bara privat/företag.
-- ============================================================

UPDATE intranet_documents SET
  title = 'Avbryta och ta bort ärenden',
  summary = 'Så avbryter du ärenden på rätt sätt - och varför ingenting någonsin raderas på riktigt.',
  content = $json$[
    {"type":"callout","variant":"success","title":"Den viktigaste regeln","text":"Ärenden försvinner aldrig på riktigt. Ta bort i portalen är en mjuk borttagning: ärendet döljs ur alla vyer men kommentarer, bilder, historik och tidsloggar bevaras i databasen."},
    {"type":"h2","text":"Så avbryter du ett ärende"},
    {"type":"list","items":[
      "Skriv först en kommentar i ärendet om VARFÖR det avbryts - t.ex. Kunden avbokade pga flytt, Kunden svarar inte efter 3 försök, eller Dubblett - se ärende #12345. Kommentaren är sökbar i efterhand.",
      "Öppna ärendet i redigeringsläge och klicka Ta bort ärende.",
      "Bekräfta i dialogen. Ärendet markeras som borttaget och döljs från listor och scheman - all data behålls."
    ]},
    {"type":"p","text":"Ärendet får status Borttaget. I kundportalen visas det som Avslutat utan åtgärd, så kunden ser aldrig interna formuleringar."},
    {"type":"h2","text":"När ska du ta bort ett ärende?"},
    {"type":"list","items":[
      "Kunden vill avboka eller avbryta.",
      "Kunden går inte att nå trots flera försök.",
      "Ärendet är inte längre aktuellt eller jobbet kan inte utföras.",
      "Dubblettärenden och testärenden."
    ]},
    {"type":"callout","variant":"warning","text":"Ta ALDRIG bort ett ärende bara för att rensa upp i listan eller för att kunden är missnöjd. Historiken är värdefull om kunden hör av sig igen - och den behövs för statistik och uppföljning.","title":"Ta inte bort i onödan"},
    {"type":"h2","text":"Kan det ångras?"},
    {"type":"p","text":"Ja. Eftersom all data finns kvar kan en administratör återställa ärendet - kontakta kontoret om du tagit bort fel ärende. Permanent radering ur databasen går inte att göra från portalen."},
    {"type":"callout","variant":"info","title":"Har du hört ordet slaska?","text":"Det är vårt gamla uttryck för precis det här: att avbryta ett ärende utan att förstöra datan. Samma princip gäller fortfarande - skillnaden är att det idag görs med Ta bort-knappen i stället för en status."}
  ]$json$::jsonb
WHERE slug = 'guide-avbryta-arenden';

UPDATE intranet_documents SET
  content = jsonb_set(
    jsonb_set(
      content,
      '{8,items}',
      $json$[
        "Får jag provision för följeärendet? Ja - det räknas som ett helt eget ärende med eget pris och egen tidloggning.",
        "Kan jag skapa följeärende från vilket ärende som helst? Ja - det fungerar från privat-, företags- och avtalsärenden (även rondering). Från ett följeärende går det däremot inte att skapa ytterligare följeärenden.",
        "Vad händer om jag väljer fel skadedjur? Ingen fara - du kan ändra skadedjurstypen i det nya ärendet efteråt.",
        "Ser kontoret att jag skapade ärendet? Ja, det loggas vem som skapade följeärendet och från vilket ärende."
      ]$json$::jsonb
    ),
    '{9,text}',
    to_jsonb('Kontrollera att ärendet inte redan är ett följeärende och att det är öppnat i redigeringsläge. Syns knappen ändå inte - fråga koordinatorn.'::text)
  )
WHERE slug = 'guide-foljearenden';
