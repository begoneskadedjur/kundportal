-- ============================================================
-- Ny guide i Handboken: Tilläggsstationer.
-- Hela kedjan från utsättning till årsfaktura, med roller, en lodrät
-- tidslinje med skärmbilder, ett räkneexempel och vanliga frågor.
-- De interaktiva blocken slås upp i INTERACTIVE_COMPONENTS i
-- src/pages/shared/IntranetDocumentPage.tsx (tillagg-*).
-- Fakta kontrollerade mot koden 2026-09-30. Synlig för alla roller.
-- ============================================================

INSERT INTO intranet_documents (slug, title, summary, section, category, sort_order, requires_acknowledgement, content)
VALUES (
  'guide-tillaggsstationer',
  'Tilläggsstationer',
  'Stationer utöver avtalet, från utsättning till faktura: vem gör vad, vad kunden betalar nu och varje avtalsår, arbetstiden för att hantera tilläggen och beslutet i avtalskartan.',
  'handbok',
  'ekonomi',
  23,
  false,
  $json$[
    {"type":"p","text":"En tilläggsstation är en station som kunden vill ha utöver det som ingår i avtalet. Kunden betalar för den separat. Guiden följer en tilläggsstation hela vägen, från att koordinatorn bokar etableringen till att kunden får sin faktura varje år."},
    {"type":"callout","variant":"success","title":"Det viktigaste på en halv minut","text":"Teknikern kryssar i Tillägg utöver avtal och svarar på frågan om arbetstid. Kunden betalar direkt för tiden som är kvar till avtalets nästa periodstart. Faktureringsansvarig beslutar tillägget i avtalskartan, och därefter faktureras det varje avtalsår på en egen faktura i samband med årsfakturan. Utan beslut blir det ingen årsfaktura för tillägget."},
    {"type":"chain","title":"Kedjan i korthet","steps":["Boka etablering","Sätt ut och markera","Svara om arbetstid","Faktura för nu","Besluta","Faktura varje år"],"labels":["Koordinator","Tekniker","Tekniker","Systemet","Fakturering","Systemet"]},
    {"type":"h2","text":"Vem gör vad"},
    {"type":"interactive","component":"tillagg-roller"},
    {"type":"callout","variant":"info","title":"Det finns ingen roll som heter kundansvarig","text":"Den som beslutar tilläggen är faktureringsansvarig, alltså den som har behörigheten att godkänna fakturor. Behörigheten sätts per person och inte per roll, så både admin och koordinator kan ha den. Det är också de som får notisen."},
    {"type":"h2","text":"Hela kedjan steg för steg"},
    {"type":"interactive","component":"tillagg-kedja"},
    {"type":"h2","text":"Räkneexempel"},
    {"type":"p","text":"Så här blir det för en enhet med 4 mekaniska fällor. Byt datum och timmar och se hur beloppen ändras. Siffrorna räknas med samma formler som portalen använder."},
    {"type":"interactive","component":"tillagg-rakneexempel"},
    {"type":"h2","text":"Tillägg utöver avtalet eller Lägg till i avtalet"},
    {"type":"p","text":"Det här är beslutet faktureringsansvarig tar i avtalskartan. Oftast är det Tillägg utöver avtalet som gäller."},
    {"type":"interactive","component":"tillagg-jamforelse"},
    {"type":"h2","text":"Tre sätt att ta betalt"},
    {"type":"list","items":[
      "Per år: kunden betalar för tiden kvar till avtalets nästa periodstart och sedan årspriset varje avtalsår, på en egen faktura i samband med årsfakturan. Det vanligaste valet.",
      "Per månad: årspriset delat med tolv, fakturerat varje månad. Första gången betalar kunden för dagarna fram till nästa månadsskifte.",
      "Per kontroll: kunden betalar vid etableringen och för varje kontrollrunda där stationen kontrolleras.",
      "Per år och per månad kräver att kunden har ett avtal, och de ska beslutas i avtalskartan."
    ]},
    {"type":"h2","text":"Var priset kommer ifrån"},
    {"type":"list","items":[
      "Stationer per år och per månad: tjänst 144 Tilläggsstation per år. Ljusfällor har en egen tjänst, 79 Ljusfälla generell. Per månad är årspriset delat med tolv.",
      "Per kontroll: tjänst 43.",
      "Arbetstid för att hantera tilläggen: kundens timpris, tjänst 135.",
      "Systemet letar i den här ordningen: avtalets prislista, kundens prislista (för en enhet utan egen lista huvudkontorets), listan Standardtjänster och sist tjänstens grundpris.",
      "I Standardtjänster kostar 144 och 79 i dag 3 600 kr per år och 135 kostar 1 016 kr per timme. Tjänst 43 har inget standardpris."
    ]},
    {"type":"callout","variant":"warning","title":"Saknas priset helt","text":"Stationen sätts ut ändå, men den faktureras inte förrän det finns ett pris. Teknikern får en varning när stationen sparas. Lägg in priset i kundens prislista, eller skriv in det direkt i Besluta tillägg."},
    {"type":"h2","text":"Vanliga frågor"},
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
    {"type":"h3","text":"Kunden tar bort stationer. Får de pengar tillbaka?"},
    {"type":"p","text":"Nej, det blir inga krediteringar. Nästa tilläggsfaktura räknas på de stationer som står ute då. Tas den sista tilläggsstationen på enheten bort går arbetstiden till 0."},
    {"type":"h3","text":"Vad händer när avtalet sägs upp?"},
    {"type":"p","text":"Tillägget följer avtalet och slutar när avtalet slutar. Tilläggsfakturor planeras bara så länge avtalet löper, och när avtalet har slutat avslutas tilläggets rader. Det som redan är fakturerat står kvar."},
    {"type":"link","slug":"guide-placera-stationer","label":"Placera stationer och fällor","description":"Så sätter du ut stationer med GPS, foto och kommentar."},
    {"type":"link","slug":"guide-fakturering-kontor","label":"Fakturering från ärende till betalning","description":"Så granskas, godkänns och skickas merförsäljningsfakturan."}
  ]$json$::jsonb
)
ON CONFLICT (slug) DO NOTHING;
