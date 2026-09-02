# Avtalsmodellen som bärare av regler, pris och schema

**Status:** Reviderad efter expertgranskning · 2026-09-01
**Utgångsläge:** Systemet är inte driftsatt. Datamängderna är små (65 enheter, 25 omfattningslänkar, 21 avtal med omfattning, 0 `covers_all_sites`). Vi kan ändra modellen istället för att bygga runt den.

> **Revision 2:** Första utkastets Fas 3–5 (ny tabell `contract_price_lines` + `invoice_items.site_customer_id`) är **förkastad efter granskning**. Den modellerade post↔enhet som en-till-många när FEV:s reningsverkspost kräver många-till-många, och den härledde ett per-enhet-pris som inte finns i upphandlingen. Ersatt av fyra-avtal-modellen i avsnitt 5. Diagnosen i avsnitt 1–3 står kvar.

---

## 1. Målbilden

Ett avtal bär reglerna:

- avtalstyp, giltighetstid, uppsägning
- prislista för avrop
- tjänster som **ingår** (§ 4) kontra som **avropas** (§ 2)
- säljare och kundansvarig
- besöksfrekvens

Enheterna dras in i omfattningen och följer reglerna. Kravet ovanpå det:

1. **Säker fakturering** — både per kund (konsoliderat på HK) och per enhet, beroende på uppsättning.
2. **Schemaläggning per ärende** för enheter som *inte* ska ha återkommande inspektioner (avrop), samtidigt som andra enheter under samma avtal har rondering.

## 2. Vad som redan fungerar

Verifierat i kod och data. Ska inte byggas om.

| Förmåga | Var den bor | Bevis |
|---|---|---|
| Ett avtal, flera enheter | `contract_sites` med `active_from`/`active_to` per enhet | Maserfrakt `4c40f714`, 5 enheter, Katrineborgsgatan från 2026-09-01 |
| Enhet i flera avtal samtidigt | unique `(contract_id, customer_id)` tillåter det | Örjasvägen i både "Förebyggande" och "Mekaniska fällor" |
| Olika besöksfrekvens per enhet | `recurring_schedules.customer_id` + `frequency` | FEV: Återvinningscentralen `quarterly`, övriga `semi_annual` |
| Avrop utan schema | Ingen kod kräver schema för en enhet i omfattningen | 19 av 25 scoped enheter kör utan schema, med ärenden |
| Fakturering per enhet (ad hoc) | `generateAdhocInvoiceForCase` nycklar på ärendets `customer_id` | 351 av 512 fakturor ligger på enhetsrader |
| Prislista: avtalet trumfar kunden | `getServicePricesForCase`, merge `{...customerPrices, ...contractPrices}` | priceListService.ts:545 |
| Multi-kontrakt per kund | `planAllForCustomer` planerar per avtal, `getActiveContracts` sorterar på `display_order` | contractInvoiceGenerator.ts:310 |
| Radbaserade fakturarader | `getServiceItemsForCustomer` → `buildInvoiceItemRows` väljer dem före generisk rad | contractInvoiceGenerator.ts:939, 986 |
| Stegvis etablering | `contract_premium_events` (premietrappa) | Maserfrakt 54 180 → 72 240 kr |
| Enhetsidentitet hela vägen ut | `cases.customer_id` = enheten; RLS och kundportal kör på samma | MultisiteContext: "Site IS the customer now" |

**Slutsats:** modellen finns till stor del. Problemet är tre glapp plus säkerhetsluckor — inte avsaknad av kapacitet.

## 3. De tre glappen

### Glapp A — avtalet är inte källan till pengarna

Avtalsfaktureringen läser ett skalärt `contracts.annual_value` och delar det på perioder (`amountPerPeriodPure`, contractInvoiceGenerator.ts:156-162). När inga service-items finns ger `buildInvoiceItemRows` **en generisk rad** "Avtalsfakturering YYYY-MM" (rad 1005-1012).

Konsekvenser:

- `contracts.selected_products` når aldrig fakturan (bara UI/Oneflow-dump)
- `contract_premium_events` når aldrig fakturan — läses av ContractCard, useCustomerRecord, contractScopeService och `api/oneflow/webhook.ts:1330`, men av ingen billing-service
- `contract_sites` har ingen priskolumn och läses inte av någon billing-service
- **`apply_contract_addition` skriver `customers.annual_value`** medan `planForContract` läser `contracts.annual_value` (rad 344). Avtalstillägg når alltså redan idag aldrig fakturan — samma bugg som premietrappan.

**Maserfrakt visar följden:** avtalen har `annual_value: null` och noll avtalsfakturor. Pengarna kommer från kundraden (73 189 kr) via ett *syntetiskt* avtal som `getActiveContracts` bygger ur `customers` (contractService.ts:1888). Avtalskartan visar 72 240 kr från premietrappan. Två tal som inte känner till varandra.

### Glapp B — "ingår i avtalet" finns inte som val

Ingen kolumn, inget fält, ingen UI-kontroll säger att ett ärende täcks av avtalet.

Debitering uppstår **implicit**: ett ärende blir fakturerbart om någon lägger rader i `case_billing_items`. Uteslutningen av § 4-tjänster sker enbart i presentationslagret (`useAvropCatalog` filtrerar bort dem ur avropskatalogen) — `CaseServiceSelector` och `caseBillingService` känner inte till § 4 alls. En tekniker kan lägga in en tjänst som ingår i avtalet som debiterbar merförsäljning.

### Glapp C — schemalöshet framställs som brist

`RonderingSchedulePage` bygger grupper enbart från `parent_customer_id` och läser aldrig `contract_sites`. Enheter utan schema får amber-markering "N utan schema" och knappen "Schemalägg alla". Batch-modalen: *"N av M enheter saknar schema — dessa schemaläggs nu."*

Avrop är majoritetsfallet i datan men presenteras som fel.

Dessutom: batch-läget ger alla enheter samma frekvens och skickar inget `contract_id`. Och `backfillContractVisitFrequency` (recurringScheduleService.ts:219-238) stämplar **första** schemats frekvens på avtalet — schemaläggs Återvinningscentralen (`quarterly`) först blir hela FEV-avtalet `quarterly` trots att övriga är `semi_annual`. **Detta är ett aktivt fel just nu.**

## 4. Fas 1–2: fundamentet

### Fas 1 — Säkra det som är öppet

Produktionsblockerande, oberoende av avtalsmodellen.

1. **RLS på `recurring_schedules`** — fyra policies `USING (true)` för alla inloggade. Vilken kund eller tekniker som helst kan läsa, ändra och radera alla scheman.
2. **RLS på `contract_sites`** — `authenticated_read`/`authenticated_write`, båda `true`/`true`. Avtalsomfattningen är oskyddad.
3. **RLS på `invoice_items`** — en enda policy, `"Allow all for authenticated users"`, `ALL` med `USING (true) WITH CHECK (true)`. **Fakturarader är helt oskyddade.** Verifierat i `pg_policies`.
4. **Teknikerns läsrätt på `contracts`** — idag endast `begone_employee_email = teknikerns e-post`. 93 av 649 avtal saknar fältet. En tekniker som avslutar ett ärende kan i normalfallet inte läsa avtalet ärendet hör till, vilket blockerar Fas 4. Behövs väg via ärende → kund → `contract_sites`.
5. **Write-without-read på `contract_billing_items`** — tekniker har INSERT utan check men SELECT bara för `item_type='ad_hoc' AND technician_owns_case(case_id)`. Rader utan `case_id` blir osynliga för sin egen skapare (0-radersfällan).

### Fas 2 — Driftläge per enhet i omfattningen

```sql
alter table contract_sites
  add column service_mode text not null default 'inspection'
    check (service_mode in ('inspection', 'on_demand'));
```

- `inspection` — enheten ska ha återkommande besök; saknas schema är det en avvikelse
- `on_demand` — enheten arbetar ärendestyrt; schemalöshet är korrekt

Följdändringar:

- `RonderingSchedulePage` läser `contract_sites` och visar amber-varning **endast** för `inspection`-enheter utan schema. `on_demand` visas neutralt som "Avrop".
- Batch-knappen "Schemalägg alla" hoppar över `on_demand`.
- **Fixa `backfillContractVisitFrequency`** — den ska inte stämpla en enhets frekvens på ett avtal som täcker flera enheter med olika takt. Antingen slopas backfillen för avtal med fler än en enhet i omfattningen, eller så sätts `visit_frequency='custom'`.
- Ingen ändring i `recurring_schedules` — per-enhet-frekvens fungerar redan.

## 5. Fas 3: prisposter som separata avtal

**Detta ersätter första utkastets `contract_price_lines`.**

Ett avtal per prispost, med `contract_sites` som omfattning. Ingen ny tabell.

### FEV konkret

| Avtal | `annual_value` | Omfattning i `contract_sites` |
|---|---|---|
| FEV — Huvudkontor | 6 842 | Huvudkontoret (Västermalmsvägen 12) |
| FEV — Kraftvärmeverket | 5 688 | Kraftvärmeverket (Slaggvarpsvägen 3) |
| FEV — Avfallsanläggningen | 6 842 | Avfallsanläggningen (Skyfallsvägen 20) |
| FEV — Fullservice Reningsverk | 16 896 | de åtta reningsverken |

`sum(annual_value)` = 35 114 kr faller ut av `planAllForCustomer` som redan planerar per avtal.

### Varför detta är bättre, inte bara billigare

1. **Reningsverkspostens paketpris bevaras.** 16 896 kr blir **en** fakturarad för **ett** avtal som omfattar åtta enheter. Ingen fiktiv per-enhet-siffra (16 896 / 8 = 2 112 kr) uppfinns — den siffran finns inte i upphandlingen och går inte att belägga om kunden ifrågasätter en rad.
2. **Många-till-många finns redan.** Unique-constraintet är `(contract_id, customer_id)`, så en enhet kan ligga i flera avtal. Första utkastets `contract_sites.price_line_id` hade **förstört** den kapaciteten — en enhet hade bara kunnat höra till en prispost per avtal.
3. **Periodisering vid stegvis etablering löses av befintlig mekanik.** Varje avtal har egna `contract_start_date`/`contract_end_date`, så en post som börjar senare får sin egen startpunkt. Ingen ny logik för `active_from` mitt i en period.
4. **Avslutade poster hanteras av befintlig `terminateContract`/`cancelFutureForContract`** per avtal. Första utkastet hade `annual_value not null` plus härledning per enhet, vilket gav division med noll när alla enheter avslutats — och därmed risk att fortsätta fakturera för noll utfört arbete.
5. **Ingen ändring i `computePlannedInvoicesPure`, `buildInvoiceItemRows`, `has_generic_items`, `invoice_items` eller cron-jobbet.** Diffen och den historiska fakturahanteringen lämnas orörda.

### Kostnad

Fyra avtalskort istället för ett i avtalskartan. `display_order` används för att gruppera dem visuellt. Det är billigt jämfört med en ny tabell plus ändringar i sex kodställen.

### När en ny tabell ändå behövs

Om en kund dyker upp som **inte** kan modelleras som separata avtal — t.ex. där prisposterna måste dela en enda uppsägning eller ett enda dokument-id mot kunden. Den kunden finns inte i datan idag. Inför `contract_price_lines` då, inte nu.

## 6. Fas 4: "ingår i avtalet" som explicit val

1. `case_billing_items` får:

```sql
alter table case_billing_items
  add column covered_by_contract boolean not null default false;
```

2. `CaseServiceSelector` läser avtalets § 4 och markerar tjänster som ingår — raden skapas med `covered_by_contract = true`, pris 0.
3. Fakturagenereringen hoppar över täckta rader.
4. **Kräver Fas 1 punkt 4** (teknikerns läsrätt), annars kan teknikern inte läsa avtalet.
5. **Kräver Fas 3**, eftersom § 4-tillhörighet med separata avtal avgörs per avtal — bygger man mot ett samlat avtal först får `CaseServiceSelector` byggas om.

## 7. Fas 5: verklig teknisk skuld i pengaflödet

Detta är buggar med pengar. De bör åtgärdas oavsett modellval.

1. **`semi_annual` saknas i radskalningen.** `getServiceItemsForCustomer` (contractInvoiceGenerator.ts:949):
   ```ts
   const divisor = freq === 'monthly' ? 12 : freq === 'quarterly' ? 4 : 1
   ```
   Halvårsavtal får helårsbelopp på raderna medan headern får halva. Verifierat.

2. **Header och rader kan divergera.** `invoices.subtotal/vat/total` sätts från `planned.amount` medan raderna kommer från service-items. `recalculateInvoiceTotals` (rad 881) anropas bara från ad-hoc-vägen (rad 805), aldrig från avtalsvägen.

3. **Cron läser fel tabell.** `api/cron/generate-continuing-contracts.ts` tar `annual_value`, `billing_frequency` m.m. direkt från `customers` medan frontend läser `contracts`. Den har dessutom ingen motsvarighet till service-items alls — cron-genererade fakturor får alltid generiska rader medan frontend-genererade får service-rader. **Två fakturaformat för samma avtal.** En delad matematikmodul löser inte detta; datakällan måste rättas.

4. **`apply_contract_addition` skriver `customers.annual_value`** medan planeraren läser `contracts.annual_value`. Avtalstillägg når aldrig fakturan.

5. **`getServicePricesForCase` skickar aldrig med `contractId`** trots att `cases.contract_id` finns (40/320 satta). Ett ärende kan prissättas från fel avtal när kunden har flera. **Förutsättning för Fas 3** — med fyra avtal på FEV blir detta akut.

6. **`contractBillingService.ts:121-127`** har en egen svagare avtalsupplösning som inte känner till `contract_sites` och ger upp vid fler än ett avtal. **Förutsättning för Fas 3.**

7. **`terminateContract` skriver bara till HK:s kundrad** (`contract_status='terminated'`, `billing_active=false`). Enheternas kundrader lämnas som aktiva.

## 8. Fas 6: fakturering per kund — kräver eget beslut

**Ej redo att planeras.** Två blockerare måste lösas först.

**Provision.** `handle_invoice_paid` börjar med `if new.case_id is null then return new; end if;`. En konsoliderad HK-faktura kan bara bära ett `case_id` — samlar man flera enheters arbete på en faktura blir `case_id = null` och **ingen provision frigörs när den betalas**. Teknikerna slutar få betalt. Detta måste lösas innan konsolidering införs.

**Fortnox-avstämning.** För FEV, där enheterna delar org.nr, går en HK-faktura bra. För WBAB (HK 5007 + 16 enheter med egna kundnummer) blir en konsoliderad faktura omöjlig att stämma av per enhet. Behövs en regel för när konsolidering är tillåten.

**Kritisk begränsning oavsett lösning:** ärendet får aldrig flyttas till HK:s `customer_id`. RLS-policyn `cases_select_scoped` och kundportalen kör båda på `customer_id`, och `multisite_user_roles.site_ids` listar enheternas id. Ett ärende som flyttas till HK försvinner ur platsansvarigs och regionchefs synfält. Konsolidering måste ske i faktureringssteget.

Notera också att 351 av 512 fakturor är ad-hoc per enhet — `generateAdhocInvoiceForCase` nycklar på ärendets `customer_id` och berörs inte av `invoice_recipient` på avtalet.

## 9. Fas 7: städning

- `contracts.site_ids` (uuid[]) — 0 rader, noll kodträffar. Föregångare till `contract_sites`. Ta bort.
- `cases.site_id` — 53 satta, **0 där den skiljer sig från `customer_id`**. Skriven av ett engångsskript, läses av ingen service. Ta bort.
- `MultisiteDashboard.tsx:59,73,83` frågar `private_cases.site_id` som **inte finns** och `status='completed'` som inte används (`cases` använder `'Avslutat'`). Siffrorna kan inte stämma.
- `setSalesPerson` speglar bara till avtalets egen kundrad medan `setAccountManager` speglar till alla täckta enheter. Gör symmetriska.
- `covers_all_sites` — 0 av 649 rader. Behåll eller slopa; mekanismen finns i tre resolversteg och är obeprövad.

**Rör inte:** `contract_billing_items` med `item_type='contract'`. Första utkastet kallade den "död väg" — det är fel. **45 rader, 646 727,60 kr, senast skapad 2026-08-21**, och den läses aktivt av `getMonthlyPipelineData` (contractBillingService.ts:1034) och summeras till `recurringAmount` (rad 1132). Städas den bort nollas pipeline-vyernas återkommande intäkt.

## 10. Ordning

| Fas | Innehåll | Beroende | Bryter befintligt? |
|---|---|---|---|
| 1 | RLS-luckor (inkl. `invoice_items`) | ingen | nej |
| 2 | `service_mode` + backfill-fix | ingen | nej |
| 5:5, 5:6 | Avtalsupplösning i pris- och billingled | ingen | nej |
| 3 | FEV som fyra avtal | 5:5, 5:6 | nej (ny data) |
| 5:1–5:4, 5:7 | Övrig pengaskuld | ingen | ja, avsiktligt (rättar fel belopp) |
| 4 | "Ingår"-val | 1:4, 3 | nej |
| 6 | Fakturering per kund | eget beslut | — |
| 7 | Städning | 3 | ja, avsiktligt |

Fas 1 och 2 kan göras direkt och löser krav 2. Fas 3 löser krav 1 för FEV utan schemaändring. Fas 6 är öppen tills provisionsfrågan är löst.

## 11. Öppna frågor

1. **Provision vid konsoliderad faktura** — hur frigörs provision när `case_id` är null? Blockerar Fas 6.
2. **När är konsolidering tillåten?** Regel som skiljer FEV (delat org.nr) från WBAB (egna kundnummer).
3. **Syntetiska avtal** — när riktiga avtal blir källan, ska synth-fallbacken tas bort eller behållas för enkelkunder?
4. **RPC:n `get_price_list_contract_candidates`** — funktionskroppen är inte granskad. Om dess parent-gren avviker från legacy-vägen får tekniker och admin olika priser för samma ärende.
5. **`contracts.organization_id`** (1 av 649) — tredje täckningsmekanism vid sidan av `contract_sites` och `parent_customer_id`?
6. **Premietrappan vid fyra avtal** — ska varje avtal ha egen trappa, eller behövs en samlad vy över kundens totala årsvärde?

## 12. Migreringsväg för FEV

FEV har idag **noll rader i `contracts`**, noll i `contract_sites`, och alla tio enhetskunder har `annual_value = null` och `billing_active = false`. Konkret ordning:

1. Städa kundkortet: ta bort dubbletten av Återvinningscentralen (`30dbab97…`, saknar avtalsdata), döp om kvarvarande till Avfallsanläggningen.
2. Skapa fyra avtal på HK `#5004` enligt avsnitt 5, med `contract_start_date = 2026-06-30`, `contract_end_date = 2028-06-29`, `notice_period_months = 6`, `billing_frequency = 'annual'`, `billing_anchor_month = 7`.
3. Koppla enheterna till respektive avtals `contract_sites`, med `service_mode` satt per enhet.
4. Sätt `billing_active = true` på rätt nivå — kontrollera att synth-fallbacken inte skapar ett parallellt avtal ur kundraden.
5. Rensa avtalsdatumen från de nio enhetsraderna så att de automatgenererade korten försvinner.
6. Lägg in prislistan för avrop och avtalstexten från villkor 1.8.1.

## 13. Vad planen medvetet inte gör

- Ingen ändring av `cases.customer_id`-konventionen. Enheten förblir kundidentiteten (RLS, kundportal, teknikervy bygger på det).
- Ingen ombyggnad av `recurring_schedules`. Per-enhet-frekvens fungerar redan.
- Ingen ny pristabell. Se avsnitt 5.
- Ingen Fortnox-konsolidering. Om kunden vill ha en faktura byggs den i vår DB först — och först när provisionsfrågan är löst.
- Ingen migrering av `private_cases`/`business_cases` (ClickUp-arvet saknar kundnyckel helt).
