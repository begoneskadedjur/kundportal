# Avtalsåret på exakt avtalsdag: teknisk byggplan

Begone Skadedjur, kundportalen. Plan skriven 2026-10-30 mot main `f19104e1` (3.109.0). Inget är byggt. Datadelen (vilka avtal, vilka fakturor, vilka stationer) står i `docs/planer/avtalsar-exakt-arsdag-data.md`, som en annan genomgång tar fram.

Radnummer nedan är kontrollerade mot main samma dag. Den som bygger kontrollerar dem igen innan varje steg, main rör sig.

## 1. Utgångsläget i siffror (SELECT mot prod 2026-10-30)

| Mått | Värde |
|---|---|
| Levande avtal (`contracts.type='contract'`, status signed/active) | 136, varav 120 med premie |
| Levande avtal där startdagen inte är den 1:a | 76 |
| Levande avtal med start 29 feb | 0 |
| Frekvens på levande avtal | annual 99, NULL 25, monthly 9, on_demand 2, semi_annual 1 |
| Levande avtal med frekvens och slutdatum minst ett år fram (hoppas över av cronen i dag) | 51 |
| Kundrader per `billing_frequency` | monthly 182, annual 117, on_demand 10, semi_annual 1 (kolumnens default är `'monthly'`) |
| `customers.adhoc_invoice_grouping` | per_case 310, monthly_batch 0 |
| Redigerbara avtalsfakturor (draft/pending_approval/ready) | 173 |
| Tilläggsstationer `is_addon` | 84 ute, 16 inne; 25 obeslutade (ingen `addon_contract_id`) på 4 kunder |
| Pro rata-rader på ärenden, status pending | 1 |
| Enheter (`parent_customer_id` satt) med egen `billing_reference` | 58 |
| Avtal markerade Kontrollerat (3.107.0) | 24 |

Överlappande avtalsfakturor av samma typ och på samma avtal (`invoice_type='contract'`, inte makulerade): åtta par mellan portalfakturor (INV mot INV): Elsa Jansson, Erika Eriksson, Gubbo 7:10, Heimstaden Brynäs, Heimstaden Maria 5, HSB Brf Tyskland i Gävle, Rikard Olsen, Torleif Edwin Roos. Alla åtta har samma mönster: en betald faktura som följer avtalsdagen (till exempel 2025-11-25 t.o.m. 2026-11-24) och ett utkast i pending_approval som följer den 1:a (2026-11-01 t.o.m. 2027-10-31). Överlappet är 4 till 24 dagar. Dessutom finns par där en sida är en Fortnox-import (F-): Lappens Grill, Brinkbacken, Tallen, Kaj-Peter Enström (tre F- på samma period) och Solveco (en dag). Ingen av de åtta har ett överlapp på 50 % eller mer av någon av perioderna.

## 2. Hur det fungerar i dag (verifierat i kod och databas)

**Perioder.** `src/shared/contractPlanner.ts` `iterPeriodsPure` (rad 344 till 398) börjar alltid perioden den 1:a: månad, kvartal och halvår från startmånadens första dag, år från ankarmånaden (`billing_anchor_month`) den 1:a. `computePlannedPeriods` (rad 423 till 545) filtrerar med `midpointBefore` (rad 328) mot bindningsfönstret. `computePlannedMonthlyEquipmentPeriods` (rad 578 till 667) ger kalendermånader från innevarande månad. SQL-tvillingarna `contract_next_period_start(uuid, date)` och `contract_next_period_start(text, smallint, date, date)` räknar också från den 1:a, liksom `contract_next_unplanned_period(uuid, date)` och `contract_customer_view` (fältet `next_invoice`).

**Matchning mot befintliga fakturor.** Per månad. `src/services/contractInvoiceGenerator.ts` `monthKey` rad 317, `buildDiff` rad 924 till 1093 (keep eller update jämför bara belopp, rad 1026; dubblettlistan, rad 1074 till 1086, också per månad), `loadConsolidatedPeriodsForContract` rad 887 till 895. Samlingsgruppen nyckel `freq|anchor_month` rad 588. Cronen `api/cron/generate-continuing-contracts.ts`: `periodKey` rad 293 till 296, samlingsnyckeln rad 485, `refreshEditableEquipmentInvoices` kräver exakt samma `periodStart` rad 595. Signeringen `api/_lib/contractSigning.ts`: `covered.add(start.slice(0, 7))` rad 1004 och uppslaget rad 1036. Fortnox-importer (F-, is_historical) matchas redan på överlapp med minst halva perioden (generatorn rad 943 till 958, signeringen rad 1007 till 1014, cronen `coveredByFortnox` rad 352 bara på överlapp).

**Databasskydd.** Unika index `invoices_contract_period_key (contract_id, billing_period_start, contract_invoice_kind)` och `invoices_consolidated_period_key (customer_id, billing_period_start, contract_invoice_kind)`, båda partiella (contract, inte adjustment, inte cancelled, inte F-). De stoppar bara exakt samma startdag. Det finns ingen trigger på `invoices` som tittar på perioder; BEFORE INSERT-triggern i dag är `trg_invoices_assign_free_number`.

**Cronens urval.** Rad 696 till 705: `.not('billing_frequency', 'is', null)` och `.or('contract_end_date.is.null,contract_end_date.lt.<idag+1 år>')`. 51 levande avtal med frekvens faller bort på slutdatumet, 25 på frekvens NULL. Cronen skapar bara, uppdaterar aldrig, utom `refreshEditableEquipmentInvoices` som byter utrustningsrader på redigerbara fakturor.

**Signering.** `src/shared/contractSigning.ts` `deriveMapSetup` rad 331 till 345 sätter `billing_anchor_month` = startmånaden. Kundraden som skapas vid signering (`api/_lib/contractSigning.ts` rad 701 till 702) saknar `billing_frequency` och får därmed kolumnens default `'monthly'`.

**Tillägg.** `equipment_placements` och `indoor_stations` saknar koppling till ärende. `sync_addon_prorata_line(p_customer_id, p_annual_price, p_technician_id, p_technician_name, p_case_id)` (SECURITY DEFINER) väljer det senaste öppna etableringsärendet när `p_case_id` saknas, räknar ALLA kundens aktiva tilläggsstationer placerade efter ärendets `created_at`, och tar med obeslutade stationer eftersom villkoret är `coalesce(addon_contract_mode, 'separate') = 'separate'`. Slutdagen är `contract_next_period_start(kontrakt, idag)`. Ingen kapning vid avtalsslut (raderna makuleras bara i efterhand av `addon_cancel_lines_for_ended_contract` via triggern `contract_end_addon_lines`). Anropas från `AddonStationBillingService.syncAfterStationChange` (`src/services/addonStationBillingService.ts` rad 349 till 361) och direkt från `useEtableringsflode.ts` rad 638, `TechnicianEquipment.tsx` rad 740, `StationInspectionModule.tsx` rad 348, `StationInspectionPanel.tsx` rad 458. Utsättningsflöden som anropar `syncAfterStationChange`: `useEtableringsflode.ts` rad 300 och 405, `TechnicianEquipment.tsx` rad 447 och 553, `IndoorEquipmentView.tsx` rad 190, `AddStationWizard.tsx` rad 396, `CustomerStationsModal.tsx` rad 1166, `StationArk.tsx` rad 152, `NyKundStationer.tsx` rad 388. Etableringsavslutet letar ärende på samma sätt (`useEtableringsflode.ts` rad 577 till 585).

**Betalt till och med.** `addon_station_paid_through(p_station_id, p_indoor)` finns som SQL-funktion men läser bara pro rata-rader och låsta tilläggsfakturor, inte manuella Fortnox-fakturor och inte efterskänkta debiteringar. Den används bara av varningen vid borttag i UI.

**Märkning.** Tilläggsfakturor märks per avtal: `contracts.invoice_reference ?? customers.billing_reference` (generatorn rad 465, 482, 619; cronen rad 547). Radtexten (`src/shared/contractInvoiceRows.ts` rad 76) saknar enhetens namn. Unikt index tillåter en tilläggsfaktura per avtal, period och typ.

**Makulerade pro rata-fakturor (WBAB YX201).** Tio adhoc-fakturor i september 2026, status cancelled, men pro rata-raderna på ärendet står kvar som `billed`. `handle_invoice_cancelled` rör bara provisioner. Det är av en slump som de inte faktureras igen i dag: `sync_addon_prorata_line` räknar billed-rader som redan fakturerade.

**Frekvens.** `customers.billing_frequency` har default `'monthly'`. Kod som förstärker det: `CreateCustomerManuallyModal.tsx` rad 74 (startvärde) och 209 (insert), `BillingSettingsModal.tsx` rad 165 (startvärde) och 490 (skrivs till kundraden), `caseCustomerService.ts` rad 103 till 110 (insert utan fältet, DB-default slår till), signeringens kundinsert (ovan). `contractScopeService.ts` rad 387 låter materialiseringen ärva kundradens värde. Ärendefakturering styrs redan av `customers.adhoc_invoice_grouping` (per_case eller monthly_batch, `contractBillingService.ts` rad 530 till 533) men syns bara i `BillingSettingsModal`.

**Visning som förutsätter den 1:a.** `ContractPremiumSection.tsx` `nextInvoicePeriodStart` rad 56 till 97 (nyckeln `-01` rad 84) och rad 176; `src/shared/contractReview.ts` rad 344 till 350 ("Fakturaperioden följer avtalsåret, juli till juni"); `CustomerContractPaper.tsx` rad 177; `contractCompleteness.ts` rad 110 (ankarmånaden krävs); `ImportCustomerByOrgnrModal.tsx` rad 149 och `ImportCustomerByPdfModal.tsx` rad 170 (`getNextBillingDates`); `contractAdditionService.ts` rad 136 till 146 (syntetiserar nästa periodstart den 1:a).

## 3. Principer för hela bygget

1. Allt nytt är additivt. Nya kolumner är NULL och NULL betyder dagens beteende, exakt. Ett avtal byter beteende först när någon med Christians ja skriver något i dess nya fält.
2. Två växlar per avtal: `contracts.billing_anchor_mode` (exakt avtalsdag) och `contracts.addon_rules` (nya tilläggsregler). De är oberoende. Inget annat styr.
3. Samma periodmatematik överallt: en ren TS-modul och en SQL-tvilling som testas mot varandra.
4. Matchning sker på datumöverlapp. För avtal i gamla läget finns en månadsreserv som gör att resultatet blir identiskt med i dag (bevisas med regressionsskriptet).
5. Databasen stoppar dubbel debitering: överlappsvakt på fakturor och överlappsvakt på stationstäckning.
6. Ingenting debiteras igen automatiskt när en faktura makuleras. Släppt täckning kräver ett aktivt val.
7. Datum är `date` eller lokala `ÅÅÅÅ-MM-DD`-strängar. I SQL: `(now() at time zone 'Europe/Stockholm')::date`, aldrig `current_date` i nya funktioner. I TS: `toLocalIsoDate`, `parseLocalDate`, aldrig rå `toISOString()` för datum. Tidpunkter med offset via `toLocalISOStringWithOffset`.
8. Varje steg som rör prod-databasen kräver Christians ja för just det steget. Migrationer skrivs utan `drop` (MCP nekar). Där en riktig drop behövs står det uttryckligen att Christian kör raden i SQL-editorn.

## 4. Regeln för perioder (avgörande, gäller TS och SQL)

Exakt läge (`billing_anchor_mode = 'start_day'`):

```
S = contract_start_date
steg = 1 (monthly), 3 (quarterly), 6 (semi_annual), 12 (annual)
periodstart(k) = addMonthsClamped(S, k * steg)
periodslut(k)  = addMonthsClamped(S, (k + 1) * steg) - 1 dag
addMonthsClamped(S, n): år/månad flyttas n månader, dagen = min(S.dag, sista dagen i målmånaden)
```

Räkna alltid från S, aldrig från föregående periodstart, så att dagen inte glider (31 jan, 28 feb, 31 mar, 30 apr). 29 feb blir 28 feb icke-skottår och 29 feb skottår. `billing_anchor_month` läses inte i exakt läge. Första perioden är k = 0 och börjar på S. Bindningsfönstret och `midpointBefore` används oförändrat; i exakt läge sammanfaller periodslut med `contract_end_date` när avtalstiden är hela år, så ingen period hamnar på fel sida.

TS (ny fil `src/shared/contractPeriods.ts`, importeras av planeraren):

```ts
export function addMonthsClampedIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return toLocalIsoDate(new Date(target.getFullYear(), target.getMonth(), Math.min(d, last)))
}

export function exactPeriods(startIso: string, endExclusive: Date, endInclusive: Date, step: number, requireFull: boolean) {
  const out: Array<{ periodStart: Date; periodEnd: Date }> = []
  for (let k = 0; k < 1200; k++) {
    const ps = parseLocalDate(addMonthsClampedIso(startIso, k * step))
    if (ps >= endExclusive) break
    const pe = addDays(parseLocalDate(addMonthsClampedIso(startIso, (k + 1) * step)), -1)
    if (requireFull && step >= 6 && pe > endInclusive) break
    out.push({ periodStart: ps, periodEnd: pe })
  }
  return out
}
```

`requireFull` motsvarar dagens regel att halvår och år måste rymmas inom avtalet (dagens kod tittar elva respektive fem månader fram från periodstart). I exakt läge är regeln enklare: periodens sista dag får inte ligga efter avtalets slutdatum (`endInclusive` = `contract_end_date`, eller uppsägningens sista dag). Bindningsläget anropar med `requireFull = false` och filtrerar på mittpunkten som i dag.

SQL (Postgres klämmer redan `date + interval 'n month'` till månadens sista dag, vilket är precis regeln):

```sql
create or replace function public.contract_period_on(p_contract_id uuid, p_day date)
returns table(period_start date, period_end date)
language plpgsql stable security definer set search_path = public as $$
declare c record; v_step int; v_k int;
begin
  select contract_start_date, billing_frequency, billing_anchor_mode into c
  from contracts where id = p_contract_id;
  if c.billing_anchor_mode is distinct from 'start_day' or c.contract_start_date is null then
    return; -- gamla läget: anroparen använder dagens funktioner
  end if;
  v_step := case coalesce(c.billing_frequency, 'annual')
              when 'monthly' then 1 when 'quarterly' then 3 when 'semi_annual' then 6 else 12 end;
  v_k := greatest(floor(((extract(year from p_day) - extract(year from c.contract_start_date)) * 12
                  + extract(month from p_day) - extract(month from c.contract_start_date)) / v_step)::int - 1, 0);
  loop
    period_start := (c.contract_start_date + make_interval(months => v_k * v_step))::date;
    period_end   := (c.contract_start_date + make_interval(months => (v_k + 1) * v_step))::date - 1;
    exit when period_end >= p_day;
    v_k := v_k + 1;
  end loop;
  return next;
end $$;
```

`billing_frequency` NULL eller `on_demand` i exakt läge betyder årsperioder. Det behövs för kund utan premie där tilläggen går årsvis på avtalets årsdag.

## 5. Matchningsregeln (avgörande)

Ny ren modul `src/shared/contractInvoiceMatch.ts`, används av generatorn, cronen, signeringen och regressionsskriptet:

```ts
export type MatchMode = 'legacy' | 'overlap'
export function overlapShare(a: Range, b: Range): number // dagar i snittet / dagar i a, inklusive båda ändar
export function matchPeriods(planned: Range[], existing: Range[], mode: MatchMode): Map<plannedIdx, existingIdx>
```

1. Bygg alla par (planerad P, befintlig E) med `overlapShare(P, E) >= 0.5`.
2. Sortera paren på andel fallande, sedan på `|P.start - E.start|` stigande, sedan på E.id. Ta paren girigt, varje P och E högst en gång.
3. Bara `mode = 'legacy'`: P och E som fortfarande är omatchade och har samma `ÅÅÅÅ-MM` på periodstart paras ihop (dagens `monthKey`). Det täcker de gamla fallen där en importerad faktura börjar den 20:e och planen den 1:a i en månadsperiod.
4. `mode` är `'overlap'` när avtalet har `billing_anchor_mode = 'start_day'`, annars `'legacy'`.
5. Befintliga utan par behandlas som i dag ("Befintliga utan motsvarande plan"): låsta blir `locked`, redigerbara `delete`. Status `overdue` räknas som låst (i dag faller den i grenen "Okänd status", rad 1059 till 1061; samma utfall, bara tydligare).

Bevis för att legacy-läget inte ändrar något: regressionsskriptet kör både gamla `monthKey`-matchningen och `matchPeriods(..., 'legacy')` på alla levande avtal och kräver samma par. Där det skiljer stoppas steget och fallen listas för Christian.

Övergången till exakt dag följer av regeln utan specialkod. Exempel Heimstaden Brynäs, start 2025-11-25: P0 2025-11-25 t.o.m. 2026-11-24 paras med den betalda fakturan (andel 1,0, `locked`). P1 2026-11-25 t.o.m. 2027-11-24 paras med utkastet 2026-11-01 t.o.m. 2027-10-31 (andel 0,93) och blir `update` med nya datum. Exempel FEV, låst 2026-07-01 t.o.m. 2027-06-30 och start 2026-06-30: P1 2026-06-30 t.o.m. 2027-06-29 paras med den låsta (0,997), P2 2027-06-30 t.o.m. 2028-06-29 överlappar den låsta en dag och skapas som vanlig årsfaktura. Ingen småfaktura för mellandagar, varken vid glapp eller överlapp.

`keep` mot `update` jämför i dag bara belopp (rad 1026). Nytt: också `billing_period_start` och `billing_period_end`. Ändrade datum på ett redigerbart utkast ger `update`. För legacy-avtal är datumen alltid lika när paret kommer från steg 1 eller 3 och planen inte ändrats, så det ger ingen skillnad (bevisas av regressionsskriptet: antal `update` före och efter).

## 6. Täckningsmodellen för stationer (avgörande)

Ny tabell, en rad per sammanhängande täckt period och station:

```sql
create table if not exists public.addon_station_coverage (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null,
  station_kind text not null check (station_kind in ('outdoor', 'indoor')),
  unit_customer_id uuid not null references public.customers(id),
  contract_id uuid references public.contracts(id),
  covered_from date not null,
  covered_to date not null,
  source text not null check (source in ('invoice', 'prorata', 'gap_invoice', 'fortnox_manual', 'waived', 'backfill')),
  invoice_id uuid references public.invoices(id) on delete set null,
  invoice_item_id uuid references public.invoice_items(id) on delete set null,
  case_billing_item_id uuid references public.case_billing_items(id) on delete set null,
  fortnox_document_number text,
  invoice_cancelled_at timestamptz,
  note text,
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id),
  release_reason text,
  constraint asc_dates check (covered_to >= covered_from),
  constraint asc_manual_has_ref check (source <> 'fortnox_manual' or fortnox_document_number is not null),
  constraint asc_waived_has_note check (source <> 'waived' or nullif(trim(note), '') is not null)
);
create index if not exists asc_station_idx on public.addon_station_coverage (station_id, station_kind) where released_at is null;
create index if not exists asc_invoice_idx on public.addon_station_coverage (invoice_id);
alter table public.addon_station_coverage enable row level security;
create policy asc_select_internal on public.addon_station_coverage for select using (public.intranet_is_internal());
```

Inga insert/update-policyer: all skrivning går via SECURITY DEFINER-funktioner och triggers.

Regler:

- En rad med `released_at is null` täcker sina dagar, vad källan än är. `waived` = efterskänkt eller avstått: dagarna täcks utan debitering.
- Vakt (BEFORE INSERT eller UPDATE, `trg_asc_no_overlap`): två aktiva rader för samma station får inte överlappa en enda dag. Undantag saknas; överlapp betyder dubbel debitering eller dubbel registrering och ska stoppas.
- Makulerad faktura släpper INTE täckningen. Triggern `trg_invoice_cancelled_coverage` (AFTER UPDATE på invoices när status blir cancelled) sätter bara `invoice_cancelled_at = now()` på fakturans rader. Arbetslistan visar dem ("Faktura X makulerad, välj Fakturera igen eller Efterskänk"). Fakturera igen = `addon_coverage_release` (sätter `released_at`), då blir dagarna ett glapp som nästa planering fakturerar. Efterskänk = `addon_coverage_waive` som släpper raden och skriver en `waived`-rad över samma dagar i samma transaktion.
- Täckning skrivs:
  - `invoice`: AFTER UPDATE på invoices när status går till booked, sent, overdue eller paid och `contract_invoice_kind in ('equipment', 'equipment_monthly', 'equipment_gap')`, eller premie med tilläggsrader (`line_kind in ('equipment_annual', 'equipment_monthly')`): en rad per station i `invoice_items.station_ids`, från `max(billing_period_start, stationens addon_effective_from)` till `billing_period_end`. Rader utan `station_ids` hoppas över och listas i arbetslistan (gamla fakturor, hanteras i datasteg 16).
  - `prorata`: AFTER UPDATE på case_billing_items när en rad med `is_addon_prorata_line` går till `billed`: en rad per station i radens nya kolumn `station_ids uuid[]` (läggs till i steg 5), från stationens startdag till `billing_start_date - 1`.
  - `fortnox_manual` och `waived`: bara via RPC (se steg 8), kräver `can_approve_invoices`.
- Glappfunktionen:

```sql
create or replace function public.addon_station_gaps(p_station_id uuid, p_kind text, p_from date, p_to date)
returns table(gap_from date, gap_to date)
language sql stable security definer set search_path = public as $$
  with recursive cov as (
    select covered_from, covered_to from addon_station_coverage
    where station_id = p_station_id and station_kind = p_kind and released_at is null
      and covered_to >= p_from and covered_from <= p_to
  ), days as (
    select d::date as day from generate_series(p_from, p_to, interval '1 day') d
    where not exists (select 1 from cov where d::date between cov.covered_from and cov.covered_to)
  ), grp as (
    select day, day - (row_number() over (order by day))::int as g from days
  )
  select min(day), max(day) from grp group by g order by 1
$$;
```

`addon_station_paid_through` byggs om att läsa täckningen först (`max(covered_to)` för sammanhängande täckning från idag) och falla tillbaka på dagens logik när stationen saknar täckningsrader. Svaret får nya fält `source` (`waived` visas som "Efterskänkt t.o.m."), `reference`, `cancelled_unresolved boolean`.

## 7. Stegen

Varje steg: syfte, ändringar, vad som inte får röras, bevis, godkännande och backning, changelog, omfattning. Kodsteg pushas till main efter gröna kontroller (`node scripts/type-check.mjs`, `npx vitest run`, eslint på rörda filer). Databasändringar körs först efter Christians ja.

### Steg 1. Regressionsskript och baslinje

**Syfte.** Ett bevis som körs före och efter varje följande steg: planerade perioder och matchning för alla levande avtal, byte för byte.

**Ändras.**
- Ny fil `scripts/regression/plan-dump.mts`. Läser med service role (bara SELECT): levande avtal (`status in ('signed','active')`, `type='contract'`, samma urval som generatorn plus synth-kunder), premietrappan, § 4/§ 6-rader (`case_billing_items` där `case_id = contract.id`), `contract_addon_ledger`, befintliga fakturor per typ. Kör `computePlannedPeriods`, `computePlannedEquipmentPeriods`, `computePlannedMonthlyEquipmentPeriods` med `window: 'binding'` och `--today=ÅÅÅÅ-MM-DD` (fast datum), sedan matchningen. Skriver `scripts/regression/out/plan-<today>-<git sha>.json`: sorterat per contract_id, kind, periodStart; alla fält i `PlannedPeriod` plus matchat fakturaid och action. Skriver också en sha256 över filen. Skriptet anropar INTE `sync_addon_period_lines` (det skriver); det läser raderna som de är.
- Ny fil `scripts/regression/sql-dump.sql`: för alla levande avtal och sju fasta datum (2026-10-30, 2026-12-31, 2027-01-01, 2027-02-28, 2027-06-30, 2027-07-01, 2028-02-29) värdet av `contract_next_period_start(id, d)`, `contract_next_unplanned_period(id, d)`, `contract_customer_view(id)->>'next_invoice'`. Körs som ren SELECT.
- `scripts/regression/compare.mjs`: jämför två dumpar, skriver skillnader per avtal.

**Får inte ändras.** Ingen kod i `src/` eller `api/`. Skriptet skriver aldrig till databasen (ingen `rpc` som skriver, inga insert/update).

**Bevis.** Två körningar på samma sha och samma `--today` ger samma hash. Antalet avtal i dumpen = levande avtal (136) plus synth-kunder.

**Godkännande.** Christian säger ja till att skriptet får läsa prod med service role lokalt. Backning: radera mappen.

**Changelog.** Ingen (internt verktyg).

**Omfattning.** En halv dag.

**Körd 2026-10-30** (commit `b02be706`): baslinje `plan-2026-10-30-f19104e1.json`, sha256 `9565552e283102e2110f93cb24da77df855886f0176cba553545419d74d5c274` (två körningar, samma hash; körning på `b02be706` ger samma innehåll enligt compare.mjs), 136 avtal (cronen väljer 57: 25 utan frekvens, 51 med slutdatum minst ett år fram, 3 med pausad fakturering), 19 synth, 335 rader. SQL-dumpen: 952 rader (136 × 7), md5 `46f0fd14be57eb3af52c04790ab75b1d`, samma md5 via SQL-editorn. `contract_customer_view` kräver auth-kontext och ersätts av samma uttryck i SQL (next_invoice_replik).

### Steg 2. Matchningen utbruten, oförändrat beteende

**Syfte.** En enda matchning i en ren modul, så att steg 7 ändrar på ett ställe. Ren refaktor.

**Ändras.**
- Ny `src/shared/contractInvoiceMatch.ts` med `monthKey`, `overlapShare` (flyttad från generatorn rad 947 till 954 och signeringen rad 1007 till 1014), `fortnoxCovers(p, ranges)`, och `buildContractDiff(planned, existing, opts)` som är `buildDiff` (generatorn rad 924 till 1093) flyttad ordagrant, med `LOCKED_STATUSES`/`EDITABLE_STATUSES` som parametrar eller exporterade konstanter. Ingen supabase-import.
- `contractInvoiceGenerator.ts`: `buildDiff` blir ett tunt anrop till `buildContractDiff`. `loadConsolidatedPeriodsForContract` använder modulens `monthKey`.
- `api/cron/generate-continuing-contracts.ts`: `periodKey` (rad 293 till 296) och `coveredByFortnox` (rad 352 till 354) importeras från modulen.
- `api/_lib/contractSigning.ts`: lokala `overlapShare` och månadsnyckeln (rad 1004, 1007 till 1014, 1036) ersätts med modulens.
- `tsconfig.node.json`: lägg `src/shared/contractInvoiceMatch.ts` i allow-listan om den inte redan nås via import (den nås via cronen; kontrollera att API-projektet förblir 0 fel).

**Får inte ändras.** Ingen logik. `F-%`/`is_historical`-överlappslogiken (fallgrop i faktureringsskillen) flyttas ordagrant.

**Bevis.**
- Vitest `src/shared/contractInvoiceMatch.test.ts`: de befintliga fallen ur generatorns beteende (Drottningens Pizzeria: F- 2026-02-16 t.o.m. 2027-02-15 täcker inte plan 2027-02-01 t.o.m. 2028-01-31; HSB Kullen-dubbletter ger `duplicateIds`; utkast efter planens sista period får förlängningstexten).
- Regressionsskriptet: hash identisk före och efter.

**Godkännande.** Ja till push (ingen databasändring). Backning: `git revert`.

**Changelog.** Ingen.

**Omfattning.** En dag.

**Körd 2026-10-30** (commit `f5640a6e`, pushad): ny `src/shared/contractInvoiceMatch.ts` + test (13 fall), generatorn, cronen, signeringen och `plan-dump.mts` använder modulen, `tsconfig.node.json` utökad. Inga migrationer. Regression: plandumpen byte för byte identisk med steg 1-körningen på `b02be706` (samma sha256 `64d8bd80…`), `compare.mjs` mot baslinjen f19104e1: inga skillnader (plan och SQL), ny dump `out/plan-2026-10-30-f5640a6e.json`. Avvikelse: cronens `coveredByFortnox` (varje överlapp, per typ) skiljer sig från generatorns och signeringens regel (minst halva perioden), så modulen har två funktioner, `coveredByFortnox` och `fortnoxCovers`, i stället för en; beteendet är oförändrat. `overlapShare` behåller dagens formel (utan +1 dag i ändarna), inte "inklusive båda ändar" som avsnitt 5 beskriver; det hör till steg 7.

### Steg 3. Överlappsvakt i databasen

**Syfte.** Stoppa nya överlappande premie- och tilläggsfakturor oavsett vilken kod som skapar dem, utan att röra de åtta befintliga paren.

**Ändras (migration `20261102_invoice_period_overlap_guard.sql`).**

```sql
create or replace function public.guard_contract_invoice_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_new_end date := coalesce(new.billing_period_end, new.billing_period_start);
  v_overlap int;
  v_share numeric;
begin
  if new.invoice_type is distinct from 'contract'
     or new.status = 'cancelled'
     or coalesce(new.is_historical, false)
     or coalesce(new.invoice_number, '') like 'F-%'
     or new.billing_period_start is null
     or coalesce(new.contract_invoice_kind, 'premium') not in ('premium', 'equipment', 'equipment_monthly') then
    return new;
  end if;
  if coalesce(current_setting('app.allow_period_overlap', true), '') = 'on' then
    return new;
  end if;
  for r in
    select i.id, i.invoice_number, i.status, i.billing_period_start as s,
           coalesce(i.billing_period_end, i.billing_period_start) as e
    from invoices i
    where i.id <> new.id
      and i.invoice_type = 'contract'
      and i.status <> 'cancelled'
      and coalesce(i.contract_invoice_kind, 'premium') = coalesce(new.contract_invoice_kind, 'premium')
      and (
        (new.contract_id is not null and i.contract_id = new.contract_id and not coalesce(i.is_consolidated, false))
        or (coalesce(new.is_consolidated, false) and coalesce(i.is_consolidated, false) and i.customer_id = new.customer_id)
      )
      and i.billing_period_start <= v_new_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= new.billing_period_start
  loop
    v_overlap := least(r.e, v_new_end) - greatest(r.s, new.billing_period_start) + 1;
    v_share := v_overlap::numeric / greatest(least(r.e - r.s + 1, v_new_end - new.billing_period_start + 1), 1);
    if v_share >= 0.5 then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s finns redan på faktura %s (%s t.o.m. %s)',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;
    if r.status not in ('booked', 'sent', 'overdue', 'paid') and coalesce(r.invoice_number, '') not like 'F-%' then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s överlappar utkastet %s (%s t.o.m. %s). Ändra utkastet i stället.',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;
  end loop;
  return new;
end $$;

create or replace trigger trg_invoices_period_overlap_guard
  before insert or update of billing_period_start, billing_period_end, contract_invoice_kind, contract_id, is_consolidated, status
  on public.invoices for each row execute function public.guard_contract_invoice_overlap();

create or replace view public.contract_invoice_overlaps as
  select a.id as invoice_a, a.invoice_number as number_a, a.status as status_a,
         b.id as invoice_b, b.invoice_number as number_b, b.status as status_b,
         a.customer_id, a.contract_id, coalesce(a.contract_invoice_kind, 'premium') as kind,
         greatest(a.billing_period_start, b.billing_period_start) as overlap_from,
         least(coalesce(a.billing_period_end, a.billing_period_start), coalesce(b.billing_period_end, b.billing_period_start)) as overlap_to
  from invoices a join invoices b on a.id < b.id
   and a.invoice_type = 'contract' and b.invoice_type = 'contract'
   and a.status <> 'cancelled' and b.status <> 'cancelled'
   and coalesce(a.contract_invoice_kind, 'premium') = coalesce(b.contract_invoice_kind, 'premium')
   and coalesce(a.contract_invoice_kind, 'premium') <> 'adjustment'
   and a.customer_id = b.customer_id
   and a.contract_id is not distinct from b.contract_id
   and coalesce(a.is_consolidated, false) = coalesce(b.is_consolidated, false)
   and a.billing_period_start <= coalesce(b.billing_period_end, b.billing_period_start)
   and b.billing_period_start <= coalesce(a.billing_period_end, a.billing_period_start);
revoke all on public.contract_invoice_overlaps from anon, authenticated;
```

Regeln: överlapp på minst halva den kortare perioden stoppas alltid (riktig dubblett). Mindre överlapp tillåts bara mot en låst faktura eller en Fortnox-import (övergången mellan gammal och ny avtalsdag). Triggern kör bara vid insert och när periodkolumnerna, typen, avtalet, samlingsflaggan eller statusen ändras, så de åtta paren (utkast mot betald, 4 till 24 dagar) påverkas inte. Statusbyte på utkasten (pending_approval till ready) passerar eftersom motparten är låst. `app.allow_period_overlap` är en nödventil som bara kan sättas i en egen transaktion i SQL-editorn.

**Får inte ändras.** De unika indexen ligger kvar. Inga befintliga rader uppdateras. Adhoc-fakturor (pro rata på ärenden) omfattas inte; de skyddas av täckningsvakten i steg 8.

**Bevis (BEGIN … ROLLBACK i SQL-editorn, efter migrationen).**
1. Insert av en kopia av Brynäs-utkastet med samma datum: fel 23P01 ("finns redan").
2. Insert av premiefaktura på FEV:s avtal 2026-06-30 t.o.m. 2027-06-29 när 2026-07-01 t.o.m. 2027-06-30 finns: fel (andel 0,997).
3. Insert 2027-06-30 t.o.m. 2028-06-29 när den låsta 2026-07-01 t.o.m. 2027-06-30 finns: går igenom (en dag mot låst).
4. Samma som 3 men motparten är ett utkast: fel ("överlappar utkastet").
5. `update invoices set status = 'ready' where invoice_number = 'INV-202610-0004'` (Brynäs): går igenom.
6. `select count(*) from contract_invoice_overlaps where number_a not like 'F-%' and number_b not like 'F-%'` = 8.
7. Generatorn mot en testkund (Demo AB): Planera fakturor två gånger i rad ger ingen ny faktura och inget fel.

**Godkännande.** Christian säger ja till migrationen. Backning: Christian kör `drop trigger trg_invoices_period_overlap_guard on public.invoices;` i SQL-editorn (MCP nekar drop). Vyn kan stå kvar.

**Changelog.** `{ kind: 'andring', text: 'Systemet stoppar nu en avtalsfaktura som skulle täcka samma period som en annan. Felet visas med vilken faktura som redan finns.' }` Version 3.110.0.

**Omfattning.** En halv dag.

**Körd 2026-10-30** (commit `000d9f43`, pushad, 3.110.0): migration `supabase/migrations/20261030_invoice_period_overlap_guard.sql` (MCP-namn `invoice_period_overlap_guard`) körd skarpt efter test i transaktion som rullades tillbaka. Trigger, funktion och vy på plats; vyn ger 15 par varav 8 utan F- (exakt de åtta i avsnitt 1), `authenticated` saknar select. Bevis: `scripts/regression/overlap-guard.test.sql` (22 fall, rullas alltid tillbaka): dubblett, FEV-mönstret (0,997), en dag mot låst, en dag mot utkast, Brynäs till ready, Fortnox-synk sent till paid, status=status på alla 577 avtalsfakturor, generatorns 13 update-rader ur regressionsdumpen (stigande och fallande ordning), F-import, HIST, adhoc, makulering och återställning, cronens create, samlingsfaktura, tilläggsfaktura, nödventilen. Dessutom simulerades alla 27 create-rader i dumpen mot databasen: största överlapp 0,082 mot låst F-, inget stopp. Regression: plan och SQL identiska mot baslinjen f19104e1 (`out/plan-2026-10-30-000d9f43.json`, sha256 `42d5ae87…`; SQL md5 `46f0fd14…`). Plan 7 (Generatorn mot Demo AB i UI) inte körd, ersatt av simuleringen. Avvikelser: UPDATE prövas bara när period, typ, avtal, samlingsflagga, `invoice_type`, `is_historical` eller F-prefix ändras, eller vid återställning från cancelled (planens skiss prövade varje statusbyte, vilket hade stoppat Fortnox-synken sent till paid när ett utkast överlappar några dagar); utkastregeln (mindre överlapp mot utkast) gäller bara INSERT; återställning av makulerad faktura med Fortnox-nummer stoppas aldrig (bara `raise warning`); vyn har `security_invoker`; filnamnet har dagens datum i stället för 20261102.

### Steg 4. Torrkörning i cronen och nytt urval bakom flagga

**Syfte.** Se vad den nya automatiken skulle göra innan den gör det. Cronen ska kunna ta med alla avtal oavsett slutdatum och frekvens, men bara i torrkörning tills Christian sagt ja.

**Ändras (`api/cron/generate-continuing-contracts.ts`).**
- Ny kontext `type RunCtx = { dryRun: boolean; v2: boolean; planned: Array<{ customer_id; contract_id; kind; periodStart; periodEnd; subtotal; action: 'create' | 'refresh' }> }`, samma mönster som signeringens `ctx.dryRun`/`write()` (`api/_lib/contractSigning.ts`).
- `insertInvoice` (rad 373 till 436) och skrivdelen av `refreshEditableEquipmentInvoices` (rad 604 till 631) går via `write(ctx, beskrivning, fn)`: i torrkörning läggs posten i `ctx.planned` och fn körs inte. `loadSources` anropar `sync_addon_period_lines` och `sync_addon_article_lines` (rad 135); i torrkörning hoppas de över och raderna läses som de är.
- `handler`: `dryRun = req.query.dry === '1'`, `v2 = req.query.v2 === '1' || process.env.CONTINUING_CONTRACTS_V2 === '1'`.
- Urval när `v2`: ta bort `.not('billing_frequency', 'is', null)` och `.or(...)` på rad 703 till 704. Synth-urvalet (rad 716 till 722) behålls som i dag i båda lägena.
- Summeringen till `cron_runs` (via `withCronLog`) får `dry_run`, `v2`, `would_create` (lista, högst 500 rader) och `would_refresh`.
- `vercel.json`: ny post `{ "path": "/api/cron/generate-continuing-contracts?dry=1&v2=1", "schedule": "30 3 * * *" }`. Kontrollera i Vercels dokumentation att querysträng i cron-path tillåts; annars en tunn fil `api/cron/generate-continuing-contracts-dry.ts` som anropar samma handler med `dryRun: true, v2: true`.

**Får inte ändras.** Den skarpa körningen 03:00 UTC beter sig exakt som i dag (gamla urvalet, gamla matchningen). `requireCronSecret` och `withCronLog` som i dag.

**Bevis.**
- Lokal körning mot prod med `dry=1` (läser bara): `would_create` för gamla urvalet = det den skarpa körningen faktiskt skapade samma natt (jämför med `cron_runs`).
- Två nätters torrkörning med `v2=1`: lista per avtal vad som skulle skapas för de 51 + 25 avtal som i dag hoppas över. Christian går igenom listan. Förväntat: utkast för perioder i nuvarande bindningstid som saknar faktura och vars fakturadatum är inne (till exempel FEV, WBAB, Falu), och inga för frekvens NULL (planeraren ger tomt).

**Godkännande.** Ja till push och till den nya cron-posten. Backning: ta bort posten i `vercel.json`, `git revert`.

**Changelog.** Ingen (inget syns för användaren).

**Omfattning.** En dag.

**Körd 2026-10-30** (commit `5c883b9c`, pushad, ingen version, ingen changelog): `RunCtx` och `write()` i cronen; `insertInvoice` och radbytet i `refreshEditableEquipmentInvoices` går via `write`, sync-RPC:erna hoppas över i torrkörning. Körningen bruten ut i `runContinuingContracts(ctx)` och `handleContinuingContracts(req, res, force)`; standardexporten är oförändrad i beteende (dry och v2 av utan querysträng eller variabel). Summeringen får `dry_run`, `v2`, `contracts_selected` och i torrkörning `would_create_count`, `would_refresh_count`, `would_create`, `would_refresh` (högst 500 vardera). Torrkörningen loggas som `generate-continuing-contracts-dry` i `cron_runs`. Ny fil `api/cron/generate-continuing-contracts-dry.ts` (dry + v2) och ny post 03:30 UTC i `vercel.json`. Inga migrationer, inga Vercel-variabler. Bevis: lokal torrkörning mot prod med en fetch-spärr som stoppar allt utom GET: 0 skrivförsök. Gamla urvalet: 57 avtal, 118 kunder, `would_create` 0 och `would_refresh` 0, samma som den skarpa körningen i natt (`cron_runs` 2026-10-30 03:00: 118 kunder, 0 skapade) och samma som regressionsdumpens cronkolumn (ingen `skapas`). v2: 117 avtal, 170 kunder, `would_create` 1 (BRO Sabbatsberg 24 AB, premie 2026-11-01 t.o.m. 2027-10-31, 8 900 kr), `would_refresh` 1 (FEV avtal 72818957, tilläggsfaktura 2027-07-01 t.o.m. 2028-06-30, 22 156 kr). Regression: plan och SQL identiska med baslinjen f19104e1 (`out/steg4/plan-2026-10-30-000d9f43.json`, sha256 `42d5ae87…`, samma som steg 3; SQL md5 `46f0fd14…`). Avvikelser: egen fil i stället för querysträng i cron-sökvägen (Vercels dokumentation nämner inte querysträngar); `created_at` med uttrycklig offset (avsnitt 12) INTE gjort, se strul.

### Steg 5. Datamodellen, additivt

**Syfte.** Alla nya fält på plats, NULL överallt, inget läses ännu.

**Ändras (migration `20261103_avtalsar_datamodell.sql`).**

```sql
alter table public.contracts
  add column if not exists billing_anchor_mode text
    check (billing_anchor_mode is null or billing_anchor_mode = 'start_day'),
  add column if not exists billing_anchor_verified_at timestamptz,
  add column if not exists billing_anchor_verified_by uuid references public.profiles(id),
  add column if not exists billing_anchor_verified_note text,
  add column if not exists addon_rules text
    check (addon_rules is null or addon_rules = 'v2');

alter table public.invoices
  add column if not exists marking_key text;

alter table public.equipment_placements
  add column if not exists placed_case_id uuid references public.cases(id) on delete set null;
alter table public.indoor_stations
  add column if not exists placed_case_id uuid references public.cases(id) on delete set null;
create index if not exists ep_placed_case_idx on public.equipment_placements (placed_case_id) where placed_case_id is not null;
create index if not exists is_placed_case_idx on public.indoor_stations (placed_case_id) where placed_case_id is not null;

alter table public.case_billing_items
  add column if not exists station_ids uuid[];

-- Unikt index som också bär märkningen. Med marking_key NULL överallt är det likvärdigt med det gamla.
create unique index if not exists invoices_contract_period_marking_key
  on public.invoices (contract_id, billing_period_start, contract_invoice_kind, coalesce(marking_key, ''))
  where invoice_type = 'contract' and contract_id is not null and contract_invoice_kind <> 'adjustment'
    and status <> 'cancelled' and invoice_number !~~ 'F-%';
```

Plus tabellen `addon_station_coverage` med policy och index (avsnitt 6), utan triggers ännu.

Två ändringar kräver drop och körs av Christian i SQL-editorn, i samma session, efter migrationen:

```sql
drop index public.invoices_contract_period_key;
alter table public.invoices drop constraint invoices_contract_invoice_kind_check;
alter table public.invoices add constraint invoices_contract_invoice_kind_check
  check (contract_invoice_kind = any (array['premium', 'equipment', 'equipment_monthly', 'adjustment', 'equipment_gap']));
```

(Det gamla indexet måste bort först när två tilläggsfakturor med olika märkning ska kunna ha samma avtal, period och typ. Fram till steg 11 finns ingen sådan rad, så ordningen är ofarlig.)

`billing_anchor_mode` och `addon_rules` läggs INTE i `framework_fields()`: avtalsdagen är ett faktum om just det avtalet och ramavtalet ska inte skriva över den. Triggern `contract_framework_apply` lyssnar på `contract_start_date`; kontrollera i steg 6 att den inte skriver tillbaka ramavtalets startdatum över ett verifierat datum (tre avtal har ramavtal).

`src/types/database.ts`: nya kolumner på contracts, invoices, equipment_placements, indoor_stations, case_billing_items; ny tabell. `src/services/contractService.ts`: `ContractWithBilling` och urvalet i `getActiveContracts`/`getContractWithBillingById` får `billing_anchor_mode, addon_rules`. Cronens urval (rad 699) och `ContractRow` samma.

**Får inte ändras.** Ingen kod läser fälten. Inga befintliga rader får värden.

**Bevis.**
- `select count(*) from contracts where billing_anchor_mode is not null or addon_rules is not null` = 0; motsvarande för `placed_case_id`, `marking_key`, `station_ids`, coverage = 0.
- I BEGIN … ROLLBACK: insert av två tilläggsfakturor med samma avtal, period, typ och `marking_key` NULL ger unikt fel (det nya indexet tar över skyddet).
- Regressionsskriptet: hash identisk.
- `node scripts/type-check.mjs` utan nya fel.

**Godkännande.** Ja till migrationen och, separat, ja till att Christian kör de tre drop-raderna. Backning: kolumnerna är oanvända och kan stå kvar; vill man ta bort dem kör Christian `alter table ... drop column` i SQL-editorn. Indexbytet backas genom att skapa det gamla indexet igen (create unique index, ingen drop behövs för det).

**Changelog.** Ingen.

**Omfattning.** En halv dag.

**Körd 2026-10-30** (commit `cfb13768`, pushad, ingen version, ingen changelog): migration `supabase/migrations/20261030_avtalsar_datamodell.sql` (MCP-namn `avtalsar_datamodell`) körd skarpt efter prov i transaktion som rullades tillbaka. Kolumnerna på contracts, invoices, equipment_placements, indoor_stations och case_billing_items, de två partiella `placed_case_id`-indexen, unika indexet `invoices_contract_period_marking_key` och tabellen `addon_station_coverage` (index, RLS, select för interna, ingen skrivpolicy, plus `revoke all from anon`) enligt planen. Typer: contracts-raden i `database.ts` (valfria fält, så att synth-avtalet och Insert-typen inte påverkas), `EquipmentPlacement` och ny `AddonStationCoverage` i `database.ts`, `IndoorStation` i `indoor.ts`, `CaseBillingItem` i `caseBilling.ts`, `Invoice` i `invoice.ts`. `CONTRACT_BILLING_COLUMNS` i `contractService.ts` (används av `getActiveContracts`, `getAllContractsWithBilling`, `getContractWithBillingById` och två till), cronens urval och `ContractRow` hämtar `billing_anchor_mode, addon_rules`; ingen kod läser dem. Bevis i `scripts/regression/avtalsar-datamodell.test.sql` (rullas alltid tillbaka): 0 rader med värden i alla nya kolumner och i täckningen; 0 grupper som bryter mot nya indexet; dubblett med `marking_key` NULL stoppas av nya indexets definition (prövad på en temp-kopia av invoices eftersom gamla indexet ligger kvar och slår till först; på invoices stoppas dubbletten av `invoices_contract_period_key`); olika märkning går igenom, samma märkning två gånger stoppas; check-villkoren stoppar andra värden; tekniker och koordinator med can_approve_invoices ser täckningsrader men får inte skriva; kund ser 0 och får inte skriva; anon saknar behörighet. Regression: plan och SQL identiska med baslinjen f19104e1 (`out/steg5/plan-2026-10-30-5c883b9c.json`, samma innehåll som steg 4 utom git_sha; SQL md5 `46f0fd14…`). De tre drop-raderna ovan är INTE körda. Avvikelser: filnamnet har dagens datum i stället för 20261103; typerna ligger i de filer där tabellerna redan är typade (de finns inte i `database.ts`); `revoke all from anon` utöver planen; bevis 2 på riktiga tabellen kan visa att nya indexet tar över först när gamla indexet är borttaget.

### Steg 6. Periodregeln med klampning (TS och SQL)

**Syfte.** Planeraren och SQL-funktionerna kan räkna exakt avtalsdag. Gamla läget orört.

**Ändras.**
- Ny `src/shared/contractPeriods.ts` (avsnitt 4): `addMonthsClampedIso`, `exactPeriods`, `periodStepMonths(freq)`, `nextPeriodStart(contract, fromIso)` och `periodContaining(contract, dayIso)` som båda läser `billing_anchor_mode` och faller tillbaka på dagens regel.
- `PlanningContract` (contractPlanner.ts rad 26 till 42) får `billing_anchor_mode?: string | null`.
- `computePlannedPeriods` (rad 466 till 477): om `contract.billing_anchor_mode === 'start_day'` används `exactPeriods(start, effectiveEnd, effectiveEnd, step, requireFull)` i stället för `iterPeriodsPure`. Allt annat (fönster, mittpunkt, belopp, fakturadatum) som i dag. `iterPeriodsPure` rörs inte.
- `computePlannedMonthlyEquipmentPeriods` (rad 578): i exakt läge månadsperioder från avtalsdagen (samma `exactPeriods` med steg 1, första perioden den som innehåller `max(idag, tidigaste billing_start_date)`), annars som i dag.
- SQL (migration `20261104_avtalsar_perioder.sql`): `contract_period_on(uuid, date)` (avsnitt 4). `contract_next_period_start(uuid, date)` får en första gren: om avtalet är i exakt läge returneras `period_end + 1` för perioden som innehåller `p_from`; annars dagens kod ordagrant. `contract_next_unplanned_period(uuid, date)`: första periodstarten räknas via `contract_period_on` i exakt läge, resten som i dag. `contract_customer_view`: `next_invoice` via `contract_next_period_start(id, idag)` där idag = `(now() at time zone 'Europe/Stockholm')::date`.
- `src/shared/contractSigning.ts` `deriveMapSetup` (rad 331 till 345) oförändrad i det här steget.

**Får inte ändras.** `iterPeriodsPure`, `bindingWindow`, `midpointBefore`, `amountPerPeriodPure`. Överlagringen `contract_next_period_start(text, smallint, date, date)` (IMMUTABLE, används i vyer) rörs inte. Dagens kod i varje SQL-funktion ska stå kvar ordagrant i else-grenen.

**Bevis.**
- Vitest `src/shared/contractPeriods.test.ts`:
  - X1: start 2026-06-30, årsvis, slut 2028-06-29, idag 2026-10-30, `window: 'binding'` ger [2026-06-30 t.o.m. 2027-06-29, 2027-06-30 t.o.m. 2028-06-29].
  - X2: start 2024-02-29, årsvis: 2025-02-28 t.o.m. 2026-02-27, 2026-02-28 t.o.m. 2027-02-27, 2027-02-28 t.o.m. 2028-02-28, 2028-02-29 t.o.m. 2029-02-27.
  - X3: start 2026-01-31, månadsvis: 2026-01-31 t.o.m. 2026-02-27, 2026-02-28 t.o.m. 2026-03-30, 2026-03-31 t.o.m. 2026-04-29, 2026-04-30 t.o.m. 2026-05-30.
  - X4: start 2026-11-15, halvårsvis, slut 2027-11-14: två perioder, 2026-11-15 t.o.m. 2027-05-14 och 2027-05-15 t.o.m. 2027-11-14.
  - X5: start 2026-08-17, kvartalsvis, tills vidare, uppsägning 2 mån, idag 2026-10-30: perioder som börjar före 2026-12-30 (2026-08-17, 2026-11-17).
  - X6: exakt läge, uppsagt med `effective_end_date` 2027-03-31, årsvis start 2025-04-10: bara 2025-04-10 och 2026-04-10.
  - X7 (legacy): alla befintliga fall i `contractPlanner.test.ts` oförändrade.
  - X8: `nextPeriodStart` exakt läge, start 2025-11-25, från 2026-10-30 ger 2026-11-25; legacy med ankare 11 ger 2026-11-01.
- SQL-tvilling mot TS: skript `scripts/regression/periods-twin.mts` genererar 400 kombinationer (start 1 till 31 i alla månader 2023 till 2026, fyra frekvenser, fem frågedatum), kör `select * from contract_period_on_pure(...)` (en ren variant med parametrar i stället för avtals-id, skapad i samma migration) och jämför med `periodContaining`. Krav: noll skillnader.
- Regressionsskriptet och `sql-dump.sql`: identiska för alla avtal (inget avtal har läget satt).
- I BEGIN … ROLLBACK: sätt `billing_anchor_mode = 'start_day'` på FEV:s avtal, kontrollera `contract_next_period_start(id, '2026-10-30')` = 2027-06-30 och `contract_customer_view(id)->>'next_invoice'` = 2027-06-30, rulla tillbaka.

**Godkännande.** Ja till push och migration. Backning: `git revert`; SQL-funktionerna återställs med `create or replace` från dumpen av dagens definitioner som sparas i `supabase/migrations/20261104_avtalsar_perioder_backning.sql` innan migrationen körs.

**Changelog.** Ingen (inget avtal använder läget än).

**Omfattning.** Två dagar.

**Körd 2026-10-30** (commit `6de109b1`, pushad, ingen version, ingen changelog): ny `src/shared/contractPeriods.ts` (`addMonthsClampedIso`, `exactPeriods`, `exactPeriodAt`, `exactPeriodIndexContaining`, `periodStepMonths`, `isStartDayMode`, `periodContaining`, `nextPeriodStart`) och test (19 fall, X1 till X8 plus månadsfakturor och gamla läget). `PlanningContract` har `billing_anchor_mode`; `computePlannedPeriods` och `computePlannedMonthlyEquipmentPeriods` räknar från avtalsdagen bara när läget är `start_day` och startdatum finns. Signeringens planering och regressionsskriptet skickar med fältet; generatorn och cronen hämtade det redan (steg 5). `tsconfig.node.json` utökad. Migration `supabase/migrations/20261030_avtalsar_perioder.sql` (MCP-namn `avtalsar_perioder`) körd skarpt efter prov i transaktion som rullades tillbaka: `contract_period_on_pure` (ren, IMMUTABLE), `contract_period_on` (SECURITY DEFINER, ingen körrätt för anon), ny första gren i `contract_next_period_start(uuid, date)`, `contract_next_unplanned_period` och `contract_customer_view`; övrig kod ordagrant (kontrollerat med md5 på funktionskroppen). Backning i `20261030_avtalsar_perioder_backning.sql`, dagens definitioner med samma md5 som prod före migrationen. Bevis: `scripts/regression/avtalsar-perioder.test.sql` (13 fall på FEV 72818957 i exakt läge, rullas alltid tillbaka, alla OK: nästa periodstart 2027-06-30, period 2026-06-30 t.o.m. 2027-06-29, klampning 29 feb och 31 jan); `scripts/regression/periods-twin.mts` 400 kombinationer TS mot SQL, 0 skillnader (även 3 000 med `--starts=150`, 0 skillnader). Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 5 (`out/steg6/plan-2026-10-30-cfb13768.json`, sha256 `ff88210a…`; SQL md5 `46f0fd14…`). Kontroller: `resolveScheduleHorizon`/`scheduleHorizon` läser inte `billing_anchor_month` (bara ett tomt fält i ett syntetiskt avtal); `apply_framework_to_contract` skriver ramavtalets `contract_start_date` över avtalets när fältet inte står i `framework_overrides` (tre avtal har ramavtal), så avtalsdagen måste läggas i `framework_overrides` när den verifieras (steg 12). Avvikelser: `requireFull` i exakt läge använder dagens marginal (periodens sista månad får inte börja efter slutdatumet, som elva respektive fem månader fram i dag och `v_full` i SQL) i stället för "periodens sista dag får inte ligga efter slutdatumet", eftersom X6 annars inte går igenom; `contract_customer_view` kunde inte provas hela vägen, den faller redan i prod på `pli.price` (se strul), grenen provades med samma uttryck; filnamnet har dagens datum i stället för 20261104.

### Steg 7. Överlappsmatchning i stället för månadsnyckel

**Syfte.** Planera fakturor, cronen och signeringen matchar på datumöverlapp (avsnitt 5). Det tar bort dubbletterna när en periodstart flyttas över en månadsgräns.

**Ändras.**
- `src/shared/contractInvoiceMatch.ts`: `matchPeriods(planned, existing, mode)`; `buildContractDiff` byter `plannedByKey`/`existingByKey` (gamla rad 964 till 967) mot `matchPeriods`; konsoliderade perioder (gamla rad 972) matchas med samma regel mot listan i stället för en månadskarta; `duplicateIds` (gamla rad 1074 till 1086) = andra redigerbara utkast utan Fortnox-nummer som överlappar fakturan med minst halva perioden; "efter planens sista period" (gamla rad 1048) jämför `billing_period_start > lastPlannedEnd`. `keep`/`update` jämför belopp och periodens båda datum.
- `contractInvoiceGenerator.ts`: `planForContract` skickar `mode` från avtalet. `loadConsolidatedPeriodsForContract` (rad 887 till 895) returnerar en lista. `planConsolidatedForCustomer`: gruppnyckeln (rad 588) blir `${freq}|${anchor}` för legacy och `${freq}|start_day|${MM-DD av startdatum}` för exakt läge, så att avtal med olika avtalsdag aldrig hamnar på samma samlingsfaktura. Ersättningen av per-avtal-fakturor (rad 681 till 706) använder överlapp i stället för `byPeriod.has(start)`.
- Cronen: `loadCoveredPeriods` (rad 299 till 350) returnerar intervall per avtal, typ och märkning i stället för nyckelmängder. `createPerContract` (rad 540 till 541) och samlingsgrenen (rad 507 till 510) frågar `isCovered(p, ranges, mode)` som använder `matchPeriods`. `refreshEditableEquipmentInvoices` (rad 595) hittar planerad period via överlapp i stället för exakt `periodStart`. `generateForSynthCustomer` (rad 657) samma, alltid `legacy`. Cronens samlingsnyckel (rad 485) som generatorns. Ändringen gäller bara när `ctx.v2` är sann; skarpa körningen fortsätter med gamla nycklar tills steg 14.
- Signeringen: `planInvoices` (rad 980 till 1040) använder `isCovered` med avtalets läge.
- Webben: `contractAdditionService.ts` rad 150 till 160 slår upp låsta fakturor med `.in('billing_period_start', futureStarts)`; byt till intervallfråga (`lte('billing_period_start', end)`, `gte('billing_period_end', start)`) och `overlapShare`.

**Får inte ändras.** Fortnox-täckningen med minst halva perioden. Att `uncovered` och `consolidated` aldrig rörs av apply. `LOCKED_STATUSES` i generatorn (lägg till `overdue` i samma steg, det ändrar inget utfall eftersom den grenen redan var "rör ej").

**Bevis.**
- Vitest (i `contractInvoiceMatch.test.ts`):
  - M1 legacy: plan 2026-05-01 t.o.m. 05-31, befintlig 2026-05-20 t.o.m. 06-19 (andel 0,39): paras via månadsreserven, samma som i dag.
  - M2 overlap: samma indata ger ingen par, planen blir `create`, befintliga `delete` om utkast.
  - M3: plan 2026-06-30 t.o.m. 2027-06-29 mot utkast 2026-07-01 t.o.m. 2027-06-30: par, `update` (datum skiljer).
  - M4: plan 2027-06-30 t.o.m. 2028-06-29 mot låst 2026-07-01 t.o.m. 2027-06-30: inget par, `create`.
  - M5: två utkast 2026-11-01 och 2026-11-25 mot plan 2026-11-25 t.o.m. 2027-11-24: paras med 2026-11-25 (andel 1,0), det andra blir `delete` och listas i `duplicateIds`.
  - M6: Brynäs-exemplet i avsnitt 5, båda lägena.
  - M7: samlingsgrupp med två avtal, samma frekvens, avtalsdag 03-01 och 03-15 i exakt läge: två grupper.
- Regressionsskriptet: för legacy-avtal identiskt par för par och action för action med baslinjen. Skriptet kör gamla och nya matchningen sida vid sida och skriver varje skillnad. Noll skillnader krävs.
- Torrkörningen med `v2=1` två nätter: inga `would_create` för perioder som redan har en faktura med annan dag i samma period.

**Godkännande.** Ja till push. Backning: `git revert`.

**Changelog.** Ingen synlig ändring för legacy-avtal. Ingen punkt.

**Omfattning.** Två dagar.

**Körd 2026-10-30** (commit `abd1e9c9`, pushad, ingen version, ingen changelog): `contractInvoiceMatch.ts` har `MatchMode`, `matchModeFor`, `periodOverlapShare` (dagar i snittet / dagar i den KORTARE perioden, båda ändar med, samma som vakten), `matchPeriods`, `isCovered`, `findPlannedFor`, `cronFortnoxCovers`, `consolidationGroupKey`; `buildContractDiff` tar `mode` och `consolidatedInvoices` (lista). Generatorn (`planForContract`, `planEquipmentEntries`, `planConsolidatedForCustomer` med ny gruppnyckel och överlapp vid ersättning av per-avtal-fakturor), cronen (`loadCoveredPeriods` ger också intervall, `createPerContract`, samlingsgrenen, `refreshEditableEquipmentInvoices`), signeringen (`planInvoices`) och `contractAdditionService` (intervallfråga i exakt läge) väljer läge per avtal. `LOCKED_STATUSES` har `overdue`. Migration `supabase/migrations/20261030_avtalsar_overlap_share.sql` (MCP-namn `avtalsar_overlap_share`) körd skarpt efter prov i transaktion som rullades tillbaka: ny ren `contract_period_overlap_share(date, date, date, date)` och `guard_contract_invoice_overlap` som anropar den (i övrigt ordagrant; md5 på kroppen kontrollerad före och efter). Bevis: vitest 34 fall i `contractInvoiceMatch.test.ts` (M1 till M7 plus andel, lägen, cronens hjälpare); `overlap-share-twin.mts` 400 och 2 000 par TS mot SQL, 0 skillnader; `overlap-share.test.sql` (rutnät mot vaktens gamla uttryck 0 skillnader, gränsfallen 0,5 och 0,4 på riktiga vakten); regression plan och SQL identiska med baslinjen f19104e1 (`out/steg7/plan-2026-10-30-abd1e9c9.json`, SQL md5 `46f0fd14…`); den frysta månadsnyckeln mot `matchPeriods(..., 'legacy')` i alla 264 anrop: 0 skillnader; prov i minnet med FEV, WBAB och Brynäs i exakt läge (`out/steg7/exakt/`) och med alla 136 avtal (`out/steg7/exakt-alla/`): 0 stopp i vaktsimuleringen, ingen dubblett mot låsta fakturor; lokal torrkörning av cronen med fetch-spärr: gamla urvalet 0/0, v2 samma två poster som steg 4, 0 skrivförsök. Avvikelser: legacy-läget är dagens månadsnyckel ordagrant, inte "överlapp först, sedan månadsreserv" (planens variant gav 0 skillnader på dagens data men ändrar dubblettfallet HSB Kullen, där fler utkast i samma månad hade blivit delete); andelen i exakt läge räknas mot den kortare perioden (vaktens regel) i stället för mot den planerade; `keep`/`update` jämför datum bara i exakt läge; i exakt läge blir en planerad period som en redan parad låst faktura täcker till minst hälften `locked` i stället för `create`; cronens matchning följer avtalets läge oavsett v2 (inga avtal har läget, så nattkörningen är oförändrad), v2 styr bara Fortnox-regeln för gamla avtal; synth-kunder oförändrade.

### Steg 8. Täckningsmotorn

**Syfte.** Varje station får "betald till och med", med alla källor: portalfaktura, pro rata, glappfaktura, manuell Fortnox-faktura, efterskänkt.

**Ändras (migration `20261105_tackning_stationer.sql`).**
- Triggerfunktioner (SECURITY DEFINER, `search_path = public`):
  - `trg_asc_no_overlap()` på `addon_station_coverage` BEFORE INSERT OR UPDATE OF covered_from, covered_to, released_at: om en annan aktiv rad för samma station och typ överlappar, `raise exception` med båda radernas källa och referens.
  - `trg_invoice_locked_coverage()` AFTER UPDATE OF status ON invoices när `old.status in ('draft','pending_approval','ready') and new.status in ('booked','sent','overdue','paid')`: skriver `invoice`- eller `gap_invoice`-rader enligt avsnitt 6. Krockar med befintlig täckning (till exempel en manuell Fortnox-rad) skrivs INTE; i stället en rad i `addon_coverage_conflicts` (ny liten tabell: invoice_id, station_id, conflict_with uuid, created_at) som arbetslistan visar.
  - `trg_invoice_cancelled_coverage()` AFTER UPDATE OF status ON invoices när status blir cancelled: `update addon_station_coverage set invoice_cancelled_at = now() where invoice_id = new.id`. För adhoc-fakturor (pro rata på ärende) via `case_billing_item_id` på fakturans rader.
  - `trg_cbi_prorata_coverage()` AFTER UPDATE OF status ON case_billing_items när `new.is_addon_prorata_line and new.status = 'billed' and old.status <> 'billed'`: `prorata`-rader för `new.station_ids`. Saknas `station_ids` (gamla rader) skrivs inget.
- RPC:er (SECURITY DEFINER, alla kräver `intranet_is_internal()`, skrivande kräver `profiles.can_approve_invoices`):
  - `addon_coverage_register_manual(p_station_ids uuid[], p_kind text, p_from date, p_to date, p_fortnox_document text, p_note text) returns int`
  - `addon_coverage_waive(p_station_ids uuid[], p_kind text, p_from date, p_to date, p_note text) returns int` (släpper överlappande rader med `released_at` och skriver `waived` i samma transaktion)
  - `addon_coverage_release(p_coverage_ids uuid[], p_reason text) returns int`
  - `addon_station_coverage_list(p_unit_id uuid) returns table(...)` för panelen
  - `addon_station_gaps(uuid, text, date, date)` (avsnitt 6)
- `addon_station_paid_through(uuid, boolean)` byggs om: först täckningen, sedan dagens logik som reserv när stationen saknar rader. Nya fält i svaret.
- TS: `AddonStationBillingService.getPaidThrough` (rad 337) läser nya fält; `src/types/addonStations.ts` (`AddonPaidThrough`) utökas. Ny `AddonCoverageService` i `src/services/addonCoverageService.ts` med de fyra RPC-anropen.

**Får inte ändras.** `handle_invoice_cancelled` (provisioner) rörs inte, de nya triggrarna är egna. Inga befintliga fakturor eller rader får täckning i det här steget (det är datasteg 16).

**Bevis (BEGIN … ROLLBACK).**
1. Skapa testfaktura kind equipment med `station_ids` på en rad, sätt status sent: en `invoice`-rad per station med rätt datum.
2. Sätt samma faktura cancelled: raderna står kvar med `invoice_cancelled_at`; `addon_station_gaps` för perioden ger inget glapp.
3. `addon_coverage_release` på raderna: glappfunktionen ger hela perioden.
4. `addon_coverage_waive` över samma period: inget glapp, en `waived`-rad, den gamla släppt.
5. Försök registrera manuell täckning som överlappar en aktiv rad: fel.
6. Kör punkt 1 till 5 som tekniker (`set local role authenticated; set local request.jwt.claims = '{"sub":"<teknikerns user_id>","role":"authenticated"}'`): select fungerar via policy (intern), skrivande RPC ger "Behörighet saknas". Som koordinator med `can_approve_invoices = false`: samma. Som Sofia Pålshagen (koordinator med befogenheten): fungerar.
7. `addon_station_paid_through` för en station utan täckningsrader ger samma svar som före migrationen (jämför för alla 100 tilläggsstationer, sparat före och efter).

**Godkännande.** Ja till migrationen. Backning: triggers tas bort av Christian i SQL-editorn (`drop trigger ...`), `addon_station_paid_through` återställs med `create or replace` ur backningsfilen. Tabellen kan stå kvar tom.

**Changelog.** Ingen än (panelen kommer i steg 12).

**Omfattning.** Två dagar.

**Körd 2026-10-30** (commit `aa076647`, pushad, ingen version, ingen changelog): migration `supabase/migrations/20261030_tackning_stationer.sql` (MCP-namn `tackning_stationer`) körd skarpt efter prov i transaktion som rullades tillbaka. Ny tabell `addon_coverage_conflicts` (RLS, select för interna, ingen skrivpolicy); triggrarna `trg_asc_no_overlap` (med rådgivande lås per station), `trg_invoice_locked_coverage`, `trg_invoice_cancelled_coverage`, `trg_cbi_prorata_coverage`; RPC:erna `addon_coverage_register_manual`, `addon_coverage_waive`, `addon_coverage_release`, `addon_station_coverage_list`, `addon_station_gaps`; hjälpfunktioner utan klientkörrätt (`addon_coverage_can_read`, `addon_coverage_approver`, `addon_station_lookup`, `addon_coverage_ref`, `addon_coverage_write_or_conflict`). `addon_station_paid_through` byggd om: dagens kod ordagrant i `addon_station_paid_through_legacy`, den nya läser täckningen först och svarar med det gamla svaret när stationen saknar täckningsrader. Backning i `20261030_tackning_stationer_backning.sql`. TS: `AddonPaidThrough` med nya källor, `from_coverage`, `cancelled_unresolved`, `addonPaidThroughLabel` (efterskänkt heter "Efterskänkt till och med" i varningen vid borttag), `AddonCoverageListRow`, ny `src/services/addonCoverageService.ts` (fem RPC-anrop), test `src/types/addonStations.test.ts`. Bevis: `scripts/regression/tackning-stationer.test.sql` (rullas alltid tillbaka) på FEV:s tilläggsutkast INV-202609-0338 och pro rata-raden på BE-0009544: alla fall OK (legacy-avtal skriver 0 rader, v2 en per station, konflikt mot manuell rad, makulering markerar utan att släppa, release ger glapp, waive täcker och klipper delvis överlappande rad, överlapp stoppas, återställd faktura avmarkeras, pro rata 2026-10-27 t.o.m. 2026-10-31, paid_through ur täckningen, tekniker och koordinator utan befogenhet stoppas, Sofia får, anon saknar körrätt); kortare prov efter skarp migration också OK. `addon_station_paid_through` för alla 100 tilläggsstationer: md5 `3a7bf24f…` före, i transaktionen och efter skarp migration (87 gäller, 38 med betald t.o.m.). Täckning och konflikter 0 rader efteråt. Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 7 (`out/steg8/plan-2026-10-30-abd1e9c9.json`, sha256 `59ab677e…`; SQL md5 `46f0fd14…`). Avvikelser: triggrarna skriver täckning bara när fakturans eller stationens avtal har `addon_rules = 'v2'` eller stationen redan har täckningsrader (14 fakturarader på FEV har redan `station_ids`, så utan spärren hade sändningen av FEV:s tilläggsutkast ändrat befintliga stationer); skrivande RPC:er kräver `can_approve_invoices`, inte "eller admin" (två tekniker är admin utan befogenheten, Christians beslut); waive skriver tillbaka delar av en släppt rad som ligger utanför perioden; makuleringstriggern tar bort markeringen om fakturan återställs; triggrarna fångar alla fel (raise warning) så att fakturering och Fortnox-synk aldrig stoppas; `addon_station_coverage_list` har en extra valfri parameter `p_include_released`; läsfunktionerna tillåter också service role och SQL-editorn; filnamnet har dagens datum i stället för 20261105.

### Steg 9. Station kopplas till ärendet där den sattes ut, pro rata version 2

**Syfte.** Pro rata räknas per station och ärende, bara över dagar som saknar täckning, kapas vid avtalets slut, och förlängs till nästa ofakturerade periodstart när nästa periods faktura redan är skickad.

**Ändras.**
- Alla utsättningsflöden skickar `placed_case_id` när ärendet är känt:
  - `useEtableringsflode.ts`: etableringsärendet (rad 365 till 400 hämtar redan `establishmentCase`); utsättningen rad 300 och 405.
  - `TechnicianEquipment.tsx` rad 447 och 553: samma.
  - `StationInspectionModule.tsx` och `StationInspectionPanel.tsx`: kontrollsessionens ärende.
  - `AddStationWizard.tsx`, `CustomerStationsModal.tsx`, `StationArk.tsx`, `NyKundStationer.tsx`, `IndoorEquipmentView.tsx`: ärendet de öppnats från, annars inget.
  - `EquipmentService.createEquipment` (`src/services/equipmentService.ts` rad 217) och motsvarande i `indoorStationService.ts` tar `placed_case_id` i insert-objektet (typen `EquipmentPlacementInsert` utökas).
- Reservtrigger `trg_station_placed_case` BEFORE INSERT på båda tabellerna, bara när `new.placed_case_id is null and new.is_addon`: om kunden (enheten) har exakt ett öppet ärende av typen etablering eller ett pågående kontrollärende skapat samma dag eller tidigare, sätt det. Annars NULL, och stationen visas i arbetslistan som "Utsatt utan ärende".
- `sync_addon_prorata_line` version 2 (samma signatur, `create or replace`). Ny gren överst:

```
för varje station s där
    s.is_addon och s.status = 'active'
    och s.addon_billing_model in ('per_year','per_month')
    och s.addon_contract_id is not null and s.addon_contract_mode = 'separate'      -- beslutsspärren (steg 10)
    och (p_case_id is null eller s.placed_case_id = p_case_id)
    och s.placed_case_id is not null
    och ärendet s.placed_case_id är öppet
  startdag = coalesce(s.addon_effective_from, lokal dag för coalesce(s.addon_marked_at, s.placed_at))
  ordinarie = nästa periodstart enligt avtalets tilläggstakt (steg 11; före steg 11 = contract_next_period_start)
  slut = ordinarie
  medan finns låst faktura (premie med tilläggsrader eller kind equipment/equipment_monthly) för avtalet
        och märkningen vars period börjar på slut och inte innehåller s i station_ids:
      slut = den fakturans period_end + 1                                            -- ledtidsregeln
  slut = least(slut, avtalets sista giltiga dag + 1)                                   -- kapning vid avtalsslut
  glapp = addon_station_gaps(s, startdag, slut - 1)
  dagar = summan av glappens längd
gruppera per (placed_case_id, stationstyp, modell, märkningsnyckel) -> en pro rata-rad per grupp
rad.quantity = antal stationer med dagar > 0
rad.unit_price = round(årspris * medeldagar / 365, 2)       -- samma formel som i dag
rad.billing_start_date = slut (gemensamt för gruppen; stationer med olika slut hamnar i olika grupper)
rad.station_ids = gruppens stationer
```

Stationer utan `placed_case_id` hanteras av dagens kod ordagrant (else-grenen), så gamla stationer beter sig som i dag. Avtalets sista giltiga dag = `coalesce(effective_end_date, contract_end_date)` när avtalet är uppsagt eller `renewal_mode = 'option'`, annars ingen kapning (rullande avtal förlängs).

- Ledtidsfakturan när ärendet redan är stängt eller fakturerat: generatorn och cronen (steg 11) skapar `equipment_gap`-faktura för samma glapp. Pro rata-raden på ärendet och glappfakturan kan aldrig ta samma dagar: båda frågar `addon_station_gaps`, och en pending pro rata-rad räknas som reserverad (glappfakturan hoppar över stationer som har en pending pro rata-rad på ett öppet ärende).
- `AddonStationBillingService.syncAfterStationChange` (rad 349 till 361) tar valfritt `caseId` och skickar det som `p_case_id`.
- `useEtableringsflode.ts` rad 577 till 585 och `TechnicianEquipment.tsx` rad 740: ärendet tas från stationernas `placed_case_id` när det finns, annars som i dag.

**Får inte ändras.** Formeln årspris × dagar / 365. Att raden aldrig synkas ner under redan fakturerat antal. `sync_addon_station_line` (per kontroll) rörs inte. Etableringskostnadsraden (0 kr) rörs aldrig.

**Bevis.**
- Vitest för den rena delen (ny `src/shared/addonProrata.ts` som speglar SQL-regeln för förhandsvisningen i `AddonDropPrompt`): 
  - P1: station 2026-11-10, årsvis premie, nästa period 2027-07-01, inget låst: slut 2027-07-01, 233 dagar.
  - P2: station 2026-06-10, faktura för 2026-07-01 t.o.m. 2027-06-30 skickad 2026-05-22 utan stationen: slut 2027-07-01, 386 dagar (ledtidsregeln).
  - P3: station 2026-06-10, fakturan för 2026-07-01 är ett utkast: slut 2026-07-01, 21 dagar.
  - P4: uppsagt avtal med `effective_end_date` 2027-03-31, station 2026-11-10: slut 2027-04-01.
  - P5: stationen har `waived` 2026-11-10 t.o.m. 2026-12-31: dagar = från 2027-01-01.
  - P6: två ärenden på samma enhet, station A på ärende 1, station B på ärende 2: två rader, en per ärende.
- SQL i BEGIN … ROLLBACK på en kopia av Falu-fallet (Lugnet 5003, utkast 0078/0079): med `placed_case_id` satt till rätt ärende och stationerna beslutade blir en rad per ärende och ljusfällan räknas en gång. Utan `placed_case_id`: samma resultat som före (jämför jsonb-svaret före och efter migrationen).
- RLS: kör RPC:n som tekniker (`intranet_is_internal()` sann) i BEGIN … ROLLBACK, enligt minnet tekniker-avslut-rls.

**Godkännande.** Ja till push och migration. Backning: `create or replace` med dagens definition ur backningsfilen; kolumnen `placed_case_id` kan stå kvar.

**Changelog.** `{ kind: 'andring', text: 'En tilläggsstation hör nu till ärendet där den sattes ut. Pro rata hamnar på rätt ärende även när kunden har flera öppna ärenden.' }` Version 3.111.0.

**Omfattning.** Tre dagar.

**Körd 2026-10-30** (commit `7d787536`, pushad, 3.111.0): två migrationer, båda skarpa. `supabase/migrations/20261030_prorata_v2_funktioner.sql` (MCP-namn `prorata_v2_funktioner`, inga anropare): `sync_addon_prorata_line_v2`, `addon_prorata_v2_end` (ordinarie, ledtidsregeln, kapning), `addon_station_uncovered_days`, `addon_prorata_uses_v2`, `addon_case_is_open`, ingen körrätt för klienter. `supabase/migrations/20261030_prorata_v2_placed_case.sql` (MCP-namn `prorata_v2_placed_case`, provad först i transaktion som rullades tillbaka): dagens `sync_addon_prorata_line` döpt om till `sync_addon_prorata_line_legacy` (md5 på kroppen `21da9cef…` före och efter, ingen körrätt för klienter); ny `sync_addon_prorata_line` med samma signatur som väljer v2 bara när enhetens avtal eller en beslutad station på enheten har `addon_rules = 'v2'`, annars legacy med samma argument; reservtriggern `trg_station_placed_case` (BEFORE INSERT på båda stationstabellerna, bara tilläggsstationer utan ärende, exakt ett öppet etableringsärende eller påbörjat kontrollärende); `trg_cbi_prorata_coverage` skriver pro rata-täckning bara över glappen. Backning `20261030_prorata_v2_placed_case_backning.sql`. TS: ny `src/shared/addonProrata.ts` + test (15 fall, P1 till P6, Falu 246 dagar 1 136,32/1 582,49, okänd faktura, kapning); `AddonStationBillingService.findOpenEstablishmentCase` och `placementCaseMessage`; `useEtableringsflode.ts`, `TechnicianEquipment.tsx` och `AddStationWizard.tsx` slår upp etableringsärendet före utsättningen och skickar `placed_case_id` (tilläggsstation eller preparat), visar en gång per kund vilket ärende stationen kopplas till när flera är öppna, aldrig blockerande; `CreateIndoorStationInput.placed_case_id`. Bevis: `scripts/regression/prorata-compare.sql` 88 anrop (alla enheter med tilläggsstationer och alla ärenden med pro rata eller etablering på sådan enhet), md5 `0fae6855…` före migrationen, i transaktionen och efter skarp migration, för både `sync_addon_prorata_line` och `_legacy`; `scripts/regression/prorata-v2.test.sql` på Falu i målbilden (alla fall OK: utan ärende ingen rad, en rad per ärende 1 136,32 och 1 582,49 slut 2027-06-30, idempotent, `p_case_id` begränsar, efterskänkt ger 180 dagar och täckning bara över glappet utan konflikt, fakturerad station får ingen ny rad, uppsägning kapar till 2027-04-01, obeslutad station och stängt ärende ger ingen rad, ledtidsregeln på FEV 2027-07-01 till 2028-07-01, okänd faktura stoppar, reservtriggern ett ärende/två ärenden/ej tillägg, tekniker sätter ut med ärende ute och inne, synkar och läser tillbaka, v2-grenen nekad direkt). Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 8 (`out/steg9/plan-2026-10-30-aa076647.json`, sha256 `f4b075fd…`, körd före commit; SQL md5 `46f0fd14…`), legacy-matchning 0 skillnader, vaktstopp 0. Avvikelser: se strul-dokumentet, steg 9.

### Steg 10. Beslutsspärr och arbetslista

**Syfte.** Pro rata skapas inte förrän tillägget beslutats i avtalskartan. Den som ansvarar ser att något måste göras, på vilken kund, och vad man gör på kartan.

**Ändras.**
- Spärren: i `sync_addon_prorata_line` (båda grenarna) byts `coalesce(addon_contract_mode, 'separate') = 'separate'` mot `addon_contract_id is not null and addon_contract_mode = 'separate'`. Det här är den enda ändringen i planen som gäller även gamla avtal; den är beslutad av Christian och stoppar bara nya debiteringar. Befintliga pending-rader (en i dag) lämnas orörda men får en markering i arbetslistan om stationerna bakom är obeslutade.
- Beslutet utlöser pro rata: `ContractScopeService.addAddonStationsSeparate` (`src/services/contractScopeService.ts`) anropar efter lyckat beslut `sync_addon_prorata_line(enhet, null, null, null, placed_case_id)` per berört ärende. Är ärendet stängt skapas inget på ärendet; glappet tas av nästa planering som `equipment_gap` (steg 11) och syns i arbetslistan som "Faktura att skapa".
- Ny RPC `contract_work_items(p_root_customer_id uuid default null)` (SECURITY DEFINER, kräver `can_approve_invoices` eller admin) som returnerar en rad per uppgift:

| kind | När | Instruktion på kartan | Knappar |
|---|---|---|---|
| `addon_decide` | tilläggsstationer utan beslut (bygger på `addon_pending_summary`) | "N tilläggsstationer på {enhet} väntar på beslut. Välj om de ingår i premien eller faktureras som tillägg. Pro rata skapas först efter beslutet." | Tillägg utöver avtalet · Ingår i premien |
| `addon_no_case` | station utan `placed_case_id` | "Stationen sattes ut utan ärende. Välj ärendet den hör till." | Välj ärende |
| `coverage_cancelled` | täckning med `invoice_cancelled_at` och ej släppt | "Faktura {nr} makulerades. Ska stationerna faktureras igen eller efterskänkas?" | Fakturera igen · Efterskänk |
| `coverage_conflict` | rad i `addon_coverage_conflicts` | "Faktura {nr} täcker dagar som redan är täckta av {källa}." | Öppna fakturan |
| `gap_invoice` | glapp som blir `equipment_gap` i nästa planering | "Station {x} saknar betalning {från} t.o.m. {till}. Planera fakturor skapar fakturan." | Planera fakturor |
| `anchor_verify` | avtal i Christians lista (datasteget) utan verifierad avtalsdag | "Kontrollera startdatum mot Oneflow-avtalet och markera avtalsdagen." | Öppna avtalet i Oneflow · Markera avtalsdag |

- Notiser: `addon_pending_refresh_notifications(root)` utökas till att räkna alla `contract_work_items` för kunden, en notis per kund med titeln "{N} att göra på avtalskartan · {kund}" och `preview` = första uppgiftens instruktion. Mottagare som i dag: `profiles.can_approve_invoices`. Länk som i dag via `case_type 'customer'`; `NotificationModal` och `NotificationBell` bygger länken `?tab=avtalskarta&panel=innehall&todo=<kind>&contract=<id>&unit=<id>`.
- Kartan (`ContractMapSection.tsx`, uppgiftsremsan rad 2382 till 2431): remsan visar arbetslistan för kunden i stället för bara brickor. Varje rad: kund/enhet, instruktionen i klartext, knapparna ovan. `?todo=` och `?contract=` öppnar rätt papper, tänder rätt § (befintliga `para6-<contractId>` och `PARA_FLASH_CLASSES`) och förväljer brickorna för enheten. Klarrad och "Tillbaka till Kräver åtgärd" som i dag. Remsan bryts ut till ny fil `src/components/admin/customers/record/ContractWorkList.tsx` (kartan är redan cirka 5 000 rader).
- `useAddonPending` (`src/hooks/useAddonPending.ts`) blir `useContractWorkItems` med samma singleton- och realtidsmönster; sidomenyns plupp och `Customers.tsx` `requiresAction` (rad 45) räknar alla uppgiftstyper.

**Får inte ändras.** Brickans drag och släpp och `AddonDropPrompt`. Mottagarregeln (`can_approve_invoices`, inte roll). Kartan avmonterar inga flikpaneler (minnet project_arendemodal_redesign).

**Bevis.**
- BEGIN … ROLLBACK: obeslutad station på testkund, kör `sync_addon_prorata_line`: ingen rad. Sätt beslut (separate + avtal): raden skapas.
- `contract_work_items()` för de fyra kunder som har obeslutade stationer i dag ger fyra `addon_decide`.
- Klicktest i webbläsare som Sofia (koordinator med befogenhet): notis, klick, kartan öppnas på rätt enhet med instruktion, beslut, raden försvinner, kvittens. Som tekniker: ingen notis, ingen remsa.
- Vitest för länkbyggaren (`buildWorkItemLink(kind, ids)`).

**Godkännande.** Ja till spärren separat (den gäller alla kunder), sedan ja till push. Backning: `create or replace` med föregående definition; UI med `git revert`.

**Changelog.** `{ kind: 'nyhet', text: 'Avtalskartan visar en arbetslista: vad som måste göras på kunden, på vilken enhet och vilken knapp man trycker på. Notisen tar dig direkt dit.' }` och `{ kind: 'andring', text: 'Pro rata för tilläggsstationer skapas först när tillägget är beslutat i avtalskartan.' }` Version 3.112.0.

**Omfattning.** Fyra dagar.

**Körd 2026-10-30** (commit `34faba2b`, pushad, 3.112.0): spärren i `sync_addon_prorata_line` är INTE ändrad. Enligt uppdraget gäller spärren bara avtal med `addon_rules = 'v2'`, och den finns redan i version 2 (steg 9, skälet `undecided`); gamla avtal går dagens väg ordagrant. Två migrationer, båda skarpa: `supabase/migrations/20261030_arbetslista_funktion.sql` (MCP-namn `arbetslista_funktion`, provad i transaktion som rullades tillbaka, sedan inlagd: `contract_work_items_internal`, ingen körrätt för klienter) och `supabase/migrations/20261030_arbetslista_avtalskartan.sql` (MCP-namn `arbetslista_avtalskartan`, provad först med testblocket: `contract_work_items` för klienten, `addon_station_set_case`, `addon_coverage_conflict_resolve`, ny `addon_pending_refresh_notifications` som räknar hela listan med titeln "{N} att göra på avtalskartan · {kund}" och första instruktionen som förhandstext, triggrarna `trg_work_items_coverage`, `trg_work_items_conflicts`, `trg_work_items_contract_anchor`, och stationstriggrarna lyssnar också på `placed_case_id` och `addon_contract_mode`). Backning i `20261030_arbetslista_avtalskartan_backning.sql`. TS: ny `src/shared/contractWorkItems.ts` (typer, `buildWorkItemLink`, `parseWorkItemLink`, `addonDecideInstruction`, sortering) med test (10 fall), ny `src/hooks/useContractWorkItems.ts` (singleton som `useAddonPending`, `workItemLinkForCustomer` för notisen), ny `src/components/admin/customers/record/ContractWorkList.tsx` (ersätter remsan i kartan; knappar per uppgift, modaler för Efterskänk, Fakturera igen och Välj ärende), `ContractScopeService.syncProrataAfterDecision` (bara v2), `AddonCoverageService.resolveConflicts`/`setStationCase`, `ContractSettingsDrawer` får `preselectUnitId`, notisklick i `NotificationBell`/`NotificationModal`, sidomenyns plupp, `Customers.tsx` Kräver åtgärd och `CustomerListRow`. Bevis: `scripts/regression/arbetslista.test.sql` (rullas alltid tillbaka, alla OK): i dag 8 `addon_decide`-rader på 4 kunder och 25 stationer, samma kunder och stationsantal som `addon_pending_summary`; Falu i v2 med obeslutade stationer ger ingen pro rata (2 undecided), beslut och sync per ärende ger raden (1 136,32); stängt ärende ger `gap_invoice` 2026-10-27 t.o.m. 2027-06-29; `addon_no_case`, `coverage_cancelled` (INV-202610-0078), `coverage_conflict`, `anchor_verify` och notisen "4 att göra på avtalskartan · Falu kommun"; Sofia läser, väljer ärende, efterskänker och markerar konflikten hanterad; admin utan befogenhet läser men får inte skriva; tekniker (även med is_admin) och koordinator utan befogenhet stoppas; klienter når inte den interna funktionen; anon/public saknar körrätt. `prorata-compare.sql` md5 `0fae6855…` före och efter för både `sync_addon_prorata_line` och `_legacy` (88 anrop). Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 9 (`out/steg10/plan-2026-10-30-7d787536.json`, sha256 `3a4c9455…`, körd före commit; SQL md5 `46f0fd14…`), legacy-matchning 0 skillnader. Klicktest i webbläsare inte gjort. Avvikelser: se strul-dokumentet, steg 10.

### Steg 11. Tilläggsregler version 2 i planeringen

**Syfte.** För avtal med `addon_rules = 'v2'`: tilläggen följer premiens takt, kund utan premie får tilläggen årsvis på avtalets årsdag, en tilläggsfaktura per avtal och referenskod, enhetens namn på varje rad, glappfakturor.

**Ändras.**
- `contractPlanner.ts`: ny `computeAddonPeriods(contract, opts)`:
  - premie månadsvis (`billing_frequency = 'monthly'` och premie > 0): inga egna tilläggsfakturor; tilläggsraderna (månadspris = årspris / 12, oavsett stationens modell) läggs på premieperiodens faktura (`equipmentMode: 'with_premium'` för den här planen).
  - premie kvartal, halvår eller år: egna tilläggsfakturor (kind `equipment`) med premiens perioder; radpris = årspris / periodDivisor. Stationens modell per_year/per_month spelar ingen roll i v2 för beslutade separate-stationer (per kontroll är oförändrat).
  - ingen premie (`annual_value <= 0` och tom trappa): årsperioder från `contract_start_date` exakt dag (avsnitt 4 med steg 12), oavsett `billing_frequency` och `billing_anchor_mode`.
  - § 6-raden tas med i perioden från och med `billing_start_date` (som i dag).
- Märkning: ny ren funktion i `src/shared/addonMarking.ts`:

```ts
export function addonMarkingFor(unit: { billing_reference?: string | null } | null,
                                contract: { invoice_reference?: string | null },
                                root: { billing_reference?: string | null }): string | null {
  return clean(unit?.billing_reference) ?? clean(contract.invoice_reference) ?? clean(root.billing_reference) ?? null
}
export function markingKey(marking: string | null): string { return (marking ?? '').trim().toUpperCase() }
```

  `planEquipmentEntries` (generatorn rad 493 till 539) grupperar periodens tilläggsrader per `markingKey(addonMarkingFor(enhet, avtal, huvudkund))` och gör en planpost per grupp med `marking` och `marking_key`. `loadExisting(..., { kind, markingKey })` filtrerar på `coalesce(marking_key, '')`. Apply skriver `invoices.marking_key`. Enhetens referens läses med kundraden för `site_customer_id` på § 6-raden. Huvudkundens referens följer minnet multisite-enheter-arver-fran-huvudkontor (läs via resolve, aldrig kolumnen rått).
- Radtext: `buildContractInvoiceRows` (`contractInvoiceRows.ts` rad 66 till 84) får `unitName` per rad i v2: `${eq.name}, ${unitName}, tillägg utöver avtal${label}, ${period}, ${qty} st`. Fortnox radtext är högst 50 tecken: `invoiceAddonLines.ts` `buildFortnoxInvoiceRows` delar redan tilläggsrader i rad plus periodtextrad; enhetens namn läggs i textraden under raden när huvudraden annars blir längre än 50 tecken (testas).
- Glappfakturor (`equipment_gap`): generatorn får `planGapEntries(contract)`: för varje beslutad separate-station utan pending pro rata på öppet ärende, `addon_station_gaps(station, från = startdag, till = nästa ordinarie periodstart som saknar låst faktura - 1)`. Glapp grupperas per märkning och slutdatum; en faktura per grupp med `billing_period_start` = tidigaste glappstart, `billing_period_end` = gemensamt slut, rader per stationstyp och enhet med dagar och pris (formeln årspris × dagar / 365), `station_ids` på raden, `line_kind = 'equipment_annual'`. Status `pending_approval`. Notes: "Tilläggsstationer från utsättning till nästa periodstart". Cronen samma i v2-läget.
- `refreshEditableEquipmentInvoices` (cronen rad 568 till 634) och `refreshContractInvoiceBeforeSend` (generatorn rad 547 till 574): hittar planpost via överlapp och märkningsnyckel. Antal = aktiva stationer minus stationer som redan har täckning för perioden.
- `computePlannedPeriods` för månadspremie i v2 får utrustningsraderna med `billing_model` behandlat som per_month.
- Gamla avtal (`addon_rules` NULL): dagens kod ordagrant, inklusive `equipmentInvoiceMode: 'separate'` (generatorn rad 836 till 839) och månadsfakturor per kalendermånad.

**Får inte ändras.** § 4-andelar och premieberäkningen. Inbakade tillägg (`included`, trappsteg addition) rörs inte. `customer_contract_articles` och `case_billing_overrides` rörs inte (faktureringsskillen). Inga krediteringar.

**Bevis.**
- Vitest (`contractPlanner.test.ts`, `contractInvoiceRows.test.ts`, `addonMarking.test.ts`):
  - A1: v2, månadspremie 1 200/år, två stationer à 1 686/år: månadsfakturan 100 + 2 × 140,50.
  - A2: v2, årspremie i juli, station beslutad november: inga månadsfakturor; kind equipment 2027-07-01 med årspris.
  - A3: v2, ingen premie, start 2026-09-23 (Falu): tilläggsperioder 2026-09-23 t.o.m. 2027-09-22, 2027-09-23 t.o.m. 2028-09-22.
  - A4: märkning: WBAB-enhet med kod YX201 och en enhet utan kod på samma avtal med `invoice_reference` "GNU 2026/60": två fakturor, märkta YX201 respektive GNU 2026/60. Enhet utan kod och avtal utan referens: huvudkontorets referens.
  - A5: radtext innehåller enhetens namn; Fortnox-raderna är högst 50 tecken.
  - A6: glapp: låst equipment 2026-07-01 t.o.m. 2027-06-30 utan stationen, station beslutad 2026-11-10, ärendet stängt: en glappfaktura 2026-11-10 t.o.m. 2027-06-30. Nästa planering skapar ingen till (täckning efter sändning).
  - A7: legacy-avtal: samma planer som i baslinjen.
- Regressionsskriptet: identiskt för alla avtal (inget har `addon_rules` satt).
- BEGIN … ROLLBACK: sätt `addon_rules = 'v2'` på en testkund med två enheter, kör planeringen via generatorn i provläge (förhandsvisning i Planera fakturor utan apply), kontrollera två planposter per period.

**Godkännande.** Ja till push. Backning: `git revert`. Inga data ändras.

**Changelog.** Ingen än (inget avtal har v2). Punkten kommer med datasteg 19.

**Omfattning.** Fyra dagar.

**Körd 2026-10-30** (commit `2dd17b7f`, pushad, ingen version, ingen changelog): ny `src/shared/addonMarking.ts` (`addonMarkingFor`, `markingKey`, `markingKeyColumn`, `unitDisplayName`), ny `src/shared/addonPlanV2.ts` (takten `addonCadence`: månadspremie på premiefakturan, kvartal/halvår/år med premiens perioder, ingen premie eller premie utan intervall årsvis på exakta årsdagen; `computeAddonPlanV2` med en grupp per märkning; `decorateV2Period` med enhetens namn och antal minus stationer som har täckning för hela perioden; `existingByMarkingGroup`; `planGapGroups` och `buildGapDiff` för `equipment_gap`), ny `src/shared/addonV2Loader.ts` (läser enheter, täckning och glapp med anroparens klient). `contractPlanner.ts`: typen `equipment_gap`, valfria v2-fält på raderna och snäppregeln för exakt läge (FEV-fyndet). `contractInvoiceRows.ts`: v2-radtext och glapprader; `invoiceAddonLines.ts`: `splitFortnoxAddonText` och `splitAddonRows` (högst 50 tecken, bara v2). Generatorn (`premiumPeriodsFor`, `loadAddonV2`, `planEquipmentEntriesV2`, apply skriver `marking_key` och raderar v2-utkast först, `refreshContractInvoiceBeforeSend` ger `splitAddonRows`), cronen (`planContractV2`, `createGapInvoices`, märkning i `createPerContract` och `refreshEditableEquipmentInvoices`), Fortnox-sändningen i `InvoiceDetailModal` och förhandsvisningens etikett. Tre migrationer, alla skarpa efter prov i transaktion som rullades tillbaka: `20261030_tillaggsregler_v2_funktioner.sql` (`addon_contract_has_premium`, `contract_addon_next_period_start`, `addon_marking_key_for_unit`, `addon_gap_candidates`, `invoice_marking_split_ready`), `20261030_tillaggsregler_v2_vakt.sql` (`addon_prorata_v2_end` med tilläggens takt och märkning, `guard_contract_invoice_overlap` och triggern med `marking_key`, vyn `contract_invoice_overlaps`), `20261030_tillaggsregler_v2_arbetslista.sql` (glappraden läser `addon_gap_candidates` och säger att fakturan väntar på databasändringen). Backning `20261030_tillaggsregler_v2_vakt_backning.sql`. Bevis: vitest (A1 till A6 i `addonPlanV2.test.ts`, A4 i `addonMarking.test.ts`, A5 i `contractInvoiceRows.test.ts` och `invoiceAddonLines.test.ts`, snäppregeln och A7 i `contractPlanner.test.ts`); `tillaggsregler-v2.test.sql` alla OK; `prorata-compare.sql` md5 `0fae6855…` oförändrad för båda funktionerna; arbetslistan i dag identisk före och efter (8 rader). Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 10 (`out/steg11/plan-2026-10-30-34faba2b.json`, sha256 `8c7fef3b…`, körd före commit; SQL md5 `46f0fd14…`), legacy-matchning 0 skillnader, vaktstopp 0; lokal torrkörning av cronen med fetch-spärr: 0/0 och v2 samma två poster som steg 4, 0 skrivförsök. Prov i minnet: `out/steg11/addon-v2-prov-2026-10-30*.json`. De tre drop-raderna från steg 5 är fortfarande INTE körda. Avvikelser: se strul-dokumentet, steg 11.

**Steg 0 till faktureringsgrupper, körd 2026-11-03 (3.116.0).** Två regler i v2 (Christians beslut för Maserfrakt, alternativ a):
1. Takt per § 6-rad, `addonCadenceFor(line, contract, steps)` i `addonPlanV2.ts`: en rad per månad faktureras på egna månadsfakturor (kind `equipment_monthly`, `computePlannedMonthlyEquipmentPeriods`) oavsett premiens takt; vid månadspremie ligger den kvar på premiefakturan som förut. Rader per år följer `addonCadence` oförändrat. `AddonPlanV2` har nya fälten `monthlyLines` och `monthly`. Generatorn (`planEquipmentEntriesV2`) diffar `equipment_monthly` mot planen (keep, update, create, delete på utkast, låsta lämnas) i stället för att radera allt; cronen (`planContractV2`) lägger månadsperioderna i `equipmentPeriods` utan märkningsnyckel och skapar och uppdaterar dem som gamla reglernas månadsfakturor. SQL: `contract_addon_next_period_start(uuid, date, text)` med stationens modell (per månad: nästa månadsstart, i exakt läge räknad från avtalsdagen), tvåparametersvarianten ger samma svar som förut, och `addon_prorata_v2_end` läser stationens modell, så pro rata och glappen räknar till nästa månadsstart för stationer per månad. Migration `20261103_tillagg_manadstakt.sql`.
2. Delvis täckning, `decorateV2Period` och `stationUncoveredSpan`: en station med täckning för en del av perioden faktureras för de otäckta dagarna på egen rad, à-pris = periodens pris × otäckta dagar / periodens dagar (öre), raden bär `billed_period` och radtexten visar den perioden (`v2AddonRowName`). Gäller årsfakturor, månadsfakturor och månadspremien.

Bevis: vitest (`addonPlanV2.test.ts`, Maserfrakt: 980 per månad från 2026-12-01, 2 850 × 204 / 366 = 1 588,52 per ljusfälla 2027-03-01, 16 av 31 dagar i en delvis täckt december), `tillaggsregler-v2.test.sql` T5 och `prorata-v2.test.sql` T14 alla OK, `prorata-compare.sql` md5 oförändrad (efa3bf92… och 94a0a181…). Regression `out/steg0/fore` och `out/steg0/efter` (`--today=2026-11-03`): plan sha256 `1c5c46f2…` och SQL `890bfbd7…` identiska; cronens torrkörning sju datum och cron-vs-plan fem datum: bara Maserfrakt 4c40f714 ändrat (glappfakturan 2 899,72 borta, 980 per månad, ljusfällorna 3 177,04 i stället för 17 460); FEV, WBAB och Falu identiska, också i `addon-v2-prov.mts`.

Inför faktureringsgrupper: takten avgörs i `addonCadenceFor` (TS) och `contract_addon_next_period_start(…, p_billing_model)` (SQL), som båda ska ta gruppen i stället för bara modellen; `computeAddonPlanV2` delar raderna efter takten och behöver en grupp per takt och märkning; `planEquipmentEntriesV2` och `planContractV2` diffar respektive skapar per kind; `addon_prorata_v2_end` hämtar stationens modell och behöver stationens grupp; `TillaggRegler.tsx` beskriver reglerna för personalen.

**Steg 0b. Faktureringsgrupper (alternativ B), körd 2026-11-03 (3.117.0).** Ett v2-avtal kan ha egna faktureringsgrupper för tilläggen. Grupp NULL är exakt reglerna ovan (steg 11 och steg 0); legacy-avtal rörs inte.

- Datamodell (`20261103_faktureringsgrupper.sql`, `20261103_faktureringsgrupper_rader.sql`): tabellen `contract_addon_billing_groups` (`contract_id`, `name`, `cadence` i follows_premium, monthly, quarterly, semi_annual, annual, `anchor_date` NULL = avtalsdagen, i gamla läget premiens månadsankare, `marking` NULL = dagens märkningsregel, `created_at`, `updated_at`, `created_by`), RLS: läs för interna (`intranet_is_internal`), skriv för admin och koordinator (`addon_billing_group_can_write`), inget för anon. Kolumnen `addon_billing_group_id` (NULL, on delete set null) på `equipment_placements`, `indoor_stations`, `case_billing_items` och `invoices`. Nya unika index med gruppen: `invoices_contract_period_group_key` och `cbi_addon_period_line_group_key`.
- Gruppen är § 6-radens. En station utan egen grupp ärver radens (`addon_line_group_for_key`, `addon_station_billing_group`). Så länge `cbi_addon_period_line_key` finns kan en rad inte delas: `set_addon_station_billing_group` flyttar hela raden när alla dess stationer flyttas och stoppar annars med beskedet "Enheten har fler stationer av samma typ på samma tilläggsrad. Byt grupp på hela raden under Faktureringsgrupper i avtalskartan." `set_addon_line_billing_group` byter grupp på raden och stationerna bakom den.
- Takten: `contract_addon_next_period_start(avtal, från, modell, grupp)` (fyra parametrar; utan grupp eller med följer premien samma svar som trepartsvarianten) och TS-tvillingen `groupNextPeriodStart` i `src/shared/addonBillingGroups.ts`. Månad, kvartal, halvår och år räknas med exakt dag från gruppens startdag (`contract_addon_billing_group_anchor`, `billingGroupAnchor`). `addon_prorata_v2_end` läser stationens grupp (takt, märkning och bara gruppens låsta fakturor), så pro rata, `sync_addon_prorata_line` och glappen (`addon_gap_candidates`, gruppens märkning och bara gruppens öppna utkast) räknar till gruppens nästa periodstart. `trg_invoice_locked_coverage` är oförändrad: täckningen skrivs per station oavsett grupp.
- Planeringen: `computeAddonPlanV2` lägger rader med grupp i `groupBuckets` (en hink per grupp, fakturatyp och märkning; `equipment` för kvartal, halvår, år och följer premien, `equipment_monthly` för månad; vid månadspremie ligger följer premien kvar på premiefakturan). Radens startdag snäpps bakåt till gruppens period, täckta dagar dras av per station som i steg 0, och perioder som börjar före dagen gruppen skapades tas inte med. Generatorn (`planEquipmentEntriesV2`) diffar varje hink mot fakturorna med samma grupp (fakturor utan grupp går den vanliga vägen), skriver `invoices.addon_billing_group_id`, och nattjobbet (`planContractV2`, `createPerContract`, `refreshEditableEquipmentInvoices`, `createGapInvoices`) matchar på samma sätt.
- Gamla unika indexet: så länge `invoices_contract_period_marking_key` finns (`invoice_group_split_ready()` falsk) kan två grupper inte ha en tilläggsfaktura med samma typ, periodstart och märkning. `blockedGroupSlots` (samma kod i generatorn och nattjobbet) håller då tillbaka gruppens faktura (Planera fakturor visar den som Senare med skälet), aldrig fakturorna utan grupp. Egen märkning eller egen startdag på gruppen undviker krocken.
- Gränssnitt: `AddonBillingGroupsPanel` i panelens grupp Innehåll och utrustning (skapa, ändra, ta bort grupper och välj grupp per tilläggsrad), gruppval i `AddonDropPrompt` (Besluta tillägg, Tillägg utöver avtalet), gruppens namn i Planera fakturor (`BillingPlanPreviewModal`) och i fakturan under Fakturering (`InvoiceDetailModal`). Guiden: `TillaggRegler.tsx` (valet Faktureringsgrupp) och Bra att veta i guide-tillaggsstationer-fakturering (version 3).
- Bevis: vitest `addonBillingGroups.test.ts` (Maserfrakt med en månadsgrupp och en kvartalsgrupp, startdag och nästa periodstart, täckning per grupp, krock med gamla indexet, glapp per grupp, pro rata-spegeln), `scripts/regression/faktureringsgrupper.test.sql` (rullas tillbaka), `addon-v2-prov.mts --grupper=prov`. Regression `out/grupper/fore` och `out/grupper/efter` (`--today=2026-11-03`), se README.
- Drop-raderna som Christian kör själv: `drop index if exists public.cbi_addon_period_line_key;` och `drop index if exists public.invoices_contract_period_marking_key;`. Därefter kan en rad delas mellan grupper och två grupper ha fakturor för samma period och märkning.

### Steg 12. Gränssnittet

**Syfte.** Avtalsdagen, tilläggsreglerna, täckningen och ärendefaktureringen syns och går att ändra där man arbetar.

**Ändras.**
- `ContractSettingsDrawer.tsx`, grupp `fakturering`: "Avtalsår" med två val, "Följer avtalsdagen ({dag månad})" eller "Börjar den 1:a (som tidigare)". Byte till avtalsdagen kräver att startdatumet markeras som kontrollerat mot Oneflow (fyller `billing_anchor_verified_at/by/note`). Under valet en förhandsvisning: nästa tre perioder och vad som händer med utkasten ("Utkast INV-… får datumen 2026-11-25 t.o.m. 2027-11-24. Skickade fakturor ändras inte."). Samma grupp: "Tilläggsregler" med "Följer premien" (v2) eller "Som tidigare". Skrivning via ny `ContractScopeService.setBillingAnchorMode(contractId, mode, note)` och `setAddonRules(contractId, rules)` som därefter kör Planera fakturor i förhandsvisning och visar diffen innan apply.
- Pappret § 7 (`ContractPremiumSection.tsx`): `premiumSummary` och `nextInvoicePeriodStart` (rad 56 till 97, nyckeln `-01` rad 84, rad 176) använder `nextPeriodStart` ur `contractPeriods.ts`. Raden visar "faktureras årsvis · avtalsdag 30 juni" i exakt läge, annars som i dag.
- `CustomerContractPaper.tsx` rad 177 och `contract_customer_view`: "faktureras på avtalsdagen 30 juni" i exakt läge (kundens vy).
- `contractCompleteness.ts` rad 110: i exakt läge krävs `contract_start_date` i stället för ankarmånad.
- `contractReview.ts`: `ReviewSnapshot` får `billing_anchor_mode` och `addon_rules`; `reviewState` (rad 256 till 300) listar byte ("Avtalsåret ändrades till avtalsdagen"); `reviewChecklist` rad 344 till 350 skriver "Fakturaperioden följer avtalsdagen, 30 juni till 29 juni" i exakt läge.
- `ImportCustomerByOrgnrModal.tsx` rad 149 och `ImportCustomerByPdfModal.tsx` rad 170: `getNextBillingDates` ersätts med `computePlannedPeriods` på förhandsvisningens fält (legacy, eftersom importen inte sätter läget).
- `contractAdditionService.ts` rad 136 till 146: syntetiserad nästa period via `nextPeriodStart`.
- Täckningspanel: i § 6-panelen per enhet en lista per station "Betald t.o.m. {datum} · {källa} {referens}", med knapparna "Registrera Fortnox-faktura" och "Efterskänk" (bara `can_approve_invoices`). Ny komponent `src/components/admin/customers/record/AddonCoveragePanel.tsx`. Ingen pill, platt text med statuspunkt (minnet ui-inga-piller).
- Avropskunder: `customers.adhoc_invoice_grouping` visas på kundkortet (fliken Fakturering, raden "Ärenden faktureras: per ärende / samlat per månad") och på avtalskartan för avrop (§ 7 på pappret visar raden, panelens grupp `fakturering` har valet). Skrivning via befintlig väg i `BillingSettingsModal` (rad 479) bruten ut till `CustomerBillingService.setAdhocGrouping(customerId, value)`.
- Fakturalistan (`PrivateBusinessInvoicing.tsx`): typetikett "Tillägg från utsättning" för `equipment_gap`; märkningen syns i raden.

**Får inte ändras.** Pappret är bara läsning, inga formulär på pappret (minnet avtalskartan-tre-lager). Modaler utan `Card` (minnet modal-design-standard). Kugghjul bara när `onOpenSettings` finns.

**Bevis.**
- Vitest för `reviewState` med nya fält och för förhandsvisningstexten.
- Klicktest i webbläsare (koordinator med befogenhet): byt avtalsår på testkund, se förhandsvisningen, avbryt, inget ändrat i databasen. Som tekniker: inga kugghjul. Kundportalen: kundens avtalsvy visar avtalsdagen.
- Skärmbild av § 7 före och efter för ett legacy-avtal: identisk.

**Godkännande.** Ja till push. Backning: `git revert`.

**Changelog.** `{ kind: 'nyhet', text: 'I avtalskartan kan avtalsåret följa avtalsdagen, till exempel 30 juni till 29 juni, i stället för den 1:a. Du ser vilka utkast som får nya datum innan du sparar.' }`, `{ kind: 'nyhet', text: 'Varje tilläggsstation visar betald till och med, även för manuella Fortnox-fakturor och efterskänkta debiteringar.' }`, `{ kind: 'andring', text: 'Kundkortet och avtalskartan visar om ärenden faktureras per ärende eller samlat per månad.' }` Version 3.113.0.

**Omfattning.** Fyra dagar.

**Körd 2026-10-30** (commit `31c8c9ab`, pushad, 3.113.0): migration `supabase/migrations/20261030_avtalsar_granssnitt.sql` (MCP-namn `avtalsar_granssnitt`) körd skarpt efter prov i transaktion som rullades tillbaka: `contract_customer_view` rättad (`pli.price` blir `pli.custom_price`, befintligt prodfel) och premien får `billing_anchor_mode` och `anchor_day`; nya RPC:er `contract_set_billing_anchor_mode(uuid, text, text)` och `contract_set_addon_rules(uuid, text)` (SECURITY DEFINER, `addon_coverage_approver()` alltså `can_approve_invoices`, loggar i `contract_events`, `verified_by` = profiles.id, startdatumet läggs i `framework_overrides` när avtalet har ramavtal); ny vakt `contract_billing_mode_guard` (BEFORE UPDATE på contracts). Backning `20261030_avtalsar_granssnitt_backning.sql`. TS: ny `ContractBillingModePanel.tsx` (panelens grupp Fakturering: Avtalsår med kontrollmarkering och förhandsvisning, Tilläggsregler med förhandsvisning, Ärenden faktureras för avrop), ny `AddonCoveragePanel.tsx` (grupp Innehåll och utrustning), ny `AdhocGroupingRow.tsx` (kundkortets flik Fakturering), ny `src/services/customerBillingService.ts`, ny `src/shared/contractAnchorPreview.ts` (`describePlanChange`, `upcomingPeriods`), ny `src/shared/importBillingPreview.ts`; `ContractScopeService.setBillingAnchorMode/setAddonRules/previewBillingModeChange`; § 6 (`nextInvoicePeriodStart` och faktureringsraden), `CustomerContractPaper`, `contractCompleteness`, `contractReview` (bild, läge, checklista), `contractReviewService`, `contractAdditionService`, importmodalerna, fakturalistan, `BillingChainSection` och `PlannedInvoicePreviewModal` (etikett för `equipment_gap`). Inget befintligt avtal har fått värden (0 rader med läge, regler eller kontrollmarkering efter migrationen). Bevis: `scripts/regression/avtalsar-granssnitt.test.sql` T1 till T10 alla ok före och efter skarp migration (kund läser avtalsbladet, kund, tekniker och admin utan befogenhet stoppas, säljare med skrivrätt stoppas av vakten men vanliga fält passerar, Sofia sätter avtalsdagen på ramavtalsavtalet 5c00b63c med anteckning, override och logg, kundvyn visar anchor_day 2026-06-30 och next_invoice 2027-06-30, ramavtalets ändrade startdatum når syskonet men inte det kontrollerade avtalet, ändrat startdatum tar bort markeringen och ger anchor_verify, tillbaka till den 1:a, spärren på igen efter RPC:n, SQL-editorn passerar, körrätt); kundvyn ger 17 priser för avtal med prislista. Vitest: `contractAnchorPreview.test.ts` (6), `importBillingPreview.test.ts` (3), `contractReview.test.ts` 5 nya (587 totalt, grönt). Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 11 (`out/steg12/plan-2026-10-30-2dd17b7f.json`, sha256 `10e041c5…`, körd före commit; SQL md5 `46f0fd14…`), legacy-matchning 0 skillnader, vaktstopp 0. Klicktest i webbläsare och skärmbild av § 7 före och efter inte gjorda. Avvikelser: se strul-dokumentet, steg 12.

### Steg 13. Ingen tyst månadsfakturering

**Syfte.** Ta bort `'monthly'` som tyst standard. Ett faktureringsintervall är ett aktivt val eller tomt.

**Ändras.**
- Migration: `alter table public.customers alter column billing_frequency set default null;` (ingen drop, går genom MCP).
- `CreateCustomerManuallyModal.tsx` rad 74: startvärde `null`; fältet obligatoriskt bara när kunden får premie; rad 209 skriver `null` annars. Valet "Inget intervall (avrop eller per ärende)".
- `BillingSettingsModal.tsx` rad 165: `useState<BillingFrequency | null>(null)`; rad 490 skriver bara när användaren valt.
- `caseCustomerService.ts` rad 103 till 110: insert med `billing_frequency: null` uttryckligen.
- `api/_lib/contractSigning.ts` kundinserten (rad 701 till 702): `billing_frequency: str(contract.billing_frequency)` (null när avtalet saknar intervall).
- `contractScopeService.ts` rad 387: materialiseringen ärver kundradens frekvens bara när kunden har premie (`annual_value > 0`) och avtalet inte är avrop; annars `null`. Kompletthetsraden flaggar "Kontrollera faktureringsintervall" när värdet ärvts.
- `refresh_customer_contract_terms` rörs inte (den speglar avtal till kund, inte tvärtom).

**Får inte ändras.** Befintliga kundrader (182 med monthly) ändras inte här; städningen är datasteg 20. `detectServiceFrequency` i signeringen (rad 167 till 178) gäller besöksfrekvens, inte fakturering, och rörs inte.

**Bevis.**
- BEGIN … ROLLBACK: insert av kund utan fältet ger NULL.
- Vitest för materialiseringsregeln.
- Synth-kunder: regressionsskriptet visar att inga planer ändras (befintliga rader orörda).

**Godkännande.** Ja till migrationen och push. Backning: `alter table public.customers alter column billing_frequency set default 'monthly';` och `git revert`.

**Changelog.** `{ kind: 'andring', text: 'Nya kunder får inget faktureringsintervall förrän någon väljer ett. Tidigare blev det månadsvis utan att det syntes.' }` Version 3.113.0 (samma leverans som steg 12 om de går ut samma dag, annars 3.114.0).

**Omfattning.** En dag.

**Körd 2026-10-30** (commit `62f15809`, pushad, punkt i 3.113.0): migration `supabase/migrations/20261030_ingen_tyst_manadsfakturering.sql` (MCP-namn `ingen_tyst_manadsfakturering`) körd skarpt efter prov i transaktion som rullades tillbaka: `customers.billing_frequency` har inget standardvärde (NULL), ny kolumn `contracts.billing_frequency_needs_check boolean not null default false` (0 avtal markerade efter migrationen). Backning `20261030_ingen_tyst_manadsfakturering_backning.sql` (set default 'monthly'; kolumnen tas bort av Christian om den ska bort). Bevis i transaktionen: kund insatt utan fältet fick NULL; efter skarp körning ingen kundrad med NULL (fördelningen orörd). Kod: ny `src/shared/billingFrequencyDefault.ts` (`materializedBillingFrequency`, regeln med beslutet årsvis är standard) med test (5 fall); materialiseringen i `ContractScopeService` (avrop: inget intervall; premie: kundradens intervall eller årsvis, markeras för kontroll; ingen premie: årsvis) och `setPremium` släcker markeringen; kompletthetsraden "Kontrollera faktureringsintervall" (varning, försvinner när § 6 sparas eller avtalet är Kontrollerat); `CreateCustomerManuallyModal` (startvärde tomt, valet "Inget intervall (avrop eller per ärende)", Årsvis förifylls när årspremie anges och krävs då); `BillingSettingsModal` (tomt värde, Årsvis visas för kund med premie, skrivs bara när värdet ändras); `caseCustomerService` (uttryckligen NULL); signeringens kundinsert (avtalets intervall, annars årsvis vid premie); dessutom `AddContractCustomerModal`, `AddXpertContractCustomerModal`, `api/create-customer.ts` och `MultisiteRegistrationWizard` (huvudkontoret) som annars hade gått från tyst månadsvis till NULL trots premie. Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 12 (`out/steg13/plan-2026-10-30-31c8c9ab.json`, sha256 `07cb2e83…`, körd före commit; SQL md5 `46f0fd14…`), legacy-matchning 0 skillnader, vaktstopp 0. Avvikelser: se strul-dokumentet, steg 13.

### Steg 14. Cronen version 2 skarpt

**Syfte.** Automatiken tar med alla avtal oavsett slutdatum och frekvens och matchar på överlapp.

**Förutsättning.** Minst två nätters torrkörning efter steg 7 och 11 där Christian gått igenom `would_create` och `would_refresh`.

**Ändras.** Vercel-variabeln `CONTINUING_CONTRACTS_V2=1` (Christians ja krävs separat, minnet feedback_godkann_varje_steg). Torrkörningsposten i `vercel.json` ligger kvar en vecka och tas sedan bort.

**Får inte ändras.** Cronen skapar fortfarande bara och uppdaterar bara utrustningsrader på redigerbara fakturor. Inga passerade perioder skapas (`!p.isHistorical`).

**Bevis.** Första skarpa natten: antal skapade = torrkörningens `would_create` kvällen innan. `contract_invoice_overlaps` får inga nya par. Inga triggerfel i `cron_runs`.

**Godkännande.** Ja till variabeln. Backning: ta bort variabeln (nästa natt går gamla vägen).

**Changelog.** `{ kind: 'andring', text: 'Nattkörningen skapar nu fakturor för alla avtal, även fleråriga och de som saknade intervall. Den räknar perioder på datum i stället för på månad, så samma period kan inte faktureras två gånger.' }` Version 3.114.0.

**Omfattning.** En timme plus uppföljning.

### Steg 15. Nya avtal får avtalsdag och nya tilläggsregler från början

**Syfte.** Avtal som signeras efter go live följer besluten utan att någon behöver slå på dem.

**Ändras.**
- `api/_lib/contractSigning.ts`: vid skapande av avtalsraden sätts `billing_anchor_mode = 'start_day'`, `billing_anchor_verified_at = now()`, `billing_anchor_verified_note = 'Startdatum ur Oneflow vid signering'`, `addon_rules = 'v2'`.
- `src/shared/contractSigning.ts` `deriveMapSetup` (rad 331 till 345): sätter inte längre `billing_anchor_month` när läget är exakt (fältet är då inte i bruk); `missing` får inte "fakturamånad".
- Manuellt skapade avtal i kartan (`ContractScopeService` skapa avtal) får samma två fält med valet förifyllt men synligt.

**Får inte ändras.** Signerade avtal före go live. Importflödena (de har inte Oneflow-startdatum som säker källa).

**Bevis.** Provkörning av signeringen (`ctx.dryRun`, finns redan) på ett testavtal: rapporten visar de nya fälten och perioderna från startdagen. Vitest för `deriveMapSetup`.

**Godkännande.** Ja till push. Backning: `git revert`; avtal som hunnit signeras behåller sina värden (rätt enligt besluten) eller nollställs i datasteg.

**Changelog.** `{ kind: 'andring', text: 'Nya avtal faktureras från avtalsdagen och tilläggsstationerna följer premiens takt från början.' }` Version 3.115.0.

**Omfattning.** En halv dag.

**Körd 2026-10-30** (commit `6a7861b7`, pushad, 3.114.0 eftersom steg 14 inte är gjort): signeringen (`processSignedContract`, ny `applyNewContractRules` efter kundsteget och före kartan och fakturaplanen) sätter `billing_anchor_mode = 'start_day'`, `billing_anchor_verified_at = now()`, `billing_anchor_verified_note = 'Startdatum ur Oneflow vid signering'` och `addon_rules = 'v2'` på avtal signerade från och med `NEW_CONTRACT_RULES_FROM` = 2026-10-30, loggar en händelse i `contract_events` och lägger `contract_start_date` i `framework_overrides` när avtalet har ramavtal. Regeln är ren (`newContractBillingRules` i `src/shared/contractSigning.ts`): aldrig avtal signerade före dagen, aldrig avtal som redan har något av fälten, låsta fakturor eller ett val i kartan (händelserna Avtalsår/Tilläggsregler), avtalsdag bara när startdatum finns, `v2` bara när `contract_default_addon_rules` säger det. `deriveMapSetup` sätter ingen fakturamånad i exakt läge. Tomt avtalsblad i kartan (`createBlankContract`) får `start_day` och `v2` enligt samma funktion, utan kontrollmarkering; toasten och händelsen säger det. Migration `supabase/migrations/20261030_nya_avtal_avtalsdag.sql` (MCP-namn `nya_avtal_avtalsdag`) körd skarpt efter prov i transaktion som rullades tillbaka: `contract_default_addon_rules(uuid, uuid)` (inloggad kräver intern, ingen körrätt för anon) och vakten `contract_billing_mode_insert_guard` (BEFORE INSERT). Backning `20261030_nya_avtal_avtalsdag_backning.sql` (drop, körs av Christian). Bevis: `scripts/regression/nya-avtal-avtalsdag.test.sql` T1 till T8 alla OK (ny kund v2, FEV NULL, service role skriver fälten och perioden blir 2026-11-17 t.o.m. 2027-11-16, Sofia skapar tomt avtal med start_day och v2, kontrollmarkering vid insert stoppas, v2 på FEV stoppas, start_day utan v2 på FEV går, update förbi RPC stoppas fortfarande, 0 befintliga avtal med fälten); vitest 8 nya fall i `contractSigning.test.ts` (600 totalt, grönt); `scripts/regression/signering-steg15-prov.mts` kör signeringen i provläge på de fem avtal som väntar på signering i Oneflow (status signed i minnet, fetch-spärr, 0 skrivförsök): Basmo, Europeiska Motor och DEMO ABBBB får start_day och v2 och årsfakturor från avtalsdagen (till exempel 2026-11-06 t.o.m. 2027-11-05), båda Heimstaden Maria 5 får start_day men inte v2 (kunden har ett levande avtal med gamla regler), ingen fakturamånad sätts (`out/steg15/signering-prov-2026-10-30.json`). Regression: plan och SQL identiska med baslinjen f19104e1 och med steg 13 (`out/steg15/plan-2026-10-30-62f15809.json`, sha256 `bba41dd4…`, körd före commit; SQL md5 `46f0fd14…`), legacy-matchning 0 skillnader, vaktstopp 0. 0 avtal har fälten efter migrationen. Avvikelser: se strul-dokumentet, steg 15.

### Datasteg 16 till 21 (ett ja per steg, och per kund där det står)

Alla datasteg körs som en SQL-fil med en BEGIN, en kontrollfråga före, ändringen, kontrollfrågan efter och sedan COMMIT först när utfallet stämmer med listan i datadokumentet. Före varje steg sparas en dump av berörda rader (`select ... into` en tabell `backup_<steg>_<datum>` eller som JSON i repot). Regressionsskriptet körs före och efter; de enda skillnaderna som får synas är de avtal steget avser.

**Steg 16. Täckning för det som redan är fakturerat.** Skriver `backfill`-rader från låsta tilläggsfakturor med `station_ids` och från billed pro rata-rader där stationerna kan härledas entydigt (enhet, typ, `addon_marked_at` mellan ärendets skapande och radens fakturering). Allt som inte är entydigt listas i datadokumentet, inget gissas. Godkännande: Christian ser listan per kund. Backning: `update addon_station_coverage set released_at = now(), release_reason = 'backning steg 16' where source = 'backfill'`.

**Steg 17. Manuella Fortnox-fakturor och efterskänkt.** FEV 648, 744, 745, 862, 1058 och Falu 946 som `fortnox_manual` på de stationer och perioder datadokumentet anger (648 och 1058 är olika stationer enligt Christian 2026-10-30). WBAB YX201: de tio makulerade pro rata-fakturorna blir `waived` med anteckning "Avsiktligt makulerad, faktureras inte igen (beslut 2026-10-30)". Via RPC:erna, inte rå insert. Backning: `addon_coverage_release` med orsak.

**Steg 18. Exakt avtalsdag per verifierat avtal.** Från datadokumentets lista (startdatum kontrollerat mot Oneflow-PDF). En kund i taget: sätt läget via kartans val (steg 12) eller RPC, kör Planera fakturor i förhandsvisning, visa Christian diffen (vilka utkast får nya datum), apply efter ja. Skickade fakturor rörs aldrig. Börja med de åtta överlappande paren (där är resultatet att utkastet flyttas till avtalsdagen och överlappet försvinner). Backning per avtal: sätt läget till NULL och planera om (utkasten flyttas tillbaka till den 1:a; överlappsvakten stoppar om något blivit fel).

**Steg 19. Nya tilläggsregler och ärendekoppling för befintliga stationer.** Per avtal (FEV, WBAB, Falu först): `addon_rules = 'v2'` och `placed_case_id` på stationer där ärendet är entydigt. Förhandsvisa tilläggsfakturorna (märkning per enhet, glappfakturor) innan apply. Changelog när första avtalet slås på: `{ kind: 'andring', text: 'Tilläggsfakturor delas per enhetens referenskod och varje rad visar vilken enhet stationerna står på.' }` Backning: `addon_rules = null`, planera om.

**Steg 20. Faktureringsintervall på kundrader och avtal.** De 182 kundraderna med monthly som saknar månadspremie: listan i datadokumentet, `billing_frequency = null` efter ja. Avtal med fel intervall (Falu 23a115e3, Steninge, Thailaan och de övriga ungefär 13) rättas enligt datadokumentets beslut; Steninge och Thailaan har 86 månadsutkast (144 492 kr) som ska bort först (de faktureras årsvis i Fortnox). Backning: dump före.

**Steg 21. De åtta överlappande paren.** Det som återstår efter steg 18 (om ett avtal inte kan verifieras): Christian väljer per par mellan att radera utkastet och planera om, eller låta det stå. Inget raderas utan ja.

## 8. Matris fil och funktion mot steg

| Fil eller objekt | Steg |
|---|---|
| `scripts/regression/plan-dump.mts`, `sql-dump.sql`, `compare.mjs`, `periods-twin.mts` (nya) | 1, 6 |
| `src/shared/contractInvoiceMatch.ts` + test (nya) | 2, 7 |
| `src/shared/contractPeriods.ts` + test (nya) | 6 |
| `src/shared/contractPlanner.ts`: `PlanningContract`, `computePlannedPeriods`, `computePlannedMonthlyEquipmentPeriods`, ny `computeAddonPeriods` | 6, 11 |
| `src/shared/contractInvoiceRows.ts` `buildContractInvoiceRows` | 11 |
| `src/shared/addonMarking.ts`, `src/shared/addonProrata.ts` (nya) | 9, 11 |
| `src/shared/invoiceAddonLines.ts` `buildFortnoxInvoiceRows` | 11 |
| `src/shared/contractSigning.ts` `deriveMapSetup` | 15 |
| `src/shared/contractReview.ts` | 12 |
| `src/services/contractInvoiceGenerator.ts`: `buildDiff`, `loadExisting`, `loadConsolidatedPeriodsForContract`, `planForContract`, `planEquipmentEntries`, `planConsolidatedForCustomer`, `refreshContractInvoiceBeforeSend`, apply (marking_key), ny `planGapEntries` | 2, 7, 11 |
| `src/services/contractService.ts` urval och typ | 5 |
| `src/services/contractScopeService.ts`: materialisering rad 387, `addAddonStationsSeparate`, nya `setBillingAnchorMode`, `setAddonRules` | 10, 12, 13 |
| `src/services/addonStationBillingService.ts` `syncAfterStationChange`, `getPaidThrough` | 8, 9 |
| `src/services/addonCoverageService.ts` (ny) | 8, 12 |
| `src/services/contractAdditionService.ts` rad 136 till 160 | 7, 12 |
| `src/services/equipmentService.ts` `createEquipment`, `src/services/indoorStationService.ts` | 9 |
| `src/services/caseCustomerService.ts` rad 103 till 110 | 13 |
| `src/types/database.ts`, `src/types/addonStations.ts` | 5, 8 |
| `src/hooks/useAddonPending.ts` (blir `useContractWorkItems`) | 10 |
| `src/components/admin/customers/record/ContractMapSection.tsx` remsan, ny `ContractWorkList.tsx` | 10 |
| `ContractSettingsDrawer.tsx`, `ContractPremiumSection.tsx`, `contractCompleteness.ts`, ny `AddonCoveragePanel.tsx` | 12 |
| `src/components/shared/CustomerContractPaper.tsx` | 12 |
| `ImportCustomerByOrgnrModal.tsx`, `ImportCustomerByPdfModal.tsx` | 12 |
| `BillingSettingsModal.tsx`, `CreateCustomerManuallyModal.tsx` | 12, 13 |
| `src/pages/admin/Customers.tsx` `requiresAction`, `NotificationModal`, `NotificationBell` | 10 |
| `PrivateBusinessInvoicing.tsx`, `InvoiceDetailModal.tsx` (glapptyp, märkning) | 11, 12 |
| Utsättningsflöden: `useEtableringsflode.ts`, `TechnicianEquipment.tsx`, `StationInspectionModule.tsx`, `StationInspectionPanel.tsx`, `AddStationWizard.tsx`, `CustomerStationsModal.tsx`, `StationArk.tsx`, `NyKundStationer.tsx`, `IndoorEquipmentView.tsx` | 9 |
| `api/cron/generate-continuing-contracts.ts` | 2, 4, 7, 11, 14 |
| `api/_lib/contractSigning.ts` `planInvoices`, kundinsert | 2, 7, 13, 15 |
| `vercel.json` (torrkörningsposten) | 4, 14 |
| SQL: `guard_contract_invoice_overlap`, trigger, vy `contract_invoice_overlaps` | 3 |
| SQL: kolumner, index, tabell `addon_station_coverage`, kind-check | 5 |
| SQL: `contract_period_on`, `contract_period_on_pure`, `contract_next_period_start(uuid,date)`, `contract_next_unplanned_period`, `contract_customer_view` | 6 |
| SQL: täckningstriggers, `addon_coverage_*`, `addon_station_gaps`, `addon_station_paid_through`, `addon_coverage_conflicts` | 8 |
| SQL: `trg_station_placed_case`, `sync_addon_prorata_line` | 9, 10 |
| SQL: `contract_work_items`, `addon_pending_refresh_notifications` | 10 |
| SQL: `customers.billing_frequency` default | 13 |
| Guider: `guide-tillaggsstationer-fakturering.tsx`, `TillaggKedja.tsx` (uppdateras efter guidemallen) | 10, 12 |
| `src/constants/changelog.ts` | 3, 9, 10, 12, 13, 14, 15, 19 |

## 9. Cron-jobb och hur de påverkas

| Jobb | Schema (UTC) | Påverkan |
|---|---|---|
| `generate-continuing-contracts` | 03:00 | Steg 2 refaktor, steg 4 torrkörning och v2-flagga, steg 7 och 11 ny logik bakom flaggan, steg 14 skarpt. Överlappsvakten (steg 3) kan stoppa en insert; felet loggas i `errors` och övriga kunder fortsätter. |
| Ny torrkörningspost | 03:30 | Steg 4 till 14, tas bort en vecka efter steg 14. |
| `sync-oneflow` | 03:00 | Ingen ändring. Samma tid som generatorn; ingen konflikt eftersom den inte skapar fakturor. Avtalsrader som skapas av synken får inte de nya fälten (bara signeringen i steg 15). |
| `expire-contracts` | 01:30 | Ingen ändring. När ett uppsagt avtal stängs kör triggern `contract_end_addon_lines` som förut. |
| `contract-renewal-watch` | 01:45 | Ingen ändring. Läser `contract_end_date`, inte perioder. |
| `reactivate-paused-billing` | 04:00 | Ingen ändring. |
| `monthly-customer-snapshot` | 02:00 den 1:a | Ingen ändring. |
| pg_cron `fortnox-sync-every-5-min` | var 5:e minut | Statusbyten på fakturor (sent, paid) skriver täckning via triggern i steg 8. Triggern måste vara snabb: en insert per station, inga anrop utåt. |
| pg_cron `refresh-contract-annual-values` | 00:15 | Ingen ändring. |
| `extend-recurring-schedules` | 04:00 | Ingen ändring (scheman följer avtalsåret via egen horisont, minnet project_schema_horisont_avtalsar). Kontrollera i steg 6 att `resolveScheduleHorizon` inte läser `billing_anchor_month`. |

## 10. Risker och motåtgärder

| Risk | Motåtgärd |
|---|---|
| Matchningen ändrar utfall för ett legacy-avtal | Månadsreserven i legacy-läget och regressionsskriptet med krav på noll skillnader (steg 7). |
| Överlappsvakten stoppar något som borde gå igenom (till exempel ett utkast som flyttas i datasteg 18 innan det gamla raderats) | Apply raderar före den skapar och uppdaterar i ordningen delete, update, create. Felet säger vilken faktura som krockar. Nödventilen `app.allow_period_overlap` finns för enstaka fall med Christians ja. |
| Cronen v2 skapar många utkast på en natt för fleråriga avtal | Två nätters torrkörning och genomgång före steg 14. Utkasten är `pending_approval` och går inte till Fortnox utan godkännande. |
| Täckning saknas för gamla fakturor och glappmotorn vill fakturera igen | Glappfakturor och pro rata version 2 gäller bara stationer med `placed_case_id` eller avtal med `addon_rules = 'v2'`. Datasteg 16 och 17 körs före datasteg 19. |
| Makulerad faktura blir dubbel debitering eller tappad intäkt | Makulering släpper aldrig täckning. Arbetslistan kräver val. |
| Fortnox radtext över 50 tecken | Test A5; enhetens namn på textraden när huvudraden blir för lång. |
| Ramavtalet skriver över ett verifierat startdatum | Kontroll i steg 6 av `trg_contract_framework_apply`; om den skriver startdatum läggs `contract_start_date` i avtalets `framework_overrides` när avtalsdagen verifieras. |
| `current_date` i SQL ger fel dag mellan 00:00 och 02:00 svensk tid | Nya funktioner använder svensk dag. Befintliga `contract_next_period_start(..., p_today default current_date)` och `contract_next_unplanned_period` rörs bara i den nya grenen. |
| Samlingsfaktura splittras när två avtal får olika avtalsdag | Gruppnyckeln visar det i förhandsvisningen innan apply; se öppen fråga 2. |
| Tekniker kan inte spara station med `placed_case_id` (RLS) | FK-kontrollen går förbi RLS, kolumnen ligger på tabeller teknikern redan skriver. Testas som tekniker i steg 9. |
| `ContractMapSection.tsx` växer och TDZ-krasch (minnet avtalskartan-tre-lager) | Remsan bryts ut i egen fil; nya render-beräkningar efter de hooks de använder. |
| InvoiceDetailModal sätter `InvoiceDate` med rå `toISOString()` (rad ungefär 1076) | Utanför planen men noterat: kvällssändning efter 22/23 kan få gårdagens fakturadatum. Rättas separat om Christian vill. |

## 11. Behörighet och RLS

- Alla nya SQL-funktioner som skriver är SECURITY DEFINER med `set search_path = public` och börjar med `if not intranet_is_internal() then raise exception 'Behörighet saknas'; end if;`. Täckningsregistrering, efterskänkning, släpp och `contract_work_items` kräver dessutom `exists (select 1 from profiles where user_id = auth.uid() and can_approve_invoices)` eller admin.
- `addon_station_coverage` och `addon_coverage_conflicts`: RLS på, select för interna, ingen skrivpolicy.
- Vyn `contract_invoice_overlaps`: `revoke all from anon, authenticated`; läses via service role i skript och via en SECURITY DEFINER-funktion om den ska visas i UI.
- Varje SQL-steg testas i BEGIN … ROLLBACK som tre roller: tekniker, koordinator utan `can_approve_invoices`, koordinator med (Sofia). Mönster: `set local role authenticated; set local request.jwt.claims = '{"sub":"<user_id>","role":"authenticated"}';`.
- Kundportalen (`contract_customer_access`) får bara det `contract_customer_view` redan ger, plus avtalsdagen.

## 12. Tidszon

- Datum lagras som `date` och hanteras som `ÅÅÅÅ-MM-DD`. Planeraren använder `parseLocalDate`/`toLocalIsoDate`, aldrig `new Date('ÅÅÅÅ-MM-DD')` (tolkas som UTC).
- Svensk dag i SQL: `(now() at time zone 'Europe/Stockholm')::date`.
- Cronen kör 03:00 UTC, då är UTC-dagen och svensk dag samma. `created_at` på cronens fakturor (rad 411, `parseLocalDate(p.invoiceDate).toISOString()`) ger midnatt UTC på Vercel; byt i steg 4 till en sträng med uttrycklig offset (`ÅÅÅÅ-MM-DDT00:00:00+01:00` eller `+02:00`, räknad med `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', timeZoneName: 'shortOffset' })` i en ny hjälpare i `src/shared/swedishTime.ts`, eftersom `src/utils/dateHelpers.ts` inte ska importeras i api-projektet).
- Täckningens `covered_from` för en station tas från `addon_effective_from` eller `addon_marked_at`/`placed_at` omräknad till svensk dag.

## 13. Versionsstrategi

Nuvarande 3.109.0. Varje steg med synlig ändring höjer mitten: 3.110.0 (steg 3), 3.111.0 (steg 9), 3.112.0 (steg 10), 3.113.0 (steg 12 och 13), 3.114.0 (steg 14), 3.115.0 (steg 15). Datasteg får en punkt i dagens post när något syns för personalen (steg 19). Rena refaktorer och skript (steg 1, 2, 4, 5, 6, 7, 8, 11) loggas inte. Ingen ny generation: periodmotorn byggs inte om i grunden, den får ett nytt läge bredvid det gamla.

Ungefärlig total omfattning för kodstegen: 28 till 32 arbetsdagar, plus datastegen som styrs av genomgången med Christian.

## 14. Kvarstående frågor (inte beslutade)

1. Månads- och kvartalsavtal: ska även deras perioder börja på avtalsdagen (den 15:e varje månad respektive kvartal), eller gäller avtalsdagen bara år och halvår medan månad och kvartal fortsätter från den 1:a? Planen bygger det första, eftersom regeln "avtalsåret följer startdagen" annars ger olika rytm för premie och tillägg. Nio avtal är månadsvis och inget är kvartalsvis i dag.
2. Samlingsfaktura (`contract_invoice_mode = 'consolidated'`): när kundens avtal har olika avtalsdag blir det en faktura per avtalsdag. Är det rätt, eller ska samlingskunder ha en gemensam dag (då måste ett avtal flyttas och det är inte dess exakta startdag)?
3. Pro rata för mycket korta perioder: kund utan premie med station utsatt en vecka före årsdagen får en pro rata-faktura på en vecka. Ska korta pro rata (till exempel under 30 dagar) i stället följa med nästa ordinarie tilläggsfaktura som en extra rad?
4. Vem får efterskänka: planen kräver `can_approve_invoices` (i dag Christian K, Peter Bergqvist, Sofia Pålshagen). Räcker det, eller ska efterskänkning bara få göras av admin?
