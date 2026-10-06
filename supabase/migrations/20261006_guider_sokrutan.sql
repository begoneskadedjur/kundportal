-- Två intranätguider om sökrutan (Ctrl+K): en för tekniker, en för koordinator och admin.
-- Ingen läskvittens. Kördes 2026-10-06 via execute_sql; filen är idempotent (on conflict).

insert into public.intranet_documents
  (slug, title, summary, section, category, content, version, requires_acknowledgement,
   is_published, sort_order, source_updated_at, audience_roles)
values
(
  'guide-sokrutan-tekniker',
  'Sökrutan',
  'Hitta ärenden, kunder, offerter och sidor med Ctrl+K. Vad du kan skriva, vad ikonerna betyder och hur du gör med tangenterna.',
  'handbok', 'guide',
  $json$[
    {"type":"p","text":"Sökrutan hittar dina ärenden, kunder, offerter, avtal och sidor från ett och samma ställe. Du skriver, sökrutan förstår vad du menar och visar rätt träffar."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"Öppna sökrutan","description":"Ctrl+K, rutan högst upp eller mobilen","target":"oppna"},
      {"label":"Vad du kan skriva","description":"Nummer, org.nr, telefon, postnummer och fritext","target":"skriva"},
      {"label":"Snabbval och åtgärder","description":"Skapa offert eller avtal direkt från kunden","target":"snabbval"},
      {"label":"Prova själv","description":"Övningssökruta med exempeldata","target":"prova"}
    ]},

    {"type":"h2","id":"oppna","text":"Öppna sökrutan"},
    {"type":"list","items":[
      "Tryck Ctrl+K. På Mac trycker du Cmd+K. Samma kortkommando stänger rutan igen.",
      "Klicka på rutan Sök i systemet högst upp på sidan.",
      "I mobilen trycker du på förstoringsglaset uppe till höger."
    ]},

    {"type":"h2","id":"skriva","text":"Vad du kan skriva"},
    {"type":"p","text":"Du behöver inte välja vad du letar efter. Sökrutan läser det du skriver och visar till höger hur den tolkar det, till exempel tolkas som ärendenummer."},
    {"type":"list","items":[
      "9011 eller BE-0009011 ger ärendet med det numret. Nollorna i början spelar ingen roll.",
      "Ett organisationsnummer, som 559900-0001 eller 5599000001, ger kunden och kundens ärenden. Personnummer fungerar på samma sätt.",
      "Ett telefonnummer, som 070-123 45 67 eller +46 70 123 45 67. Mellanslag och bindestreck spelar ingen roll.",
      "En e-postadress, hel eller en del av den. Det som avgör är att @ finns med.",
      "Ett kundnummer, som 4711. Sökrutan letar efter både ärendenummer och kundnummer.",
      "Ett postnummer med mellanslag, som 186 97. Utan mellanslag läses det som ett vanligt nummer.",
      "Fritext, som solrosen lastkaj. Det kan vara kundnamn, adress, skadedjur eller ort. Alla ord måste finnas med i träffen."
    ]},
    {"type":"callout","variant":"info","title":"Minst två tecken","text":"Träffarna kommer medan du skriver. Skriv minst två tecken."},

    {"type":"h2","id":"ikoner","text":"Ikonerna"},
    {"type":"p","text":"Varje träff har en ikon som visar vad det är. Till höger på raden står samma sak i text."},
    {"type":"interactive","component":"sok-ikoner","variant":"tekniker"},

    {"type":"h2","id":"hittar","text":"Vad du hittar"},
    {"type":"list","items":[
      "Ärenden där du är tekniker. Det gäller även ärenden du delar med andra tekniker.",
      "Alla kunder. Väljer du en kund kommer du till den samlade stationsvyn med kundens stationer.",
      "Offerter och avtal som du har skapat eller står som ansvarig på.",
      "Sidor i din meny, till exempel schemat eller tillbud."
    ]},
    {"type":"p","text":"Träffarna kommer i grupper: Exakt träff, Ärenden, Kunder, Dokument, Arkiv, Sidor och Åtgärder. Exakt träff ligger alltid överst. Varje grupp visar högst fem rader. Hittar du inte det du söker, skriv fler ord."},

    {"type":"h2","id":"snabbval","text":"Snabbval och åtgärder"},
    {"type":"p","text":"Den markerade raden kan ha fler val under sig. Enter gör det första valet. Tab hoppar till nästa."},
    {"type":"list","items":[
      "Kund: Öppna stationsvyn, Skapa offert och Skapa avtal. Offerten och avtalet öppnas med kunden redan ifylld.",
      "Avtalsärende: Öppna och Stationsvy.",
      "När rutan är tom: Skapa offert, Skapa avtal, Rapportera tillbud och Mitt schema.",
      "Du kan börja med ett verb, till exempel skapa offert solrosen. Då kommer åtgärderna först."
    ]},

    {"type":"h2","id":"tangenter","text":"Tangenter"},
    {"type":"list","items":[
      "↑ och ↓ flyttar markeringen mellan raderna.",
      "Enter öppnar den markerade raden.",
      "Tab byter till nästa snabbval på raden. Shift+Tab går tillbaka.",
      "Esc stänger sökrutan.",
      "Ctrl+K eller Cmd+K öppnar och stänger."
    ]},
    {"type":"p","text":"Du kan också klicka direkt på en rad eller ett snabbval."},

    {"type":"h2","id":"arkiv","text":"Arkivet"},
    {"type":"p","text":"Gamla ärenden från ClickUp syns inte i vanliga sökningar. Skriv ordet arkiv någonstans i sökningen, till exempel möss arkiv eller arkiv 4120. Då kommer de gamla ärendena med i en egen grupp, Arkiv (ClickUp), med grå ikon. Du ser bara dina egna gamla ärenden."},

    {"type":"h2","id":"senast","text":"Senast öppnade"},
    {"type":"p","text":"När rutan är tom ser du det du öppnat senast, upp till sex rader. Listan sparas i webbläsaren på den telefon eller dator du använder."},

    {"type":"h2","id":"prova","text":"Prova själv"},
    {"type":"p","text":"Övningen använder påhittade kunder och ärenden. Ingenting öppnas och ingenting sparas. Klicka i rutan och skriv."},
    {"type":"interactive","component":"sok-ovning","variant":"tekniker"}
  ]$json$::jsonb,
  1, false, true, 24, now(), array['technician']
),
(
  'guide-sokrutan-kontor',
  'Sökrutan',
  'Hitta ärenden, kunder, leads, tekniker och fakturor med Ctrl+K. Vad du kan skriva, ikonerna, snabbvalen och tangenterna.',
  'handbok', 'guide',
  $json$[
    {"type":"p","text":"Sökrutan hittar ärenden, kunder, offerter, avtal, webbleads, tekniker, fakturor och sidor från ett och samma ställe. Du skriver, sökrutan förstår vad du menar och visar rätt träffar. Från träffen kan du boka in, skapa offert eller öppna schemat direkt."},
    {"type":"jump","title":"Hoppa till","items":[
      {"label":"Öppna sökrutan","description":"Ctrl+K, sidomenyn eller mobilen","target":"oppna"},
      {"label":"Vad du kan skriva","description":"Nummer, org.nr, telefon, postnummer och fritext","target":"skriva"},
      {"label":"Snabbval och åtgärder","description":"Boka in, ny offert, nytt ärende","target":"snabbval"},
      {"label":"Prova själv","description":"Övningssökruta med exempeldata","target":"prova"}
    ]},

    {"type":"h2","id":"oppna","text":"Öppna sökrutan"},
    {"type":"list","items":[
      "Tryck Ctrl+K. På Mac trycker du Cmd+K. Samma kortkommando stänger rutan igen.",
      "Klicka på rutan Sök i systemet högst upp på sidan.",
      "Klicka på Sök i sidomenyn.",
      "I mobilen trycker du på förstoringsglaset uppe till höger."
    ]},

    {"type":"h2","id":"skriva","text":"Vad du kan skriva"},
    {"type":"p","text":"Du behöver inte välja vad du letar efter. Sökrutan läser det du skriver och visar till höger hur den tolkar det, till exempel tolkas som ärendenummer."},
    {"type":"list","items":[
      "9011 eller BE-0009011 ger ärendet med det numret. Nollorna i början spelar ingen roll.",
      "Ett organisationsnummer, som 559900-0001 eller 5599000001, ger kunden, kundens ärenden, avtal, leads och fakturor. Personnummer fungerar på samma sätt.",
      "Ett telefonnummer, som 070-123 45 67 eller +46 70 123 45 67. Mellanslag och bindestreck spelar ingen roll.",
      "En e-postadress, hel eller en del av den. Det som avgör är att @ finns med.",
      "Ett nummer, som 4711. Sökrutan letar efter ärendenummer, kundnummer, fakturanummer, Fortnox-nummer och enhetskod på samma gång.",
      "Ett postnummer med mellanslag, som 186 97. Utan mellanslag läses det som ett vanligt nummer.",
      "Fritext, som solrosen lastkaj. Det kan vara kundnamn, adress, skadedjur, ort eller en teknikers namn. Alla ord måste finnas med i träffen."
    ]},
    {"type":"callout","variant":"info","title":"Minst två tecken","text":"Träffarna kommer medan du skriver. Skriv minst två tecken."},

    {"type":"h2","id":"ikoner","text":"Ikonerna"},
    {"type":"p","text":"Varje träff har en ikon som visar vad det är. Till höger på raden står samma sak i text."},
    {"type":"interactive","component":"sok-ikoner","variant":"kontor"},

    {"type":"h2","id":"hittar","text":"Vad du hittar"},
    {"type":"h3","text":"Koordinator"},
    {"type":"list","items":[
      "Alla ärenden: privatärenden, företagsärenden och avtalsärenden.",
      "Alla kunder, alla offerter och alla avtal.",
      "Webbleads från formuläret på begone.se.",
      "Tekniker, med genvägar till schemat och bokningsassistenten.",
      "Fakturor, på fakturanummer, Fortnox-nummer, kundnamn eller org.nr.",
      "Sidor i din meny."
    ]},
    {"type":"h3","text":"Admin"},
    {"type":"list","items":[
      "Allt som koordinatorn hittar.",
      "Personalkortet för varje tekniker.",
      "Adminportalens sidor i menyn."
    ]},
    {"type":"p","text":"Träffarna kommer i grupper: Exakt träff, Ärenden, Kunder, Dokument, Arkiv, Leads (webb), Tekniker, Fakturor, Sidor och Åtgärder. Exakt träff ligger alltid överst. Varje grupp visar högst fem rader. Hittar du inte det du söker, skriv fler ord."},

    {"type":"h2","id":"snabbval","text":"Snabbval och åtgärder"},
    {"type":"p","text":"Den markerade raden kan ha fler val under sig. Enter gör det första valet. Tab hoppar till nästa."},
    {"type":"list","items":[
      "Ärende: Öppna, Boka in om ärendet saknar tid och Flytta om det redan är bokat. Avtalsärenden har även Kundkort.",
      "Kund: Kundkort, Stationer, Ny offert och Nytt avtal. Offerten och avtalet öppnas med kunden redan ifylld.",
      "Tekniker: Schemat och Bokningsassistent. Admin får även Personalkort.",
      "Lead (webb): Öppna, som tar dig till förfrågan i Leads (webb).",
      "Faktura: Öppna, som tar dig till fakturan i Fakturering."
    ]},
    {"type":"h3","text":"Åtgärder som följer träffen"},
    {"type":"list","items":[
      "Söker du på en tekniker får du Boka in ärende hos och teknikerns namn. Den öppnar bokningsassistenten med teknikern vald.",
      "Söker du på en kund får du Ny offert till och Nytt avtal för kunden. Har kunden avtal får du även Nytt ärende hos kunden.",
      "När rutan är tom: Nytt ärende, Hitta ledig tid och Rapportera tillbud."
    ]},
    {"type":"p","text":"Du kan börja med ett verb. Då kommer åtgärderna först. Skriv till exempel boka in hos följt av en teknikers förnamn, ny offert till följt av ett kundnamn, eller bara nytt ärende."},

    {"type":"h2","id":"tangenter","text":"Tangenter"},
    {"type":"list","items":[
      "↑ och ↓ flyttar markeringen mellan raderna.",
      "Enter öppnar den markerade raden.",
      "Tab byter till nästa snabbval på raden. Shift+Tab går tillbaka.",
      "Esc stänger sökrutan.",
      "Ctrl+K eller Cmd+K öppnar och stänger."
    ]},
    {"type":"p","text":"Du kan också klicka direkt på en rad eller ett snabbval."},

    {"type":"h2","id":"arkiv","text":"Arkivet"},
    {"type":"p","text":"Gamla ärenden från ClickUp och gamla dokument från Oneflow syns inte i vanliga sökningar. Skriv ordet arkiv någonstans i sökningen, till exempel möss arkiv eller arkiv 4120. Då kommer de med i en egen grupp med grå ikon, märkta Arkiv (ClickUp) eller Arkiv (Oneflow). Arkivträffar har inga snabbval för bokning."},

    {"type":"h2","id":"senast","text":"Senast öppnade"},
    {"type":"p","text":"När rutan är tom ser du det du öppnat senast, upp till sex rader. Listan sparas i webbläsaren på den dator eller telefon du använder, en lista per portal."},

    {"type":"h2","id":"prova","text":"Prova själv"},
    {"type":"p","text":"Övningen använder påhittade kunder, ärenden och kollegor. Ingenting öppnas och ingenting sparas. Växla mellan Koordinator och Admin för att se skillnaden."},
    {"type":"interactive","component":"sok-ovning","variant":"kontor"},
    {"type":"link","slug":"guide-schemavyn","label":"Schemavyn","description":"Vyer, sök, filter och drag & drop i schemat."}
  ]$json$::jsonb,
  1, false, true, 25, now(), array['admin','koordinator']
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  section = excluded.section,
  category = excluded.category,
  content = excluded.content,
  requires_acknowledgement = excluded.requires_acknowledgement,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  source_updated_at = excluded.source_updated_at,
  audience_roles = excluded.audience_roles;
