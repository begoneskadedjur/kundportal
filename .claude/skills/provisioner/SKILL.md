---
name: provisioner
description: Använd vid arbete med provisioner och tekniker-ersättning (commission, payout, löneunderlag). Triggers: commission_posts, commission_settings, ProvisionService, provisionService.ts, CommissionSection, useProvisionDashboard, TechnicianCommissions, /admin/provisioner, /technician/commissions, payout_month, ready_for_payout, provisionsexport, invoice paid trigger.
---

# Provisioner och tekniker-ersättning

**Viktigast:** det finns TVÅ generationer med bakvänd namngivning. Gen 2 (AKTIV, live mars 2026) bor i filer som heter `provision*` men typer/tabeller heter `Commission*`. Gen 1 (LEGACY, ClickUp-eran, 5% hårdkodat) bor i filer som heter `commission*`. Allt nytt arbete sker i gen 2. Importera typer från `src/types/provision.ts`, ALDRIG från `src/types/commission.ts` (död gen 1).

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `src/services/provisionService.ts` | Statisk klass `ProvisionService`: settings, beräkning, create/upsert av poster, statusflöde, KPI:er |
| `src/types/provision.ts` | `CommissionPost`, `CommissionStatus`, `COMMISSION_STATUS_CONFIG`, månadshjälpare |
| `src/hooks/useProvisionDashboard.ts` | Admin-hooken; beräknar utbetalningsmånad KLIENT-side (ignorerar lagrade `payout_month`) |
| `src/pages/admin/TechnicianCommissions.tsx` | Adminvy `/admin/provisioner` (gamla `/admin/commissions` redirectar, `src/App.tsx:218`) |
| `src/pages/technician/TechnicianCommissions.tsx` | Teknikerns egen vy, grupperar på `created_at`-månad |
| `src/components/shared/CommissionSection.tsx` | Delad formulärsektion i ärendemodaler; förhandsberäkning via SAMMA `calculateCommission` |
| `src/components/admin/provisions/ProvisionSettingsPanel.tsx` | Admin-UI som skriver `commission_settings` |
| `src/services/provisionExportService.ts` | CSV-export: `exportPayrollCSV` (löneunderlag), `exportDetailedCSV` |
| `src/components/admin/technicians/EditCaseModal.tsx` | Skapandeflöde privat/företag: `upsertPostsForCase` vid VARJE sparning i 'Avslutat' (~:1174) |
| `src/components/coordinator/EditContractCaseModal.tsx` | Avtalsärenden: `createPostsForCase` ENDAST vid övergång till 'Avslutat' och bara om inga poster finns (~:1185-1189), räknar aldrig om |
| `supabase/migrations/20260623_invoice_paid_automation.sql` | DB-trigger: faktura betald ⇒ post flyttas till `ready_for_payout` |

## Arkitektur

**Tabeller:** `commission_posts` (ledger, en rad PER TEKNIKER per ärende; delade jobb = flera rader med `share_percentage`) + `commission_settings` (key/value: `engangsjobb_percentage`=6.00, `min_commission_base`=4000, `payout_cutoff_day`=6.00). OBS: `case_id` är TEXT (inte uuid, inget FK). Flaggan `is_commission_eligible` finns på `private_cases`, `business_cases` och `cases` och styr förifyllnad av radioknappen.

**Beräkning:** `effectiveBase = is_rot_rut ? rot_rut_original_amount : base_amount` (belopp FÖRE ROT-avdrag). Krav: `effectiveBase >= min_commission_base`, annars Error och ingen post. Per tekniker: `round((effectiveBase - deductions) * pct/100 * share/100, 2)`. Avdrag dras FÖRE procenten men tröskeln testas mot `effectiveBase` UTAN avdrag. `base_amount` = `billingSummary?.subtotal || case_price` (exkl moms). `deductions` förifylls med `billingSummary.subcontractor_total` bara om inga poster finns.

**Statusflöde (kritiskt ordningsberoende):**
```
Ärende sparas 'Avslutat' → 1) faktura genereras (InvoiceService.upsertInvoiceFromCase, FÖRE provisionen;
                              avtalsärenden skapar i stället contract_billing_items via ad-hoc-flödet)
                           2) commission_posts skapas, status 'pending_invoice'
Fortnox-webhook (api/fortnox/webhook.ts:68,133-146): Balance==0 && FinalPayDate satt ⇒ invoices.status='paid'
  → DB-trigger trg_invoice_paid: matchar cp.case_id = new.case_id::text AND status='pending_invoice'
    ⇒ 'ready_for_payout', sätter invoice_paid_date + payout_month, loggar case_comments
Admin batch i /admin/provisioner: ready_for_payout → approved → paid_out → CSV-löneunderlag
```
Allt annat än `pending_invoice` räknas som LÅST: `upsertPostsForCase` vägrar räkna om, `CommissionSection` disablar fälten (`postsLocked`). Manuell fakturamarkering via `InvoiceService.updateInvoiceStatus` triggar också DB-triggern.

## Invarianter

- ALDRIG räkna om historiska poster från aktuella settings. Procent/tröskel fryses per post vid skapandet, det är korrekt design för lönehistorik.
- ALDRIG låta provisionsfel blockera ärendesparningen. Alltid try/catch runt post-anropen med toast (`Provision: <msg>`), ärendet sparas alltid.
- ALDRIG lita på kodens fallback-värden för settings. `payout_cutoff_day` är 6 i DB men 20 i fallbacken (`useProvisionDashboard.ts:94,139` och `provisionService.ts:27`), testa alltid mot DB.
- ALDRIG DDL mot `commission_posts` utan migrationsfil. Tabellskapandet saknar käll-DDL i repot (schemat lever bara i DB), varje ändring MÅSTE bli en migration för spårbarhet.
- ALDRIG ändra en post som inte är `pending_invoice` från kod utanför det avsedda batch-statusflödet.
- Jämförelser mot `invoices.case_id` (uuid) kräver `::text`-cast eftersom `commission_posts.case_id` är TEXT.
- Rör inte DB-triggerns kärna (`pending_invoice`-guard, `SECURITY DEFINER`, case_id-cast). Bara `payout_month`-beräkningen får förbättras (se Riktning).
- Denormaliserade `technician_name/email` fryses vid skapandet, "staleness" är en feature (snapshot vid intjänandet), synka inte mot `technicians`.

## Vanliga uppgifter

**Ändra procent/tröskel/brytdag:** ingen kod. Kugghjulet på `/admin/provisioner` skriver `commission_settings`. Befintliga poster påverkas inte.

**Ny status i flödet:** ändra ALLA ihop: `types/provision.ts` (`CommissionStatus` + `COMMISSION_STATUS_CONFIG`), `provisionService.ts` (`updateStatus`, `getKpis`), `useProvisionDashboard.ts` (statusräknare på TRE ställen: `payoutSummary`, `monthlyPayouts`, `ProvisionKpi`-init), båda `TechnicianCommissions.tsx`, `provisionExportService.ts` (`statusLabels`), ev. DB-triggern och `economicsServiceV2.ts`.

**Ny modal som ska skapa provision:** återanvänd `CommissionSection` + kopiera mönstret från `EditCaseModal.tsx`: (a) ladda `getPostsByCase(caseId)` vid öppning, sätt `existingCommissionPosts` + `postsLocked = posts.some(p => p.status !== 'pending_invoice')`, förifyll från posterna; (b) spara `is_commission_eligible` på ärendet vid varje sparning; (c) vid status exakt `'Avslutat'` anropa `upsertPostsForCase` i try/catch med toast.

**Felsöka "provision skapades inte":** i ordning: (1) status exakt `'Avslutat'`? (2) radioknapp Ja + minst en tekniker? (3) `effectiveBase >= 4000`? (4) låsta poster (upsert kastar)? (5) andelar summerar till 100 (±0.01)? Fel syns som toast + `console.warn`.

**Felsöka "post fastnar i pending_invoice":** fakturan måste ha `case_id` satt och nå status 'paid'. Fakturor utan `case_id` triggar aldrig flytten (avsiktligt, triggerns rad 34).

## Fallgropar

- Månadsväljaren i adminvyn filtrerar på **`created_at`** (postens skapandemånad), inte utbetalningsmånad (`provisionService.ts:201`). En post skapad i maj som betalas i juli syns inte under juli.
- KPI-raden ignorerar tekniker-/statusfilter (`getKpis` tar inga filters) medan listorna filtreras. Siffrorna "stämmer inte" ihop by design.
- TRE sanningar om utbetalningsmånad: triggern sätter `payout_month = betalmånad + 1` rakt av; `updateStatus('ready_for_payout')` sätter `nu + 1` och `invoice_paid_date = idag`; UI:t ignorerar kolumnen och räknar själv med cutoff (`useProvisionDashboard.ts:117-158`). UI:t är sanningen för utbetalningsvyn.
- `EditCaseModal` (upsert vid varje sparning) vs `EditContractCaseModal` (create-once, räknar aldrig om) beter sig olika. Prisändring på avslutat AVTALSÄRENDE uppdaterar inte provisionen. Kan vara avsiktligt (avtalsbilling går via `contract_billing_items`), kräver produktbeslut innan "fix".
- ~~`upsertPostsForCase` raderar poster INNAN valideringen körs~~ FIXAT 2026-07-05 (`f46b5787`): `validatePostInput` (tröskel + andelar) körs före delete och delas med `createPostsForCase`. Partiellt unikt index `idx_commission_posts_case_technician_active` på `(case_id, technician_id) WHERE status != 'cancelled'` skyddar mot dubbletter vid parallella sparningar.
- `ProvisionService.markInvoicePaid` och `deletePost` är döda (ersatta av DB-triggern resp. aldrig kopplade).
- Gen 1-webhooken (`api/clickup-webhook.ts`) skriver fortfarande `commission_amount` på case-tabellerna, och teknikerns ärendekort VISAR fältet som "Provision" (`src/components/technician/cases/CaseCard.tsx:341`, används av `TechnicianCases.tsx` på `/technician/cases`). `caseDuplicationService.ts:92-97,179-184` nollar fälten vid duplicering, behåll det mönstret.
- Ekonomidashboarden (`economicsServiceV2.ts:751-807`, `getTechnicianCommissionTrend`) läser gen 2:s `commission_posts` och speglar medvetet provisionssidans gruppering (created_at, alla statusar utom 'cancelled') för att siffrorna ska matcha.
- Tekniker-dashboarden hämtar legacy-API:t `/api/technician/dashboard` för ärendestatistik men provisionssiffrorna kommer från gen 2, blanda inte källorna.

## Riktning

1. ~~**Fixa tyst dataförlust i `upsertPostsForCase`**~~ KLART 2026-07-05 (`f46b5787`): validering före delete + partiellt unikt index (migration `20260705_unique_commission_post_per_technician`). Kvarstående målbild: delete+insert som Postgres-RPC för äkta atomicitet.
2. **Lås RLS på `commission_posts` (säkerhetsskuld, känd i säkerhetsplanen).** Dagens läge: alla fyra policies är `USING (true)` för `authenticated`, dvs. även kundinloggningar kan läsa/ändra alla teknikers lönedata. Teknikervyn filtrerar bara klient-side. Målbild: admin/koordinator full CRUD, technician SELECT på egna poster, customer inget; samma genomgång för `commission_settings` (skrivning admin-only). OBS: tekniker kan avsluta ärenden, så insert behöver tillåtas för egna poster eller flyttas till `SECURITY DEFINER`-RPC. Verifiera postskapande som tekniker/koordinator/admin efter ändringen.
3. **EN källa för utbetalningsmånad + rätt population i löneunderlaget.** Dagens läge: tre inkonsistenta beräkningar (se Fallgropar) och `exportPayrollCSV` exporterar per skapandemånad inkl. obetalda `pending_invoice`-poster. Målbild: DB-funktion `compute_payout_month(paid_date)` som läser cutoff från settings, används av trigger och `updateStatus`; UI läser lagrade `payout_month`; ny export filtrerad på `payout_month` + status i (`ready_for_payout`,`approved`). Backfilla befintliga rader och stäm av med lönekörningen först, detta ändrar vad lönesystemet får.
4. **Radera gen 1-ytan.** Dagens läge: två parallella `calculateCommission` (5% hårdkodat vs 6% konfigurerbart) och bakvänd typnamngivning gör att nästa utvecklare lätt lagar fel generation. Målbild: bryt först ut `commissionService.getAvailableTechnicians` (används av `ClosedCasesFunnel.tsx` och `CustomerJourney.tsx`), radera sedan `commissionService.ts`, `commissionCalculations.ts`, `commissionExportService.ts`, `useCommissionDashboard.ts`, `useCommissionExport.ts`, `components/admin/commissions/*`, `MonthlyCommissionModal.tsx`, `useSecureData.ts`. Rör INTE `api/technician/dashboard.ts` (anropas av `TechnicianDashboard.tsx:95`) och lämna `api/clickup-webhook.ts` + `types/commission.ts` till ClickUp-avvecklingen. Kör `npm run type-check` efteråt (API-projektet ska förbli grönt).
