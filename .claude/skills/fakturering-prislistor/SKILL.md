---
name: fakturering-prislistor
description: Fakturering, prislistor och prissättning i BeGone Kundportal. Använd vid ändringar i invoiceService, contractBillingService, contractInvoiceGenerator, caseBillingService, priceListService, tabellerna invoices/invoice_items/contract_billing_items/case_billing_items/price_list_items, Fortnox-integration, avtalsfakturering, årspremie, merförsäljning/adhoc, ROT/RUT, fakturanummer, billing/invoicing/pricing/price list/contract billing.
---

# Fakturering, prislistor och prissättning

## Nyckelfiler

| Fil | Roll |
|---|---|
| `src/services/invoiceService.ts` | Privat/företagsfakturor: `createInvoiceFromCase` (65), `upsertInvoiceFromCase` (277), `isInvoiceStale` (616) |
| `src/services/contractInvoiceGenerator.ts` | NUVARANDE avtalsmotor: plan/diff/apply direkt mot `invoices`. `computePlannedInvoicesPure` (232, ren funktion), `generateAdhocInvoiceForCase` (670) |
| `src/services/contractBillingService.ts` | `contract_billing_items`: legacy-batch + `createAdHocItemsFromCase` (353) + Fortnox-import `importHistoricalItems` (1346) |
| `src/services/caseBillingService.ts` | Ärenderader tjänster/artiklar; `caseHasBillableAmount` (588), `getCaseBillingItems` (361, default status='pending'!) |
| `src/services/priceListService.ts` | Prislistor; `getEffectiveServicePrice` (281) |
| `src/pages/admin/invoicing/index.tsx` | UI läser ENBART `invoices` för alla tre flikar via `PrivateBusinessInvoicing` med `invoice_type`-filter |
| `src/components/admin/invoicing/InvoiceDetailModal.tsx` | Manuell Fortnox-push, `handleSendToFortnox` (370) |
| `src/components/shared/CaseServiceSelector.tsx` | Prisguiden: fast pris-låsning + markup-slider |
| `api/fortnox/webhook.ts` | Fortnox → statussynk till BÅDA tabellerna, skyddslistor mot bakåtsteg (rad 95-100) |
| `api/cron/generate-continuing-contracts.ts` | Server-side KOPIA av periodmatematiken (se Fallgropar) |

## Arkitektur

Tre flöden, och för avtalskunder TVÅ parallella system:

- **A. Privat/Företag**: `case_billing_items` → `InvoiceService.createInvoiceFromCase` → `invoices` + `invoice_items` (`invoice_type='case'`, `'partial'` för delfaktura från RevisitModal).
- **B. Avtal (årspremie)**: NUVARANDE är `ContractInvoiceGenerator` (plan/diff/apply → `invoices` med `invoice_type='contract'`, event-driven från `BillingSettingsModal`, uppsägning, kundimport, cron). LEGACY är `contract_billing_items`-batchpipelinen i `contractBillingService.ts`. Komponenterna `MonthlyBillingPipeline.tsx`, `AdhocSalesPipeline.tsx`, `ContractBillingGenerateModal.tsx` är INTE inkopplade i någon route. `docs/merforsaljning-avtal-och-prissattning.md` beskriver den gamla routingen, lita inte på den för UI-frågor.
- **C. Merförsäljning avtal**: avslutat avtalsärende → `createAdHocItemsFromCase` → cbi-rader (`item_type='ad_hoc'`) → `generateAdhocInvoiceForCase` → `invoices` (`invoice_type='adhoc'`). Här möts systemen: cbi-raderna stämplas med `invoice_id` + `status='invoiced'`.

**Auktoritet**: `invoices` är sanning för UI, `contract_billing_items` för aggregering/import. `importHistoricalItems` skriver medvetet till båda och dedupar autogen-rader vars period överlappar.

**Statusflöden** (Fortnox-linjerade): `invoices`: pending_approval → ready → draft → booked → sent → paid (`overdue` lagras aldrig, härleds i UI). `contract_billing_items`: pending → approved → draft → booked → sent → overdue → paid (`invoiced` = legacy). `case_billing_items`: pending → approved → billed → cancelled. `LOCKED_STATUSES = booked/sent/paid` (generator rad 113) rörs aldrig av plan-apply. Webhooken slår alltid upp fakturan i Fortnox API (litar inte på payload); webhook-mekaniken i detalj: se skill externa-integrationer.

**Prissättning**: `articles.default_price` = intern kostnad, ALLTID. Tjänstepris-fallback: kundens prislista (service-rad) → standardprislistan (`is_default=true`) → null → `services.base_price`/prisguidens markup. Årspremien (`customers.annual_value`, INTE `annual_premium` som äldre docs säger) är helt orörd av prislistor. `price_list_items` har `article_id` XOR `service_id`; nya flöden skriver bara service-rader.

## Invarianter

- ALDRIG `toISOString()` för date-kolumner, alltid lokala komponenter (`toLocalIsoDate`, generator rad 117) - UTC backar en dag i svensk sommartid.
- ALDRIG byta strängen `'Anpassat pris'` i `invoice_items.article_name` - `isInvoiceStale` matchar exakt den (invoiceService.ts:645).
- ALDRIG "fixa" att `getCaseBillingItems` default-filtrerar `status='pending'` - det är dubbelfaktureringsskyddet.
- ALDRIG skriva en syntetisk kontrakt-rad (`id='synth-<customerId>'`, `_synthetic:true`) till DB - de skapas on-the-fly av `ContractService.getActiveContracts` → `buildSyntheticContract` (contractService.ts:1974) och synt-planer får `contractId=null` (generator rad 64).
- ALDRIG `onConflict`-upsert mot `price_list_items` - unique-indexen är partiella, därav check-then-insert-mönstret i priceListService (kommentar rad 366-373).
- ALDRIG röra `case_billing_overrides` eller artikel-raderna i `price_list_items` - levande konsumenter: CaseArticleSelector + `getCustomPrice`-logiken i invoiceService (rad 102/644/686) läser overrides, `getArticlesWithPrices` (caseBillingService.ts:43, via `getCustomerArticlePrices`) läser artikel-raderna. `customer_contract_articles` rörs inte heller, men dess ENDA konsument är `generateBillingItems` (contractBillingService.ts:125) som själv bara nås från det orutade legacy-batch-UI:t - pensioneras batchen (Riktning 4) blir tabellen konsumentlös.
- ALDRIG förenkla `F-%`/`is_historical`-överlappslogiken i `buildDiff` (rad 447-448) - den bryggar Fortnox-perioder (avtalsdatum) mot autogen (kalendermånad); förenkling ger dubbelfakturor för importerade kunder.
- Bucketera adhoc på `invoice_date` (ärendets avslut) och årspremie på `billing_period_start` - blanda aldrig.
- Ändrar du periodmatematiken i `contractInvoiceGenerator.ts` MÅSTE `api/cron/generate-continuing-contracts.ts` ändras likadant. Dagens läge kräver detta eftersom cron inte kan importera frontend-koden; målbilden är en delad ren modul (se Riktning).
- Filtreringen "tjänsterader om de finns, annars artikelrader" finns copy-paste på TRE ställen som måste hållas i synk: invoiceService.ts:82, contractBillingService.ts:369, caseBillingService.ts:596. Dagens läge kräver manuell synk; målbild är gemensam hjälpare (se Riktning).

## Vanliga uppgifter

**Ändra avtalsperioder/belopp**: `computePlannedInvoicesPure`/`iterPeriodsPure`/`amountPerPeriodPure` i generatorn OCH kopiorna i cron-filen. Preview i `BillingSettingsModal` följer automatiskt (importerar pure-funktionen).

**Nytt fakturafält till Fortnox**: `invoices`-kolumn → `src/types/invoice.ts` → `createInvoiceFromCase` + `regenerateInvoiceItems` → `InvoiceDetailModal.handleSendToFortnox` (payload) → ev. `exportForFortnox` (CSV).

**Ny status**: `ContractBillingItemStatus` + config (contractBilling.ts), `InvoiceStatus` + config (invoice.ts), ordningen i `deriveInvoiceStatus` (contractBilling.ts:355), tidsstämplar i `updateItemStatus`/`bulkUpdateStatus` + `updateInvoiceStatus`, webhookens skyddslistor (webhook.ts:95), `LOCKED_STATUSES`/`EDITABLE_STATUSES` (generator 113-114), filterbadges i `PrivateBusinessInvoicing.tsx`.

**Kund sägs upp / importeras**: uppsägning → `TerminateContractModal` → `cancelFutureAfterTermination` (period som STARTAR på cutoff raderas; inom bindningstid gäller `contract_end_date`, annars `terminated_at + notice_period_months`). Fortnox-import: kör `regenerateForCustomer` FÖRE `importHistoricalItems` — importens dedupe raderar autogen-fakturor vars period överlappar Fortnox-raderna, så autogen måste finnas först (ordningen är kommenterad i `ImportCustomerByOrgnrModal.tsx:345-354`; samma ordning i `ImportCustomerByPdfModal.tsx:443/463`). Efter importen skyddar `F-%`-täckningen i `buildDiff` mot att perioderna återskapas.

## Fallgropar

- **Fel i adhoc-fakturaskapandet sväljs**: `createAdHocItemsFromCase` markerar case-items `'billed'` FÖRE fakturan och try/catch:ar `generateAdhocInvoiceForCase` med bara console.error (contractBillingService.ts:447-449). Misslyckas det ligger cbi-rader utan `invoice_id` osynliga i UI, och omkörning hjälper inte eftersom raderna redan är billed (tyst intäktsläckage, se Riktning).
- **Tre fakturanummer-generatorer** med samma format `INV-YYYYMM-XXXX`: invoiceService count()+retry (23-60, kolliderar efter raderade rader, fallback bryter formatet), generatorn max-sekvens (1135-1156, fixad efter produktionsbugg), cron fortfarande buggig count UTAN retry (rad 279). Cron + manuell fakturering samma natt kan kollidera.
- **`mapped_service_id` i `case_billing_items` pekar på tjänsteRADENS `case_billing_items.id`, inte `services.id`** (caseBilling.ts:65).
- **`monthly_batch`-adhoc**: `generateAdhocInvoiceForCase` plockar ALLA kundens ofakturerade adhoc-rader för månaden och återanvänder öppen adhoc-faktura, inte bara ärendets rader.
- **Moms**: Fortnox `Total` är inkl. moms och delas med 1.25 vid import. `case_billing_overrides.custom_total_price` matas in inkl. moms i `CaseArticleSelector` men lagras exkl. (delas med 1.25 på rad 491, sparas via `setCustomPrice` rad 503). Vid override skapas fakturarader med pris 0 som referens + en rad "Anpassat pris".
- **Kundnummer-gating**: `caseHasBillableAmount` styr om `getOrCreateCaseCustomer` körs (EditCaseModal.tsx:1082) - 0-kronorsärenden ska inte konsumera kundnummer. Fortnox-push kräver `customers.customer_number`.
- **Avtalsfakturans rader** speglas från containern: `getServiceItemsForCustomer` (generator 859) läser `case_billing_items` där `case_id = contracts.id` (importerad container, `oneflow_contract_id='imported-<customerId>'`); saknas rader skapas generisk rad och `has_generic_items` triggar update när riktiga rader senare finns.
- **`removeCaseArticle` nollar `invoice_items.case_billing_item_id` först** (FK, caseBillingService.ts:295) - det är så `isInvoiceStale`s count-jämförelse upptäcker borttag.
- **ROT/RUT**: tjänsterader använder `services.rot_rate_percent/rut_rate_percent` med default-fallback (caseBillingService.ts:444-451), artikelrader hårdkodade 30/50 via `ROT_RUT_PERCENT` (caseBilling.ts:265-268). Fakturering blockeras om ROT/RUT-rad saknar `fastighetsbeteckning` (invoiceService.ts:91-99).
- **Historiska perioder** skapas direkt som `status='paid', is_historical=true` och döljs per default i alla fakturalistor (`getInvoices`, invoiceService.ts:356).
- **`iterPeriodsPure` annual använder `<` (inte `<=`)** mot avtalsslut plus elva-månaders-check (rad 208-214) - avsiktligt, samma skäl som cutoff-regeln.

## Riktning

Dagens läge vs målbild - betala av när du ändå rör koden:

1. **Adhoc-felsväljningen (högst prio)**: idag sväljs DB-fel och `generateAdhocInvoiceForCase` returnerar `null` både för "inga rader" och fel. Målbild: returnera `invoiceId/invoiceError` till anroparna (`EditContractCaseModal`, `RevisitContractModal`) med toast-varning, kasta vid DB-fel, plus backfill-cron för `item_type='ad_hoc' AND invoice_id IS NULL AND status != 'cancelled'` (samma filter som `generateAdhocInvoiceForCase` använder, generator rad 695-697; cron-struktur enligt `api/cron/reactivate-paused-billing.ts` med `withCronLog`, men kör backfillen sekventiellt per kund).
2. **Delad periodmatematik**: synk-invarianten finns för att cron-filen är en handkopia som redan driftat (fel nummergenerator, hårdkodade 30 dagar i stället för `PaymentTermsService`, ingen `contract_id`). Målbild: beroendefri modul (t.ex. `src/services/shared/contractPlanMath.ts`) utan supabase-imports, importerad av båda, med enhetstester på kvartal över årsskifte/anchor/uppsägning. Då stryks invarianten.
3. **En atomär fakturanummer-generator**: målbild är en Postgres-RPC (`INSERT ... ON CONFLICT ... RETURNING` mot räknartabell, seedad från nuvarande max) som ersätter alla tre implementationerna. `F-%`-nummer sätts direkt av importen och ska INTE gå genom räknaren.
4. **Pensionera legacy-batch-UI:t**: `MonthlyBillingPipeline.tsx`, `AdhocSalesPipeline.tsx`, `ContractBillingGenerateModal.tsx` (+ `ContractInvoiceModal.tsx`) + metoderna bara de når (`generateBatchBilling`, `getMonthlyPipelineData`, `getAdhocSalesPipelineData`, `getBillingPipeline`, `groupItemsIntoInvoices`, `generateBillingItems`, `getCustomerInvoice`; funktionen `calculateBillingPeriod` ligger i `types/contractBilling.ts:222`) är orutad död kod som kan skapa parallella cbi-rader om den kopplas in av misstag. Med den försvinner flera `toISOString()`-brott mot datumregeln - men OBS: `importHistoricalItems` har kvar egna (contractBillingService.ts:1460-1461, månads-fallback för perioder) som ska fixas separat. Radera i egen commit, behåll resten av `contractBillingService.ts` (flöde C, Fortnox-import, statusuppdateringar lever). Kolla först att multi-kontrakt-planen inte återanvänder batchflödet.
