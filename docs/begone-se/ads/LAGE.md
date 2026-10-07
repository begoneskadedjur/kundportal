# Google Ads: läge och beslut

Konto: BeGone.se - Ny (940-760-4856) under MCC MCP-BEGONE (679-697-3203). Agent: `google-ads`.

## Läge 2026-10-06

- API-åtkomst klar (Explorer, Cloud-projekt begone-ruttplanering, API v25). Verktyg: `scripts/ads/gaql.mjs` (läsa), `scripts/ads/mutate.mjs` (provkör, genomför med `--genomfor` efter godkännande).
- GAQL-tips: `DURING LAST_90_DAYS` finns inte, använd `segments.date BETWEEN`. `campaign_search_term_view` ger söktermer även för Performance Max. `change_event` räcker bara 30 dagar bakåt.
- Mätning live på begone.se sedan 2026-10-06: egen cookiebanner, Consent Mode v2 grundläge, konverteringen Formulär ifyllt med förbättrade konverteringar. Ingen mätning 2026-09-23 till 2026-10-06.
- Kontot visade i stort sett inga annonser 2026-09-24 till 2026-10-04 (råttsöket redan från 2026-09-22). Orsak (Christian 2026-10-06): annonserna stängdes av när WordPress-sajten byttes ut och slogs på igen 2026-10-05.
- BrightBid styr inte längre kontot.
- Nio aktiva kampanjer, total budget cirka 4 430 kr per dag.
- Känt: förbjudna löften i annonstexter (garanti, 24/7, akut, inom 24 h, 10/10), underkända webbplatslänkar och prisruta (gamla WordPress-adresser, JOUR, garanti), en underkänd porträttbild i generell PMax, myrannonsen underkänd (sidan fungerar nu), primära konverteringar räknar telefonklick. Företagsnamnet BeGone Skadedjur är underkänt som tillgång (kontrollera annonsörsverifiering).
- Delade negativa listan Konkurrenter är bara kopplad till råttsöket. Ingen varumärkeskampanj finns; begone och be gone köps i råttsöket och båda PMax.

## Kontoplan från noll (2026-10-06)

- PDF `Ads_Kontoplan_2026-10-06.pdf`, skript `gen-ads-kontoplan.mjs`, data (kampanjer, sökord, annonser, tillägg, negativa listor) i `docs/begone-se/ads/kontoplan-data.mjs`. Väntar på Christians beslut (avsnitt 8 i PDF:en).
- Historik: kontot 940-760-4856 har data från 2022-06 (2,37 mkr). Gamla kontot 773-630-6196 går INTE att läsa via API (CUSTOMER_NOT_ENABLED, även via MCC).
- Lärdomar: råttornas PMax "billiga" formulär kom mest från konkurrentsökningar (75 % av synlig kostnad, anticimex kontakt 19 920 kr); misstänkt skräp september 2024 (139 PMax-formulär på en månad). Råttsöket 771 till 1 398 kr per formulär varje år. Fras/exakt billigare än bred. Formulär dygnet runt, samtal bara vardagar 08 till 17 (1 av 111 samtal kvällar/helger var 60 s+). 28 118 kr har gått till Västmanland och Örebro (platsalternativ intresse).
- Struktur: Sök | Råttor 1 550, Sök | Fåglar 800, PMax | Fåglar (övergång, befintlig) 200, Sök | Vägglöss 600, Sök | Insekter i hemmet 450, Sök | Möss 450, Sök | Varumärke 180, Sök | Företag och avtal 200, Getingar och Myror pausade till säsong. Summa 4 430 kr. 23 annonsgrupper, fras + exakt, nio delade negativa listor (Konkurrenter även på kontonivå), bara närvaro i sex län, annonser dygnet runt, samtal vardagar 08 till 17. Ingen ny PMax vid start; generell och råttornas PMax pausas.
- Budstrategi: Maximera konverteringar utan mål-CPA vecka 1 till 4, sedan mål-CPA; Bokat uppdrag primärt vid 15 till 20 bokade/månad; värde (mål-ROAS) vid 30 genomförda/månad.
- Mätning: telefonklick och GA4 generate_lead sekundära, Calls from ads primär (60 s, en per klick), ny Samtal från webbplatsen (kräver beslut om vidarekopplingsnummer), Bokat uppdrag och Genomfört uppdrag för offline-import från web_inquiries (cron i kundportalen, ej byggt).
- Texterna: skadedjursexperten GODKÄND efter två omgångar (Takrunda struken, "Ofta på plats redan samma dag" för råttor och möss, ROT och Kostnadsfri inspektion per annonsgrupp, inte avlopp/BRF/företag). Säljchefen: åtta sidändringar (råttsidan formular_forst först), se PDF 5.
- Förslagsfiler `andringar/2026-10-06_konto_1-matning.json` (10 op), `_2-fas1-bygg.json` (445), `_3-fas2-bygg.json` (390, listornas id fylls i med `node --env-file=.env.local gen-ads-kontoplan.mjs --json` efter steg 2), `_4-start-fas1.json`, `_5-start-fas2.json`. **EJ PROVKÖRDA**: provkörning med mutate.mjs nekades av behörighetsspärren i agentsessionen 2026-10-06. Provkör i huvudsessionen innan Christian godkänner.
- Öppna frågor till Christian: vidarekopplingsnummer, offline-import och integritetstext, värde per förfrågan (1 400 kr i åtgärden, taggen skickar 1 kr enligt säljchefen), inga konkurrentnamn, PMax Fåglar kvar till vecka 8, kostnadsfri inspektion för möss?, fågelspillning offert eller fast pris?, fast pris per telefon för värmebehandling?, företagsnamnet under annonsörsverifiering.

## Offline-import och samtal (2026-10-06)

- Nattjobb `api/cron/google-ads-konverteringar.ts` (05:45 UTC) PUSHAT dfe848c7. Google Ads API uploadClickConversions är stängt för kontot (CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE); jobbet använder Data Manager API (`datamanager.googleapis.com/v1/events:ingest`), kräver OAuth-scopet datamanager. Idempotens i tabellen google_ads_konverteringar. Torrkörning `?torr=1`.
- Återstår: aktivera Data Manager API i Cloud-projektet, kör om oauth.mjs (båda scopen), lägg GOOGLE_ADS_*-variablerna i kundportalens Vercel, skapa konverteringsåtgärderna (konto_1-matning.json), torrkör i produktion.
- begone-se gren `samtal-och-utfall` (7fb7f03, ej main): webbplatssamtal via phone_conversion_number bara med samtycke (aktiveras när PUBLIC_GOOGLE_ADS_ETIKETT_SAMTAL sätts), policy och bannertext om samtal och utfall, CONSENT_VERSION 2. Rutin: begäran om att stoppa delning via info@begone.se = sätt details.samtycke_marknadsforing false.

## Annonsbilder (2026-10-06)

- Flöde: `scripts/ads/generera-annonsbilder.mjs` (Gemini gemini-3.1-flash-image-preview, stilrad ur BILDNORM, högst 3 försök), manifest `docs/begone-se/ads/bilder/manifest.json` (id, kampanj, motiv, format, prompt, status, kommentar, historik), original i `bilder/original/` (i .gitignore), färdiga JPG i `bilder/klara/` (1200x628, 1200x1200, 960x1200). sharp lånas från begone-se:s node_modules.
- Fas 1: 18 bilder, 24 genereringar. Skadedjursexperten godkände 17 (tre omgångar). Struken: fagel-vajer-nock-l (Gemini ger inget trovärdigt vajersystem; ta riktigt foto från ett uppdrag). Rensbrunnen är svag som annons (låg vikt), spillningsbilden bara i fågelsöket, inte PMax.
- Kontaktark `Ads_Bilder_2026-10-06.pdf` (skript `gen-ads-bilder.mjs`). Förslagsfil `andringar/2026-10-06_bilder-fas1.json` byggs med `scripts/ads/bygg-bildforslag.mjs`: 17 bildtillgångar + 22 kopplingar (AD_IMAGE på Claude | Sök | Råttor, Fåglar, Varumärke; MARKETING/SQUARE/PORTRAIT_MARKETING_IMAGE i PMax Fåglar, grupp 6516988320). PROVKÖRD OK 2026-10-06 (39 op). GENOMFÖRD 2026-10-06 20.58 (bilderna godkända av Google).
- Kontoplanens motiv med tekniker bakifrån gjordes om till bilder av utfört arbete (BILDNORM: inga personer eller händer).
- PMax Fåglar har 12 gamla bilder (flera stockbilder från 2025); med de 6 nya blir det 18 av 20 tillåtna. Föreslå borttagning av de gamla i eget steg när de nya är godkända av Google.
- Fas 2 (ej påbörjad): vägglöss och värmetält, silverfisk, pälsänger, mjölbaggar, möss (husmus inomhus).

## Gemensam start (2026-10-07)

- Christian vill ha annonser i alla kampanjer snart: fas 1 och fas 2 startas TILLSAMMANS. Underlag `Ads_Start_2026-10-07.pdf` (skript `gen-ads-start.mjs`). INGET GENOMFÖRT, väntar på Christians ja.
- Företagsnamn (asset.field_type_policy_summaries): BeGone, Begone, BeGone AB och Begone.se är GODKÄNDA. Begone Skadedjur och BeGone Skadedjur är underkända (BUSINESS_NAME_IRRELEVANCE, "Skadedjur" matchar inte annonsör/domän). Rekommendation: BeGone (tillgång 112323469970).
- Filer (byggs med `node --env-file=.env.local scripts/ads/bygg-start.mjs`), körordning: 1 `2026-10-06_logotyp-namn.json` (18 op, OK), 2 `_annonser-b-fas1.json` (11, OK), 3 `_pmax-fagel-texter.json` (89, EJ PROVKÖRD, kvoten), 4 `_pmax-fagel-bilder-bort.json` (12, OK), 5 `_fas2-komplett.json` (423 = konto_3 384 OK + annons B och bilder fas 2 EJ PROVKÖRDA, kvoten), 6 `_start-alla.json` (13 OK utan fas 2; efter fil 5 kör `bygg-start.mjs --bara-start`, då 17 op, provkör igen).
- Explorer-kvoten (2 880 op/dygn, provkörningar räknas) tog slut 2026-10-07 cirka 00:00. Provkör fil 3 och 5 efter återställning.
- konto_3: listornas id ifyllda direkt i filen (gen-ads-kontoplan.mjs --json skulle skriva över fil 1, 2, 2b och 4). Neg | Konkurrenter kopplas inte per kampanj i fas 2 (kontolistan Konto | Konkurrenter, 18 ord, gäller hela kontot). Provkörd OK 384 op 2026-10-06.
- Annons B: `docs/begone-se/ads/annonser-b-data.mjs`, 21 grupper (inte Getingar/Myror), vinkel erfarna tekniker, ISO, uppföljning. Experten underkände först, elva rättningar, sedan godkänd. Pälsänger: ingen uppföljning som rutin. Värmetält 1 till 3 dygn. Fåglar: "gamla bon".
- PMax Fåglar: nya texter `docs/begone-se/ads/pmax-fagel-data.mjs` (experten godkände direkt), gamla texter och bilder sparade i `pmax-fagel-fore-2026-10-07.json`. Tillägg ersätts med fågelsökets (sitelänkar, framhävningar, utdrag, samtal vardagar 08 till 17). Logotyper: tre minsta bort (tak 5), nya in, namn BeGone.
- Logotyper `bilder/klara/logo-1x1.png` (1200x1200) och `logo-4x1.png` (1200x300), ordbilden oförändrad på vit botten. Kontonivå BUSINESS_LOGO + BUSINESS_NAME (ärvs av fas 2), kampanjnivå på fas 1.
- Bilder fas 2: 14 motiv, 20 genereringar, 13 godkända av experten, mjolbaggar-skafferi-l struken (fel skala tre gånger). Kopplas i fas2-komplett per annonsgrupp (Vägglöss, Insekter) och per kampanj (Möss, Företag).
- Budget efter start: Råttor 1 550, Fåglar 800, PMax Fåglar 200, Varumärke 180, Vägglöss 600, Insekter 450, Möss 450, Företag 200 = 4 430 kr. Pausas: gamla råttsöket, båda BrightBid-PMax (råttor, generell), gamla fågelsöket, Silverfisk|Pälsänger|Mjölbaggar|Vägglöss, Möss, Getingar, Myror.

## Kampanjer

### BrightBid_High Priority_Råttbekämpning (sök, 19729967497)

- Rapport 2026-10-06: `Ads_Rattbekampning_2026-10-06.pdf` (skript `gen-ads-rattbekampning.mjs`). Väntar på Christians beslut.
- Nuläge: budget 2 000 kr/dag (höjd från 600 kr 2026-10-05), Maximera konverteringar mål-CPA 800 kr, bjuder bara på formulär (samtal räknas inte). 90 dagar: 21 374 kr, 705 klick, 24 formulär, 891 kr/formulär. Visningsandel 40 %, 60 % tappas på rankning, 0 % på budget, så budgeten begränsar inte.
- Annonsgruppen Musbekämpning är borttagen sedan före 2026-09-07; samma sökord ligger i kampanjen Möss. Search - Råttor (rabatt, 10/10, garanti) slogs på 2026-10-05 17.31 och pausades 2026-10-06 10.09.
- Förslagsfiler (alla provkörda OK 2026-10-06, 98 operationer, inget genomfört): `andringar/2026-10-06_ratt_1a_nya-annonser.json`, `_1b-pausa-gamla-annonser.json` (först när 1A är godkänd), `_2-tillagg.json`, `_3-negativa-sokord.json`, `_4-stadning.json`, `_5-bilder-bort.json`.
- Nya texter granskade och godkända av skadedjursexperten (två omgångar) och prövade av säljchefen. Villkor: Christian bekräftar ISO 9001/14001-certifiering, annars stryks framhävningen.
- Fas 2 (beslut 2026-11-03): dela annonsgruppen i Råttbekämpning, Råttor inomhus, Råttor utomhus (+ avlopp), matchningstyper, mål-CPA, budget (cirka 1 500 kr/dag används inte), varumärkeskampanj och sedan begone negativt här, samtal ≥ 60 s som mål.
- Säljchefen: råttsidan saknar `formular_forst: true` (heron visar Ring först och "ringer upp med ett pris"); bör åtgärdas innan kampanjen trappas upp.

## Beslut

- 2026-10-07 (eftermiddag): STÄDNING GENOMFÖRD (fil `andringar/2026-10-07_stadning-konto.json`, 84 op, plus rekommendationsprenumerationen 1 op via eget anrop). Kontonivån: fyra gamla webbplatslänkar (inom 24 timmar, verksamhetsområden, JOUR, inom 48 timmar) och två gamla utdrag borttagna; kvar är logotypen och ett PAUSAT samtalstillägg 010 280 44 10 (ofarligt). Företagsnamnet BeGone (112323469970) på kontonivå syns inte i GAQL men skapades 2026-10-07. Ny webbplatslänk Kontakta oss / Skicka en förfrågan / Vardagar 08 till 17 till https://begone.se/kontakt/ ersätter de tio underkända (destination not working 2026-10-04, sju av dem med telefonnummer i text) i alla tio Christian-kampanjer. Inga telefonnummer finns i annonstexterna i Christian-kampanjerna. Webbplatslänkar kompletterade med redan godkända: Om Begone på Råttor, Fåglar, PMax Fåglar; Företag och fastigheter på Varumärke; Skicka en förfrågan på Insekter; Skadedjursavtal på Företag. Nu 4 till 5 per aktiv kampanj. Gamla råttsökets underkända företagsnamn Begone Skadedjur ersatt med BeGone. GA4 click_phone, click_akut, click_phone_akut och generate_lead borttagna (API:et tar inte status REMOVED, remove-operation används). OPTIMIZE_AD_ROTATION pausad, inga automatiska rekommendationer på. 45 pausade gamla kampanjer borttagna (alla Brightbid, BrightBid_, [PB], [G] och de omärkta gamla: Fågelsäkring, Jour, Kackerlackor, Pälsänger, Bekämpa mal, Elektriska råttfällor, Fågelspillning, Flugor, Huddinge, Konkurrenter, Mjölbaggar, Search - Getingar/Möss/Myror/Råttbekämpning). Kvar: bara de elva Christian-kampanjerna.
- 2026-10-07: Christian bekräftade webbplatslänken Skadedjursavtal "Första besöket är kostnadsfritt / Avtalsförslaget binder er inte" (sant, får stå).
- Kvar att titta på: dolda GA4-åtgärden "BeGone - GA4 (web) Konverting" står som primary (HIDDEN, räknas troligen inte men bör tas bort i samma anda); gamla råttsöket (pausat) har kvar gamla aktiva annonser med "inom 24h", "Akut ... Ring nu" och framhävningen "Alla tekniker har 1SO" (1B ej körd). Fas 2-kampanjerna har inget eget företagsnamn på kampanjnivå (ärver kontonivån).

- 2026-10-07 09.40: GEMENSAM START GENOMFÖRD. Logotyp + företagsnamnet BeGone, annons B, PMax Fåglar-texter (med "Hundratals nöjda kunder" och "Vi stänger ute fåglarna med nät, piggar och vajer, utan preparat."), gamla PMax-bilder bort, fas 2 byggd, och start-alla: 8 Christian-kampanjer aktiva (Råttor 1 550, Fåglar 800, Vägglöss 600, Insekter i hemmet 450, Möss 450, PMax Fåglar 200, Företag och avtal 200, Varumärke 180 = 4 430 kr/dag), 8 gamla pausade. Getingar och Myror (säsong) byggda men pausade. Namnprefix bytt från Claude till Christian (Christians begäran). Nästa: "Hundratals nöjda kunder" i övriga kampanjer om specialisten tycker det, kolla annonsgranskning och söktermer 2026-10-08, veckogenomgång, utvärdering vecka 4.

- 2026-10-07: Christian: "Hundratals nöjda kunder" är sant och får stå. Fågelsäkring utan preparat eller avdödning får stå (konkret, inte "miljövänligt"). Lägg in i PMax Fåglar-texterna före start. Experten var för sträng här.

- 2026-10-06: Namnregel: kampanjer som Claude skapat eller arbetat i heter "Claude | ...". Bytt: Claude | Råttbekämpning (gammal, rensad), Claude | Sök | Råttor, Claude | Sök | Fåglar, Claude | Sök | Varumärke. Fas 2 i data och förslagsfil har samma prefix.

- 2026-10-06: GENOMFÖRT: mätningen (konto_1, telefonklick sekundära, Calls from ads ≥60 s primär, nya åtgärder Samtal från webbplatsen 60 s, Bokat uppdrag, Genomfört uppdrag), fas 1-bygget PAUSAT (Sök | Råttor 1 550, Sök | Fåglar 800, Sök | Varumärke 180), kontolistan Konto | Konkurrenter (ACCOUNT_LEVEL_NEGATIVE_KEYWORDS) på hela kontot. GOOGLE_ADS_*-variabler i kundportalens Vercel (production), nattjobbet i torrläge (GOOGLE_ADS_KONVERTERINGAR_TORR=1) första veckan. begone.se main 317c0b7: samtal/utfall-text i policyn, kort cookiebanner (Christian vill inte ha detaljer i bannern), samtyckesversion 2. Kvar: etiketten PUBLIC_GOOGLE_ADS_ETIKETT_SAMTAL i begone-se Vercel för nummerbyte, start av fas 1 efter råttsidans formular_forst, 1B för råttsöket.

- 2026-10-06 (kontoplanen, avsnitt 8): Ordning och budgetfördelning: agenten bestämmer inom 4 430 kr/dag. Inga konkurrentnamn i annonseringen (de som söker konkurrenter går ofta via försäkringsbolag och förväntar sig gratis arbete). Fåglarnas PMax får gå kvar till vecka 8. Kostnadsfri inspektion gäller även möss. Fågelspillning: blandat, mindre saneringar (balkong o.d.) kan få pris per telefon efter bild, omfattande kräver inspektion. Fast pris per telefon eller mejl gäller även värmebehandling av vägglöss. Förfrågans värde: följer huvudsessionens förslag (inget fast värde, riktiga belopp via Bokat/Genomfört). Vidarekopplingsnummer och offline-import: förklarade för Christian, inväntar ja.

- 2026-10-06: Steg 1A, 2, 3, 4 och 5 i råttrapporten GENOMFÖRDA (95 operationer, se andringslogg.jsonl). 1B (pausa gamla annonser) körs när de nya annonserna är godkända av Google.
- 2026-10-06: Kontot ska SÄTTAS UPP FRÅN NOLL. Historiken används bara som underlag (sökord, söktermer, vad som har gett formulär). Ny struktur byggs vid sidan av, gamla kampanjer pausas när den nya är godkänd och igång. Christian föredrar större, ordentliga ändringar framför att lappa i det gamla.
- 2026-10-06: ISO 9001 och ISO 14001 är certifierade av Qvalify (ackrediterat organ). Framhävningen får stå.
- 2026-10-06: "Ofta redan samma dag" får stå i annonser.
- 2026-10-06: Teknikerna har 8 till 16 års erfarenhet av skadedjur (alla utom en). Begone är premium inom skadedjur; positionera därefter (utan siffror som inte är belagda per tekniker, inga garantier).
- 2026-10-06: Historik: när kontot sköttes för cirka två år sedan kostade råttleads 300 till 600 kr och höll bra kvalitet. Ingen med Ads-kompetens har arbetat i kontot sedan dess.

- 2026-10-06: Råttor och fågel prioriteras, sedan insekter och möss. Getingar och myror (10 kr per dag) lämnas tills vidare.
- 2026-10-06: Total dagsbudget oförändrad, pengar flyttas mellan kampanjer.
- 2026-10-06: Kostnadsfri inspektion får stå för råttor och fågel. "På plats inom 24 timmar" stämmer inte för vanliga ärenden och tas bort som löfte.
- 2026-10-06: Striktare uppsikt i början: en kampanj i taget med PDF-rapport som Christian godkänner innan något ändras.

## Nästa steg

- (2026-10-07, gäller före punkterna nedan) Christian läser `Ads_Start_2026-10-07.pdf`. Efter ja: provkör fil 3 och 5 när kvoten är återställd, genomför 1 till 5, kör `bygg-start.mjs --bara-start`, provkör och genomför startfilen. Policystatus dag 1 och 2, A mot B 2026-10-21, mål-CPA 2026-11-04. YouTube-filmerna i PMax Fåglar är inte granskade.
0. (2026-10-06, kontoplanen) Provkör de fem konto-filerna, Christian läser `Ads_Kontoplan_2026-10-06.pdf` och svarar på avsnitt 8. Ordning: mätning, råttsidan formular_forst, fas 1 pausad, granskning, start fas 1 + paus gamla samma dag, fas 2 vecka 2, utvärdering vecka 4 och 8. Kontoplanen ersätter fas 2 i råttrapporten och de planerade separata rapporterna för PMax, fågel och möss.
1. Christian läser råttrapporten och svarar per steg (1A, 1B, 2, 3, 4, 5) samt på frågorna om ISO, "ofta redan samma dag" och stoppet 2026-09-24 till 2026-10-04.
2. Efter ja: genomför stegen, kontrollera policystatus 2026-10-08, kör 1B när nya annonser är godkända. Avstämning 2026-10-20, utvärdering och fas 2 2026-11-03.
3. Nästa rapporter: BrightBid_High Priority_Råttbekämpning_PMax (konkurrentnamn, varumärke, mål-CPA 300 mot sökets 800), därefter fågel. Möss-rapporten tar dubbla annonsgrupper och fel slutadress (/moss-i-huset-och-vaggarna/ i stället för /tjanster/moss/).
4. Kontoövergripande: rensa primära konverteringar (click_phone, click_akut), varumärkeskampanj.
5. Annonsbilder: Christian läser `Ads_Bilder_2026-10-06.pdf`; efter ja körs `2026-10-06_bilder-fas1.json` med --genomfor (bygg om filen med bygg-bildforslag.mjs om manifestet ändrats), policystatus dagen efter. Därefter fas 2 av bilderna.
