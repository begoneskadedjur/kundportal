-- Leads och tips i nytt formspråk (2026-10-24): de tre leadsguiderna skrivs om efter nya sidan.
--   guide-leads-tekniker  Tipsa om en ny kund   (tekniker, telefon och dator, modul guide-leads-tekniker.tsx)
--   guide-leads-saljare   Arbeta med dina leads (säljare, dator, modul guide-leads-saljare.tsx)
--   guide-leads-kontor    Fördela nya tips      (admin och koordinator, dator, modul guide-leads-kontor.tsx)
-- Delade skärmdelar i guider/_leads.tsx. Nytt på sidan: rutan Tips om ny kund med fyra frågor
-- (Vem gäller det?, Vad gäller det?, Hur når vi dem?, Vem tar det vidare?), fel som text under fälten,
-- sektionen Vad gäller det? högt upp i leaden, Ta leaden direkt på raden och grupper med förklaring.
-- Slugs, kategorier, målgrupper och sorteringsordning behålls. Idempotent.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- 1. Tipsa om en ny kund (tekniker)
(
  'guide-leads-tekniker',
  'Tipsa om en ny kund',
  'Skapa › Tips om ny kund: namn, vad det gäller och telefon. Koordinatorn fördelar, eller så tar du det själv.',
  'handbok', 'ekonomi',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Skapa › Tips om ny kund. Dina tips ligger under Mer › Leads och tips, på datorn i sidomenyn under Sälja","tar":"2 min","behover":"Namnet, vad det gäller och ett telefonnummer eller en e-post","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck [[Skapa|allman.plus]] och Tips om ny kund. Skriv namnet, vad det gäller och telefon eller e-post, och tryck [[Skicka tips|lead.tips]]. Koordinatorn fördelar tipset. Vill du höra av dig själv väljer du Jag tar det själv under Vem tar det vidare?"},
    {"type":"visning","steg":[
      {"text":"Tryck [[Skapa|allman.plus]].","ser":"Rutan Vad vill du göra? öppnas."},
      {"text":"Tryck Tips om ny kund.","ser":"Rutan Tips om ny kund öppnas med fyra frågor. Under 4 Vem tar det vidare? är Koordinatorn fördelar redan valt."},
      {"text":"Under 1 Vem gäller det?: tryck Företag eller namn * och skriv namnet, till exempel Exempel AB.","ser":"Namnet står i fältet. Kontaktperson kan du lämna tom."},
      {"text":"Under 2 Vad gäller det?: skriv kort vad kunden behöver hjälp med.","ser":"Texten står i rutan. Den som tar hand om tipset läser den först."},
      {"text":"Under 3 Hur når vi dem?: tryck Telefon och skriv numret.","ser":"Det räcker med telefon eller e-post."},
      {"text":"Tryck [[Skicka tips|lead.tips]].","ser":"Det står Tipset är skickat och leaden öppnas med Ingen ägare och Tips från och ditt namn. Koordinatorn ser den under Nya tips."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Det saknas uppgifter. Se de röda texterna.","svar":"Något av det som krävs är tomt. Under fältet står vad: Skriv företagets eller personens namn., Skriv kort vad kunden behöver hjälp med. eller Fyll i telefon eller e-post. Fyll i och tryck igen."},
      {"fraga":"Det står Det finns redan en lead med samma uppgifter","svar":"Någon har redan lagt upp kunden. Tryck [[Öppna den]] om du får se den, annars står det Be ägaren dela den med dig. Är det ändå en ny kund trycker du [[Skapa ändå]]."},
      {"fraga":"Rutan Nästa steg och Datum och tid dök upp","svar":"Du valde Jag tar det själv eller En kollega. En lead med ägare behöver ett nästa steg. Förslaget Ring och presentera oss nästa vardag 09:00 är redan ifyllt, ändra om det behövs. Ska koordinatorn fördela väljer du Koordinatorn fördelar."},
      {"fraga":"Jag hittar inte knappen på sidan Leads och tips i telefonen","svar":"Längst ner på sidan finns [[Tipsa om en ny kund|lead.tips]]. Du kan också använda [[Skapa|allman.plus]] och Tips om ny kund."}
    ]},
    {"type":"bra","items":[
      "Du kan också tipsa från ett privat- eller företagsärende: i steget Klart finns knappen Skapa lead. Kunden och ärendet följer då med.",
      "Med Jag tar det själv blir du ägare. Leaden kommer upp under Att göra den dag du valt för nästa steg.",
      "Sidan Leads och tips visar det du har tipsat om, äger eller fått delat med dig. Överst står hur många som är att göra. Flikarna är Att göra, Pågående, Nya tips och Alla.",
      "Org.nr och årspremie ligger under Fler uppgifter och är valfria. Källan blir alltid Teknikertips.",
      "Det du skriver under Vad gäller det? står högt upp i leaden, direkt under Nästa steg, så koordinatorn och säljaren ser det först."
    ]},
    {"type":"ovning","uppdrag":"Grannen Exempel AB har råttor i soprummet och vill ha fast avtal. Lämna ett tips som koordinatorn fördelar."},
    {"type":"quiz","fragor":[
      {"fraga":"Du vill att koordinatorn tar hand om tipset. Vad väljer du under Vem tar det vidare?","alternativ":["Koordinatorn fördelar","Jag tar det själv","En kollega"],"ratt":0,"forklaring":"Utan ägare hamnar tipset under Nya tips där koordinatorn fördelar det. Du står kvar som tipsare."},
      {"fraga":"Vad måste du alltid fylla i när du tipsar?","alternativ":["Org.nr och årspremie","Namnet, vad det gäller och telefon eller e-post","Kontaktperson"],"ratt":1,"forklaring":"Namnet, vad det gäller och en kontaktväg krävs. Resten fyller du i efteråt."},
      {"fraga":"Du väljer Jag tar det själv. Vad händer i rutan?","alternativ":["Nästa steg och Datum och tid visas, ifyllda med ett förslag","Tipset skickas direkt till koordinatorn","Du måste fylla i årspremien"],"ratt":0,"forklaring":"En lead med ägare behöver ett nästa steg. Förslaget är Ring och presentera oss nästa vardag 09:00."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-skapa-avtal-offert","label":"Skapa och skicka en offert eller ett avtal","description":"När kunden vill ha pris direkt."},
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i nya arbetsvyn","description":"Skapa, Mer och sidomenyn."}
    ],"fraga":"Koordinatorn, eller skriv en ticket till rollen Koordinator."}
  ]$json$::jsonb,
  1, false, true, 33, now(), array['technician']
),

-- 2. Arbeta med dina leads (säljare)
(
  'guide-leads-saljare',
  'Arbeta med dina leads',
  'Börja dagen i Att göra och avsluta varje kontakt med Klar, välj nästa, så att leaden alltid har ett nästa steg.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["säljare"],"var":"Leads (B2B) › Att göra","tar":"2 min","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna leaden överst under Att göra och gör det som står i Nästa steg. Tryck sedan [[Klar, välj nästa|allman.bock]], skriv vad som hände och välj ett nytt nästa steg med datum. Varje öppen lead ska ha ett nästa steg."},
    {"type":"visning","steg":[
      {"text":"Öppna Leads (B2B) i menyn. Tryck på leaden överst under Försenade.","ser":"Leaden öppnas. Rutan Nästa steg är röd och det står försenat. Under Vad gäller det? står kundens behov."},
      {"text":"Gör det som står, till exempel ring kunden. Tryck sedan [[Klar, välj nästa|allman.bock]].","ser":"Rutan blir Klart. Vad blev gjort och vad händer sedan?"},
      {"text":"Välj vad du gjorde. Samtal är förvalt.","ser":"Du kan välja Anteckning, Samtal, Mejl eller Möte."},
      {"text":"Skriv vad som hände under Vad hände?","ser":"Lämnar du rutan tom loggas Klart: och det gamla steget."},
      {"text":"Under Nytt nästa steg skriver du vad som ska göras i fältet Nästa steg.","ser":"Datum och tid är förvalt till nästa vardag 09:00. Ändra om det behövs."},
      {"text":"Tryck [[Spara]].","ser":"Det du gjorde hamnar under Aktivitet. Var leaden Ny blir den Kontaktad. Den försvinner ur Att göra tills datumet kommer."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Det står Skriv nästa steg och välj datum med röd text i rutan","svar":"Fältet Nästa steg eller Datum och tid är tomt. Fyll i båda och tryck Spara igen."},
      {"fraga":"Det står Inget nästa steg. Bestäm vad som ska hända och när.","svar":"Leaden saknar nästa steg. Tryck [[Välj nästa steg|lead.nasta-steg]] och fyll i vad och när."},
      {"fraga":"Knappen Klar, välj nästa syns inte","svar":"Du är tipsare på leaden men inte ägare, och den är inte delad med dig. Be ägaren dela den med dig."},
      {"fraga":"Det står Välj ett datum framåt i tiden då leaden ska vakna","svar":"Du valde Parkera. Välj en dag efter i dag under Vaknar den."},
      {"fraga":"Det står Leaden finns inte eller är inte delad med dig","svar":"Du öppnade en länk till en lead som du inte ser. Be ägaren dela den med dig."}
    ]},
    {"type":"bra","items":[
      "Ett samtal, mejl eller möte räknas som kontakt. En anteckning gör det inte. [[Ändra|rapport.penna]] flyttar nästa steg utan att logga något.",
      "Parkera kräver ett datum då leaden vaknar. Förlorad kräver en orsak.",
      "Besök bokat, Offert skickad och Vunnen sätts av sig själva. Skapa offerten med [[Skapa offert|dok.offert]] i leaden, annars flyttas den inte.",
      "Under Vad gäller det? står kundens behov och teknikerns tips. Tryck Redigera i sektionen för att ändra texten.",
      "Pil upp och ned flyttar i listan, Enter öppnar, N startar en ny lead och / går till sökrutan."
    ]},
    {"type":"interactive","component":"leads-steg","variant":"saljare"},
    {"type":"ovning","uppdrag":"Du har just ringt Exempel AB. De vill ha en offert. Logga samtalet och sätt nästa steg Skicka offert."},
    {"type":"quiz","fragor":[
      {"fraga":"Du har ringt kunden. Vad trycker du på för att både logga samtalet och sätta ett nytt steg?","alternativ":["Logga samtal","Klar, välj nästa","Ändra"],"ratt":1,"forklaring":"Logga samtal sparar bara samtalet. Ändra flyttar bara steget. Klar, välj nästa gör båda."},
      {"fraga":"Kunden har avtal med en annan leverantör ett halvår till. Vad gör du?","alternativ":["Markerar leaden som förlorad","Parkerar den med ett datum då den ska vakna","Låter nästa steg vara försenat"],"ratt":1,"forklaring":"En parkerad lead kommer tillbaka under Parkerade som vaknar i dag samma dag som du valde."},
      {"fraga":"Du skapar offerten direkt i guiden i stället för från leaden. Vad händer med leaden?","alternativ":["Den blir Offert skickad","Ingenting, den flyttas inte","Den blir Vunnen"],"ratt":1,"forklaring":"Bara dokument som skapas med Skapa offert i leaden flyttar den. Be annars koordinatorn sätta steget."}
    ]},
    {"type":"avslut","lankar":[],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 73, now(), array['säljare']
),

-- 3. Fördela nya tips (admin och koordinator)
(
  'guide-leads-kontor',
  'Fördela nya tips',
  'Fördela nya tips till rätt säljare: läs vad teknikern skrev under Vad gäller det? och överlåt leaden.',
  'handbok', 'guide',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Leads (B2B) › Nya tips","tar":"2 min","enhet":"dator"},
    {"type":"kortsvar","text":"Öppna fliken Nya tips och tipset överst. Läs teknikerns text under Vad gäller det?, tryck [[Överlåt eller dela|lead.dela]], välj säljaren under Ny ägare och tryck [[Överlåt|lead.agare]]. Vill du ta tipset själv trycker du [[Ta leaden|lead.agare]] direkt på raden."},
    {"type":"visning","steg":[
      {"text":"Öppna Leads (B2B) i menyn och tryck på fliken Nya tips.","ser":"Tipsen som väntar, äldst överst. Siffran vid fliken visar hur många. Ingen ägare står i gult och raden har knappen Ta leaden."},
      {"text":"Tryck på tipset överst.","ser":"Leaden öppnas med Ingen ägare och Tips från och teknikerns namn. Under Vad gäller det? står ärendet tipset kom från och teknikerns text."},
      {"text":"Tryck [[Överlåt eller dela|lead.dela]].","ser":"Rutan öppnas. Det står Ägare nu: ingen."},
      {"text":"Tryck på Ny ägare.","ser":"Listan med kollegor öppnas. Där står Välj kollega tills du har valt."},
      {"text":"Välj säljaren.","ser":"Knappen Överlåt är inte grå längre."},
      {"text":"Tryck [[Överlåt|lead.agare]].","ser":"Det står Leaden är överlåten till och säljarens namn. Ägaren syns i leadens huvud."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Knappen Överlåt går inte att trycka på","svar":"Den är grå tills du har valt en kollega under Ny ägare."},
      {"fraga":"Tipset ligger kvar under Nya tips","svar":"Nya tips visar också tips som fortfarande är Ny, även när de har en ägare. Tipset försvinner därifrån när säljaren loggar ett samtal, mejl eller möte, eller sätter steget Kontaktad."},
      {"fraga":"Det står Inga nya tips att fördela.","svar":"Alla tips har en ägare och har kontaktats. Inget väntar."},
      {"fraga":"Under Vad gäller det? står Saknas","svar":"Leaden skapades utan text. För kontoret är Vad gäller det? valfritt när en lead skapas. Ring kunden eller fråga den som tipsade. Tryck Redigera i sektionen och skriv in det du får veta."},
      {"fraga":"Jag gav tipset till fel person","svar":"Öppna leaden, tryck [[Överlåt eller dela|lead.dela]] igen och välj rätt säljare."}
    ]},
    {"type":"bra","items":[
      "Ett tips från ett ärende har ingen ägare och nästa steg Kontakta kunden om tipset om två dygn. Ett tips från Skapa saknar nästa steg. Målet är kontakt inom två arbetsdagar.",
      "[[Ta leaden|lead.agare]] finns direkt på raden när leaden saknar ägare, och under Fler åtgärder (⋯) i leaden.",
      "Tipsaren står kvar som tipsare när du överlåter, och får notiser när tipset får en offert och när det är vunnet.",
      "[[Boka besök|allman.kalender]] i leaden öppnar ärendemodalen ifylld. När ärendet sparas kopplas det och steget blir Besök bokat.",
      "Under Fler åtgärder (⋯) kan du sätta Besök bokat, Offert skickad och Vunnen för hand. Gör det bara när besöket eller offerten skapades utanför leaden."
    ]},
    {"type":"interactive","component":"leads-steg","variant":"kontor"},
    {"type":"ovning","uppdrag":"Anna Exempel har tipsat om Brf Exempelgården. Läs vad hon skrev och ge tipset till säljaren Sara Exempel."},
    {"type":"quiz","fragor":[
      {"fraga":"Var hittar du vad teknikern skrev i tipset?","alternativ":["Under Vad gäller det?, direkt under Nästa steg","Under Kontakt","Under Ursprung och kopplingar"],"ratt":0,"forklaring":"Teknikerns text sparas i Beskrivning och behov, som står under Vad gäller det? högt upp i leaden."},
      {"fraga":"Du vill ta ett tips själv. Vad trycker du på?","alternativ":["Ny lead med samma uppgifter","Ta leaden på raden","Klar, välj nästa"],"ratt":1,"forklaring":"Ta leaden gör dig till ägare direkt. Den finns på raden och under Fler åtgärder i leaden."},
      {"fraga":"En offert skapades direkt i guiden, inte från leaden. Leaden står kvar på Kontaktad. Vad gör du?","alternativ":["Sätter Offert skickad för hand under Fler åtgärder","Skapar en ny lead","Väntar, den flyttas av sig själv"],"ratt":0,"forklaring":"Systemet vet inte att offerten hör till leaden. Nödutgången under Fler åtgärder är till för just det."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-sokrutan-kontor","label":"Hitta med sökrutan","description":"Ctrl+K, snabbval och Boka in."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 74, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
