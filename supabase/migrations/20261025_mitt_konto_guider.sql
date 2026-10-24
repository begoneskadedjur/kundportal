-- Mitt konto i ny form (2026-10-25): sidan i grupper Profil, Visning, Appen på hemskärmen,
-- Säkerhet och Konto, för alla personalroller. Guiderna följer den nya sidan:
--   guide-mitt-konto              tekniker, telefon och dator   (guidemodul guide-mitt-konto.tsx,
--                                 interaktiv del nyvy/AppenPaHemskarmen)
--   guide-roller-och-vyer-kontor  admin, koordinator och säljare, dator (guidemodul guide-roller-och-vyer-kontor.tsx)
--   guide-roller-och-vyer         tekniker: raden på Mer heter nu Mitt konto (inte Mitt konto och visning)
-- Slugs, category och audience_roles behålls så att länkar och läsloggen fungerar. Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- 1. Ställ in Mitt konto och visningen (tekniker)
(
  'guide-mitt-konto',
  'Ställ in Mitt konto och visningen',
  'Tema, hjälptexter, genomgångarna, portalen som app på hemskärmen och byt lösenord, på samma sida.',
  'handbok', 'introduktion',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Mer › Mitt konto. På datorn Mitt konto under Hjälp i sidomenyn","tar":"4 min","enhet":"mobil"},
    {"type":"kortsvar","text":"Mitt konto har fem grupper: Profil, Visning, Appen på hemskärmen, Säkerhet och Konto. Under Visning väljer du tema och stänger av hjälptexterna och genomgångarna när du kan sidorna. Under Säkerhet byter du lösenord. Valen sparas på ditt konto, inte bara i telefonen."},
    {"type":"visning","steg":[
      {"text":"Öppna Mitt konto. I telefonen: tryck [[Mer|allman.meny]] och sedan Mitt konto under Konto. På datorn: tryck Mitt konto under Hjälp i sidomenyn.","ser":"Överst står Profil med ditt namn. Under det Visning med Tema och reglagen."},
      {"text":"Tryck [[Ljust|konto.sol]] under Tema.","ser":"Portalen blir ljus direkt. Mörkt gör den mörk igen, och Som enheten följer telefonens eller datorns inställning."},
      {"text":"Tryck reglaget Visa hjälptexter.","ser":"Reglaget blir grått. Förklaringarna under rubrikerna försvinner och en (i)-knapp visar dem när du behöver."},
      {"text":"Tryck [[Visa genomgångarna igen|allman.aterstall]].","ser":"Det står Genomgångarna visas igen. Alla genomgångar visas på nytt nästa gång du öppnar sidorna."},
      {"text":"Bläddra ner till Säkerhet. Tryck Nuvarande lösenord och skriv ditt lösenord.","ser":"Lösenordet står som punkter. Ögat i fältet visar vad du skriver."},
      {"text":"Skriv det nya lösenordet i Nytt lösenord och en gång till i Bekräfta nytt lösenord.","ser":"Punkterna under Lösenordskrav: blir gröna: minst 8 tecken, en stor bokstav, en liten bokstav och en siffra. Det står också Lösenorden är lika."},
      {"text":"Tryck [[Byt lösenord|allman.las]].","ser":"Det står Lösenord uppdaterat! Nästa gång loggar du in med det nya."}
    ]},
    {"type":"interactive","component":"nyvy/AppenPaHemskarmen"},
    {"type":"felsok","items":[
      {"fraga":"Det står Felaktigt nuvarande lösenord","svar":"Lösenordet du skrev under Nuvarande lösenord stämmer inte. Tryck på ögat i fältet och skriv det igen. Har du glömt det: logga ut och tryck Glömt lösenord? på inloggningssidan."},
      {"fraga":"Det står Lösenorden matchar inte","svar":"Nytt lösenord och Bekräfta nytt lösenord är olika. Under Lösenordskrav: står Lösenorden är inte lika än tills de är samma."},
      {"fraga":"Jag kan inte trycka Spara ändringar","svar":"Knappen går att trycka först när du har ändrat namn, e-postadress eller telefonnummer under Profil."},
      {"fraga":"Jag ser ingen knapp under Appen på hemskärmen","svar":"På datorn visas bara stegen, knappen finns i telefonen. Ligger portalen redan på hemskärmen står det Installerad. Portalen körs som app på den här enheten."},
      {"fraga":"Jag vill tillbaka till den gamla vyn","svar":"Reglaget Ny arbetsvy visas under Visning bara om du har fått rätt att byta själv. Då kan du också slå på den nya vyn igen där. Annars: fråga koordinatorn."}
    ]},
    {"type":"bra","items":[
      "Valen under Visning sparas på ditt konto. De gäller i telefonen och på datorn.",
      "Temat byter du också snabbt med raden under Konto på Mer i telefonen, och med temaknappen uppe till höger på datorn.",
      "Genomgången visas en gång per sida. Frågetecknet uppe till höger, Visa mig hur, visar den igen när du vill. Mitt konto har också en.",
      "Ändrar du e-postadress skickas en bekräftelse till den nya adressen.",
      "Logga ut finns längst ner på Mitt konto under Konto, på Mer i telefonen och längst ner i sidomenyn på datorn."
    ]},
    {"type":"ovning","uppdrag":"Byt till ljust tema och stäng av genomgångarna som visas första gången du öppnar en sida."},
    {"type":"quiz","fragor":[
      {"fraga":"Du stänger av Visa hjälptexter i telefonen. Vad händer på datorn?","alternativ":["Hjälptexterna syns fortfarande på datorn","Hjälptexterna är avstängda där också","Du måste stänga av dem på datorn också"],"ratt":1,"forklaring":"Valen sparas på ditt konto, inte bara i telefonen."},
      {"fraga":"Du vill att portalen blir mörk på kvällen när telefonen blir mörk. Vad väljer du under Tema?","alternativ":["Mörkt","Ljust","Som enheten"],"ratt":2,"forklaring":"Som enheten följer telefonens eller datorns inställning för mörkt och ljust."},
      {"fraga":"Vilket nytt lösenord godkänns?","alternativ":["exempel26","EXEMPEL2026","Exempel2026"],"ratt":2,"forklaring":"Lösenordet måste ha minst 8 tecken, en stor bokstav, en liten bokstav och en siffra."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Bottenmenyn, sidomenyn och Mer."},
      {"slug":"guide-ticket-systemet","label":"Tickets","description":"Fråga en kollega."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 5, now(), array['technician']
),

-- 2. Hitta rätt i portalen (kontoret)
(
  'guide-roller-och-vyer-kontor',
  'Hitta rätt i portalen',
  'Sidomenyn, Mitt konto, byta lösenord och tema, och växlaren för dig som har flera roller.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["admin","koordinator","säljare"],"var":"Sidomenyn till vänster och växlaren uppe till höger","tar":"3 min","enhet":"dator"},
    {"type":"kortsvar","text":"Sidorna ligger i grupper i menyn till vänster. Längst ner finns [[Mitt konto]], där du ändrar dina uppgifter, väljer tema och byter lösenord. Har du flera roller byter du vy i växlaren uppe till höger."},
    {"type":"visning","steg":[
      {"text":"Tryck på en grupp i menyn till vänster, till exempel Försäljning.","ser":"Gruppen fälls ut och visar sina sidor. Grupper med grön rubrik är öppna från början."},
      {"text":"Tryck [[Mitt konto]] längst ner i menyn.","ser":"Sidan Mitt konto öppnas med grupperna Profil, Visning, Appen på hemskärmen, Säkerhet och Konto."},
      {"text":"Fyll i Nuvarande lösenord, Nytt lösenord och Bekräfta nytt lösenord under Säkerhet. Tryck [[Byt lösenord|allman.las]].","ser":"Det står Lösenord uppdaterat! Punkterna under Lösenordskrav: blir gröna när de är uppfyllda."},
      {"text":"Har du flera roller: tryck på vyn du vill byta till i växlaren uppe till höger.","ser":"Den vyns Översikt öppnas. Växlaren syns bara om du har mer än en roll."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Jag ser ingen växlare","svar":"Du har bara en roll. Admin lägger till roller under Användarkonton (Personal), Roller & vyer."},
      {"fraga":"Det står Lösenorden matchar inte","svar":"Nytt lösenord och Bekräfta nytt lösenord är olika. Skriv samma i båda. Under Lösenordskrav: står Lösenorden är lika när de stämmer."},
      {"fraga":"Det står Lösenordet måste innehålla minst en stor bokstav","svar":"Lösenordet ska ha minst 8 tecken, en stor bokstav, en liten bokstav och en siffra. Punkterna under Lösenordskrav: visar vad som saknas."},
      {"fraga":"Det står Felaktigt nuvarande lösenord","svar":"Det du skrev under Nuvarande lösenord stämmer inte. Tryck på ögat i fältet och se vad du skriver. Har du glömt det: logga ut och tryck Glömt lösenord? på inloggningssidan."}
    ]},
    {"type":"bra","items":[
      "Under Visning på Mitt konto väljer du tema: Mörkt, Ljust eller Som enheten. Valet sparas på ditt konto. Temaknappen uppe till höger byter också.",
      "Ändrar du e-postadress under Profil skickas en bekräftelse till den nya adressen. Spara ändringar går att trycka först när något är ändrat.",
      "Appen på hemskärmen: på datorn visas stegen för iPhone och Android. Själva knappen finns när du öppnar Mitt konto i telefonen.",
      "Sök i systemet uppe i mitten, eller Ctrl och K, hittar det din roll får se. Koordinatorn och admin hittar ärenden och kunder. Säljaren hittar kunder, offerter och avtal och webbleads.",
      "Roller ändrar admin under Användarkonton (Personal), Roller & vyer. Under Konto på Mitt konto ser du vilka roller du har."
    ]},
    {"type":"ovning","uppdrag":"Byt ditt lösenord till ett nytt och byt sedan till teknikervyn. Du har både rollen koordinator och tekniker."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har både admin och tekniker. Hur kommer du till teknikerns sidor?","alternativ":["Loggar ut och in igen som tekniker","Trycker Tekniker i växlaren uppe till höger","Öppnar Mitt konto"],"ratt":1,"forklaring":"Växlaren byter vy direkt, utan att du loggar ut."},
      {"fraga":"Du trycker Byt lösenord och det står Lösenorden matchar inte. Vad är fel?","alternativ":["Nuvarande lösenord är fel","Nytt lösenord och Bekräfta nytt lösenord är olika","Lösenordet är för kort"],"ratt":1,"forklaring":"Skriv exakt samma nya lösenord i båda fälten."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-rapportera-tillbud-kontor","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Den gula knappen överst i sidomenyn."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 13, now(), array['admin','koordinator','säljare']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;

-- 3. Hitta rätt i nya arbetsvyn (tekniker): raden på Mer heter nu Mitt konto
update public.intranet_documents
set content = replace(content::text, 'Mitt konto och visning', 'Mitt konto')::jsonb,
    source_updated_at = now()
where slug = 'guide-roller-och-vyer'
  and content::text like '%Mitt konto och visning%';
