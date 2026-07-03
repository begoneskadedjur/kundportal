---
name: externa-integrationer
description: Externa integrationer i BeGone Kundportal - Oneflow (avtal/offerter), Fortnox (fakturor/ekonomi), ClickUp (legacy, avvecklas), e-post (Resend/SMTP) och SMS (ClickSend). Använd vid ändringar i api/oneflow/*, api/fortnox/*, api/clickup-webhook.ts, api/create-case.ts, api/send-sms.ts, api/email-templates.ts, api/_lib/auth.ts, contractService, fortnoxService, clickupFieldMapper, tabellerna contracts/oneflow_sync_log/fortnox_tokens/sms_templates, webhooks, contract signing, invoice sync, email templates, OAuth.
---

# Externa integrationer: Oneflow, Fortnox, ClickUp, e-post/SMS

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `api/_lib/auth.ts` | `requireAuth(req,res,roles[])` (rad 66) - skickar själv 401/403, returnerar `null`. `profiles.is_admin=true` räknas alltid som admin. `requireAuthenticated` (rad 34) = bara giltig JWT, kostnadsskydd |
| `api/_lib/cronLogger.ts` | `withCronLog(jobName, fn)` loggar till `cron_runs`, best-effort. OBS: `sync-oneflow` använder den INTE |
| `api/oneflow/webhook.ts` | 2000 rader, hjärtat i Oneflow-inflödet. `api/oneflow-webhook.ts` är bara re-export-alias - Oneflow är registrerat mot den URL:en, ta aldrig bort |
| `api/oneflow/create-contract.ts` | Skapa/publicera offert/avtal + persistera draftItems till `case_billing_items` (`case_type='contract'`) |
| `api/cron/sync-oneflow.ts` | Nattlig helsync 03:00. Kan TRASHA avtal - se Fallgropar |
| `api/constants/oneflowTemplates.js` | Godkända mall-ID:n. CommonJS, `require()`-importeras från TS - konvertera INTE till ESM. `src/constants/oneflowTemplates.ts` är en separat frontendkopia |
| `api/fortnox/refresh.ts` | `getValidAccessToken()`, tokenrotation, testläge via `FORTNOX_USE_TEST` (`fortnox_test_tokens` vs `fortnox_tokens`) |
| `api/fortnox/proxy.ts` | Generisk proxy `?path=...` mot Fortnox-API:t. Sedan 2026-07-03: `requireAuth(['admin','koordinator'])` + resurs-allowlist (customers/invoices/articles/companyinformation) + path-validering. Ny Fortnox-resurs kräver tillägg i allowlisten |
| `api/fortnox/webhook.ts` | Fakturastatusåterläsning - litar aldrig på payload, hämtar fakturan från Fortnox API |
| `api/clickup-webhook.ts` | LEGACY inflöde ClickUp→Supabase. Kill-switch `CLICKUP_WEBHOOK_PAUSED=true` |
| `api/create-case.ts` | LEVER i produktion: skapar ClickUp-task + DB-rad vid nytt ärende. Kräver server-varn `CLICKUP_API_TOKEN` |
| `api/extract-contract-data.ts` m.fl. `extract-*` | Gemini AI-baserad PDF-extraktion (`GOOGLE_AI_API_KEY`) för import av BEFINTLIGA avtal - INTE Oneflow-API |
| `src/services/fortnoxService.ts` | Frontendens enda väg till Fortnox (via proxyn). `findOrCreateCustomer` rad 159, `ensureArticlesExistForInvoiceItems` rad 232 |
| `src/services/clickupFieldMapper.ts` vs `src/utils/clickupFieldMapper.ts` | TVÅ olika filer med samma namn. services = utflödes-sync (död, dör med ClickUp). utils = `PEST_TYPE_OPTIONS`, systemets kanoniska skadedjurslista - ÖVERLEVER avvecklingen |
| `api/send-sms.ts` | ClickSend-SMS, `requireAuth(['admin','koordinator'])`, mallar i `sms_templates` (`slug`, `{{variabel}}`). Enda anroparen: koordinatorns `CreateCaseModal.tsx:1256` |
| `api/email-templates.ts` | Delade HTML-mallar (`baseTemplate`, brand `#20c58f`) |

## Arkitektur

**Oneflow (dubbelriktad):** `create-contract.ts` skapar kontrakt. Avsändare mot Oneflow är ALLTID `info@begone.se` (`x-oneflow-user-email`); skaparen sparas separat i `created_by_*`. Webhooken tar emot events, hämtar full data från Oneflow-API:t och upsertar `contracts` på `oneflow_contract_id`. Create-sidan och webhooken kan skriva i valfri ordning (medveten race-hantering, båda upsertar på `onConflict: 'oneflow_contract_id'`); webhookens update strippar `price_list_id`, `created_by_*`, `source_id/source_type` som ägs av create-sidan (webhook.ts:562) och nedgraderar aldrig `LIFECYCLE_STATUSES` vid `preserveStatus`. Nattlig `sync-oneflow` reparerar drift (importerar saknade, trashar borttagna, `STATUS_PRIORITY` rad 71 förbjuder nedgradering). Allt loggas till `oneflow_sync_log` - primär felsökningskälla. OBS: `useOneflowWebhook` prenumererar via realtime men tabellen ingår INTE i `supabase_realtime`-publikationen (verifierat mot live-DB), så prenumerationen är en tyst no-op; hooken fungerar via sin initiala fetch. Se skill supabase-databas.

Vid `contract:sign`: `createCustomerFromSignedContract` (webhook.ts:825) skapar kund ENDAST för `type='contract'` (offert blir aldrig kund) och kräver `contact_email`+`company_name`, annars tyst skip. Dedupe: `oneflow_contract_id` → `organization_number` → `contact_email`; träff = länka bara, skapa inte. Kundnummer via RPC `allocate_customer_number(p_group_id)`. Källärendet får status `'Offert signerad - boka in'` med `start_date/due_date = null` - avsiktligt, avbokar planeringen så koordinatorn bokar om. Ärendekoppling via `contracts.source_id/source_type`; updates provar alltid tabellordningen `cases` → `private_cases` → `business_cases`.

**Fortnox:** Frontend anropar ALDRIG Fortnox direkt. Kedja: `FortnoxService` → `/api/fortnox/proxy?path=...` → Fortnox med server-hämtad OAuth-token. Fakturaskapandet är klient-orkestrerat (`InvoiceDetailModal`; `ContractInvoiceModal` lever bara i det orutade legacy-batch-UI:t och når aldrig produktion, se skill fakturering-prislistor Riktning 4) men idempotent (GET-före-POST, 409 = finns redan = OK). Skapar bara UTKAST, aldrig bokförda. Vårt `customers.customer_number` = Fortnox CustomerNumber (delad nyckel). Webhooken härleder status (paid > overdue > sent > booked) och skriver till BÅDA `contract_billing_items` och `invoices` på `fortnox_document_number`, med monotoni-skydd (`protectedByTarget` rad 95: paid skrivs aldrig ned). Fakturaflöden: se skill `fakturering-prislistor`; paid-trigger: se skill `provisioner`.

**ClickUp:** Legacy under avveckling (planerad ~juni 2026, datumet passerat men koden lever). Inflödet (webhook → routing på list-ID: `901204857438`→`private_cases`, `901204857574`→`business_cases`, annars `customers.clickup_list_id`→`cases`; upsert på `clickup_task_id`) kan pausas med `CLICKUP_WEBHOOK_PAUSED`. Utflödet (`src/services/clickupSync.ts` + `useClickUpSync` + `clickupUserMapping` + `clickup/client.ts`) är död kod utan anropare. `api/create-case.ts` lever dock: ClickUp-task skapas FÖRE DB-insert och raderas vid DB-fel. Bygg INGET nytt mot ClickUp.

**E-post:** Två transporter utan delad modul - Resend via nodemailer-SMTP (`smtp.resend.com:465`, 6 inline-block i 5 filer: `create-customer.ts:413`, `revoke-invitation.ts:162`, `send-customer-invitation.ts:96` + `:201`, `send-staff-invitation.ts:116`, `send-work-report.ts:135`) och Resend REST-API direkt (`reset-password.ts:146`, `send-multisite-invitation.ts:251`, `create-multisite-users.ts:299`, `send-welcome-password.ts:124`). Generisk SMTP (`SMTP_HOST`-env) endast i `send-email-campaign.ts`. E-postfel är icke-fatala där mejlet är en sidoeffekt: huvudoperationen lyckas ändå (`create-customer.ts` returnerar `email_sent: false`; `create-multisite-users.ts` loggar bara felet).

## Invarianter

- ALDRIG ta bort `bodyParser: false` i Oneflow/ClickUp-webhookarna - signaturverifieringen kräver rå body.
- ALDRIG "rätta" stavfelen `utfrande-adress`, `per--org-nr`, `e-post-anstlld`, `avtalslngd` i fältmappningarna - det är Oneflows faktiska custom_id:n.
- ALDRIG konvertera `api/constants/oneflowTemplates.js` till ESM - webhook.ts:6 `require()`-importerar den.
- ALDRIG ta bort retry-dansen för templatedata (webhook.ts:208, upp till 100 s) eller sänka `maxDuration: 300` i vercel.json - Oneflows templatedata är eventually consistent.
- ALDRIG förenkla dubbel-upserten på `contracts` till "en skrivare" - den hanterar racet mellan create-contract och webhooken; låsordning ger bara problem.
- Spara ALLTID nya `refresh_token` vid Fortnox-refresh (refresh.ts:62-70) - Fortnox roterar den vid VARJE refresh; tappas den är integrationen låst tills admin gör om OAuth-flödet.
- `contracts.total_value` från Oneflow är ÅRSVÄRDET, inte kontraktsvärdet (webhook.ts:651, :960). Totalvärde = årsvärde × antal år.
- Känslig ny endpoint under `api/`: använd `requireAuth` (mönster: `const auth = await requireAuth(req, res, [...]); if (!auth) return`). Understreck-prefix (`_lib/`) hindrar att filen exponeras som endpoint.
- Webhookar svarar 200 även vid interna fel (Fortnox webhook.ts:153, Oneflow-kundskapande) - avsiktligt mot retry-spam. Felsök via `oneflow_sync_log`/Vercel-loggar, inte HTTP-status.
- Vid ClickUp-avveckling: rör INTE `clickup_task_id`, `case_number`, statussträngarna eller de svenska kolumnnamnen i `private_cases`/`business_cases` (`skadedjur`, `adress`, `pris` - skapade av `sanitizeFieldName`) - hela ärendehanteringen läser dem.

## Vanliga uppgifter

**Ny Oneflow-mall:** Mall-ID:na finns på 7+ ställen. Uppdatera (1) `api/constants/oneflowTemplates.js`, (2) `api/cron/sync-oneflow.ts:20-27`, (3) `OFFER_TEMPLATE_IDS` i `sync-offers.ts:8` + `offer-stats.ts:8` om offert, (4) `src/constants/oneflowTemplates.ts`, (5) `TEMPLATE_FIELD_ORDER` webhook.ts:320, (6) `getContractTypeName` webhook.ts:810, (7) `api/import-customer-by-orgnr.ts:171`. Missas cron-kopian TRASHAS avtal på nya mallen natten efter (se Fallgropar).

**Nytt Oneflow-datafält:** Avtal: `CONTRACT_FIELD_MAPPING` i `sync-oneflow.ts:44` + `import-contracts.ts:8` + `findField`-anrop i webhook.ts:517-528. Offert: `OFFER_FIELD_MAPPING` (sync-oneflow.ts:30, sync-offers.ts:24, import-contracts.ts:37) + `FIELD_MAPPING.contract_to_offer` i create-contract.ts:76. API-skapade avtal utan custom_id mappas indexbaserat via `TEMPLATE_FIELD_ORDER` - bara mall 8486368 är mappad.

**Ny Fortnox-resurs:** Ny metod i `fortnoxService.ts` - proxyn är generisk, inget backend-arbete. GET-före-POST för idempotens. Kolla att scopet täcks av `api/fortnox/auth.ts` (`article companyinformation customer invoice payment price costcenter`) - annars måste admin göra om OAuth.

**Felsöka "kontrakt kom inte in":** 1) `oneflow_sync_log` (signaturfel? error?), 2) godkänd mall? (draft + okänd mall skippas tyst), 3) template-retryn kan ta 100 s, 4) kör syncen manuellt: `POST /api/cron/sync-oneflow` med `Authorization: Bearer $CRON_SECRET`, 5) `cron_runs` gäller INTE sync-oneflow - den loggar bara till console.

**Nytt SMS-utskick:** rad i `sms_templates` (`slug`, `body` med `{{variabler}}`), anropa `/api/send-sms` med `templateSlug` + `variables` + auth-header. Håll SMS/e-postfel icke-fatala (toast, operationen lyckas ändå).

## Fallgropar

- **Nattsyncen kan tyst TRASHA giltiga avtal:** `sync-oneflow.ts` filtrerar Oneflow-listan på godkända mallar; allt i DB som inte finns i det filtrerade svaret sätts till `trashed` (rad 324-346). `TERMINAL_STATUSES` skyddar bara `declined/ended/trashed` - INTE `signed/active`. Ny mall som bara läggs i webhooken = alla dess avtal trashas natten efter import. Säkerhetsspärr finns bara för 0 kontrakt totalt (rad 298).
- **`CRON_SECRET` är fail-closed sedan 2026-07-03:** alla cron-jobb kräver `requireCronSecret` (`api/_lib/cronAuth.ts`) och vägrar köra (503) om env-varn saknas. Den MÅSTE vara satt i Vercel, annars stannar nattsyncen och faktureringsjobben.
- **Tre olika webhook-signaturscheman:** Oneflow = `sha1(callback_id + secret)`, failar stängt (webhook.ts:148). ClickUp = HMAC-SHA256 av rå body, failar ÖPPET utan secret, och body med "test"/"ping" släpps igenom FÖRE signaturkontrollen (clickup-webhook.ts:109) - avsiktligt olagat, åtgärden är paus + avregistrering. Fortnox = valfri `?secret=`-query, ingen HMAC (OK: sanningen hämtas ändå från API:t).
- **Två Supabase-service-key-namn:** Oneflow/ClickUp-filer kräver hårt `SUPABASE_SERVICE_KEY!`, Fortnox-filer `SUPABASE_SERVICE_ROLE_KEY!` (bara `_lib/`-filerna auth.ts:8 och cronLogger.ts:9 tål båda, med OLIKA fallback-ordning - se skill dev-workflow). BÅDA måste finnas i Vercel - klassisk fälla vid ny miljö.
- **`create-contract.ts` kan returnera 502 EFTER att Oneflow-kontraktet skapats** (draftItems-persistensen, rad 549-656). Anroparen måste hantera "skapat men ej persisterat". Artikel→tjänst-kopplingen översätts via index-ordning på insert-resultatet (rad 615-624) - fungerar, låt vara.
- **`invoices` CHECK-constraint saknar `overdue`** - Fortnox-webhooken skippar overdue för `invoices` (rad 131) men sätter det på `contract_billing_items`. Nytt statusvärde kräver koll av BÅDA tabellernas constraints.
- **Kolumnskillnad mellan ärendetabeller:** `cases` har `quote_status/quote_sent_at/...` och `scheduled_date/assigned_technician_*`; `private_cases`/`business_cases` SAKNAR quote-kolumnerna (strippas i webhook.ts:1289) och har `start_date/due_date/primary_assignee_*` i stället.
- **`contract:create`-eventet ignoreras helt** - template saknas ofta då; `content_update` strax efter tar det. Ser ut som ett hål, är avsiktligt.
- **Motparts-detektion görs på två sätt:** webhooken med namn-heuristik `!name.includes('begone')` (webhook.ts:479), cron med `my_party`-flaggan (sync-oneflow.ts:232). Båda avsiktliga, blanda inte.
- **Offert-events kopplar befintlig kund (org.nr → e-post → företagsnamn) men skapar ALDRIG kund.** Kund skapas bara vid signerat AVTAL.
- ClickUp-webhooken importerar `getStatusName`/`isCompletedStatus` från `../src/types/database` - api-koden delar typfil med frontend, bryt inte importen.
- `mapAssignees` (clickup-webhook.ts:578) har en hårdkodad lista med 8 tekniker - nya tekniker matchas inte. Avsiktligt olagat (koden ska bort).

## Riktning

Dagens läge har kända säkerhetshål (fas 1 i säkerhetsplanen). Betala av när du ändå rör filerna:

1. ~~**`api/fortnox/proxy.ts` saknar auth**~~ KLART 2026-07-03 (`5754bbfd`): requireAuth + resurs-allowlist + path-validering, `fortnoxRequest` skickar Bearer via `getAuthHeaders()`.
2. **Oneflow-mutationsendpoints saknar auth:** bara `offer-stats` och `sync-offers` har `requireAuth`. `delete-offer` raderar avtal oautentiserat; `comments.ts` tar headern `x-sender-email` rakt in i `x-oneflow-user-email` (identitetsspoofing); `create-contract.ts:300` validerar bara OM `senderEmail` skickas - utelämna fältet och valideringen hoppas över, `created_by_email` är spoofbar. Målbild: `requireAuth(['admin','koordinator','säljare'])` i `create-contract`, `delete-offer`, `extend-signing-period`, `comments`, `import-contracts`, `webhook-config` (+ fil-endpoints i steg 2); härled skaparen från auth-profilen. Anropare som måste uppdateras: `offerFollowUpService.ts` (delete-offer/extend-signing-period/comments), `useContracts.ts` (fil-endpoints), `useOneflowContract.ts:90`, `OneflowContractCreator.tsx:575`, `ContractImportModal.tsx:68/:152` (import-contracts), `WebhookConfig.tsx` (webhook-config). Rör INTE `webhook.ts` - den autentiserar med signatur, inte JWT.
3. **`VITE_CLICKUP_API_TOKEN` ligger i publika frontend-bundlen** (`clickupSync.ts:15`, `clickupUserMapping.ts:8`) - go-live-krav. Målbild: radera `src/services/clickupSync.ts`, `src/services/clickupUserMapping.ts`, `src/services/clickupFieldMapper.ts`, `src/services/clickup/client.ts`, `src/hooks/useClickUpSync.ts` (verifierat död kedja), ta bort fallbacken i `api/debug/clickup-users.ts:14` + env-varn, rotera token hos ClickUp (gammal token ligger i historiska bundles). Rotera server-varn `CLICKUP_API_TOKEN` men behåll den - `create-case.ts` kräver den. OBS: `src/utils/clickupFieldMapper.ts` är en ANNAN fil som lever.
4. **Konsolidera mall-ID:na:** dagens läge kräver 7 synkade kopior eftersom varje fil har sin egen lista, och felläget är dataförstörande (trashing, se Fallgropar). Målbild: exportera `ALL_TEMPLATE_IDS`/`OFFER_TEMPLATE_IDS` från `oneflowTemplates.js` (behåll CJS!), importera i cron/sync-offers/offer-stats/import-customer-by-orgnr; frontendkopian kan inte importera över projektgränsen - korsreferera med kommentar eller generera i build. Passa samtidigt på i `sync-oneflow.ts`: gör CRON_SECRET fail-closed och wrappa i `withCronLog` så felsökning hamnar i `cron_runs`.

Investera INTE i ClickUp-webhookens svagheter (test/ping-bypass, fail-open-signatur, hårdkodad teknikerlista) - rätt åtgärd är `CLICKUP_WEBHOOK_PAUSED=true` + avregistrering hos ClickUp, inte att polera kod som ska bort.
