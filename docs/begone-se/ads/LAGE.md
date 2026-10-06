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

1. Christian läser råttrapporten och svarar per steg (1A, 1B, 2, 3, 4, 5) samt på frågorna om ISO, "ofta redan samma dag" och stoppet 2026-09-24 till 2026-10-04.
2. Efter ja: genomför stegen, kontrollera policystatus 2026-10-08, kör 1B när nya annonser är godkända. Avstämning 2026-10-20, utvärdering och fas 2 2026-11-03.
3. Nästa rapporter: BrightBid_High Priority_Råttbekämpning_PMax (konkurrentnamn, varumärke, mål-CPA 300 mot sökets 800), därefter fågel. Möss-rapporten tar dubbla annonsgrupper och fel slutadress (/moss-i-huset-och-vaggarna/ i stället för /tjanster/moss/).
4. Kontoövergripande: rensa primära konverteringar (click_phone, click_akut), varumärkeskampanj.
