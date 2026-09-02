# Avtalskartan som motor

**Status:** Godkänd av Christian 2026-09-02. Sammanslagen från två specialistgranskningar (avtalsmodell/CRM, ekonomi/data) och rättad efter en oberoende tredje granskning samma dag (fynd F1 till F7 och R1 till R9 inarbetade nedan). Fas 0 och 1 påbörjade på branchen `avtalskarta-motor`.
**Mockup:** https://claude.ai/code/artifact/e1e2888d-17f0-45ac-aac6-6ccc037cebb9 (Avtalskarta FEV, förslag). Byggs inte förrän Christian godkänt både plan och mockup.
**Bakgrund:** `docs/avtalsmodell-plan.md` (diagnos + fyra-avtal-modellen), rapporten `Avtalskartor_FEV_GNU-2026-60.pdf` (FEV-läget 2026-09-02) och Christians beslut samma dag.

## 1. Målbild

Avtalskartan är motorn. Ett papper per avtal bär allt som styr hur vi arbetar med de enheter avtalet omfattar: pris, besök, utrustning, premie, referenser, löptid. Enheterna dras in i omfattningen och följer reglerna. Kundraden bär bara sådant som gäller oavsett avtal: juridiskt namn, Fortnox-nummer, fakturaadress, referenskod per enhet.

Designen behålls: papper med § -sektioner, brickor till vänster, kopplingslinjer, dra in enheter. Befintliga § 1 till § 5 behåller nummer och plats. Det nya läggs efter, så inget som redan sitter i händerna på användarna flyttar.

Principer som inte får brytas:

- `cases.customer_id` är enheten. RLS, kundportal och regionroller bygger på det. Samlad fakturering sker i faktureringssteget, aldrig genom att flytta ärenden.
- `contract_sites` är omfattningen: en rad per enhet och avtal med `active_from`/`active_to`. Rader raderas aldrig (undantag: ångra inom minuter utan beroenden).
- `contractResolver` (eget avtal, sedan omfattning, sedan täcker-alla) är den enda upplösningen av "vilket avtal gäller".
- `contractLifecycle` är den enda livscykeldefinitionen. `renewal_mode` läggs bredvid, inte i.
- Inget kundnivå-innehåll i Verksamhetspanelen. Kundnivåval som rör hur pappren binds ihop (samlad faktura) visas som ett gem ovanför pappren, i papperskolumnen.

## 2. Pappret: sektioner och vad de skriver

| § | Namn | Läge | Visar | Skriver |
|---|---|---|---|---|
| Huvud | Typ, parter, stämpel, värdeband | finns | årspremie som gäller idag, frekvens, period | härleds ur § 7 och § 9 |
| § 1 | Omfattning | finns | enheter med gäller fr., avtalsobjekt | `contract_sites`, `contracts.covers_all_sites`, `contracts.agreement_text` |
| § 2 | Prislista för avrop | finns | prislista + avropskatalog | `contracts.price_list_id` |
| § 3 | Uppföljning | utökas | en rad per enhet: besökstyp, frekvens, utfall i år mot plan, nästa besök | `contract_sites.service_mode`, `contract_sites.visit_frequency`, `contract_sites.visits_per_year` (nya). Avtalets `visit_frequency`/`visits_per_year` blir förval |
| § 4 | Tjänster i avtalet | finns, får verkan | tjänsterader som ingår i premien | `case_billing_items` (case_type contract) som idag; nytt: `covered_by_contract` på ärenderader |
| § 5 | Marginal | finns | intäkt, kostnad, marginal | läser bara. Kostnaden är artikelraderna, samma rader som § 6 visar |
| § 6 | Utrustning i avtalet | ny sektion, befintliga rader | avtalsinnehållets artikelrader (det som idag heter "Intern kostnad" i § 5): typ, antal, intern kostnad, läge (ingår i premien, per styck och år, per kontrollrunda), faktiskt utplacerat | samma `case_billing_items`-rader som § 4/§ 5 (`item_type = article`, `case_type = contract`); nytt: `billing_model` + `station_type_id` på raden |
| § 7 | Premie och fakturering | ny | årspremie, frekvens, ankarmånad, premietrappa som tidslinje, indexjustering, nästa faktura, faktureringsläge | `contracts.annual_value`, `billing_frequency`, `billing_anchor_month`, `billing_active`; `contract_premium_events` |
| § 8 | Referenser | ny | avtalets referens, diarienummer, kod per enhet, dynamisk där kod saknas | `contracts.invoice_reference`, `contracts.diary_number`; `customers.billing_reference` per enhet |
| § 9 | Löptid och option | ny | start, slut, uppsägningstid, sista uppsägningsdag, förlängningsläge, optionsgräns, beslutsdatum, bevakning | `contracts.contract_start_date`, `contract_end_date`, `notice_period_months`, `signed_at`, `renewal_mode`, `option_until`, `option_decision_deadline` |
| Fot | Säljare, kundansvarig, signerat, säg upp | finns | | som idag |

Var saker bor:

| Nivå | Bär | Varför |
|---|---|---|
| Avtal | premie, frekvens, ankarmånad, trappa, index, prislista, tjänster, utrustning, avtalsreferens, diarienummer, löptid, option, besöksförval, säljare, kundansvarig | allt en kund kan ha olika av per avtal (FEV: fyra prisposter) |
| Enhet i avtal (`contract_sites`) | täckningsperiod, besökstyp, frekvens per enhet | samma enhet kan stå i två avtal med olika besöksregim |
| Enhet (`customers`) | referenskod, kontakt, adress, Fortnox-nummer | koden tillhör beställaren på platsen, inte avtalet |
| Kund (HK-rad) | faktureringsläge samlad/enskild, fakturaadress, `adhoc_invoice_grouping` | gäller alla avtal |
| Ärende (`cases`) | dynamisk referens (`invoice_marking`) | beställarens kod för den beställningen; förifylls från enheten, finns redan |

### Gemet

När kunden har fler än ett levande papper visas ett band överst i papperskolumnen:

`SAMLINGSFAKTURA · en faktura per period, en rad per avtal · 4 avtal, 35 114 kr/år · ändra`

Alternativ: `ENSKILDA FAKTUROR · varje avtal faktureras för sig`. Lagras på HK-raden som `customers.contract_invoice_mode`. Varje papper speglar valet i § 7. Samlad faktura kräver att avtalen delar frekvens, ankarmånad och Fortnox-kundnummer; avvikande avtal faller ut som egna fakturor och gemet visar varning. Beslut 2026-09-02: på samlad faktura står huvudkundens referens (HK:s Märkning faktura) i fakturahuvudet och avtalen listas som rader; inget undantag per avtal i första versionen. Gemet får också "Indexera alla avtal". Fortnox-faktura 643 (FEV år 1) är redan byggd exakt så: fyra rader, en per prispost, en mottagare.

### Tomt avtalsblad

Ett streckat papper visas alltid sist i papperskolumnen, även när avtal redan finns. Dra en enhet eller "Hela verksamheten" dit: avtalstyp väljs, ett tomt avtal skapas på huvudkontoret med nästa visningsordning, och enheten skrivs in i § 1 med startdatum. Det tar bort dagens begränsning att UI:t bara kan skapa det första avtalet på ett huvudkontor.

## 3. Drag och släpp

Alla dragningar går genom befintlig pointer-mekanik i `ContractMapSection` (`DragPayload`, `startDrag`, `findPaperAt`, `validateDrop`). Släppytor får `data-drop-zone`. Varje skrivning loggas i `contract_events` och toasten får Ångra.

| # | Källa | Mål | Validering | Skriver | Ångra |
|---|---|---|---|---|---|
| B1 finns | Enhet | papper § 1 | ej importrest, ej täcker-alla, ej redan i omfattning | `addSite` | ny `removeSiteIfFresh` (radera om under 10 min och utan beroenden, annars `endSite`) |
| B2 finns | Hela verksamheten | papper | som B1 | `covers_all_sites` eller `coverAll` | `setCoversAllSites(false)` |
| B3 finns | § 1-rad | annat papper | ej samma avtal | `moveSite` | invers `moveSite` |
| N1 | Enhet eller Hela verksamheten | tomt avtalsblad | kundraden är HK eller enkelkund | typprompt, `createBlankContract`, sedan B1/B2 | `deleteContract` (blockeras vid historik) |
| N2 | Prislista (Katalog) | papper § 2 | levande avtal | `setPriceList` | tillbaka till föregående |
| N3 | Tjänst (Katalog) | papper § 4 | levande avtal | öppnar § 4-editorn med tjänsten förvald | ta bort raden |
| N4 | Utrustning (Katalog: stationstyper och utrustningstjänster) | papper § 6 | levande avtal | popover: antal, läge, pris från avtalets prislista | ta bort raden |
| N5 | Enhet | papper § 8 | enheten står i § 1 | inline-fält, `customers.billing_reference` | återställ värde |
| N6 | § 1-rad | Verksamhetspanelen | ej enhetsavtal, ej enkelkundens enda lokal | `endSite` med datumprompt | `active_to = null` |
| N7 | Papper (grepp vid stämpeln) | arkivytan | levande avtal | `TerminateModal` som idag | `reactivateContract` |
| N8 | Papper | annat papper (över/under) | båda levande | `display_order` byts | byt tillbaka |

Katalog-facket: hopfällt under Verksamhetspanelen med flikarna Prislistor, Tjänster, Utrustning. Systemkatalog, inte kundinnehåll. Fälls upp när musen vilar över § 2, § 4 eller § 6 på ett papper.

## 4. Datamodell

Återbruk före ny tabell. Ingen ny tabell behövs.

### M1 contracts

```sql
alter table contracts
  add column invoice_reference text,
  add column diary_number text,
  add column renewal_mode text not null default 'rolling'
    check (renewal_mode in ('rolling','fixed','option')),
  add column option_until date,
  add column option_decision_deadline date,
  add column equipment_billing text not null default 'with_premium'
    check (equipment_billing in ('with_premium','separate')),
  add column billing_paused_until date;
```

`renewal_mode`: `rolling` = dagens beteende (rullar vidare tills uppsägning), `fixed` = upphör vid slutdatum, inga besök bokas efter, `option` = upphör om inte optionen nyttjas före `option_decision_deadline`. Beslutet loggas i `contract_events` som `renewal` och flyttar `contract_end_date` (max `option_until`).

### M2 customers

```sql
alter table customers
  add column contract_invoice_mode text not null default 'per_contract'
    check (contract_invoice_mode in ('per_contract','consolidated'));
```

Läses bara på HK-raden. `billing_type` rörs inte (annan axel, dessutom 'consolidated' på 169 av 169 rader).

### M3 invoices och invoice_items

```sql
alter table invoices
  add column is_consolidated boolean not null default false,
  add column contract_invoice_kind text not null default 'premium'
    check (contract_invoice_kind in ('premium','equipment','adjustment')),
  add constraint invoices_consolidated_no_case check (not is_consolidated or case_id is null);

alter table invoice_items
  add column contract_id uuid references contracts(id) on delete set null,
  add column line_kind text
    check (line_kind in ('premium','equipment_annual','index_note','addon_round','service','article','generic'));

create unique index invoices_contract_period_key
  on invoices(contract_id, billing_period_start, contract_invoice_kind)
  where invoice_type = 'contract' and contract_id is not null
    and contract_invoice_kind <> 'adjustment'
    and status <> 'cancelled' and invoice_number not like 'F-%';
create unique index invoices_consolidated_period_key
  on invoices(customer_id, billing_period_start, contract_invoice_kind)
  where invoice_type = 'contract' and is_consolidated
    and contract_invoice_kind <> 'adjustment'
    and status <> 'cancelled' and invoice_number not like 'F-%';
```

Samlad faktura: `contract_id = null`, `is_consolidated = true`, avtalet bor på raden. Per-avtal-läget nycklar på `invoices.contract_id` som idag. Justeringsfakturor (`adjustment`) undantas från de unika nycklarna: två indexeringar eller indexering plus tillägg samma period måste kunna ge två justeringar. Verifierat 2026-09-02: inga befintliga dubbletter för någon av nycklarna. Detektionen `has_generic_items` byter från radtextprefixet "Avtalsfakturering " till `line_kind is null`, så nya radtexter ("Årspremie {label}, {period}") kan skrivas fritt.

### M4 contract_premium_events som fakturakälla

```sql
alter table contract_premium_events
  add column percent numeric,
  add column index_reference text,
  add column approved_by uuid references auth.users(id),
  add column approved_by_name text,
  add column first_invoice_id uuid references invoices(id) on delete set null;
create unique index premium_events_contract_day_type
  on contract_premium_events(contract_id, effective_from, event_type);
```

`event_type` har redan CHECK med `start`, `step_up`, `indexation`, `addition`, `adjustment`, `termination`. Regel: `contracts.annual_value` = beloppet som gäller idag (härlett), planeraren läser trappan. Saknas händelser används `annual_value` från `contract_start_date`. RLS blir staff-only.

### M5 utrustning i avtalsinnehållet

```sql
alter table case_billing_items
  add column billing_model text not null default 'premium'
    check (billing_model in ('premium','per_year','per_round')),
  add column station_type_id uuid references station_types(id),
  add constraint cbi_billing_model_contract_only
    check (billing_model = 'premium' or (case_type = 'contract' and item_type = 'service'));
```

`billing_model` sätts på TJÄNSTERADEN (`item_type = service`), som bär priset. Artikelraden (intern kostnad) ärver läget via `mapped_service_id`. Skälet: § 5 (`getCaseServiceSummary`) summerar tjänster som intäkt och artiklar som kostnad, och fakturaradbyggaren speglar tjänsterader. Ligger läget på artikelraden får per-år-utrustning ingen intäkt alls. `getServiceItemsForContract` läser bara `billing_model = premium` till premieraden; `per_year`-tjänsterader blir `equipment_annual`-rader och får aldrig dubbleras som vanlig tjänsterad.

§ 6 är ingen ny datamängd. Utrustningen i avtalet är redan avtalsinnehållets artikelrader (`item_type = article`, kopplade till tjänsteraden via `mapped_service_id`), alltså det som § 5 idag summerar som "Intern kostnad". § 6 visar samma rader som en egen sektion med antal, intern kostnad, läge och faktiskt utplacerat, och § 5 fortsätter räkna marginalen på dem. Det nya är två kolumner på raden:

- `billing_model = premium`: ingår i årspremien, bara intern kostnad (dagens rader, oförändrat).
- `billing_model = per_year`: debiteras utöver premien, antal = stationer, pris via avtalets prislista (tjänsteraden), intern kostnad från artikeln. Blir en `equipment_annual`-rad på årsfakturan och räknas som både intäkt och kostnad i § 5.
- `billing_model = per_round`: markering att stationstypen debiteras per kontrollrunda via tjänst 43 (dagens tilläggsstationsflöde, oförändrat). Raden faktureras aldrig från avtalet.
- `station_type_id`: kopplar raden till stationstypen så "utplacerat X av Y" kan räknas ur `equipment_placements`/`indoor_stations` på avtalets enheter.

Fyra nya tjänster (st/år) behövs för LOU-priserna: ljusfälla 1 686, avloppsfälla 4 896, flerfångsfälla 2 348, Eagleye 1 388. Antalssynk från utplaceringar via SECURITY DEFINER-RPC av samma snitt som `sync_addon_station_line`.

### M6 apply_contract_addition

RPC:n får `p_contract_id`, låser `contracts` (inte `customers`), skriver `contract_premium_events` med `addition` och `source_addition_id`. Kundraden uppdateras bara för synth-avtal.

### M7 contract_sites, contract_events, backfyll

```sql
alter table contract_sites
  add column service_mode text not null default 'inspection'
    check (service_mode in ('inspection','on_demand')),
  add column visit_frequency text,
  add column visits_per_year smallint;

alter table contract_events drop constraint contract_events_event_type_check;
alter table contract_events add constraint contract_events_event_type_check
  check (event_type in ('price_list','scope_mode','note','billing','indexation','renewal','other'));

alter table case_billing_items add column covered_by_contract boolean not null default false;

-- Backfyll invoices.contract_id (326 rader) där kunden har exakt ett levande avtal
update invoices i set contract_id = c.id
  from contracts c
 where i.contract_id is null and i.invoice_type = 'contract' and i.customer_id = c.customer_id
   and c.status in ('signed','active') and c.type = 'contract'
   and (select count(*) from contracts c2 where c2.customer_id = i.customer_id
          and c2.status in ('signed','active') and c2.type = 'contract') = 1;
```

Kunder med flera avtal och rader utan `contract_id` listas av migrationen och backfylls för hand. Den transitionella `or contract_id.is.null` i `planForContract` tas bort när ingen kund med minst ett riktigt avtal har null-rader kvar. De cirka 80 kunder som faktureras via synth-avtal berörs inte av villkoret och behöver inte backfyllas för det.

### RPC för tekniker

`get_contract_candidates(p_customer_id)` SECURITY DEFINER (mall: `20260831_price_list_contract_candidates_rpc.sql`). Resolvern använder den när den finns. Löser att scheman tekniker skapar får `contract_id = null`, utan att öppna `contracts` för tekniker.

## 5. Faktureringsflödet

### Gemensam planerare

`computePlannedInvoicesPure` flyttas till en DB-fri modul `src/shared/contractPlanner.ts` som delas av frontend och cron (idag två kopior). Ny signatur tar avtalet, premietrappan och utrustningsraderna och ger per period: premiebelopp, utrustningsrader, gällande årsvärde, källhändelse. Periodmatematiken hanterar redan `semi_annual`; det som saknas är typen `BillingFrequency` och divisorn för tjänsteraderna (`getServiceItemsForCustomer` och cronens motsvarighet), som ger helårsbelopp på raderna medan huvudet får halvår.

### Årspremie samlad per kund

1. Alla levande avtal på HK grupperas på (frekvens, ankarmånad, Fortnox-kundnummer). Grupp som inte kan samfaktureras faller tillbaka till per avtal med varning i gemet.
2. Per period: en `premium`-rad per avtal med text "Årspremie {label}, {period}" och diarienummer, därefter `equipment_annual`-rader för avtal med `equipment_billing = with_premium`. Huvudet räknas från raderna.
3. Diff: saknas = skapa; låst status = rör inte (avtal som saknas på en skickad faktura loggas och får en `adjustment`-faktura); redigerbar = jämför radmängd, uppdatera.
4. Uppsagt avtal: på redigerbara samlade fakturor tas bara avtalets rader bort, huvudet räknas om, tom faktura raderas. Låsta loggas för kreditering.
5. Fortnox: en faktura per samlad rad, en Fortnox-rad per `invoice_items`-rad. `YourReference` = gemensam avtalsreferens om alla avtal har samma, annars HK:s `billing_reference`. `OurReference` = kundansvarig. `ExternalInvoiceReference1` = diarienummer. `Remarks` = period + avtalslista + eventuell indexnotering.
6. Provision: `case_id` förblir null. Rätt, årspremie ger ingen provision.

### Årspremie per avtal

Dagens `planForContract` med tre ändringar: belopp från trappan, `invoice_marking` från avtalets referens (fallback HK), `line_kind` och `contract_id` på raderna. "Uppdatera fakturor" i faktureringsmodalen byter från "första avtalet" till alla avtal eller samlad, beroende på läge. § 4-rader når fakturan även för portalskapade och Oneflow-avtal (idag bara importcontainrar).

### Utrustning per år

Beslut 2026-09-02: båda modellerna ska stödjas, och de utgår från dagens etableringsflöde. Koordinatorn skapar ett etableringsärende, teknikern placerar ut stationer och markerar varje station som Tillägg (utöver avtalet) eller inte (inne i avtalet).

- **Tilläggsstation utanför avtalet** (`billing_model = per_round`): debiteras per etablering och per kontrollrunda enligt prislistan. Dagens tilläggsstationsflöde (tjänst 43), oförändrat.
- **Tilläggsutrustning som läggs in i avtalet** (`billing_model = per_year`): från ärendemodalen används den befintliga funktionen "Lägg till i avtalet" på fakturarader och interna kostnader (avtalstillägg, `apply_contract_addition`). Då adderas utrustningen till avtalet som § 6-rad, syns i kundens tidslinje, kunden betalar pro rata fram till nästa årspremie (merförsäljningsfakturan, som idag), och nästa årspremiefaktura får utrustningen som `equipment_annual`-rad för hela det kommande året. Avtalat antal, helt år i förskott. Premietrappan får ett `addition`-steg (M6 flyttar tillägget från kundraden till avtalet).

`equipment_annual`-radens text: "{tjänst}, tillägg utöver avtal, {antal} st à {pris} kr/år, {period}". Med `equipment_billing = separate` blir det en egen faktura med `contract_invoice_kind = equipment`. Antalet låses på raden vid fakturering. FEV:s fakturor 648, 744, 745 och 862 är exakt sådana tillägg (Aurocon, ljusfällor, mekaniska fällor) och ska importeras och kopplas till respektive § 6-rad, med "faktureras med huvudavtalet från 2027-07-01" som täckning för första perioden.

### Avrop per ärende

Oförändrad mekanik. Kedjan enhet → ärende → faktura finns: `billing_reference` förifylls på ärendet, `invoice_marking` följer till fakturan och blir `YourReference`. Två luckor täpps: `monthly_batch` sätter aldrig märkning (sätt enhetens kod), och en beställare utan kod på enheten ska kunna sätta koden på ärendet i kundportalen.

### Indexjustering

"Indexjustera" i § 7: gäller från (förval nästa periodstart), procent eller nytt belopp, indexreferens, notering. `applyIndexation` skriver `contract_premium_events` (indexation, procent, referens, godkänd av), uppdaterar `annual_value` om datumet passerat, loggar `contract_events`, planerar om kunden. Låsta fakturor rörs inte; träffar justeringen en skickad period loggas det och en `adjustment`-faktura kan skapas. Fakturans `Remarks` får "Indexjusterad +3,0 % fr.o.m. 2027-07-01 (AKI ...)". Kundradens `price_adjustment_percent` används inte för avtalskunder.

### Cron

- `generate-continuing-contracts` skrivs om till avtalsnivå med samma planerare som frontend och fakturanummer via max-sekvens (dagens `count` kolliderar efter radering). Dagens version läser kundraden, nycklar bara på period per kund och skulle med två avtal på samma huvudkontor hoppa över det andra som "finns redan". Hårt krav: cronen är omskriven innan något andra papper på en kund får `billing_active`.
- Beslut 2026-09-02: avtal med option eller fast slutdatum stoppas INTE automatiskt. De löper vidare tills någon aktivt säger upp dem, precis som rullande avtal idag. `renewal_mode` och optionsfälten styr därför bara bevakningen (påminnelse 90 dagar före beslutsdatum, händelse i tidslinjen, samma papper vid förlängning), inte livscykeln. `expire-contracts` och `isEndedContract` lämnas som de är.
- "Indexera alla avtal" finns på gemet: ett klick indexerar kundens alla levande avtal med samma procent och datum (FEV: fyra avtal). Fakturaansvarig indexerar utan annan godkännare. Utrustning per år indexeras i samma steg om det kan göras enkelt, annars skjuts det.
- Ny `contract-renewal-watch` (dagligen): för `option` 90 dagar före beslutsdatum, för `fixed` 90 dagar före slut, för `rolling` 30 dagar före uppsägningsfönstret. Skriver `contract_events` och mejlar kundansvarig. Avtalskartan visar "Avtal som kräver beslut" och bevakningsraden i § 9 visar dagar kvar. Schemahorisonten (`resolveScheduleHorizon`, `extend-recurring-schedules`) rullar bara `rolling`-avtal.
- `reactivate-paused-billing` läser även `contracts.billing_paused_until`.

### Redan fakturerade perioder (FEV år 1, WBAB år 1)

Fortnox-import (`F-`) är enda vägen att markera en period som fakturerad utanför portalen. Den automatiska "betalda historiken" (`insertHistoricalPaidInvoice`) stängs av för riktiga avtal och ersätts av planposten `uncovered` som visas i förhandsgranskningen ("Perioden saknar faktura i portalen, importera från Fortnox") och aldrig appliceras. Täckningsfiltret godtar `F-`-faktura med samma avtal eller med tomt avtal och samma kund. Importmodalen får avtalsval och en manuell "Registrera Fortnox-faktura"-form. Ingen ny status `externally_invoiced`: den skulle ge intäkt utan verifikat.

Fortnox 2026-09-02, kund 5004 (FEV): år 1 är fakturerad som **Fortnox 643** (2026-07-06, 35 114 kr exkl. moms, betald) med fyra rader på tjänst 129, en per prispost, radtext "Skadedjursavtal generell, avser årsavtal GNU 2026/60, {anläggning}". Den ska importeras som avtalsfaktura för perioden 2026-07-01 till 2027-06-30 och täcka alla fyra avtalen (samlad). Dessutom är tilläggsutrustning per år redan fakturerad med "avtalstid följer huvudavtal GNU 2026/60": 648 (8 Aurocon à 2 348 + 2 ljusfällor à 1 686, ref 4019), 744 (12 Aurocon + 11 ljusfällor, Märkning 3099, obetald), 745 (3 Aurocon, Märkning 5037, obetald), 862 (3 mekaniska fällor à 2 348 vid huvudkontoret, ref 8315, "faktureras med huvudavtalet från 2027-07-01", obetald). Sammanlagt cirka 83 000 kr/år i utrustning utöver premien, på tjänsteraderna 37, 79 och 39. Det bekräftar § 6-modellen (per år på tjänsteraden med antal per enhet) och per-enhet-referenserna i § 8. Ingen av dessa fem fakturor finns i portalen, och de 23 Aurocon-enheterna och 13 ljusfällorna finns inte som stationer i portalen. Krav från Christian: radtexten på årspremiefakturor ska innehålla ordet "Årspremie" (eller "Avtalspremie") så de går att känna igen.

Latent fel att stänga först: WBAB:s år 1 (F-642, 74 591 kr) är importerad som `adhoc` med period juli 2026 och `contract_id` null, och WBAB saknar helt `contracts`-rad (kundraden bär 74 591 kr, årsvis, ankar 7). Täckningsfiltret ser bara `contract`-typ, så varje omplanering av WBAB:s HK skapar idag en falsk betald faktura på 93 239 kr inkl. moms. Omplanering triggas från fem ställen: de två importmodalerna, rabattgodkännande, avtalstillägg vid teknikeravslut (`contractAdditionService`) och cronen efter 2028-06-30. F-642 kan typas om till avtalsfaktura först när fas 1 skapat WBAB:s avtal. Fram till fas 2: rör inte WBAB via någon av vägarna, och lägg avtalstillägg för WBAB på is.

## 6. Faser

| Fas | Innehåll | Storlek | Beroende | Migration | Klart före |
|---|---|---|---|---|---|
| 0 Grund | RPC-gren i resolvern; `getServicePricesForCase` tar `contractId` (ärendets avtal via `cases.contract_id`); `contractBillingService` använder resolvern. **Byggt och applicerat 2026-09-02** (RPC `get_contract_candidates` verifierad mot Maserfrakts enheter: Örjasvägen ger båda sina avtal via omfattningen) | S | inget | RPC | nu |
| 1 FEV via UI | Tomt avtalsblad (N1) + `createBlankContract`; § 7 med premie, frekvens, ankarmånad, premietrappa (nytt steg, indexjustering som händelse); § 8 Referenser (avtalets referens + diarienummer, Er referens per enhet, släpp enhet på § 8 = N5); § 9 grundläge (start, slut, uppsägningstid); `annual_value` speglas som summa till HK och räknas om vid uppsägning, radering, återaktivering; "Nolla avtalsfält" i Importrester; `createFromCustomerRow` rättad (ankarmånad, kopierar inte fel fält när avtal redan finns). **Byggt 2026-09-02** på branchen. Kvar i fas 1: visningsordning via drag (N8) och utbrytning av pappret till egen fil | M | 0 | M1 (referenskolumner, applicerad) | oktober 2026 |
| 2 Pengar och referenser | **Byggt 2026-09-02** (ej browser-testat): M2 till M6 applicerade; delad planerare `src/shared/contractPlanner.ts` med trappa, utrustning och ledtid 40 dagar; generatorn läser avtalets egna § 4-rader, ger `uncovered` i stället för betald historik för riktiga avtal, räknar Fortnox-importer av båda typerna som täckning; gemet (`contract_invoice_mode`) med samlad faktura (`is_consolidated`, `invoice_items.contract_id`), "Planera fakturor" och "Indexera alla" i avtalskartan; § 6 Utrustning med faktureringsläge per rad; § 7 visar planens nästa faktura och passerade perioder med "koppla Fortnox-faktura" (`ContractInvoiceImportService`); cron på avtalsnivå med samma planerare; avtalstillägg skriver avtalet (RPC v2) och lägger § 6-rad; Fortnox-sändning sätter diarienummer och kundansvarig på årspremiefakturor; månadsbatch får enhetens märkning. **Ej gjort:** historikflik Fakturor, importmodalens avtalsval (ersatt av § 7-kopplingen), M7-backfyll av `invoices.contract_id` (326 legacy-rader), WBAB/FEV-avtal och kopplingen av 643/642 (görs i UI när avtalen finns) | L | 1 | ja | april 2027 (FEV/WBAB andra årspremie i juli) |
| 3 Besök, utrustning, löptid | **Byggt 2026-09-02** (ej browser-testat): migration `20260902_avtalskarta_motor_fas3` (contract_sites.service_mode inspection/on_demand + visit_frequency + visits_per_year; contracts.renewal_mode rolling/fixed/option, option_until, option_decision_deadline, renewal_reminder_days); § 3 per enhet med driftläge, takt, utfall i avtalsåret (pro rata) och nästa besök, redigering i SitePlanModal; `useContractVisitFrequency` läser enhetens takt först; `backfillContractVisitFrequency` stämplar aldrig avtal med flera enheter; ronderingssidan flaggar inte avropsenheter som "utan schema" och batchen hoppar över dem; § 9 med förlängningsläge, option, bevakningsrad, "Nyttja option" (flyttar slutdatum på samma papper), "Förläng tills vidare", "Säg upp"; cron `contract-renewal-watch` (01:45) skriver `renewal`-händelse och mejlar kundansvarig (option: reminder-dagar före beslutsdatum, fixed: före slutdatum, rolling: 30 dagar före uppsägningsfönstret), idempotent via metadata.watch_key; § 6 visar aktiva stationer ute/inne och tilläggsstationer på avtalets enheter. Schemahorisonten är oförändrad: avtal löper vidare tills uppsägning (beslut 2026-09-02). | M | 1, § 6 kräver 2 | ja | juli 2027 |
| 4 Ingår i avtalet + resten av drag och släpp | **Byggt 2026-09-02** (ej browser-testat): migration `20260902_avtalskarta_motor_fas4` (case_billing_items.covered_by_contract); `ContractCoverageService` läser avtalets § 4-premierader och tjänsteväljaren i ärendemodalen sätter pris 0 och "Ingår i avtalet" för de tjänsterna (ärendets avtal via `cases.contract_id`), och varken avropsfaktureringen eller fakturaservicen tar med sådana rader; Katalog-facket i Verksamhetspanelen (prislistor, tjänster, utrustning, stationstyper) släpps på § 2, § 4 och § 6 och skapar rätt radtyp (tjänst = premierad, utrustning = per år, stationstyp = per kontrollrunda via tjänsten för tilläggsstationer); arkivremsan tar emot papper (uppsägning), Verksamhetspanelen tar emot omfattningsrader (avslutar täckning); pappret har ett grepp i stämpeln och kan dras på ett annat papper för att byta ordning (`display_order`); Ångra på toasterna för indragen enhet, avslutad täckning, prislistebyte och katalograder | M | 0, 1, 3 | ja | hösten 2027 |
| 5 Städning | Faktureringsmodalens avtalsfält blir läsbara med länk till avtalskartan; datumpropagering till enheter tas bort; `apply_contract_addition` på avtalet (M6); `billing_paused_until` på avtal; beslut om de 80 synth-kunderna | S | 2 | RPC | efter juli 2027 |

Fas 1 räcker för att lägga upp FEV helt från UI: fyra papper på HK 5004, årsvis i juli, enheterna indragna, spökavtalen nollade. Fakturaplanen faller ut per avtal redan då (generiska rader tills fas 2). FEV:s option 2028-06 bevakas av fas 3 senast december 2027.

## 7. Kodkarta

Återanvänds oförändrat: `contractScopeService` (addSite/endSite/moveSite/coverAll/logEvent/terminateContract/reactivateContract/deleteContract), `contractResolver`, `contractLifecycle`, `useCustomerRecord` (premietrappa i vyn), `ContractCaseServiceSelector` + `useContractContent` (§ 4), `useAvropCatalog` (§ 2), `DatePromptPopover`, `planAllForCustomer`/`planForContract`, `addonStationBillingService` (per runda), `RecurringScheduleWizardWithContract`, referenskedjan i `CreateCaseModal` och `InvoiceDetailModal`.

Ändras (fil, vad, fas):

- `ContractMapSection.tsx`: tomt avtalsblad alltid sist (1); `DragPayload`, `findDropAt` med zoner, `validateDrop` per zon (1, 2, 3, 4); nya props och utbrutna sektionsfiler `ContractEquipmentSection`, `ContractPremiumSection`, `ContractReferencesSection`, `ContractTermSection` (1 till 3); `followupFor` per enhet (3); knapp "Nolla kundradens avtalsfält" (1).
- `contractScopeService.ts`: `createBlankContract`, `setPremium`, `addPremiumEvent`, `applyIndexation`, `setTerm`, `exerciseOption`, `setInvoiceReference`, `setUnitBillingReference`, `setDisplayOrder`, `removeSiteIfFresh`, `clearCustomerRowContractFields`, utrustnings-CRUD, `setContractInvoiceMode` (1 till 3). `mirrorToCustomerRow`: `annual_value` som summa av levande avtal, frekvens/ankar bara när alla avtal delar värde (1). `createFromCustomerRow`: ankarmånad med, fel fält kopieras inte (1).
- `src/shared/contractPlanner.ts` (ny): periodmatematik, trappa, utrustning, `semi_annual` (2).
- `contractInvoiceGenerator.ts`: `getServiceItemsForContract(contractId)` läser avtalets egna rader; trappa som belopp; `uncovered`; utökat täckningsfilter; huvud från rader; `invoice_marking`, `line_kind`, `contract_id` på rader; `planConsolidatedForCustomer`, `insertConsolidatedInvoice`; `cancelFutureForContract` tar bort rader på samlade fakturor (2). Radtextprefixet "Avtalsfakturering " behålls för `has_generic_items`.
- `api/cron/generate-continuing-contracts.ts`: avtalsnivå, delad planerare, fakturanummer via max-sekvens (2).
- `api/cron/contract-renewal-watch.ts` (ny) + `vercel.json` (3).
- `InvoiceDetailModal.tsx` och `ContractInvoiceModal.tsx`: referensregler för avtalsfakturor (2).
- `BillingSettingsModal.tsx`: `handleApplyInvoices` planerar alla avtal eller samlat (2); avtalsfält läsbara, datumpropagering bort (5).
- `priceListService.getServicePricesForCase`: tar `contractId` (0).
- `contractBillingService.ts` rad 116 till 127: resolvern i stället för egen upplösning (0). `importHistoricalItems`: typ `contract` + `contract_id` (2).
- `contractResolver.ts`: RPC-gren (0).
- `useContractVisitFrequency`, `RonderingSchedulePage`, `recurringScheduleService.resolveScheduleHorizon`, `extend-recurring-schedules`: per-enhet-frekvens och `renewal_mode` (3). `backfillContractVisitFrequency` skriver till `contract_sites`, aldrig till avtal med flera enheter (3).
- `addonStationBillingService.prefillAddonStationLine`: `per_year`-rad på avtalet ger utfall "täcks av avtalet", ingen rundrad (3).
- `CaseServiceSelector.tsx`: § 4-tjänster markeras "Ingår i avtalet", rad med `covered_by_contract`, 0 kr, ej fakturerbar (4).
- `ContractHistoryModal.tsx`: flik Fakturor (2).
- `generateAdhocInvoiceForCase`: märkning vid `monthly_batch` (2). Kundportal: beställare sätter referens på ärendet (2).

## 8. Risker

1. Samlad faktura mot dagens diff: `planForContract` matchar `contract_id = X eller null`. Utan `is_consolidated` och exkludering raderas eller dubbleras fakturor. Fas 2 levererar planerare, diff och cron tillsammans.
2. Byte av faktureringsläge: redigerbara fakturor i gamla läget raderas, byte vägras om låsta fakturor finns för framtida perioder.
3. Fortnox-avstämning: samlad faktura går på HK:s kundnummer. Pelican och Heimstaden (enheter med egna kundnummer) får aldrig samfaktureras; regel i grupperingen.
4. `customers.annual_value` som summa: dubbelräkningen finns redan. 28 aktiva enhetsrader bär eget årsvärde (1 135 973 kr) och Dashboard, `useContractInsights` och cronen `monthly-customer-snapshot` (bestående ARR-historik) summerar utan att skilja HK från enhet. Regel: HK-summan omfattar bara avtal som bor på HK-raden (Pelican och Heimstaden har avtal på enhetsrader och summeras inte). De tre läsarna ska filtrera bort enheter eller läsa `contracts` direkt. Triggern som räknar `customers.total_contract_value` ur årsvärde och HK-radens datum blir meningslös vid flera avtal; sätt värdet till null för kunder med fler än ett levande avtal eller sluta läsa kolumnen. Summan måste räknas om även vid uppsägning, radering och återaktivering av ett avtal (fas 1 gör det).
5. Huvud mot rader: nya flödet räknar huvudet från raderna och varnar när premieradernas årssumma inte är `annual_value`.
6. Provision: samlade och per-år-rader har `case_id` null. CHECK-villkor hindrar att `case_id` sätts på samlad faktura.
7. RLS: `invoice_items`, `contract_sites`, `contract_premium_events`, `contract_events` är öppna för alla inloggade. Premietrappa och index måste bli staff-only innan de blir fakturakälla. Antalssynk från teknikerflöden via SECURITY DEFINER-RPC.
8. `billing_active` är överlastad: § 7 visar paus via `isBillingPaused`, aldrig som livscykel.
9. Filstorlek: `ContractMapSection.tsx` är 3 228 rader. Fas 1 börjar med att bryta ut pappret innan nya sektioner läggs till.
10. Enkelkund: § 3 och § 8 per enhet faller tillbaka på kundraden själv, som § 1 gör.
11. Historik: autogenererade "paid"-rader utan Fortnox-nummer märks i `notes` så avstämning inte tar dem för verifikat.
12. Synth-fallback: `getActiveContracts` återupplivar fakturering ur kundraden när sista avtalet lämnar aktiv status. Fas 5 beslutar om de 80 synth-kunderna.
13. RLS: policyn för insert på `contracts` täcker admin och koordinator men inte säljare, medan update och delete gör det. Tomt avtalsblad failar tyst med 0 rader för en säljare tills policyn utökas. Skrivning av `customers.billing_reference` (§ 8) fungerar för admin, koordinator och säljare.
14. Oneflow-webhooken skriver över `agreement_text` (§ 1 avtalsobjekt) och `start_date` vid varje innehållshändelse; premie, datum och de nya kolumnerna rörs inte. Ska avtalskartan äga avtalsobjektet läggs `agreement_text` till webhookens undantagslista. Offert- och avtalsimporten mappar redan Oneflows fält "faktura-referens" till `invoice_reference`, vilket börjar gälla när kolumnen finns (avsett: samma betydelse).
15. Avtalstillägg vid teknikeravslut kör omplanering per kund. Med samlad faktura måste den planera samlat, annars återskapas per-avtal-fakturor bredvid den samlade.
16. Schemahorisonten och `extend-recurring-schedules` rullar slutdatumet ett år i taget så länge avtalet inte är uppsagt; 16 aktiva scheman saknar avtalskoppling och faller till kundraden. Fas 3 måste ge båda vägarna `renewal_mode`, och tekniker måste kunna läsa det via RPC:n.
17. Avtal som bor på enhetsrader (Pelican, Heimstaden) syns inte i huvudkontorets papperskolumn. Gemet visas bara på HK och grupperar på Fortnox-kundnummer, så de samfaktureras aldrig av misstag, men planen bör säga var de pappren visas (förslag: på enhetens egen kundsida, som idag).

## 9. Beslut och öppna frågor

Besvarat av Christian 2026-09-02:

1. Diarienummer: ja, i radtexten och `ExternalInvoiceReference1`, "Er referens" reserveras för referenskoden. Fältet (`contracts.diary_number`) är generellt och redigerbart per avtal för alla kunder, inte något FEV-specifikt.
2. Samlad faktura med olika referenser: huvudkundens referens i huvudet, avtalen som rader.
3. Inget undantag per avtal från samlingsfakturan i första versionen.
5. Option: 90 dagars förvarning räcker. Avtalet löper vidare om ingen aktivt säger upp det. Samma papper, händelse i tidslinjen.
6. Indexering: fakturaansvarig indexerar utan annan godkännare. "Indexera alla avtal" på gemet. Utrustning indexeras om det blir enkelt och tydligt, annars senare.
7. Besökstyp: ingen egen uppföljningstyp. Stationskontroller används; extra besök är vanliga engångsärenden ("extrabesök avtalskund"). `service_mode` blir `inspection` eller `on_demand`.
8. FEV år 1 = Fortnox 643, WBAB år 1 = Fortnox 642 (se avsnitt 5). Årspremiefakturor ska ha "Årspremie" i radtexten.
10. Synth-kunderna materialiseras inte i batch. Först ska motorn fungera överallt, sedan går Christian igenom alla avtal ett och ett.

4. Utrustning per år: båda modellerna, se avsnitt 5 "Utrustning per år". Tillägg utanför avtalet per runda; tillägg i avtalet via "Lägg till i avtalet" med pro rata nu och helt år i nästa premie. Provision på per-år-rader är inte beslutad (per-rundaflödet ger provision via ärendet som idag).
9. Årspremiefakturan skapas så tidigt att den är betald innan kundens nya avtalsår börjar: fakturadatum = periodstart minus betalningsvillkor (30 dagar) minus marginal. Förslag: 40 dagar före periodstart, som inställning (`invoice_lead_days`) med 40 som standard. Dagens beteende (skapas vid planering med förfallodag idag + 30) ersätts.

Kvar att besvara: inget som blockerar fas 2.

## 10. Rättelser mot tidigare underlag

- Alla 169 kundrader har `billing_type = consolidated`; kolumnen bär ingen information och rörs inte.
- WBAB:s enheter har inte egna Fortnox-kundnummer (alla 16 löser HK 5007). Egna nummer finns bara hos Pelican och Heimstaden.
- WBAB år 1 (F-642) är importerad som `adhoc`, inte som avtalsfaktura, och skyddar därför inte mot dubbelfakturering idag.
- `contract_premium_events.event_type` har redan CHECK med `indexation`; två indexrader finns (Huddinge Pastorat, skrivna via SQL). Ingen constraint-ändring behövs, bara skriv- och läsväg.
- Fyra kunder har redan fler än ett levande avtal på samma kundrad; flera papper per rad är ett existerande tillstånd som UI:t bara inte kan skapa.
