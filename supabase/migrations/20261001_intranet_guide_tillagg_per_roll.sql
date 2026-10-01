-- Guiden Tilläggsstationer delas upp per roll med hopp-block och stabila ankare
-- (#tekniker, #koordinator, #fakturering, #admin, #fragor). Nytt: produktval,
-- låsta betalda stationer och Produkter under Stationer & Fällor.
update intranet_documents
set content = $json$[
  {"type":"p","text":"En tilläggsstation är en station som kunden vill ha utöver det som ingår i avtalet. Kunden betalar för den separat. Guiden är uppdelad efter vem du är, så hoppa direkt till ditt avsnitt."},
  {"type":"callout","variant":"success","title":"Det viktigaste på en halv minut","text":"Teknikern kryssar i Tillägg utöver avtal, väljer produkt och svarar på frågan om arbetstid. Kunden betalar direkt för tiden som är kvar till avtalets nästa periodstart. Faktureringsansvarig beslutar tillägget i avtalskartan, och därefter faktureras det varje avtalsår på en egen faktura i samband med årsfakturan. När kunden har betalat kan stationens typ och betalning inte ändras."},
  {"type":"jump","title":"Hoppa till det som gäller dig","items":[
    {"label":"Tekniker","description":"Sätta ut, välja produkt, arbetstid, låsta och borttagna stationer","target":"tekniker"},
    {"label":"Koordinator","description":"Boka rätt ärende på rätt enhet","target":"koordinator"},
    {"label":"Faktureringsansvarig","description":"Besluta tillägg, fakturorna, priser och räkneexempel","target":"fakturering"},
    {"label":"Admin","description":"Produkter per stationstyp och kundpriser","target":"admin"},
    {"label":"Vanliga frågor","description":"Korta svar på det som brukar dyka upp","target":"fragor"}
  ]},
  {"type":"chain","title":"Kedjan i korthet","steps":["Boka etablering","Sätt ut och markera","Svara om arbetstid","Faktura för nu","Besluta","Faktura varje år"],"labels":["Koordinator","Tekniker","Tekniker","Systemet","Fakturering","Systemet"]},

  {"type":"h2","id":"tekniker","text":"Tekniker: ute hos kunden"},
  {"type":"jump","items":[
    {"label":"Sätta ut en tilläggsstation","target":"tekniker-satta-ut"},
    {"label":"Välja produkt","target":"tekniker-produkt"},
    {"label":"Per år, per månad eller per kontroll","target":"betalsatt"},
    {"label":"Frågan om arbetstid","target":"tekniker-arbetstid"},
    {"label":"När stationen är låst","target":"tekniker-last"},
    {"label":"Ta bort eller hämta upp","target":"tekniker-ta-bort"}
  ]},
  {"type":"h3","id":"tekniker-satta-ut","text":"Sätta ut en tilläggsstation"},
  {"type":"steps","items":[
    "Öppna etableringsärendet, eller kontrollrundan om du sätter ut tillägget under en kontroll, och placera stationen på kartan eller planritningen som vanligt.",
    "Välj stationstyp och produkt. Har typen bara en produkt är den redan vald.",
    "Kryssa i Tillägg utöver avtal.",
    "Välj hur stationen betalas: per år, per månad eller per kontroll. Kundens pris står bredvid varje val.",
    "Spara. Stationen blir en bricka att besluta i kundens avtalskarta och kontoret får en notis."
  ]},
  {"type":"list","items":[
    "Per år och per månad går bara att välja när kunden har ett avtal.",
    "Saknas priset sparas stationen ändå och du får en varning. Kontoret lägger in priset.",
    "Har du satt ut nya tillägg per år eller per månad får du frågan om arbetstid när du trycker Färdig med etablering."
  ]},
  {"type":"h3","id":"tekniker-produkt","text":"Välja produkt"},
  {"type":"p","text":"Välj den fälla eller station du faktiskt satte ut, till exempel Aurotrap Nature eller Aurotrap Collect. Vilka produkter som finns att välja bestäms per stationstyp av admin."},
  {"type":"list","items":[
    "Produkten är en intern kostnad. Kunden ser bara stationstypen och betalar samma pris oavsett produkt.",
    "Byter du fälla på en befintlig station väljer du den nya produkten i Redigera station. Kostnaden räknas om automatiskt.",
    "Listan innehåller bara själva fällorna och stationerna. Förbrukning som batterier och CO2-patroner läggs som artiklar på ärendet."
  ]},
  {"type":"h3","id":"tekniker-arbetstid","text":"Frågan om arbetstid"},
  {"type":"p","text":"När du trycker Färdig med etablering, eller klarmarkerar kontrollrundan, frågar portalen hur mycket arbetstid som ska debiteras för att hantera tilläggen. Svara i timmar per år: tiden det tar att kontrollera, byta och rapportera tilläggsstationerna under ett helt år. Hela eller halva timmar."},
  {"type":"list","items":[
    "Enhet utan tillägg sedan tidigare: skriv antalet timmar. Behövs ingen extra tid skriver du 0.",
    "Enhet som redan har tillägg: Nej är förvalt och timmarna blir som idag. Väljer du Ja skriver du det nya totala antalet timmar.",
    "Dina timmar är ett förslag. Faktureringsansvarig kan ändra dem när tilläggen beslutas."
  ]},
  {"type":"h3","id":"tekniker-last","text":"När stationen är låst"},
  {"type":"p","text":"Har kunden redan betalat för en tilläggsstation per år eller per månad står det Betald till och med och ett datum under stationstyperna i Redigera station. Då går tre saker inte att ändra:"},
  {"type":"list","items":[
    "Stationstyp. Den valda typen står kvar, de andra är nedtonade.",
    "Rutan Tillägg utöver avtal.",
    "Betalningen: per år, per månad eller per kontroll."
  ]},
  {"type":"p","text":"Allt annat går att ändra som vanligt: produkt, position, serienummer, preparat, foto, anteckning och status. Du kan flytta stationen, kontrollera den i kontrollrundan och se dess historik precis som förut."},
  {"type":"callout","variant":"info","title":"Ska typen eller betalningen ändras?","text":"Ta bort stationen och placera en ny. Kunden har betalat för stationen som den är, därför går det inte att ändra i efterhand. Avtalsstationer och tillägg som inte är fakturerade än låses aldrig."},
  {"type":"h3","id":"tekniker-ta-bort","text":"Ta bort eller hämta upp en tilläggsstation"},
  {"type":"p","text":"Du kan ta bort en tilläggsstation med status Borttagen, med rutan Hämta upp stationen efter kontrollen i kontrollrundan eller med Ta bort-knappen. Är stationen redan betald framåt kommer ett förtydligande först:"},
  {"type":"list","items":[
    "Du ser att stationen är betald till och med ett datum, oftast dagen före avtalets nästa periodstart.",
    "Kunden får ingen återbetalning om den tas bort nu, och den faktureras inte längre från nästa period.",
    "Låt den stå kvar om kunden inte uttryckligen vill ta bort den.",
    "Vill kunden ändå ta bort den trycker du en gång till. I kontrollrundan heter knappen då Ta bort ändå, i stationsformuläret Klicka igen för att ta bort.",
    "Är stationen inte fakturerad än står det Inte fakturerad än. Tas den bort räknas den inte med."
  ]},

  {"type":"h2","id":"koordinator","text":"Koordinator: boka etableringen"},
  {"type":"p","text":"Stationer hos en avtalskund sätts ut i ett ärende av typen Etablering Avtalskund. Boka det på den enhet där stationerna ska stå, alltså rätt enhet om kunden har flera."},
  {"type":"list","items":[
    "Samma ärende används när teknikern sätter ut stationer som ingår i avtalet och stationer som är tillägg.",
    "Tillägg kan också sättas ut under en vanlig kontrollrunda. Då är det kontrollärendet som bär tillägget.",
    "Per år och per månad kräver att kunden har ett avtal. Saknas avtalet kan teknikern bara välja per kontroll."
  ]},

  {"type":"h2","id":"fakturering","text":"Faktureringsansvarig: besluta och fakturera"},
  {"type":"jump","items":[
    {"label":"Besluta tillägget","target":"fakturering-besluta"},
    {"label":"Tillägg utöver eller Lägg till i avtalet","target":"fakturering-val"},
    {"label":"Fakturorna","target":"fakturering-fakturor"},
    {"label":"Var priset kommer ifrån","target":"priser"},
    {"label":"Räkneexempel","target":"rakneexempel"}
  ]},
  {"type":"h3","id":"fakturering-besluta","text":"Besluta tillägget i avtalskartan"},
  {"type":"steps","items":[
    "Klicka på notisen Tillägg att besluta, eller på kunden under Kräver åtgärd i Befintliga kunder.",
    "Du hamnar i kundens avtalskarta med en gul remsa överst. Tryck Öppna § 5 och välj en av knapparna vid brickan.",
    "I Besluta tillägg ser du vad teknikern satte ut med kundens årspris per station, och arbetstiden förifylld med teknikerns förslag. Ändra pris eller timmar om det behövs.",
    "Välj Tillägg utöver avtalet eller Lägg till i avtalet och spara."
  ]},
  {"type":"callout","variant":"warning","title":"Utan beslut ingen årsdebitering","text":"Kunden betalar då bara för tiden fram till avtalets nästa periodstart, och tillägget följer inte med till nästa avtalsår. Kunden står kvar under Kräver åtgärd tills tilläggen är beslutade."},
  {"type":"h3","id":"fakturering-val","text":"Tillägg utöver avtalet eller Lägg till i avtalet"},
  {"type":"p","text":"Oftast är det Tillägg utöver avtalet som gäller."},
  {"type":"interactive","component":"tillagg-jamforelse"},
  {"type":"h3","id":"fakturering-fakturor","text":"Fakturorna"},
  {"type":"list","items":[
    "När ärendet stängs faktureras tiden fram till avtalets nästa periodstart som merförsäljning, under Fakturering › Merförsäljning Avtal. Fakturan kan skickas innan tilläggen är beslutade, eftersom beloppet är detsamma oavsett beslut.",
    "Den 1:a varje månad planerar systemet avtalens fakturor tolv månader framåt. Tillägget blir en egen planerad faktura bredvid årsfakturan.",
    "Antalet stationer räknas om precis innan fakturan skickas. En station som tagits bort faktureras inte.",
    "Det blir inga krediteringar. Det som redan är fakturerat står kvar.",
    "Interna kostnader, alltså produkterna och den interna arbetstiden, blir aldrig fakturarader."
  ]},
  {"type":"h3","id":"priser","text":"Var priset kommer ifrån"},
  {"type":"list","items":[
    "Stationer per år och per månad: tjänst 144 Tilläggsstation per år. Ljusfällor har en egen tjänst, 79 Ljusfälla generell. Per månad är årspriset delat med tolv.",
    "Per kontroll: tjänst 43.",
    "Arbetstid för att hantera tilläggen: kundens timpris, tjänst 135.",
    "Systemet letar i den här ordningen: avtalets prislista, kundens prislista (för en enhet utan egen lista huvudkontorets), listan Standardtjänster och sist tjänstens grundpris.",
    "I Standardtjänster kostar 144 och 79 i dag 3 600 kr per år och 135 kostar 1 016 kr per timme. Tjänst 43 har inget standardpris."
  ]},
  {"type":"callout","variant":"warning","title":"Saknas priset helt","text":"Stationen sätts ut ändå, men den faktureras inte förrän det finns ett pris. Lägg in priset i kundens prislista, eller skriv in det direkt i Besluta tillägg."},
  {"type":"h3","id":"rakneexempel","text":"Räkneexempel"},
  {"type":"p","text":"Så här blir det för en enhet med 4 mekaniska fällor. Byt datum och timmar och se hur beloppen ändras. Siffrorna räknas med samma formler som portalen använder."},
  {"type":"interactive","component":"tillagg-rakneexempel"},

  {"type":"h2","id":"admin","text":"Admin: produkter och priser"},
  {"type":"p","text":"Vilka produkter teknikern kan välja mellan styrs per stationstyp under Stationer & Fällor."},
  {"type":"steps","items":[
    "Gå till Stationer & Fällor och öppna stationstypen, till exempel Mekanisk fälla.",
    "Under Produkter söker du fram artikeln på namn eller artikelnummer och klickar för att lägga till den.",
    "Markera vilken produkt som ska vara förval och ändra ordningen med pilarna.",
    "Tryck Spara ändringar. Nästa gång en station av typen placeras ut finns produkterna i listan."
  ]},
  {"type":"list","items":[
    "Bara aktiva artiklar går att välja. Saknas en produkt lägger du upp den under Artiklar (Inköp) först.",
    "Artikelns inköpspris blir utrustningskostnaden i marginalen för tillägget.",
    "Koppla bara själva fällorna och stationerna, inte tillbehör som batterier eller CO2-patroner.",
    "Kundpriserna för tillägg sätts i prislistorna, se Var priset kommer ifrån."
  ]},

  {"type":"h2","id":"betalsatt","text":"Tre sätt att ta betalt"},
  {"type":"list","items":[
    "Per år: kunden betalar för tiden kvar till avtalets nästa periodstart och sedan årspriset varje avtalsår, på en egen faktura i samband med årsfakturan. Det vanligaste valet.",
    "Per månad: årspriset delat med tolv, fakturerat varje månad. Första gången betalar kunden för dagarna fram till nästa månadsskifte.",
    "Per kontroll: kunden betalar vid etableringen och för varje kontrollrunda där stationen kontrolleras.",
    "Per år och per månad kräver att kunden har ett avtal, och de ska beslutas i avtalskartan."
  ]},
  {"type":"h2","id":"vem-gor-vad","text":"Vem gör vad"},
  {"type":"interactive","component":"tillagg-roller"},
  {"type":"h2","id":"kedjan","text":"Hela kedjan steg för steg"},
  {"type":"interactive","component":"tillagg-kedja"},

  {"type":"h2","id":"fragor","text":"Vanliga frågor"},
  {"type":"h3","text":"Varför kan jag inte byta stationstyp på en station?"},
  {"type":"p","text":"Stationen är en tilläggsstation som kunden redan har betalat för. Typ och betalning styr vad kunden betalar, därför är de låsta. Ta bort stationen och placera en ny om något av det ska ändras."},
  {"type":"h3","text":"Kan jag byta produkt på en betald station?"},
  {"type":"p","text":"Ja. Produkten påverkar bara vår interna kostnad, inte kundens pris. Kostnaden räknas om till den nya produktens inköpspris."},
  {"type":"h3","text":"Varför är priset lägre nu än det fasta priset?"},
  {"type":"p","text":"Kunden betalar bara för tiden som är kvar till avtalets nästa periodstart. Sätts stationerna ut 29 september och avtalsåret börjar 1 juli är det 275 dagar kvar. Då blir det 2 348 × 275 / 365 = 1 769 kr per station. Från 1 juli betalar kunden hela årspriset, 2 348 kr."},
  {"type":"h3","text":"Jag vet inte hur mycket arbetstid det blir. Kan jag hoppa över frågan?"},
  {"type":"p","text":"Nej, inte när enheten saknar tillägg sedan tidigare. Gör din bästa bedömning, eller skriv 0 om ingen extra tid behövs. Har enheten redan tillägg är Nej förvalt och timmarna blir som idag. Ditt svar är ett förslag, och faktureringsansvarig kan ändra timmarna när tilläggen beslutas."},
  {"type":"h3","text":"Vad händer om kunden saknar pris?"},
  {"type":"p","text":"Har kunden inget eget pris används listan Standardtjänster. Finns inget pris alls sätts stationen ut men faktureras inte förrän priset har lagts in, i prislistan eller i Besluta tillägg."},
  {"type":"h3","text":"Vad är skillnaden mellan Tillägg utöver avtalet och Lägg till i avtalet?"},
  {"type":"p","text":"Tillägg utöver avtalet ligger bredvid avtalet och faktureras på en egen faktura i samband med årsfakturan. Premien rörs inte. Lägg till i avtalet höjer årspremien och gör stationerna till en del av avtalet, och då finns ingen egen tilläggsfaktura."},
  {"type":"h3","text":"Måste vi planera om fakturorna efter beslutet?"},
  {"type":"p","text":"Nej. Den 1:a varje månad planerar systemet avtalens fakturor tolv månader framåt och tar med tillägget som en egen faktura bredvid årsfakturan. Antalet stationer räknas om igen precis innan fakturan skickas."},
  {"type":"h3","text":"Vad händer om ingen beslutar tilläggen?"},
  {"type":"p","text":"Kunden betalar delen för nu när ärendet stängs, men sedan blir det ingen årsdebitering för tillägget. Kunden står kvar under Kräver åtgärd, och notisen ligger kvar, tills tilläggen är beslutade."},
  {"type":"h3","text":"Fakturan skapas innan tilläggen är beslutade. Hur hänger det ihop?"},
  {"type":"p","text":"När ärendet stängs skapas merförsäljningsfakturan för tiden fram till avtalets nästa periodstart direkt, oberoende av beslutet i avtalskartan. Beloppet är detsamma oavsett om man sedan väljer Tillägg utöver avtalet eller Lägg till i avtalet. Beslutet styr bara vad som händer från nästa periodstart."},
  {"type":"h3","text":"Kunden tar bort stationer. Får de pengar tillbaka?"},
  {"type":"p","text":"Nej, det blir inga krediteringar. Nästa tilläggsfaktura räknas på de stationer som står ute då. Tas den sista tilläggsstationen på enheten bort går arbetstiden till 0."},
  {"type":"h3","text":"Vad händer när avtalet sägs upp?"},
  {"type":"p","text":"Tillägget följer avtalet och slutar när avtalet slutar. Tilläggsfakturor planeras bara så länge avtalet löper, och när avtalet har slutat avslutas tilläggets rader. Det som redan är fakturerat står kvar."},
  {"type":"link","slug":"guide-placera-stationer","label":"Placera stationer och fällor","description":"Så sätter du ut stationer med GPS, foto och kommentar."},
  {"type":"link","slug":"guide-fakturering-kontor","label":"Fakturering från ärende till betalning","description":"Så granskas, godkänns och skickas merförsäljningsfakturan."}
]$json$::jsonb,
    source_updated_at = now(),
    updated_at = now()
where slug = 'guide-tillaggsstationer';
