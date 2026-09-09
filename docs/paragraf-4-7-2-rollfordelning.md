# Vem äger priset: § 2, § 4, § 6 och § 7 i avtalskartan

Rapport 2026-09-08. Underlag från två agenter (ekonomi, UX). Christian godkände 2026-09-09 modellen i tillägget nedan (avtalstypen som bärande rad). IMPLEMENTERAD 2026-09-09, EJ browser-testad. Gårdagens "fördelning efter kostnad" (regel 2 och åtgärd 1) UTGICK till förmån för andelar med bärande rad.

## Frågan

Christian: "§ 4 kan lista vad som ingår i avtalet och räkna ut marginalen, men borde den ha med faktureringen att göra? Eller ska jag lägga allt som ingår i § 4 och sätta det priset till årspremien? Då måste det priset indexeras. Nu är det § 7 som reglerar priset, vilket jag är okej med, men allt måste hänga ihop."

Bakgrund: Återbesök / Uppföljning hade lagts i prislistan GNU 2026/60 med 0 kr (den blev då gratis per ärende för FEV och AVAB också), och avtal ett hos WBAB har en § 4-rad på 0 kr som gör att årspremiefakturan i juli 2027 skulle bli 0 kr.

## Nuläge i koden

- § 7 (`contracts.annual_value` + `contract_premium_events`) styr vad som faktureras och trappan (start, steg, indexering).
- § 4 (`case_billing_items` med case_type contract, billing_model premium) styr: ärenden avslutas till 0 kr för ingående tjänster, marginalen i § 5, och fakturaraderna: när årspremien faktureras speglas § 4-raderna och premien fördelas på dem i proportion till radernas priser (`factor = premie / radsumma` i contractInvoiceGenerator). Är radsumman 0 blir raden 0 kr och ingen premierad skrivs. Finns inga § 4-rader skrivs "Årspremie <avtalstyp>, period, diarienummer".
- § 2 (`price_lists`) styr priset på allt som faktureras per ärende utöver premien.
- § 6 är § 2 tillämpad på tilläggsstationer: egna rader, aldrig fördelning av premien.

## Rekommenderad modell

**§ 7 äger priset. § 4 äger innehåll och kostnad. § 2 äger styckepriser för avrop.** Det är så koden redan fungerar, men det är oskrivet och därför otryggt.

| Paragraf | Svarar på | Källa för | Rör aldrig |
|---|---|---|---|
| § 2 Prislista för avrop | Vad betalas per ärende utöver premien | styckepris per tjänst och artikel, tilläggsstationernas årspris | premien |
| § 4 Tjänster i avtalet | Vad ingår i premien och vad kostar det oss | antal, intern kostnad (arbetstid, produkter), fördelningsnyckel för fakturaraderna | fakturans totalsumma |
| § 6 Utrustning i avtalet | Vad faktureras utöver premien i egna rader | antal per stationstyp och enhet, pris ur § 2 | premien |
| § 7 Premie och fakturering | Vad kunden betalar för avtalet och hur det utvecklas | årspremie, frekvens, trappa med steg och indexering | radernas innehåll |

### Regler

1. **§ 4-radernas pris är härlett, inte inmatat.** Raden visar sin andel av premien, aldrig ett fritt prisfält. Summan av § 4 kan aldrig ändra premien; en teknikers radändring får inte flytta avtalets pris.
2. **Fördelningsnyckeln byter från pris till intern kostnad.** Premien fördelas på § 4-raderna efter arbetstid plus material under raden, inte efter radens pris. Då försvinner 0-kronorsfallet av sig självt: "Återbesök / Uppföljning" med 6 timmar under får sin andel. Rader helt utan kostnad får andel 0 och skrivs som textrad (0 kr, antal 0). Finns ingen kostnad alls faller generatorn tillbaka på en enda rad "Årspremie ...". Fakturan blir aldrig 0 kr så länge § 7 har en premie.
3. **Indexering är ett steg i § 7-trappan.** Andelarna i § 4 ligger fast och räknas upp proportionellt. § 2 indexeras separat via prislistans egen version. De två uppräkningarna blandas aldrig i samma händelse.
4. **Omfattningsändring (en enhet tillkommer, till exempel en tryckstegring à 1 446 kr)** sker i tre steg: raden läggs i § 4 med antal och kostnad, ett steg av typ tillägg läggs i § 7 med nytt årsvärde och pro rata på innevarande period, nästa faktura får textraden "Tilläggsstationer adderade" plus omfördelade andelar. Alternativet, egen löpande rad utanför premien, är § 6 och väljs medvetet per kund via tilläggsläget.
5. **Samma tjänst får finnas i både § 2 och § 4**, med olika betydelse: § 4 säger hur många som ingår per period, § 2 vad de kostar därutöver. Tills en förbrukningsräknare finns är regeln enkel: ingår tjänsten i § 4 avslutas ärendet till 0 kr. En tjänst i § 2 med 0 kr betyder däremot "gratis per ärende för alla kunder på listan" och är ett fel.

### Fakturaraden

För en LOU-kund: speglade § 4-rader med fördelad premie, inte en klumpsumma och inte 20 st à 1 446 kr. Diarienummer och Er referens i fakturahuvudet, inte i radtexten. Styckepriset på en fördelad rad ska inte likna § 2-priset, annars börjar kunden stämma av avtalsrader mot prisbilagan. Radtexten bär "andel av årspremien" så att två fakturor med olika á-pris efter indexering inte läses som en prisändring.

Exempel WBAB avtal ett, juli 2027 (fördelning efter kostnad):

```
Återbesök / Uppföljning, andel av årspremien 2027-07-01 till 2028-06-30    4 st    4 924,50    19 698,00
```

Avtal två och tre utan § 4-rader:

```
Årspremie Tryckstegringsstationer, 2027-07-01 till 2028-06-30    1 st    28 920,00
```

Det förutsätter att avtalen får egna namn (i dag är radnamnet avtalstypen, samma på alla tre).

## UX: så blir rollfördelningen uppenbar på pappret

Skillnaden ska finnas i kolumnhuvudet, inte bara i rubriken. Båda paragraferna visar i dag en tjänst och ett belopp i samma typografi, och ögat läser det som samma sorts pris.

- **Underrubriker** i samma stil som "Premietrappa" (9,5 px versaler, muted, ingen linje):
  - § 2: `BETALAS PER ÄRENDE, UTÖVER PREMIEN`
  - § 4: `INGÅR I PREMIEN · KUNDEN BETALAR INGET PER ÄRENDE`
  - § 6: `UTÖVER PREMIEN · EGNA RADER PÅ FAKTURAN`
  - § 7: `VAD KUNDEN BETALAR FÖR AVTALET`
- **Kolumnhuvuden**: § 4 `TJÄNST · ANDEL AV PREMIEN`, § 2 `TJÄNST · PRIS PER ÄRENDE`.
- **Summeringsrad i § 4**: "Summa fördelad premie 19 698 kr", grön när den är lika med 7.1, annars "(av 19 698 kr)" i varningsfärg. Neutral på avtal utan premie (avrop).
- **Koppling i radetiketter**: 7.1 får "· fördelad på 1 tjänst", 5.1 heter "Premie mot kostnad i § 4". Inga förklaringsstycken.
- **Varningar där felet uppstår**: i katalogens tjänstväljare visas en tjänst som redan ligger i § 4 nedtonad med "ingår i avtalet (§ 4)" när den väljs till § 2, och omvänt "har avropspris (§ 2)". Ett 0-krona i § 2 sparas aldrig tyst: "0 kr betyder gratis för kunden. Ingår tjänsten i premien hör den hemma i § 4." med knapparna "Flytta till § 4" och "Spara ändå". Kompletthetsraden bär bara tillståndet: "2 dubbletter mellan § 2 och § 4", "Fördelad premie 5 900 av 6 842 kr".
- **Fakturaförhandsvisning i § 7-panelen**: nästa fakturas rader exakt som Fortnox får dem (text, antal, á-pris, belopp, moms, total), och under det "Ingår utan debitering" med § 4-tjänsterna till 0 kr. Det hade avslöjat 0-kronorsfallet direkt. På pappret bara raden "7.3 Nästa faktura".

## Åtgärder att godkänna

1. Planeraren: fördela premien efter intern kostnad, textrad för kostnadsfria rader, reserv på en premierad. Aldrig 0 kr när § 7 har premie.
2. § 4 på pappret: priskolumnen blir "Andel av premien" (härledd, inte redigerbar), summeringsrad mot 7.1, underrubriker och kolumnhuvuden enligt ovan.
3. § 2: 0-kronorsrader visas inte som fast pris, och panelen frågar innan ett 0-krona sparas i prislistan. Ta bort "Återbesök / Uppföljning 0 kr" ur GNU 2026/60.
4. Avtal får ett eget namn (nytt fält), som används på fakturaraden och i kundlistan i stället för avtalstypen.
5. Fakturaförhandsvisning i § 7-panelen.
6. Katalogens varningar för dubbletter mellan § 2 och § 4, och raden i kompletthet.

Byggs inte: förbrukningsräknare per period (ingår N, därutöver § 2). Det är nästa steg när grunden sitter.

## Risker

- Summeringsraden i § 4 blir brus på avtal där premien inte ska fördelas (avrop, beredskap). Neutral när premien är 0, och en panelinställning "Premien fördelas på § 4" som är av på avropsavtal.
- Tyst omfördelning efter indexering ser ut som prisändring på fakturan. Radtexten "andel av årspremien" och avrundning mot totalen, inte per rad.
- Manuella Fortnox-fakturor cementerar en annan sanning (WBAB:s julifaktura hade tre handskrivna rader). Fördelningsnyckeln måste vara på plats före nästa faktureringsomgång, annars blir undantaget rutin.
- Fyra underrubriker gör pappret bullrigare. Testa på ett avtal med alla paragrafer; räcker det inte behålls underrubriken bara på § 2 och § 4.

## Tillägg 2026-09-09: Christians förslag, avtalstypen som bärande rad i § 4

Christian: avtalstypen som väljs i headern ska skapas som rad i § 4 med ett pris som avgörs av årspremien (låst, bara beroende av § 7 och indexering), med interna kostnader under. Allt mappas fortfarande mot tjänsten i prisguiden. Fakturatexten "Årspremie <avtalstyp>" som fallback med möjlighet till egen text per avtal, för kunder med flera avtal.

Båda agenterna: **håller, med ändringar.** Det är samma modell som ovan med ett bättre standardvärde: det finns alltid en rad att fördela premien på, § 4 blir fullständig som innehållsförteckning, och avtalsarbetets kostnader får en hemvist. Fyra justeringar:

1. **Låst, men härlett, inte lagrat.** Raden lagrar en andel av premien (ensam rad = 100 %), aldrig ett belopp. Skrivs premien in som ett fast tal på raden uppstår två sanningar som glider isär vid varje indexering. Beloppet räknas vid rendering ur § 7-trappan för den period man tittar på, så 19 698 → 20 290 efter AKI-steget kräver ingen ändring i § 4. Kostnaderna under indexeras inte, det är så marginalerosionen mellan stegen blir synlig.
2. **Bärande raden är restposten.** Övriga § 4-rader (Återbesök, Ljusfälla generell) får andel 0 som standard: de syns på pappret, bär sin interna kostnad, och skrivs på fakturan som textrad 0 kr under "Ingår utan debitering". Vill man specificera premien på rader (LOU-kund som vill se det) sätts andelar per rad, och 4.1 blir premien minus de andra. Summan är alltid 100 %; kompletthetsraden flaggar överfördelning och en 4.1 under 10 % av premien. Fördelning efter kostnad som standard (gårdagens förslag) utgår: varje ny § 4-rad skulle då bli en fakturaförändring hos kunden.
3. **Ett namnfält, inte två.** contracts.label finns redan och används som rubrik. Etikett i panelen, gruppen Avtalet: "Avtalets namn", hjälptext "Visas i kundlistan, i rubriken och på fakturaraden. Tomt ger avtalstypen." Fakturaraden blir "Årspremie <namn>, <period>, <diarienummer>". Diarienummer och Er referens kommer alltid ur sina fält, aldrig ur fritexten. Namnet måste skyddas mot Oneflow-synk, som i dag skriver label. Ett separat fakturatextfält byggs inte; behövs avvikande text senare hör den hemma som en överskrivbar rad i fakturaförhandsvisningen.
4. **Inga antal i premieraden.** "20 st à 1 446" på en premierad ger kunden ett styckepris att stämma av mot prisbilagan, och nästa AKI-steg ger ett á-pris ingen beställt. Antal hör hemma i § 6 (riktiga styckepriser ur § 2) eller i avtalets namn som beskrivning.

### Regler

- Varje avtal med premie har exakt en bärande § 4-rad: tjänsten med is_contract_service som matchar avtalstypen. Skapas när typen väljs. Byte av avtalstyp byter tjänst på den befintliga raden och behåller andel och kostnader, aldrig en ny rad (annars dubblas fakturan).
- Bärande raden: antal 1, andel = 100 % minus övriga andelar, belopp härlett ur § 7 för perioden. Ingen prisinmatning, ingen kryssruta. På pappret "hela premien" i punktlinjen när den är ensam, annars "andel av premien", och ett lås efter beloppet. I panelen står "Priset följer § 7.1" där prisfältet annars är.
- Innan premien finns i § 7: beloppet "— kr" (aldrig 0 kr) och "premie saknas i § 7" i varningsfärg, klickbart till panelen.
- Avropsavtal utan premie: ingen bärande rad, § 5 neutral.
- Bärande radens tjänst får aldrig ligga i § 2 med pris. Katalogens dubblettvarning ska vara särskilt hård för avtalstjänster.
- Enhetskortet i vänsterpanelen visar avtalets namn och premie i stället för avtalstypen, så WBAB:s tre avtal går att skilja åt även innan de döpts.

### Migrering

- Avtal med tom § 4 (de flesta): bärande rad skapas ur avtalstypen, andel 100 %, kostnad 0. Fakturan blir identisk med dagens fallback-rad. Säker backfill.
- WBAB avtal ett: bärande rad läggs till med 100 %, "Återbesök / Uppföljning" får andel 0 och behåller sin arbetstid som kostnad. Julifakturan 2027 blir 19 698 kr på en rad.
- Avtal där någon avsiktligt satt priser på flera rader: bärande raden till 100 %, övriga till 0, och de listas i kompletthetsraden som "N rader förlorade sitt pris, granska".

### Risker

- Restposten döljer fel: en orimlig kostnad på en annan rad krymper 4.1 tyst. Flaggas i kompletthet, inte bara i färg.
- Namnfältet skrivs över av Oneflow-synken. Måste bli användarsatt och skyddat.
- Låst belopp i en priskolumn inbjuder till redigering. Kolumnhuvud och text, inte input.
- Marginal per tjänst går förlorad när allt hänger under en rad. Ingår-raderna med andel 0 behålls som kostnadsbärare, så kostnaden per tjänst syns även när intäkten inte fördelas.
