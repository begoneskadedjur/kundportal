# Ronden på riktiga ärenden

Plan 2026-09-07. Underlag från två experter (system, avtalsleverans), granskad av en tredje agent: godkänd med ändringar, som är inarbetade nedan. Godkänd av Christian 2026-09-07 och implementerad samma dag. EJ browser-testad.

## Problemet

Sektionen "Ronden, leverans mot avtalet" i fliken Ärenden på kundkortet (`src/components/admin/customers/record/ContractCasesSection.tsx`, useMemo `rond`, rad 376 till 508) räknar fram förväntade besökstider ur avtalets frekvens och visar dem som förseningar. Rytmen förankras i ett godtyckligt schema och projiceras bakåt när schemat startar senare än tolvmånadersfönstret. Hos FEV visas fyra förseningar på 335, 243, 152 och 61 dagar som aldrig har haft ett ärende. Ronden tar dessutom första avtalet med frekvens som rytm för hela organisationen, fast FEV har fyra avtal med olika rytm.

KPI-rutan Kontrollbesök räknar in framtida bokningar och visar "senast 15 apr 2030".

## Grundregel

Rita bara det som har en rad i databasen. Frekvens är en regel, inte en händelse. Regler hör hemma i rubriktexten, aldrig på tidslinjen och aldrig som förseningar.

"Försenat" betyder exakt en sak: en bokning som finns, vars datum har passerat, och som aldrig avslutades. En frekvens som inte blivit en bokning är en lucka i planeringen och heter "återstår att boka".

## Vad Ronden visar efter ändringen

Enbart `station_inspection_sessions` som hör till levande ärenden (`liveSessions`, redan filtrerad på att ärendet finns och inte är Borttaget).

| Läge | Villkor | Ritas |
|---|---|---|
| Utfört | status completed eller completed_at satt | fylld plomb på UTFÖRT-spåret vid completed_at, med täckningsbåge (kontrollerade av totalt stationer) |
| Bokat | status scheduled, scheduled_at i framtiden | streckad grön ring på övre spåret vid scheduled_at |
| Missat | samma predikat som `sessionLateness` (används redan av Kräver handling), ärendet levande | röd ring på övre spåret med streckad linje till idag |
| Avbokat | status cancelled | ritas inte |

Missat definieras på exakt ett ställe, `sessionLateness`, så ronden och Kräver handling aldrig kan säga olika.

Övre spåret byter etikett från AVTAL till BOKAT. Sektionens rubrik byter till "Ronden, bokat och utfört": när inget avtalat ritas mäter modulen inte längre leverans mot avtal. Inga ledlinjer mellan spåren: bokat och utfört är samma session.

Utförda besök behåller en driftsiffra i tooltipen, men mot sessionens egen `scheduled_at` ("utfört 3 dagar efter bokad tid"), aldrig mot en beräknad avtalstid. Det är en riktig databaspost.

`completedSessions` (rad 353) filtreras på `liveSessions` precis som `lateSessions`, annars kan ett borttaget ärendes session bli "senaste besöket" i pärlbandet.

Ramen bakom spåren: avtalsstart och första etablering som två lodräta markeringar. Inget ritas till vänster om etableringen.

## Planeringsstatus, bara antal i text

Det här är det enda stället där frekvensen används, och det är medvetet en beräkning: den räknar ANTAL, aldrig datum, och kan därför aldrig bli en försening. En rad i löptexten, aldrig ringar, aldrig ordet försenad. En definition, framåtblickande:

> Avtalet ger 4 kontrollbesök per år per enhet. Stationerna sattes ut juli och augusti 2026. Kommande 12 månader: 1 bokad, 3 återstår att boka.

Regel: bokade = sessioner med status scheduled och scheduled_at inom kommande 365 dagar. Återstår att boka = max(0, besök per år minus bokade). Raden visas bara för spår med både frekvens och minst en etablering eller session, och utelämnas helt om enheten saknar etablering (då finns inget att kontrollera). Ingen bakåtblickande nämnare alls i det här steget.

## Multisite

Per rytmenhet, aggregerat med enhetsuppdelning. En rytmenhet = en rad i `recurring_schedules` (bär customer_id och contract_id). Sessioner mappas till spår via recurring_schedule_id, annars customer_id, annars ett spår "Övrigt" så manuellt skapade kontrollbesök utan schema aldrig försvinner.

```ts
interface RondTrack {
  key: string                    // schedule.id, annars `unit:${customerId}`
  unitName: string | null
  contractId: string | null
  visitsPerYear: number | null   // schemats frekvens, annars avtalets på samma contract_id
  frequencyLabel: string | null
  startsAt: number | null        // max(schemastart, avtalsstart, första etablering)
  done: RondVisit[]
  booked: RondVisit[]
  missed: RondVisit[]
  planning: { booked: number; remaining: number } | null
}
```

`visitsPerYear` löses per spår, aldrig via `contracts.find(...)`.

Kräver för att fungera: `recurring_schedule_id` läggs till i selecten på `station_inspection_sessions` i `src/hooks/useCustomerRecord.ts` rad 529 till 532 och i typen `RecordInspectionSession` (rad 236 till 249). Kolumnen finns i databasen och är ifylld på 206 av 213 sessioner. Resten fångas av fallback på customer_id.

`rond` returnerar `tracks: RondTrack[]` och exponerar dem så att `actions`-memon (Kräver handling) kan läsa samma underlag i stället för att räkna om.

Rendering: ett band per spår upp till sex spår. Fler än sex: ett samlat band med enhetens namn i vänsterkolumnen, samma grid som extraärendenas artrader. Ett enda spår renderas som i dag utan enhetsetikett.

Toppen på ett huvudkontor säger bara räknebara saker:

> 9 enheter, 4 avtal (1 kvartalsvis, 3 halvårsvis). Avtalsstart 2026-06-30, stationer utsatta juli och augusti. 0 missade besök. 3 enheter saknar bokning framåt.

Inga procentsatser på huvudkontorsnivå. Kvartals- och halvårsenheter blandas aldrig i en gemensam nämnare.

## Kräver handling

Ordning och ton:

1. Missade bokningar (bokat i det förflutna, aldrig avslutat). Enda posten som får kallas allvarlig. Finns redan, byggd på `lateSessions`, oförändrad.
2. NY: enhet med avtal och etablering men utan bokning inom kommande 365 dagar: "att boka". Underlag: `rond.tracks` (planning.booked === 0). Respittid: flaggas inte förrän 30 dagar efter etableringen.
3. NY: enhet med avtal men utan återkommande schema och utan sessioner: "saknar rond". Underlag: enheter i omfattningen som inte har något spår.

Delvis kontrollerad rond byggs INTE nu: den befintliga posten "sjunkande täckning tre besök i rad" (rad 607 till 633) täcker det, och en egen post skulle dubbelrapportera.

Schema vars första besök ligger före etableringen är ett uppläggningsfel, inte en leveransavvikelse. Det hör hemma i en admin-notis, inte i kundvyn. Byggs inte i det här steget.

## KPI-rutan Kontrollbesök

Två fält per kategori i `base`: `latestDone` (max av completed_date/completed_at bland utförda) och `nextBooked` (min av framtida scheduled_at/scheduled_start bland ej utförda). Undertexten blir "senast ÅÅÅÅ-MM-DD" och, när det finns, "nästa ÅÅÅÅ-MM-DD". Antalet räknar tolvmånadersfönstret på utfört datum, så framtida bokningar inte blåser upp siffran. Etableringens undantagsregel (rad 347 till 351, senaste etablering visas även utanför fönstret) behålls oförändrad.

## Kodblock i ContractCasesSection.tsx

Tas bort:
- rad 408 till 416: `stepMs`, `expected`, `anchorIso`, `n0`-loopen, hela projektionen
- rad 418 till 454: matchningsloopen `for (const exp of expected)` med `matchedDone`, `bestDiff`, `lateExpected`
- rad 488: `expectedRings`, och rad 885 till 887 som ritar dem
- rad 831 till 841: meningen "N besök är försenade" ur projektionen
- ledlinjen mellan spåren (rad 896 till 898) och `lineColor` (rad 893). Plomben och täckningsbågen i samma gren (rad 891 till 913) BEHÅLLS
- `lateCount` (rad 499) om ingen konsument återstår, död kod annars

Ändras:
- rad 381 till 391: `contractWithFreq`, `visitsPerYear` och `frequencyLabel` ersätts av per-spår-upplösning
- rad 353: `completedSessions` filtreras på `liveSessions`
- rad 816: infotexten beskriver förväntansspåret och skrivs om: "Övre spåret är bokade besök, undre är utförda"
- rad 456 till 474: utförda och bokade byggs per spår ur `track.sessions`
- ny `missed`-loop ersätter `lateExpected`; `driftDays` = dagar sedan scheduled_at
- `RondVisit` (rad 263 till 270): `kind: 'late'` byter namn till `'missed'`, `expectedAt` blir schemalagd tid
- rad 499: `lateCount` = `lateSessions.length`
- rad 816 till 862: löptext och infotext enligt ovan; snittintervall bara när minst tre utförda finns
- tooltip-grenarna rad 968 till 980 skrivs om för missat i stället för förväntat

Behålls på `rond`-objektets TOPPNIVÅ, inte per spår: `x`, `domainStart`, `domainEnd`, `months`, `todayX`. Extraärendenas artrader (rad 1073 till 1134) och `onRondMove` (rad 697) läser dem, och `rond` får inte bli null oftare än i dag (`hasRecurring` rad 377 behålls som den är), annars slocknar artraderna tyst.

`src/hooks/useCustomerRecord.ts`: rad 529 till 532 lägger till `recurring_schedule_id` i selecten; rad 545 till 548 lägger till `.order('schedule_start_date')`; kommentaren på rad 527 om att contract_id alltid är null stämmer inte längre och tas bort.

## Oförändrat

Ärendeflödet, extraärenden och kön, tempo-modulen, stationsdatahooken, pärlbandet och Kräver handling (utöver punkterna ovan).

## Testfall

- FEV (huvudkontor 5004, 4 avtal, start 2026-06-30): noll plomber, noll röda ringar, de bokade besök som finns i `station_inspection_sessions`. Texten "0 av 4 avtalade" och förseningarna 335/243/152/61 är borta. Planeringsraden per spår läser till exempel "Kommande 12 månader: 1 bokad, 3 återstår att boka" för Återvinningscentralen. Kräver handling visar de enheter som saknar bokning framåt som "att boka", inte som försenade.
- Enhetskund med ett schema: ett band, ingen enhetsetikett, samma bild som i dag minus förväntansringarna, etikett BOKAT.
- Kund utan scheman och utan sessioner: ronden renderas inte, resten av fliken oförändrad.
- Kund med sessioner men utan schema: hamnar i fallbackspåret, försvinner inte.
- Kund med en missad bokning: röd ring på BOKAT-spåret, samma rad under Kräver handling.

## Risker

- Fler än sex spår på ett stort huvudkontor: samlat band, verifiera läsbarhet med Stockholms Kommun (7 regioner).
- Sessioner med recurring_schedule_id som pekar på ett raderat schema: fallback på customer_id.
- `hasRecurring` (rad 377) styr om ronden renderas alls: kund med bara framtida bokningar ska visa dem.
