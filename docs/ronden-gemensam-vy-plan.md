# Ronden som en gemensam vy för alla enheter

Plan 2026-09-08. Underlag från tre agenter (UX, CRM, data). UX-agenten fick sista ordet: GODKÄND MED ÄNDRINGAR, inarbetade nedan. IMPLEMENTERAD 2026-09-08, EJ browser-testad. Ändringarna:

1. Radhöjd 26 px, vänsterkolumnen EN textrad: namn (12,5 px) plus mono-metadata "12 st · kvartalsvis" (10,5 px, slate-500) på samma baslinje, ellips och title på kapade namn.
2. Namnkolumn 240 px (180 px minimum på smal skärm), fast gridkolumn.
3. Höger marginal fast 92 px för "nästa ÅÅÅÅ-MM-DD" så spårbredden är identisk på alla rader. "Senast" ligger i vänsterkolumnen, aldrig i spåret.
4. Sök och kollaps båda från 12 enheter.
5. Ingen dynamisk framtidsaxel. Fast fönster 12 månader bakåt plus 6 fram, hela månader. Allt bortom som marginaltext.
6. Sammanfattningsraden: fyra klickbara tal (passerat utan avslut, att boka, saknar rond, avrop); "N i fas" som icke-klickbar text.
7. Hela raden fäller ut (triangel i vänsterkanten); namnet är länk till enheten. Under bandet i utfällningen: de 3 till 5 senaste besöken som lista (datum, tekniker, täckning).
8. Status `due` heter `to_book`. LATENESS_STYLE-etiketterna ("Missat", "Försenat", "Skulle utförts") renderas ALDRIG i svärmen, varken i tooltip eller aria-label. Ordvalet är "passerat utan avslut".
9. Markeringen för passerat utan avslut: 1 px röd linje i 45 % opacitet genom raden, inte fylld.

## Problemet

Ronden ritar i dag ett band per rond (schema på en enhet). FEV med 9 enheter ger 4 band, kunder med 50 enheter skulle ge 50 band. Halvårsenheter ser tomma ut eftersom fönstret slutar två månader fram. Enheter i avtalets omfattning utan schema syns inte alls, eftersom sektionen inte får omfattningsraderna (contract_sites).

## Vyn: en svärm på delad tidsaxel

En gemensam tidsaxel för hela kunden, en tunn rad per enhet.

- **Tidsaxel**: 12 månader bakåt. Framåt: dynamiskt till nästa bokning, minst 3 och högst 12 månader, avrundat till hel månad. Avtalsstart, första etablering och idag som lodräta linjer över hela ytan (inte per rad). Fältet före första etableringen tonat.
- **Rad** (ca 22 px): vänsterkolumn 180 px med enhetsnamn och på rad två stationsantal och rytm i mono ("12 st · kvartalsvis"). Spåret: utfört = fylld grön punkt (halvfylld vid delvis täckning, via befintlig arcPath), bokat = streckad ring, missat = röd punkt plus en lodrät markering genom hela radens höjd. Två besök samma vecka slås ihop till en punkt med antal i tooltip, aldrig jitter i höjdled.
- **Höger marginal**: "nästa ÅÅÅÅ-MM-DD" som text när bokningen ligger utanför fönstret. Vänster marginal: "senast ÅÅÅÅ-MM-DD" om senaste utförda ligger före fönstret.
- **Enheter utan schema**: spåret ersätts av platt text "saknar rond" i slate-500. Avropsenheter (service_mode on_demand i omfattningen): platt text "avrop", aldrig saknar rond.
- **Ton**: missat heter alltid "passerat utan avslut" (kan vara en ej inlämnad rapport), aldrig "missat" mot kund. Inga piller. Statuspunkt plus ord.

## Överst

Sammanfattningsrad med klickbara filter: "N passerat utan avslut · N att boka · N saknar rond · N i fas · N avrop". Klick på en siffra filtrerar raderna, klick igen släpper.

Sortering: passerat utan avslut (äldsta först), förfallna utan bokning (flest dagar sedan senast först), saknar rond, bokade efter datum, avrop, sedan namn (sv). Över 15 enheter kollapsas gruppen "i fas" bakom "visa N till". Sökfält på enhetsnamn (substring) visas från 10 enheter.

## Interaktion

- Hover på rad: raden tänds svagt och en lodrät tidsmarkör visas över alla rader. Hover på punkt: tooltip med datum, tekniker, täckning x av y, för passerade "bokat ÅÅÅÅ-MM-DD, N dagar utan avslut".
- Klick på punkt: öppnar ärendet.
- Klick på enhetsnamn: fäller ut dagens detaljerade band (RondBand) för enheten under raden. Bandet blir detaljvy, inte förstavy.

## Datamodell

```ts
type RondUnitStatus = 'missed' | 'due' | 'unscheduled' | 'booked' | 'on_demand'

interface RondVisit {
  kind: 'done' | 'missed' | 'booked'
  at: number                    // completed_at för done, scheduled_at annars
  session: RecordInspectionSession
  scheduledAt: number | null
  driftDays: number | null
  coverage: { inspected: number; total: number } | null
}

interface RondUnitRow {
  unitId: string
  unitName: string
  status: RondUnitStatus
  urgency: number               // 0 missed, 1 due, 2 unscheduled, 3 booked, 4 on_demand
  source: 'site' | 'schedule' | 'contract' | 'orphan'
  serviceMode: 'inspection' | 'on_demand'
  rhythm: { visitsPerYear: number | null; label: string | null }
  stations: number | null
  startsAt: number | null
  establishedAt: number | null
  lastDone: { at: number; session: RecordInspectionSession } | null
  nextBooked: { at: number; session: RecordInspectionSession; beyondWindow: boolean } | null
  missed: number
  missedOldestAt: number | null
  daysSinceDone: number | null
  planning: { booked: number; remaining: number } | null
  visits: RondVisit[]           // bara inom fönstret
}

interface RondSummary { units, missed, due, unscheduled, booked, onDemand, visitsDone12m, bookedNext12m, remainingToBook, nextBookedAt, oldestMissedAt }
interface RondModel { rows: RondUnitRow[]; summary: RondSummary; geometry: RondGeometry }
```

En rad per enhet nycklad på unitId i en Map. Prioritet för serviceMode och rytm: contract_sites (aktiv rad: active_to null eller framtida) → recurring_schedules på enheten → avtal som täcker allt eller ligger på enheten → sessioner utan schema (orphan). Enheter utan någon av dessa får ingen rad. Root får en rad bara om root har egna sessioner eller schema.

Statusregel:
- missed om minst en session uppfyller sessionLateness (enda predikatet)
- due om inspection, uttalad visitsPerYear från omfattning eller schema, ingen bokning framåt, och (ingen utförd och startsAt + 30 dagar < nu) eller (senast utförd äldre än 1,25 × 365/visitsPerYear dagar)
- booked om nästa bokning finns
- unscheduled om inspection utan rytm och utan bokning
- on_demand om service_mode on_demand (en passerad bokning ger ändå missed)

Aldrig due på gissad rytm.

## Kod

- `useCustomerRecord.ts`: contract_sites laddas redan (rad ca 490); skicka vidare till sektionen. Sessioner: ingen begränsning nu (volymen är liten).
- `ContractCasesSection.tsx`: `rond` returnerar RondModel. RondTrack, bands, single, unitsWithoutTrack utgår. `x` tas bort från RondVisit (geometry mappar). RondBand behålls som detaljvy, tar en rad. Ny `RondSwarm` (rader, summering, filter, sök, kollaps) och `RondRow` (React.memo, egen hover). Kräver handling läser rows: missed finns redan via lateSessions; "att boka" = due; "saknar rond" = unscheduled.
- CustomerRecordContent (eller där sektionen monteras): prop contractSites.

## Testfall

- FEV: 9 rader (root utan rad). Återvinningscentralen bokad, KVV/Enviken/Huvudkontor med "nästa 2027-..." i marginalen, Boda/Främby/Linghed/Vika saknar rond, Sågmyra saknar rond (etablering ej avslutad). Inga röda.
- Stockholms Kommun (7 regioner): rader per region, avrop där omfattningen säger det.
- Enhetskund med ett schema: en rad, klick fäller ut bandet.
- Kund utan scheman och sessioner: sektionen visas inte.

## Risker

- Omfattning och scheman säger olika för samma enhet: Map på unitId med prioritetsordningen ovan, verifiera FEV och WBAB.
- Punktkollisioner på månadsrytm: slå ihop inom 7 dagar.
- Två skalor på en axel undviks: en linjär axel, framtiden förlängs i stället.
