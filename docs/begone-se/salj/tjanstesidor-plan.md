# Plan för tjänstesidorna och startsidan

Säljchefen och SEO-chefen, 2026-10-05. Den gemensamma planen som copy-agenten implementerar, en sida i taget. Den bygger på [tjanstesidor-saljunderlag.md](tjanstesidor-saljunderlag.md) och [tjanstesidor-seo-underlag.md](tjanstesidor-seo-underlag.md), som står kvar som underlag med siffror och citat. Där underlagen och den här planen skiljer sig gäller planen. Inga sajtfiler är ändrade.

Christians beställning 2026-10-05, i sak: tjänstesidorna och startsidan är både SEO-sidor och landningssidor för Google Ads. De beskriver vad vi gör i stället för vad det är värt, de innehåller påhitt och process som inte gäller varje ärende, och de känns som artikelkrafs. De ska vara auktoritära, proffsiga och förmedla kunskap, högt värde och kompetens, på den nivå som Begones plats i branschen motsvarar. Storleken eller koncernens plats skrivs aldrig ut.

Gäller före allt i planen: SKRIVGUIDE (avsnitt 13 och 14 med 14.4), TJANSTEINNEHALL (bara Belagt får påstås), KUNDPORTAL-FUNKTIONER, REGLER, företagsfakta och `src/lib/sajt.ts`.

## 1. Mål och mätning

**Mål:** fler förfrågningar och samtal per besök på sidorna i serien, med samma eller bättre position på de skyddade frågorna.

**Det som mäts per sida,** 28 dagar före och 28 dagar efter att sidan är klar:

1. Förfrågningar i webbförfrågningarnas system per landningssida och källa. Annonsernas slutadress får `?fran=ads-<slug>`, så att Ads skiljs från organiskt.
2. Klick på telefonnumret per sida och per plats (hero, sticky bar, CTA-band).
3. Search Console: klick, visningar och position på sidans skyddade frågor (`gsc_sida_fraga_manad`).
4. Google Ads: konverteringsgrad och kvalitetsresultat per annonsgrupp, avläst av den som sköter kontot.

**Hypotes, inte slutsats:** en sida som visar kunskap och värde i stället för process ger fler förfrågningar per besök. Den prövas på råttbekämpning. Serien fortsätter medan råttsidan mäts, men 28 dagar efter att råttsidan är klar görs en avläsning. Har förfrågningarna per besök eller positionen på "råttbekämpning", "råttsanering" och "råttbekämpning företag" sjunkit tydligt stannar serien och mönstret prövas om innan nästa sida.

**Mätproblemet:** nya sajten gick live 2026-09-25 och tjänstesidorna blev indexerbara 2026-09-28. Det finns inget 28-dagarsunderlag före för de första sidorna i webbförfrågningarnas system. Före-värdet för Ads tas därför ur Ads-kontot (fråga 2 till Christian), och för Search Console ur perioden 2026-09-28 fram till att sidan publiceras.

## 2. Principerna för hela serien

### 2.1 Vad sidorna säljer

Sidorna säljer att problemet blir löst av någon som vet vad den gör. Inte arbetsgången. Kärnan, som varje sida uttrycker på sitt sätt (källor i säljunderlaget avsnitt 4):

1. **Vi löser orsaken, inte bara det som syns.** Vi bekämpar det som finns och stänger vägarna in, och teknikern tätar själv där det går. Gift löser inte orsaken.
2. **En leverantör hela vägen.** Bekämpning, tätning, råttspärr, att ledningen filmas och lagas, sanering och isolering. Kunden samordnar inga andra firmor.
3. **Du vet priset innan vi börjar, och vi följer upp tills skadedjuren är borta.** Sagt en gång per sida i mallens block och en gång i prisfrågan, inte fjorton gånger.
4. **Vi säger när du inte behöver oss.** "Kan jag göra det själv?" och silverfiskens ärliga förklaring om inspektionen.
5. **Kompetensen syns i detaljerna.** 1SO för alla tekniker, ISO 9001 och 14001, arbete på hög höjd med fallskydd, värmetält med 4 givare, sökhund, skyddsjakt med tillstånd.
6. **Snabbhet är ett villkor, inte huvudsaken.** Vi ringer upp när vi ser förfrågan, alltid samma dag under öppettiderna; tekniker på plats inom 2 dagar i alla sex län; godkänner du priset kan teknikern oftast börja vid samma besök.

### 2.2 Auktoritet utan storleksanspråk

Auktoriteten byggs av fyra saker, aldrig av storlek:

1. **Kunskap som förklarar resultatet.** Två till fyra punkter per sida om vad som avgör om bekämpningen håller, var och en med vad vi gör åt det. Exempel på nivån: att dofter inte håller råttor borta, att gift undviks mot möss inomhus eftersom musen kan dö i väggen, att tätt packade textilier aldrig blir varma i mitten, att en inspektion säger lite om silverfisk eftersom de lämnar få spår. All kunskap har källa i REGLER, SKRIVGUIDE 13 eller är allmän och okontroversiell biologi som går att belägga i flera oberoende faktaverk.
2. **Säkerhet i tonen.** Korta, exakta meningar. Inga förklaringar av sådant läsaren redan vet (SG 14.1, 14.3). En sak sägs en gång.
3. **Belagda bevis.** Google-betyget och ett riktigt omdöme om tjänsten, ärendesiffran ur `uppdrag.json`, certifieringarna, kundportalen visad som exempelbild med Demo AB.
4. **Ärlighet om gränserna.** När kunden klarar sig själv, när en fuktspecialist är rätt, när försäkringen eller hyresvärden ska kontaktas först.

Aldrig: storleksord, koncernens plats i världen eller i Sverige, "ledande", "experter", "en av de största". Befintliga omnämnanden av Tyro Group (sidfoten, företagssidans förtroenderad, om oss) står kvar som i dag; inga nya läggs till i serien förrän Christian har svarat på fråga 1.

### 2.3 Vad som stryks

1. **Processbeskrivningar som inte är belagda eller som varierar mellan ärenden.** Numrerade "Så går det till"-steg stryks på alla sidor i serien. Det enda flöde som är belagt och gäller varje ärende av sin typ (det privata ärendet med inspektion, och avtalets sex punkter i SG 13.4 p 31) står en gång, i mallens block "Det här kan du räkna med" respektive på avtals- och företagssidan. Allt annat i stegen är antingen metod eller kunskap och skrivs om till det, eller stryks.
2. **Raderna i säljunderlagets fel 1 och fel 4,** till exempel "från grunden till vinden", "Måste jag vara hemma? Ja", "visar dig varje markering", "återrapporterar till Länsstyrelsen", verksamt ämne i musgiftsfrågan, "Inte genom de vägar vi har tätat" och "låsta stationer längs fasaden" som förslag på innehåll.
3. **Artikelstoff.** Allmän biologi som inte förklarar resultatet eller metoden (livscykel för sin egen skull, artbestämning i detalj, gör det själv-instruktioner) hör hemma i artikeln. Tjänstesidan nämner det i en mening och länkar dit med artikelns ämnesord.
4. **Upprepning.** Det samma BRF- och avtalsstycket, kundportalens funktionslista och avtalsprocessen stryks på tjänstesidorna. Ersätts av högst ett stycke om det som gäller just den målgruppen för just den tjänsten, med länk till företagssidan. Länstabellen med orter stryks och ersätts av en mening som nämner de sex länen och Stockholm med namn; mallens "nära dig"-länkar står kvar.
5. **Mallens fel,** som gäller alla sidor: "Teknikerna svarar själva", "Granskad av", "Priset anges exkl. moms", "Boka kostnadsfri inspektion" för avtal och den generiska "Så bedömer vi omfattningen" (avsnitt 3).

**Tak per sida, räknat i den byggda HTML:en inklusive mallen:** "fast pris" eller "priset innan" högst 3 gånger, "inom 2 dagar" högst 3, "kundportal" högst 2 på tjänstesidorna och högst 8 på företagssidan och skadedjursavtalet.

### 2.4 Ordningen på en sida uppifrån och ned

Samma ordning tjänar annonsbesökaren och den organiska besökaren. Annonsbesökaren ska på första skärmen se sitt sökord, vad som blir uträttat, villkoren och knapparna. Den organiska besökaren ska strax därunder få kunskapen som visar att vi vet vad vi gör. Ingen separat Ads-sida (SEO: tunt dubblettinnehåll).

| Nr | Del | Var | Innehåll |
|---:|---|---|---|
| 1 | Första skärmen | mallen, `h1` och `kort_svar` | H1 med huvudsökordet först och vad köparen vill ha uträttat. Ingen logistik i H1. `kort_svar` med värdet i första meningen ("Begone" som subjekt). Knappar efter avsikt. Villkorsraden. Betyget |
| 2 | Vad som avgör resultatet | brödtext, H2 | 2 till 4 kunskapspunkter, var och en med vad vi gör åt det. Sidans hjärta. Ord som bär skyddade frågor och i dag står i stegen flyttas hit |
| 3 | Det här tar vi ansvar för | brödtext, H2 | Vad Begone gör i ärendet, som ansvar och inte som steg. Bara belagda rader ur TJANSTEINNEHALL |
| 4 | Det här kan du räkna med | mallen | Ett block per prismodell med det belagda flödet. Prislöftet står här |
| 5 | Bevis | mallen | Omdöme om tjänsten, ärendesiffra, certifieringar |
| 6 | För BRF, fastighet och verksamhet | brödtext, H2 | Högst ett stycke, det som gäller just den målgruppen för just den tjänsten, länk till företagssidan. H2 kvar där den bär en skyddad fråga |
| 7 | Kan jag göra det själv? | brödtext | Behålls. Ärligheten som gör rådet att ringa trovärdigt |
| 8 | Hemförsäkring och ROT-avdrag | brödtext | Kort, som i dag |
| 9 | Vanliga frågor | brödtext, sist | 4 till 6 frågor, de skyddade frågorna först i urvalet |
| 10 | Avslutning | mallen | CTA-band, nära dig, artiklar, andra tjänster |

Del 2, 3 och 6 kan byta plats på en enskild sida om briefen visar att en skyddad fråga eller annonsgruppen kräver det (till exempel silverfiskens "Vanlig eller långsprötad silverfisk", som är kunskap och ska stå högt).

### 2.5 Akut och planerat

| | Akut (`intent: akut`: råttor, möss, getingar, kackerlackor) | Planerat (`planerad`: vägglöss, silverfisk, mal, myror, fåglar, mögel med flera) | Företag (`foretag`) |
|---|---|---|---|
| Köparens fråga | Får ni bort det, och hur snabbt? | Väljer ni rätt metod första gången? | Får vi en motpart och underlag som håller? |
| Första skärmen | Ring först. Villkorsraden med samma dag och inom 2 dagar framme | Få pris och tid först. Villkorsraden med prismodellen framme | Boka kostnadsfritt första besök först |
| Kunskapen | Kort och handfast: vad som gör att de kommer tillbaka | Djupare: varför metoden fungerar, var den inte räcker | Vad som är annorlunda för verksamheten: dokumentation, flera enheter, besökstid |
| "Det här gör du tills vi är där" | Behålls där frontmatter har det (konkreta säkerhetsråd är värde) | Bara om briefen har ett skäl | Nej |
| Jour | Jourraden kvällar och helger syns | Syns i mallens CTA, inte i texten | Avtalas efter behov (SG 13.4 p 27) |

### 2.6 Vad SEO kräver att varje sida behåller

1. `url`, `canonical`, filnamn och slug. Ingen ändring.
2. `title` med huvudsökordet först. Title ändras inte i serien, med ett undantag: där title i dag bär logistik ("tekniker på plats inom 2 dagar") får copy föreslå en ny title med samma huvudsökord först, men den ändras bara efter SEO:s godkännande i sidans brief och aldrig på startsidan.
3. H1 med huvudsökordet först, och de sekundära ord som H1 bär i dag enligt SEO-underlaget (till exempel "råttsanering", "långsprötad silverfisk", "ånga och kiselgur").
4. Varje fråga med klick i Search Console står kvar i H1, en H2 eller brödtexten med samma ord eller nära böjning. Frågor som en artikel äger räcker att nämna med länk.
5. FAQ-blocket i formen `## Vanliga frågor …` med `###`-frågor som slutar med `?`, så att FAQPage-schemat byggs. Frågor som bär skyddade ord får omformuleras men inte strykas. Prisfrågan står kvar på varje sida, eftersom "pris" och "kostnad" har klick och visningar; den behöver inte stå först utom där kostnadsfrågor har klick (vägglöss sanering, råttbekämpning).
6. Länkarna mellan artikel och tjänst åt båda håll, med köpordet som länktext från artikeln och ämnesordet från tjänsten.
7. Ankarna `#livsmedelsindustri`, `#fastigheter` och `#industri` på företagssidan.
8. JSON-LD i mallarna (Service, BreadcrumbList, FAQPage, organisationsnoden) orört.
9. Sidan blir inte tunnare: minst 600 ord, och för sidor med många skyddade frågor (silverfisk, vägglöss sanering, startsidan) minst lika många ord unikt innehåll som i dag. Det som stryks som process ersätts av kunskap.
10. Stockholm och de sex länen nämns med namn i texten när länstabellen stryks.

## 3. Malländringar

Inga ändringar av URL:er, title eller H1 i mallarna. Alla malländringar som bara rör sidor i serien styrs av ett fält, så att en sida i taget kan bytas. Mallfel som är fel på alla sidor rättas för alla på en gång i pilotens commit.

### 3.1 Fältet `upplagg`

- `src/content.config.ts`, samlingen `tjanster`: lägg till `upplagg: z.literal(2).optional()`. Saknas fältet ser sidan ut som i dag.
- Sidan sätter `upplagg: 2` i frontmatter i samma commit som den nya texten.

### 3.2 `src/layouts/Tjanst.astro`

**Gäller alla tjänstesidor direkt (pilotens commit):**

1. FAQ-ingressen, rad 479: `Teknikerna svarar själva på frågor om ${ordet}, ${OPPETTIDER}.` blir samma form som avtalsvarianten: `Frågor om ${ordet} svarar vi på ${OPPETTIDER}.`
2. Bokningsrutan, rad 355 till 362: raden "Granskad av <strong>{t.namn}</strong>, tekniker" tas bort. Teknikerkortet i heron står kvar.

**Gäller bara sidor med `upplagg: 2`:**

3. **Villkorsraden i heron.** `tj-hero__nasta` (rad 247) och `Fortroenderad` (rad 252 till 264) ersätts av en enda rad med tre villkor, hämtade ur en ny konstant `VILLKOR` i `src/lib/sajt.ts` per prismodell:
   - `inspektion`: "Vi ringer upp samma dag under öppettiderna", "Kostnadsfri inspektion inom 2 dagar", "Fast pris innan vi börjar".
   - `kartlaggning`: "Vi ringer upp samma dag under öppettiderna", "Kartläggning med fällor", "Pris innan vi börjar".
   - `hundsok`: "Vi ringer upp samma dag under öppettiderna", "Hundsök i alla sex län", "Fast pris på din beskrivning".
   - `offert`: "Vi ringer upp samma dag under öppettiderna", "Kostnadsfri inspektion inom 2 dagar", "Offert innan vi börjar". För `foretag` står "Kostnadsfritt första besök" och "Avtalsförslaget binder inte".
   Copy får justera orden i konstanten; källorna skrivs som kommentar per rad. `installelse` i frontmatter går före "inom 2 dagar" som i dag.
4. **Prisrutan i heron (desktop)** står kvar, eftersom den är erbjudandet ovanför vecket för annonsbesökaren. Den får ingen omfattningslista och ingen egen formulering av prislöftet; löftet står i villkorsraden.
5. **Avsnittet `tj-sa`** (rad 311): `aria-label="Så går det till"` blir `aria-label={`Om ${ordet}`}`. Etiketten "Så går det till" och steglistan renderas inte. Om en sida med `upplagg: 2` ändå har en H2 följd av en numrerad lista ska bygget varna (se punkt 9), inte rendera steg.
6. **Brödtexten delas i två.** `src/lib/rehype-tjanst.mjs` får en tredje uppgift för filer med `upplagg: 2`: allt från och med H2:n "Kan jag göra det själv?" lyfts ut ur trädet till `fm.resten_html` (som `steg` lyfts ut i dag, med `toHtml`). Saknas rubriken blir `resten_html` tomt och allt står i första delen. `renderaTjanst` i `src/lib/` lämnar ut `resten`. Mallen renderar: första delen (`<Content />`, del 2, 3 och 6 i ordningen), sedan det nya blocket "Det här kan du räkna med" och beviset, sedan `resten` (del 7 och 8), sedan FAQ som i dag. FAQ lyfts fortsatt ut av rehype-faq, som körs före.
7. **Blocket "Det här kan du räkna med"** ersätter avsnittet `tj-modell` ("Så sätter vi priset" med "Så bedömer vi omfattningen", rad 392 till 469). H2 "Det här kan du räkna med". En lista ur en ny konstant `RAKNA_MED` i `sajt.ts` per prismodell, varje rad med källa som kommentar. För `inspektion`, som utgångspunkt för copy:
   - Vi ringer upp när vi ser förfrågan, alltid samma dag om den kommer in under öppettiderna (SG 13.4 tillägg 2026-10-03).
   - Räcker din beskrivning och dina bilder får du ett fast pris per telefon eller mejl; annars kommer en tekniker på kostnadsfri inspektion inom 2 dagar, i alla sex län (SG 13.1 p 22, 24).
   - Du får ett fast pris innan vi börjar, och det är det priset som gäller (`LOFTET`).
   - Godkänner du priset kan teknikern oftast börja vid samma besök, och antalet besök bestäms vid inspektionen (SG 13.1 p 24).
   - Vi följer upp tills skadedjuren är borta (SG 13.4 p 29).
   - Du får en rapport när du behöver den, till exempel till försäkringsbolaget (företagsfakta, rapporter).
   För `kartlaggning`, `hundsok` och `offert` skriver copy motsvarande rader ur SG 13.3, 13.4 p 24 och p 38. Under listan en rad med knappen "Få pris och tid" och länken till skadedjursavtal respektive företagssidan (dagens `tj-modell__annan`, kortad till en mening).
8. **Kort under "Andra tjänster" och "Fler sätt att bli av med"** (rad 565 och 587): prismodellraden `tj-andra__rad` visas inte. Den upprepar prismodellen upp till 17 gånger per sida.
9. **Kontroll i bygget.** Ett nytt skript `scripts/granska-tjanst.mjs`, som körs efter `npm run build` som del av definitionen av klar (inte i `npm run check`, som är astro check). Det läser `dist/tjanster/<slug>/index.html` för sidor med `upplagg: 2` och skriver ut: antal "fast pris"/"priset innan", "inom 2 dagar" och "kundportal" mot taken i 2.3, förekomst av tankstreck (U+2013, U+2014) i synlig text, kolonrubriker utom "Steg N:", orden "garanti", "dygnet runt", "egenkontroll", "avropsavtal", "Granskad av", "Teknikerna svarar själva", och en H2 följd av `<ol>`. Det ändrar inget, det rapporterar.

Mallen ändrar inget i heron utöver punkt 3, inget i JSON-LD, inget i H1 och inget i `title`.

### 3.3 `src/layouts/Foretag.astro`

Rättas i företagssidans commit (nr 6 i ordningen), utom punkt 1 som är fel i dag och rättas i pilotens commit:

1. Rad 210: "Priset anges exkl. moms." tas bort. Inget pris visas.
2. Rad 109: primärknappen "Boka kostnadsfri inspektion" blir "Boka kostnadsfritt första besök" (avtal har behovsanalys, SG 13.4 p 31). Engångsinsatsen nås via sekundärknappen eller formuläret.
3. Hero-ingressen (rad 103 till 107) skrivs om till värdet för verksamheten: en motpart, underlag som håller vid tillsyn, upplägg efter verksamheten. Kundportalen nämns som bevis, inte som rubrikens poäng. H1 rad 102 rörs inte i mallarbetet; om H1:n ska ändras görs det i företagssidans omgång med "Skadedjursbekämpning för företag" först och SEO:s godkännande.
4. Avsnittet `ingar`, "Så arbetar vi med ett avtal" (rad 179 till 213): ersätts av "Det här ger ett avtal er", ur `ingar` omskrivet till värde. Avtalets sex punkter står bara en gång på sidan, i brödtextens "Så går ett avtal till", och mallen visar dem inte igen. Prisrutan `pris` står kvar utan momsraden.
5. Avsnittet `portal` (rad 215 till 284): bilderna och filmen står kvar som bevis. Rubriken "Allt i kundportalen, när ni vill" och ingressen skrivs om till vad det ger (underlaget finns daterat utan att någon behöver be om det). Figurtexterna kortas. Brödtextens "Se vad vi gör i kundportalen" stryks i texten eftersom mallen redan visar det.
6. Branschkolumnerna (`bransch`) säger vad vi gör för den typen av verksamhet, aldrig vilka problem branschen har (SG 14.1 p 3). Länkarna till ankarna står kvar.

### 3.4 Startsidan, `src/pages/index.astro`

Rättas i startsidans commit:

1. **H1, rad 136,** står i sidan och inte i en mall. Ändras bara i startsidans omgång, med "Skadedjursbekämpning" först, och med logistiken ("på plats inom 2 dagar") flyttad till villkorsraden. Title i `hem.md` rörs inte.
2. **"Tre vägar"** (rad 171 till 193): behålls som väljare. Kortet "Fast pris innan vi börjar" byter rubrik till värdet; prislöftet står i villkorsraden och i det nya blocket. Kortet för företag behåller länktexten "Skadedjursbekämpning för företag".
3. **"Så sätter vi priset"** (rad 216 till 250), **"Från samtal till skadedjursfritt"** (rad 252 till 304) och **"Så arbetar teknikern"** (rad 306 till 337) ersätts av två avsnitt: "Så tänker vi" med 3 till 4 påståenden ur kärnan i 2.1, vart och ett med ett belagt exempel från en tjänst och en länk till tjänsten med dess huvudsökord, och "Det här kan du räkna med" med samma konstant `RAKNA_MED.inspektion` som tjänstesidorna. `PRISRADER` och tidslinjens steg (rad 60 till 110) tas bort ur sidan. Raden "klart inom cirka en timme" (rad 72) är belagd i företagsfakta (batch 6) och får flytta till "Det här kan du räkna med" som "Ett vanligt ärende med inspektion och åtgärd är i regel klart inom cirka en timme".
4. **Företagsblocket** (rad 377 till 409): rubriken "Skadedjursavtal där varje besök syns i kundportalen" skrivs om till värdet, och länken med exakt texten "skadedjursbekämpning för företag" till `/skadedjursbekampning-foretag/` står kvar.
5. **"Vad har du hittat?", omdömen, artiklar och "Tekniker nära dig"** står kvar. Etiketterna under varje djur skrivs som värde eller kunskap, inte som utrustning.
6. Rad 325, "Begone ingår i Tyro Group, en koncern med flera specialistbolag", står kvar tills Christian har svarat på fråga 1. Inga nya ord om koncernen.

### 3.5 `src/components/Fotoplats.astro` (Christians beslut, fråga 6)

Etiketten "Foto N ur fotodagen · format" och motivtexten (rad 20 till 28) syns för betalande annonsbesökare och är den största enskilda förlusten av intryck på första skärmen. Förslag: en konstant `VISA_FOTOPLATSER` i `sajt.ts`, `false` i produktionsbygget. När den är `false` renderar Fotoplats ytan med samma format men utan text och med `aria-hidden="true"`, så att layouten inte hoppar. Ändringen påverkar alla sidtyper och är ingen copyfråga, därför eget beslut och egen commit.

### 3.6 Utanför mallarna

- SKRIVGUIDE 3.1, 4.2, 8 p 3 och 11.1 p 13 kräver "Så gör vi"-steg och att prisfrågan står först; 3.1 sista stycket, 14.1 p 2 och 14.3 p 4 förbjuder biologi på köpsidor. Ändringen i avsnitt 6 måste vara beslutad innan copy skriver första sidan. Säljchefen, SEO och copy ändrar inte guiden själva.
- TJANSTEINNEHALL: raderna om flugor (döda djur), hästmyror (boet och orsaken) och mögel (skriftlig offert) uppdateras till Belagt enligt SG 13.4 tillägg 2026-10-04 p 35, 36 och 38. Det görs av den som förvaltar filen, före sidorna för flugor, myror och mögel.
- `Granskad av` i artikelmallen ingår inte i serien (artiklar är utanför uppdraget). Frågan om teknikerna har granskat texterna (fråga 3) avgör även den.

## 4. Sidornas ordning

Rangordnad efter affärsvärde: inskick (främst Ads) och organiska klick ur SEO-underlaget, säsong för det som annonseras, och avtalsvärde. En sida är klar och committad innan nästa påbörjas.

| Nr | Sida | Filer | Varför här |
|---:|---|---|---|
| 1 | /tjanster/rattbekampning/ | `src/content/tjanster/rattbekampning.md`, plus malländringarna i 3.1, 3.2, 3.3 p 1 och 3.6 i samma commit | Största landningssidan (562 inskick), högsäsong i oktober, villa och företag på samma sida. Pilot för mönstret och mallen. Lägre SEO-risk än startsidan |
| 2 | /tjanster/moss/ | `src/content/tjanster/moss.md` | 149 inskick, högsäsong nu, samma kunskapsbas. Ska ta "musbekämpning" från artikeln |
| 3 | / | `src/pages/index.astro`, `src/content/sidor/hem.md` (bara description), `src/lib/sajt.ts` | Störst organiskt värde (1 229 klick, "skadedjursbekämpning" 111 klick) och 269 inskick. Spärr: påbörjas tidigast 2026-10-26, när det finns 4 veckors Search Console efter indexeringen. Är det inte uppnått när turen kommer tas nr 4 först |
| 4 | /tjanster/vaggloss-sanering/ | `src/content/tjanster/vaggloss-sanering.md` | 93 inskick, 277 klick, 20 skyddade frågor, året runt |
| 5 | /tjanster/silverfisk-sanering/ | `src/content/tjanster/silverfisk-sanering.md` | Bästa organiska tjänstesidan (785 klick, 138 frågor), fallen från position 3,3 till 10,4. Ska bli djupare |
| 6 | /skadedjursbekampning-foretag/ | `src/content/sidor/skadedjursbekampning-foretag.md`, `src/layouts/Foretag.astro` | Varje avtal är värt mest. Ska ta "skadedjursbekämpning för företag" från startsidan |
| 7 | /tjanster/skadedjursavtal/ | `src/content/tjanster/skadedjursavtal.md` | Stödsida som konverterar för avtal; artikeln äger sökordet |
| 8 | /tjanster/fagelsakring/ | `src/content/tjanster/fagelsakring.md` | 157 inskick. Klar före februari, innan fåglarna söker boplats |
| 9 | /tjanster/getingar/ | `src/content/tjanster/getingar.md` | 190 inskick, nästan bara Ads. Klar före april |
| 10 | /tjanster/myror/ | `src/content/tjanster/myror.md` | 64 inskick, 47 klick. Klar före säsongen i maj |
| 11 | /tjanster/kackerlackor/ | `src/content/tjanster/kackerlackor.md` | Akut, restaurang och BRF, högt värde per ärende |
| 12 | /tjanster/palsanger/ | `src/content/tjanster/palsanger.md` | 57 inskick; artikeln äger sökorden |
| 13 | /tjanster/vagglushund/ | `src/content/tjanster/vagglushund.md` | 26 inskick, hotell och BRF |
| 14 | /tjanster/vaggloss-varmebehandling/ | `src/content/tjanster/vaggloss-varmebehandling.md` | 18 inskick; artikeln äger "värmebehandling vägglöss" |
| 15 | /tjanster/mjolbaggar/ | `src/content/tjanster/mjolbaggar.md` | 24 inskick |
| 16 | /tjanster/fagelspillning/ | `src/content/tjanster/fagelspillning.md` | 15 inskick, 20 klick på position 3,5 |
| 17 | /tjanster/mal/ | `src/content/tjanster/mal.md` | 13 inskick |
| 18 | /tjanster/mogelsanering/ | `src/content/tjanster/mogelsanering.md` | Kräver TJANSTEINNEHALL p 38 först |
| 19 | /tjanster/flugor/ | `src/content/tjanster/flugor.md` | Kräver TJANSTEINNEHALL p 35 först |
| 20 | /tjanster/skyddsjakt/ | `src/content/tjanster/skyddsjakt.md` | Ny sida; kräver svar på rapporteringen till länsstyrelsen (fråga 4) |
| 21 | /skadedjur-jour/ | `src/content/sidor/skadedjur-jour.md` | 357 klick, men mest på en konkurrents varumärke. Ingen Ads-trafik i dag |
| 22 | /vara-tjanster/ | `src/content/sidor/vara-tjanster.md` | Navet. Sist, så att det sammanfattar de nya sidorna med samma ord |

Ändras Ads-kontots fördelning (fråga 2) kan nr 8 till 20 flyttas. Nr 1 till 7 står fast.

## 5. Mall för sidbriefen

Briefen skrivs av säljchefen och prövas av SEO innan copy skriver. Den sparas som `docs/begone-se/salj/brief-<slug>.md` och kompletterar, ersätter inte, den befintliga `docs/begone-se/briefer/tjanster-<slug>.md`.

```markdown
# Brief: <url>

Datum, säljchefen. SEO prövad <datum>: godkänd / invändningar nedan.

## 1. Sidan i siffror
- Inskick (gamla formuläret, 24 mån), andel Ads:
- Search Console 16 mån: klick, visningar, position. Senaste 28 dagarna:
- Annonsgrupper som pekar hit och deras sökord (ur fråga 2):
- Före-värden för mätningen (avsnitt 1), med datum:

## 2. Köparen
- Avsikt: akut / planerad / företag. Målgrupper i ordning:
- Vad köparen egentligen köper (en mening):
- Vad som får köparen att ringa i stället för att lämna sidan:

## 3. SEO-villkor (SEO fyller i)
- Huvudsökord. Title (oförändrad eller föreslagen ny, med skäl):
- H1 i dag. Ord i H1 som måste stå kvar:
- Skyddade frågor med klick, och var var och en ska stå (H1, H2, brödtext, FAQ):
- H2:or som måste stå kvar:
- FAQ-frågor som måste stå kvar:
- Artiklar som äger frågor, och länkarna åt båda håll med länktext:
- Minsta ordantal:

## 4. Innehållet
- H1-förslag (huvudsökordet först, värdet, ingen logistik):
- kort_svar, budskapet (copy formulerar):
- Vad som avgör resultatet, 2 till 4 punkter. Per punkt: kunskapen, vad vi gör åt det, källa (REGLER rad, SG punkt, eller allmän biologi med faktaverk):
- Det här tar vi ansvar för. Per rad: källa i TJANSTEINNEHALL (Belagt):
- Målgruppsstycket (BRF, fastighet, verksamhet): vad som gäller just här, källa:
- Kan jag göra det själv: gränsen, länkar:
- FAQ: frågorna i ordning, och vilken skyddad fråga varje bär:

## 5. Stryks
- Citat ur dagens sida som stryks, och skälet (inte belagt, varierar, artikelstoff, upprepning):
- Ord i det strukna som bär en skyddad fråga, och vart de flyttas:

## 6. Öppna frågor
- Det som saknar belägg och inte får skrivas förrän det är besvarat:
```

## 6. Ändringen i SKRIVGUIDE som krävs först

Förslag till Christian eller innehållschefen, som ersätter "Så gör vi" i 3.1, kravet i 8 p 3 på ett steg, kontrollfrågan 11.1 p 13, sista stycket i 3.1, 14.1 p 2 och 14.3 p 4 för tjänstesidor och startsidan:

> En tjänstesida beskriver värdet och vad kunden kan räkna med. En fast stegvis process står bara där den är belagd och gäller varje ärende, och då i mallens block "Det här kan du räkna med". Kunskap om djuret står med när den förklarar vad som avgör resultatet eller varför metoden fungerar, med källa i REGLER, avsnitt 13 eller allmän biologi enligt 9.1. Allmän biologi för sin egen skull hör hemma i artikeln. Prisfrågan står kvar i FAQ, men behöver inte vara den första. Löftet "fast pris innan vi börjar" står i mallens villkorsrad, i mallens block och i prisfrågan, inte fler gånger.

14.1 p 1 och p 3 (förklara aldrig för en verksamhet vilka problem den har) står kvar oförändrade. Kunskapen i den nya regeln handlar om djuret och metoden, aldrig om kundens bransch.

## 7. Definition av klar per sida

1. Briefen är skriven och SEO har prövat den.
2. Copy har skrivit sidan efter briefen och avsnitt 2.
3. Varje påstående om Begone har källa i TJANSTEINNEHALL (Belagt), SG 13 eller KUNDPORTAL-FUNKTIONER; varje regel och biologisk uppgift har källa i REGLER eller är allmän biologi enligt SG 9.1. Källorna står i briefen, inte på sidan.
4. SEO-kontroll: skyddslistan, title, H1, H2:or, FAQ-schemat i den byggda HTML:en, länkarna åt båda håll, ordantalet.
5. Copy-kontroll: SG 10 och 14, inga tankstreck, inga kolonrubriker utom "Steg N:", inga spärrade ord.
6. `npm run build` och `npm run check` utan fel i `C:\Users\chris\begone-se`, och `node scripts/granska-tjanst.mjs` utan anmärkningar.
7. Commit med svenskt meddelande som slutar med en tom rad och `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Ingen push.
8. Den här filens avsnitt 9 är uppdaterat med datum, commit och före-värden.

Först därefter påbörjas nästa sida.

## 8. Frågor som bara Christian kan svara på

1. **Tyro Group.** Sidfoten, företagssidan, om oss och startsidan säger i dag "En del av Tyro Group". Ska det stå kvar som i dag, tas bort från tjänstesidorna och startsidan, eller lyftas en gång i förtroenderaden? Planen gör ingenting förrän du har svarat.
2. **Google Ads.** Vilka annonsgrupper och sökord pekar på vilken sida i dag, vilka sidor annonseras inte, och kan slutadresserna få `?fran=ads-<slug>`? Kan vi få konverteringsgraden per annonsgrupp för de senaste 28 dagarna som före-värde?
3. **"Granskad av".** Har teknikerna granskat texterna? Annars tas raden bort på alla tjänstesidor i pilotens commit (planen räknar med det).
4. **Öppna fakta som sidorna behöver:** rapporterar vi skyddsjakt till länsstyrelsen (TJANSTEINNEHALL fråga 18), ROT för montering av råttspärr (fråga 12), och "ofta samma dag" i Stockholm (fråga 9)?
5. **Anonyma uppdragsexempel.** Får vi skriva ett fåtal exempel på vad som var fel och vad vi gjorde, utan kund, ort eller belopp, om teknikerna lämnar dem? Inget sådant är belagt i dag och inget hittas på.
6. **Bilderna från fotodagen.** När finns de? Får platshållarnas etiketter döljas i produktionen tills dess (3.5)?
7. **SKRIVGUIDE.** Godkänner du regeländringen i avsnitt 6, eller ska innehållschefen besluta den?

## 9. Överenskommet

Ingen agent kunde kallas in i den här körningen (verktyget Agent fanns inte). Säljchefen förde därför diskussionen i två rundor med SEO-rollen, så sträng som den skulle vara, med SEO-underlaget, Search Console-siffrorna i det och källfilerna (`Tjanst.astro`, `Foretag.astro`, `index.astro`, `rehype-tjanst.mjs`, `content.config.ts`, sidornas rubriker) som underlag. Copy-perspektivet prövades mot SKRIVGUIDE 10 och 14.

### Runda 1, SEO:s invändningar mot säljunderlaget

1. **Länstabellen.** "Råttbekämpning stockholm" har 370 visningar och H2:n "Här tar vi råttuppdrag" med orterna bär ortnamnen. Att stryka tabellen utan ersättning tappar ordet. *Löst:* tabellen stryks, men Stockholm och de sex länen nämns med namn i texten, och mallens "nära dig"-länkar till ortssidorna står kvar (2.3 p 4, 2.6 p 10).
2. **Ordantalet.** Att stryka steg, BRF-block och tabell gör sidorna tunnare, och silverfisk har redan fallit. *Löst:* golv på 600 ord och, för sidor med många skyddade frågor, minst dagens ordantal unikt innehåll (2.6 p 9).
3. **Prisfrågan.** Säljunderlaget ville flytta ned den. "Vägglöss sanering kostnad", "värmebehandling vägglöss kostnad" och "råttbekämpning pris" har klick eller stora visningar. *Löst:* prisfrågan står kvar på varje sida och först där kostnadsfrågor har klick (2.6 p 5).
4. **Title.** Säljunderlaget ville ha logistiken ut ur H1. SEO godtar det för H1, men title är det som syns i sökresultatet och "på plats inom 2 dagar" kan vara skälet till klicket. *Löst:* title ändras inte i serien utan SEO:s godkännande i briefen och aldrig på startsidan (2.6 p 2).
5. **Startsidan som nr 3.** Positionen på "skadedjursbekämpning" har glidit från 6,6 till omkring 12 och sajten är nyss flyttad. En omskrivning nu gör det omöjligt att skilja flyttens effekt från textens. *Löst:* spärr till 2026-10-26; är spärren inte passerad när turen kommer tas nr 4 först (avsnitt 4).
6. **Brödtexten delas.** SEO krävde att FAQ fortsatt byggs ur brödtexten och att rubrikerna står kvar i HTML:en i samma ordning för robotar. *Löst:* delningen sker i rehype efter rehype-faq och ändrar inte rubriknivåer; FAQPage-schemat byggs som i dag (3.2 p 6).

### Runda 2, SEO:s prövning av utkastet

SEO läste utkastet till avsnitt 2 till 5 och hade tre invändningar till:

1. **Ordningen getingar och fågelsäkring.** SEO-underlaget hade dem som nr 3 och 4 på inskicken. Säljchefen höll fast vid säsongen: ingen av dem har egna organiska klick att tappa, och annonserna går när säsongen är igång. *SEO godtog ordningen,* med kravet att getingar är klar före april och fågelsäkring före februari.
2. **Företagssidan som nr 6.** SEO-underlaget satte den som nr 10. Säljchefen: varje avtal är värt mest, och sidan ska ta "skadedjursbekämpning för företag" från startsidan, vilket hänger ihop med att startsidan just har skrivits om. *SEO godtog,* med kravet att startsidan och företagssidan görs i följd utan annan sida mellan, utom om spärren för startsidan tvingar fram vägglöss först.
3. **Kontrollskriptet.** SEO ville att skriptet också kontrollerar att varje skyddad fråga står kvar. Säljchefen: skyddslistan lever i Search Console och skiljer sig per sida, så den kontrolleras i briefen och i SEO-kontrollen (avsnitt 7 p 4). *SEO godtog,* med kravet att briefen listar var varje skyddad fråga står.

### Copy-perspektivet

Godkänner principerna. Två villkor: copy formulerar orden i `VILLKOR` och `RAKNA_MED` (raderna i 3.2 är utgångspunkt, inte text), och kunskapen i "Vad som avgör resultatet" skrivs i Begones röst, kort och självsäkert, aldrig som pedagogik om djuret (SG 14.3 p 2 och 3). Copy påpekade att SKRIVGUIDE måste ändras först, annars är kontrollistan 11.1 p 13 omöjlig att uppfylla.

### Läge

- **Överens, säljchefen och SEO:** avsnitt 2, 3, 4, 5 och 7.
- **Ingen kvarstående oenighet mellan perspektiven.** Tyro Group, som underlagen skilde sig på, lämnas som i dag och ligger hos Christian (fråga 1).
- **Förutsättningar innan första sidan skrivs:** beslut om SKRIVGUIDE (avsnitt 6, fråga 7). Utan det får copy inte börja.

| Datum | Vad | Av vem |
|---|---|---|
| 2026-10-05 | Planen skriven och överenskommen | Säljchefen och SEO, prövad ur copyperspektivet |
| 2026-10-05 | Brief för /tjanster/rattbekampning/ i [sidor/tjanster-rattbekampning.md](sidor/tjanster-rattbekampning.md), SEO prövad (rollen, inget Agent-verktyg) | Säljchefen och SEO |
| 2026-10-05 | /tjanster/rattbekampning/ klar, begone-se 5c9cbea (ej pushad). granska-tjanst: fast pris 3/3, inom 2 dagar 3/3, kundportal 1/2, inga anmärkningar. Mallrättning i samma commit: delningen vid "Kan jag göra det själv?" körs efter rehype-artikel, annars blev bilderna i resten trasiga. Före-värden för Search Console tas för 2026-09-28 till publiceringen; avläsning 28 dagar efter publicering | Copy |
| 2026-10-05 | /tjanster/moss/ klar, begone-se 78d19dc (ej pushad). granska-tjanst: fast pris 3/3, inom 2 dagar 3/3, kundportal 1/2, inga anmärkningar. Ord 1 414 till 1 180. Före-värden: Search Console för sidan 2026-09-28 till publiceringen (inga rader före), kontrollgruppen ur kluster/moss.md avsnitt 12; avläsning 28 dagar efter publicering | Copy |
| 2026-10-05 | Brief för /tjanster/vaggloss-sanering/ (nr 4, före startsidan på grund av spärren till 2026-10-26) i [sidor/tjanster-vaggloss-sanering.md](sidor/tjanster-vaggloss-sanering.md), SEO prövad (rollen, inget Agent-verktyg). Före-värde Search Console 2026-09-28 till 2026-09-29: 1 klick, 104 visningar, position 8,9 | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/silverfisk-sanering/ (nr 5) i [sidor/tjanster-silverfisk-sanering.md](sidor/tjanster-silverfisk-sanering.md), SEO prövad (rollen, inget Agent-verktyg). Före-värde Search Console 2026-09-28 till 2026-09-29: 0 klick, 5 visningar, position 14,6; 28 dagar till 2026-09-29: 7 klick, 114 visningar, position 10,2 | Säljchefen och SEO |
| 2026-10-05 | Brief för /skadedjursbekampning-foretag/ (nr 6) i [sidor/skadedjursbekampning-foretag.md](sidor/skadedjursbekampning-foretag.md), SEO prövad (rollen, inget Agent-verktyg). Före-värde Search Console 2026-09-28 till 2026-09-29: 0 klick, 3 visningar, position 4,0; 28 dagar till 2026-09-29: 2 klick, 67 visningar, position 22,1. Öppet: formulären visar tack fast `INBOUND_URL` är tom | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/skadedjursavtal/ (nr 7) i [sidor/tjanster-skadedjursavtal.md](sidor/tjanster-skadedjursavtal.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde för stoppregeln (kluster/foretag.md 4.2): artikeln /skadedjursavtal/ 28 dagar till 2026-09-29 7 klick, 100 visningar, position 8,5, kontrollgruppen /rattgift/ 58 klick och /rattor-i-avlopp/ 7 klick | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/fagelsakring/ (nr 8) i [sidor/tjanster-fagelsakring.md](sidor/tjanster-fagelsakring.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde för klustret: "fågelsäkring" september 2026 140 visningar, position 45,2, 0 klick (på /fagelskydd/). Öppet: offertmodellens källa i TJANSTEINNEHALL, plastugglor (fråga 17) | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/getingar/ (nr 9) i [sidor/tjanster-getingar.md](sidor/tjanster-getingar.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen 28 dagar till 2026-09-29: bekämpa getingar 66 visningar, ta bort getingbo kostnad 27, hjälp att ta bort getingbo 25. Öppet: pris per telefon för getingar (kluster getingar b1 mot `RAKNA_MED.inspektion`) | Säljchefen och SEO |
| 2026-10-05 | /tjanster/getingar/ klar, begone-se 74cab33 (ej pushad). granska-tjanst: fast pris 3/3, inom 2 dagar 3/3, kundportal 0/2, inga anmärkningar. Ord 1 443 till 1 257, `<main>` 2 019 till 1 828. Mallen fick fältet `utan_telefonpris` (bara getingar). Avläsning 28 dagar efter publicering, den som säger något maj till augusti 2027 | Copy |
| 2026-10-05 | /tjanster/myror/ klar, begone-se a8a504e (ej pushad). granska-tjanst: fast pris 3/3, inom 2 dagar 2/3, kundportal 0/2, inga anmärkningar. Ord 1 065 till 1 144, `<main>` 1 681 till 1 701. Före-värden: Search Console för sidan 2026-09-28 till publiceringen (0 klick, 9 visningar, position 7,7) och 28 dagar till 2026-09-29 (1 / 167 / 12,5); stoppregeln i kluster/myror.md 4.3. Avläsning 28 dagar efter publicering, den som säger något april till juni 2027 | Copy |
| 2026-10-05 | Brief för /tjanster/kackerlackor/ (nr 11) i [sidor/tjanster-kackerlackor.md](sidor/tjanster-kackerlackor.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen på sajtnivå 28 dagar till 2026-09-29: 0 klick, 8 visningar, position 39,4 (16 mån 3 / 1 694 / 13,4). `utan_telefonpris: true` tills Christian svarat. Öppet: pris per telefon för kackerlackor, teknikerns bedömning av grannlägenheter | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/palsanger/ (nr 12) i [sidor/tjanster-palsanger.md](sidor/tjanster-palsanger.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen på sajtnivå 28 dagar till 2026-09-29: 4 klick, 133 visningar (16 mån 128 / 3 201); /palsanger/ 687 klick, 25 677 visningar, position 5,6. Ny title "Sanering av pälsänger: kostnadsfri inspektion \| Begone" godkänd av SEO; en mening i /palsanger/ (löftet om stegen) ändras i samma commit | Säljchefen och SEO |
| 2026-10-05 | /tjanster/palsanger/ klar, begone-se b46de5e (ej pushad). granska-tjanst: fast pris 3/3, inom 2 dagar 2/3, kundportal 1/2, inga anmärkningar. Ord 869 till 1 103, `<main>` 1 508 till 1 677. Meningen i /palsanger/ ändrad i samma commit. Före-värden enligt briefen avsnitt 1; avläsning i början av november | Copy |
| 2026-10-05 | Brief för /tjanster/vagglushund/ (nr 13) i [sidor/tjanster-vagglushund.md](sidor/tjanster-vagglushund.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen på sajtnivå 28 dagar till 2026-09-29: 5 klick, 287 visningar; artikeln /vagglushund-i-stockholm/ 21 klick, 761 visningar, position 7,0. Ny title och H1 godkända av SEO. Öppet: inom 2 dagar för hundsök, prismodellen `hundsok` | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/vaggloss-varmebehandling/ (nr 14) i [sidor/tjanster-vaggloss-varmebehandling.md](sidor/tjanster-vaggloss-varmebehandling.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde stoppregelns grupp på sajtnivå 28 dagar till 2026-09-29: 6 klick, omkring 90 visningar; artikeln /varmebehandling-mot-vaggloss/ 29 klick, 979 visningar, position 14,2. Title och description oförändrade. Malländring i samma commit: ett fält som byter raden om samma besök i `RAKNA_MED.inspektion` (tältet följer inte med vid inspektionen). Öppet: vem som bär in möblerna och packar tältet | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/mjolbaggar/ (nr 15) i [sidor/tjanster-mjolbaggar.md](sidor/tjanster-mjolbaggar.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen på sajtnivå 28 dagar till 2026-09-29: 0 klick, 234 visningar, position 8,2, kontrollgruppen 13 / 813 / 1,8; artikeln /bli-av-med-mjolbaggar/ 206 klick, 29 491 visningar, position 5,7. Ny title "Sanering av mjölbaggar: kostnadsfri inspektion \| Begone" godkänd av SEO, H1 oförändrad, ingen malländring. Öppet: brödbaggar saknar egen rad i TJANSTEINNEHALL, vad teknikern gör vid inspektionen (källan, vad som kan sparas) | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/fagelspillning/ (nr 16) i [sidor/tjanster-fagelspillning.md](sidor/tjanster-fagelspillning.md), SEO prövad (rollen, inget Agent-verktyg). Före-värde Search Console 28 dagar till 2026-09-29: 1 klick, 69 visningar, position 19,6; köpgruppen på sajtnivå 0 / 4 / 19,7 (16 mån 5 / 621 / 14,5). Title och H1 oförändrade. FAQ "Är fågelspillning farligt?" stryks (Duv äger den). Föreslagen malländring `utan_uppfoljning` (rad 5 i `RAKNA_MED.inspektion` passar inte en sanering som inte tar bort fåglarna). Öppet: stänger saneringen öppningen (TJANSTEINNEHALL fråga 13), skyddsutrustning och fuktning | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/mal/ (nr 17) i [sidor/tjanster-mal.md](sidor/tjanster-mal.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen på sajtnivå 28 dagar till 2026-09-29: 0 klick, 119 visningar, position 7,9 ("sanering klädmal" 103 av dem); kontroll /kladesmal-palsmal/ 124 klick, 19 270 visningar, position 8,0. Title och H1 oförändrade, description "hittar" blir "letar upp". FAQ "Är mal ett farligt skadedjur?" stryks (artiklarna äger den), "Hur snabbt kan ni komma?" byts mot tiden för jobbet. Öppet: om teknikern går igenom vilka plagg som ska tvättas eller frysas, REGLER 14 om värmetält mot klädesmal (passerad av SG 13.4 p 21) | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/flugor/ (nr 19) i [sidor/tjanster-flugor.md](sidor/tjanster-flugor.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen på sajtnivå 28 dagar till 2026-09-29: 0 klick, 47 visningar, position 19,4 (16 mån 1 / 610); kontroll /bli-av-med-flugor/ 40 / 12 314 / 10,0. Title, description och H1 oförändrade, ny H2 "Sanering av flugor i bostad, på vind och i fastighet", ingen malländring. Öppet: tätning mot vindsflugor saknar egen rad i TJANSTEINNEHALL, döda djur på vinden (p 35 nämner inte vind) | Säljchefen och SEO |
| 2026-10-05 | Brief för /tjanster/skyddsjakt/ (nr 20) i [sidor/tjanster-skyddsjakt.md](sidor/tjanster-skyddsjakt.md), SEO prövad (rollen, inget Agent-verktyg). Sidan har inga rader i Search Console; före-värde köpgruppen på sajtnivå 16 mån till 2026-09-29: 1 klick, 30 visningar, nästan allt på /fiskmas/; 28 dagar 0 / 0. Title, description och H1 oförändrade. Malländring: `RAKNA_MED.offert` i ni-form för `intent: foretag` (bara skyddsjakt). Återrapporteringen till Länsstyrelsen stryks tills fråga 4 är besvarad. Öppet: rapporteringen, fällor vid skyddsjakt | Säljchefen och SEO |
| 2026-10-05 | Brief för /skadedjur-jour/ (nr 21) i [sidor/skadedjur-jour.md](sidor/skadedjur-jour.md), SEO prövad (rollen, inget Agent-verktyg). Före-värde Search Console för sidan 2026-09-28 till 2026-09-29: 0 klick, 18 visningar, position 10,8; 28 dagar till 2026-09-29: 8 / 393 / 25,4; "skadedjur jour" 16 mån 26 / 491 / 2,7. Title, description och H1 oförändrade, steglistan stryks, ny FAQ om helgen. Malländring: bottenraden ringer jouren på den här sidan. Öppet: är jouren bemannad (företagsfakta säger att den startar snart) | Säljchefen och SEO |
| 2026-10-05 | Brief för /vara-tjanster/ (nr 22) i [sidor/vara-tjanster.md](sidor/vara-tjanster.md), SEO prövad (rollen, inget Agent-verktyg). Före-värde Search Console för sidan 2026-09-28 till 2026-09-29: 0 klick, 15 visningar, position 3,1; 28 dagar till 2026-09-29: 2 / 396 / 25,3; "vägglushund pris" 16 mån 2 / 321 / 12,1. Title och H1 oförändrade, description "Få fast pris" blir "Du får priset". Ändras i både `vara-tjanster.md` och `vara-tjanster.astro`: tidslinjen ersätts av "Det här kan du räkna med", rutornas prismodellrad av en rad med värdet och huvudsökordet (`HUBBRAD`), företagsavsnittet kortas till ett stycke. Öppet: mätning av vidareklick, SG 3.5 kräver fortfarande tre steg på hubben | Säljchefen och SEO |
| 2026-10-06 | Formuläret först på alla tjänstesidor (Christian 2026-10-06), råttsidan först som landningssida för Ads-kampanjen Claude \| Sök \| Råttor. begone-se cee7073 på grenen `rattsida-formular-forst` (inte main). `formular_forst: true` på råttor, getingar, kackerlackor, myror, flugor, mal, fågelspillning, mögelsanering och skyddsjakt. Formulärets steg 1-rad följer prismodellen (inspektion först och offert: "Vi ringer upp och bokar en kostnadsfri inspektion", fast och hundsök: "Vi ringer upp med ett pris"); råttor får prisrad och kvittens med inspektion, kostnadsförslag och bokning (`PRIS_KOSTNADSFORSLAG`). SEO godkände med villkor: följ /tjanster/rattbekampning/ i Search Console 4 till 6 veckor (före: sep 1 klick, 661 visningar, position 33). Copy godkände med de ord som byggdes. Mätning: förfrågningar med `fran=tjanst-rattbekampning` och gclid mot klick i kampanjen, första avläsning efter 2 veckors trafik. Observerat: på mobil 360 px börjar formuläret 587 px ner, under det långa svarsstycket | Säljchefen, SEO och copy |
| 2026-10-06 | Christians beslut: svarsstycket flyttas så att formuläret syns direkt på mobil. Lösning: bara CSS-ordning i `Tjanst.astro` (klassen `tj-hero__text--formular-forst`). Under 1024 px visas brödsmulor, etikett, H1, formuläret, svarsstycket, villkorsraden, teknikerkortet; HTML:en oförändrad med svarsstycket direkt efter H1, desktop oförändrad, ingen ny text. Gäller alla tjänstesidor med `formular_forst`. Mätt i preview på 360 px: formuläret 587 till 324 px från toppen (H1 213 px, svarsstycket 1 596 px); 1280 px oförändrad (svar 485, formulär 667). begone-se a4262a1 (ej pushad), middleware.js oförändrad. **SEO (agent): godkänd med villkor:** baslinje per sida före deploy, URL-inspektion med live-test på råttsidan efter deploy (svarsstycket i renderad HTML direkt efter H1), uppföljning av alla tjänstesidor 4 till 6 veckor, återställ CSS:en om en sida med klick tappar mer än 5 positioner eller 30 % visningar på mobil men inte på dator över 28 dagar, svarsstycket får aldrig döljas eller fällas ihop på mobil. Baslinje tagen ur `gsc_sida_dag` 2026-09-06 till 2026-10-03 (utan enhetsuppdelning, som tabellen saknar): vägglöss sanering 10 klick / 1 391 visningar / pos 11,1, råttbekämpning 3 / 418 / 11,3, myror 1 / 142 / 12,5, silverfisk 6 / 101 / 10,2, fågelspillning 1 / 63 / 16,1. Uppdelningen mobil/dator måste tas ur Search Console direkt före deploy. **Copy (agent): godkänd,** ingen ny mening behövs (rutan Råttor är förvald och formulärets rad bär övergången); för senare: steg 1 frågar "Vad har du hittat?" och "Beskriv vad du har hittat" efter varandra. Telefonraden "Hellre ringa?" står sist i formuläret (1 532 px), alltså sekundär | Säljchefen, SEO och copy |

Nästa steg: Christian eller innehållschefen beslutar SKRIVGUIDE-ändringen i avsnitt 6 och svarar på fråga 1 till 3. Därefter skriver säljchefen briefen för /tjanster/rattbekampning/, SEO prövar den, copy skriver sidan och malländringarna byggs i samma commit. Avläsning av piloten 28 dagar efter att den är klar.
