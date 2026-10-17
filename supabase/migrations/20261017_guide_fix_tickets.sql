-- 20261017_guide_fix_tickets.sql
-- Guiderna om tickets efter ändringen av vem som får markera löst (20261017_ticket_status_rpc.sql).
--   guide-ticket-systemet           Skicka och svara på en ticket (tekniker, telefon)
--   guide-ticket-systemet-kontor    Skicka och svara på en ticket (admin, koordinator, dator)
-- Förut stod det att bara den som skrev första kommentaren kan markera löst. Nu gäller:
-- författaren, den som är nämnd i ticketen (med namn, grupp eller @alla) samt admin och
-- koordinator kan markera löst och återöppna. Ett svar i en löst ticket öppnar den igen,
-- oavsett vem som svarar. Svara-knappen syns alltid på pekskärm.
-- Hela innehållet skrivs om. Idempotent: on conflict skriver om guiden.

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values

-- ─── 1. Ticket, tekniker ───
(
  'guide-ticket-systemet',
  'Skicka och svara på en ticket',
  'Fråga kontoret eller en kollega direkt i ärendet med @namn, och svara när någon frågar dig.',
  'handbok', 'kommunikation',
  $json$[
    {"type":"intro","roller":["technician"],"var":"Ärendet › pratbubblan uppe till höger","tar":"3 min","behover":"Ett ärende att skriva i","enhet":"mobil"},
    {"type":"kortsvar","text":"Tryck på pratbubblan i ärendet, skriv @ och välj vem som ska svara. Då blir kommentaren en ticket. Frågor till dig hittar du under klockan uppe till höger, och du svarar med [[Svara]] så att svaret hamnar i samma tråd."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på pratbubblan uppe till höger.","ser":"Panelen Kommunikation öppnas nerifrån."},
      {"text":"Tryck i rutan och skriv @. Tryck på personen eller gruppen som ska svara.","ser":"Namnet står i rutan, till exempel @Anna Exempel. Grupperna @tekniker, @koordinator, @admin och @alla når alla med den rollen."},
      {"text":"Skriv frågan efter namnet och tryck på pappersplanet.","ser":"Kommentaren syns i listan med status Öppen. Den du nämnde får en notis."},
      {"text":"När någon har skrivit till dig: tryck på klockan uppe till höger.","ser":"Sidan Tickets öppnas. Under Att göra ligger det som väntar på ditt svar."},
      {"text":"Tryck på ticketen.","ser":"Kommunikation öppnas med hela tråden."},
      {"text":"Tryck [[Svara]] under kommentaren, skriv ditt svar och tryck på pappersplanet.","ser":"Ovanför rutan står det Svarar och namnet. När svaret är skickat försvinner ticketen från Att göra."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"Personen jag vill fråga finns inte i listan","svar":"Listan visar bara aktiva tekniker, koordinatorer och admins. Kunder och säljare går inte att nämna."},
      {"fraga":"Det står Bara den som skrev ticketen, den som är nämnd i den eller admin och koordinator kan ändra status","svar":"Du har inte startat ticketen och är inte nämnd i den, varken med namn, med @tekniker eller med @alla. Ticketen ligger kvar som öppen. Be den som startade den, eller koordinatorn, markera den som löst."},
      {"fraga":"Det står Filtypen stöds inte eller Filen är för stor (max 5MB)","svar":"Du kan bifoga bilder (JPG, PNG, WEBP, HEIC) och PDF, högst 5 MB per fil."},
      {"fraga":"Jag svarade men ticketen ligger kvar under Att göra","svar":"Svaret skrevs direkt i rutan och blev en ny ticket. Tryck [[Svara]] under kommentaren först, så hamnar svaret i samma tråd."},
      {"fraga":"Det står Kunde inte skapa kommentar","svar":"Kommentaren sparades inte. Kontrollera att du har täckning och skicka igen."}
    ]},
    {"type":"bra","items":[
      "Bara de du nämner med @ får en notis. Utan @ blir det en vanlig kommentar i ärendet.",
      "Kunderna ser aldrig kommunikationen. Den är intern.",
      "Siffran på klockan visar hur många öppna tickets du är med i.",
      "I telefonen heter flikarna Att göra, Svar, Bevaka, Nytt, Alla och Klart. Klart är de lösta. Svarar någon i en löst ticket öppnas den igen, oavsett vem som svarar.",
      "När inget mer behövs: tryck på pilen till höger på ticketen och sedan [[Markera löst]]. Det kan du göra om du startade ticketen eller är nämnd i den, med namn, med @tekniker eller med @alla. Admin och koordinator kan alltid."
    ]},
    {"type":"ovning","uppdrag":"Fråga koordinatorn Anna Exempel om Familjen Exempel vill ha kvittot på mejl. När Anna har svarat: svara henne i samma tråd."},
    {"type":"quiz","fragor":[
      {"fraga":"Du vill att koordinatorn Anna ska svara på en fråga i ärendet. Vad skriver du?","alternativ":["Bara frågan, utan namn","@Anna Exempel och sedan frågan","Ett sms till Anna"],"ratt":1,"forklaring":"Med @ blir kommentaren en ticket och Anna får en notis. Utan @ får ingen veta att du har frågat."},
      {"fraga":"Anna har svarat dig med en ny fråga. Hur svarar du så att det hamnar rätt?","alternativ":["Skriver direkt i rutan överst","Trycker Svara under hennes kommentar och skriver","Startar en ny ticket med @Anna Exempel"],"ratt":1,"forklaring":"Svara lägger svaret i samma tråd. Skriver du direkt i rutan blir det en ny ticket, och den gamla ligger kvar under Att göra."},
      {"fraga":"Var hittar du snabbast det som väntar på ditt svar?","alternativ":["Klockan uppe till höger, fliken Att göra","Under Mitt konto","I ärendehistoriken"],"ratt":0,"forklaring":"Klockan öppnar Tickets. Att göra är det som väntar på dig."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer","label":"Hitta rätt i portalen","description":"Menyn, Mitt konto och appen på hemskärmen."},
      {"slug":"guide-rapportera-tillbud","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Den gula knappen i menyn."},
      {"slug":"guide-sokrutan-tekniker","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Koordinatorn, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 10, now(), array['technician']
),

-- ─── 2. Ticket, kontor ───
(
  'guide-ticket-systemet-kontor',
  'Skicka och svara på en ticket',
  'Fråga en kollega i ärendet med @namn, svara på det som väntar på dig och avsluta tickets som är klara.',
  'handbok', 'kommunikation',
  $json$[
    {"type":"intro","roller":["admin","koordinator"],"var":"Ärendet › pratbubblan uppe till höger, och Tickets i menyn","tar":"4 min","behover":"Ett ärende att skriva i","enhet":"dator"},
    {"type":"kortsvar","text":"Tryck på pratbubblan i ärendet, skriv @ och välj vem som ska svara. Det som väntar på dig ligger under Tickets › Väntar på ditt svar. Svara med [[Svara]] och avsluta med [[Markera löst]] när inget mer behövs."},
    {"type":"visning","steg":[
      {"text":"Öppna ärendet och tryck på pratbubblan uppe till höger.","ser":"Panelen Kommunikation öppnas till höger."},
      {"text":"Skriv @ i rutan och tryck på personen eller gruppen som ska svara.","ser":"Listan Nämn visar Grupper och Personer. Piltangenterna och Enter fungerar också."},
      {"text":"Skriv frågan och tryck [[Skicka]].","ser":"Kommentaren får status Öppen och den du nämnde får en notis. Ctrl och Enter skickar också."},
      {"text":"Tryck Tickets i menyn. Koordinatorn har den under Planering, admin under Organisation.","ser":"Sidan Tickets öppnas på fliken Väntar på ditt svar. Klockan uppe till höger går också dit."},
      {"text":"Tryck på ticketen.","ser":"Kommunikation öppnas med ärendet till vänster och tråden till höger."},
      {"text":"Håll muspekaren över kommentaren och tryck [[Svara]]. Skriv svaret och tryck [[Skicka]].","ser":"Ovanför rutan står det Svarar och namnet. Ticketen försvinner från Väntar på ditt svar."},
      {"text":"När inget mer behövs: tryck på pilen till höger på ticketen och sedan [[Markera löst]].","ser":"Ticketen flyttas till Avslutade. Där finns [[Återöppna]] om frågan kommer tillbaka."}
    ]},
    {"type":"felsok","items":[
      {"fraga":"En ticket som jag markerade som löst ligger öppen igen","svar":"Någon har svarat i den. Ett svar i en löst ticket öppnar den igen, oavsett vem som svarar. Läs svaret och tryck [[Markera löst]] igen när inget mer behövs."},
      {"fraga":"Personen jag letar efter finns inte i listan","svar":"Listan visar bara aktiva tekniker, koordinatorer och admins. Säljare och kunder går inte att nämna."},
      {"fraga":"Jag ser ingen Svara-knapp","svar":"Den syns när du håller muspekaren över kommentaren. På en pekskärm syns den alltid."},
      {"fraga":"Det står Inga tickets i denna kategori","svar":"Byt flik för att se andra tickets. Lösta tickets ligger under Avslutade."},
      {"fraga":"Ett rött meddelande visas när jag trycker Markera löst","svar":"Statusen sparades inte och ticketen ligger kvar som öppen. Kontrollera att du är inloggad och försök igen. Hjälper det inte: skriv till admin och ange ärendet."}
    ]},
    {"type":"bra","items":[
      "Bara de du nämner med @ får en notis. @alla når alla användare, använd den sparsamt. Kunderna ser aldrig kommunikationen.",
      "Admin och koordinator kan markera alla tickets som lösta och återöppna dem. Tekniker kan det för tickets de har startat eller är nämnda i, med namn eller via sin grupp. Ett svar i en löst ticket öppnar den igen.",
      "Väntar på ditt svar är din att göra-lista. Svar till dig är svar på dina kommentarer, och Väntar på andras svar är frågor du ställt som ingen har svarat på.",
      "Färgen till vänster på kortet visar läget: röd betyder att någon väntar på dig, gul att du väntar på andra.",
      "Siffran på klockan visar hur många öppna tickets du är med i."
    ]},
    {"type":"ovning","uppdrag":"Fråga teknikern Erik Exempel hur många fällor han satte ut hos Familjen Exempel. När Erik har svarat: svara honom och markera ticketen som löst."},
    {"type":"quiz","fragor":[
      {"fraga":"En tekniker har frågat dig något i ett ärende. Var ser du det?","alternativ":["Tickets › Väntar på ditt svar","Tickets › Väntar på andras svar","Under Uppdateringar"],"ratt":0,"forklaring":"Väntar på ditt svar visar allt där någon har nämnt dig och väntar på ditt svar."},
      {"fraga":"Erik startade ticketen och frågan är besvarad. Kan du som koordinator markera den som löst?","alternativ":["Nej, bara Erik kan det","Ja, admin och koordinator kan alltid markera löst","Bara om Erik nämnde dig"],"ratt":1,"forklaring":"Admin och koordinator kan markera alla tickets som lösta och återöppna dem. Tekniker kan det för tickets de har startat eller är nämnda i."},
      {"fraga":"Du svarar genom att skriva direkt i rutan överst. Vad händer?","alternativ":["Svaret hamnar i tråden","Det blir en ny ticket och den gamla ligger kvar","Ingenting skickas"],"ratt":1,"forklaring":"Svara lägger svaret i samma tråd. Annars blir det en ny ticket."}
    ]},
    {"type":"avslut","lankar":[
      {"slug":"guide-roller-och-vyer-kontor","label":"Hitta rätt i portalen","description":"Sidomenyn, Mitt konto och växlaren."},
      {"slug":"guide-rapportera-tillbud-kontor","label":"Rapportera ett tillbud, en avvikelse eller en olycka","description":"Rapportera och utred från datorn."},
      {"slug":"guide-sokrutan-kontor","label":"Sökrutan","description":"Hitta ärenden och kunder snabbt."}
    ],"fraga":"Admin, eller skriv i Teams-chatten Systemet."}
  ]$json$::jsonb,
  1, false, true, 11, now(), array['admin','koordinator']
)

on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, section = excluded.section, category = excluded.category,
  content = excluded.content, requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published, sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at, audience_roles = excluded.audience_roles;
