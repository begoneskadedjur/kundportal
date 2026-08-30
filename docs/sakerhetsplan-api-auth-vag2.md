# SLUTGILTIG PLAN: Autentisering av oskyddade serverless-endpoints — BeGone Kundportal

Granskningsdatum: 2026-08-30. Framtagen av två oberoende specialistanalyser (säkerhetsarkitekt + driftingenjör) som syntetiserats av en tredje oberoende granskare med egna stickprov mot kod och databas (läsande SQL). Systemet är inte i skarp drift; planen utnyttjar det för att korta vägen till skydd av de farligaste hålen, men behåller den bevisdrivna sekvensen för allt annat.

STATUS: GENOMFÖRD I SIN HELHET 2026-08-30. Alla etapper deployade och verifierade samma dag (aktiv testning med testinloggningar per roll + webbläsartest ersatte observationsfönstren på Christians begäran; systemet var ej i skarp drift):
- Etapp 0 (0af2888a): report-only-logg, forwarding-fix, teknikerroll i create-contract, artefaktstädning
- Etapp 1 (bbecdb3d): apiFetch + ~30 anropsställen + ESLint-spärr + blob-nedladdning
- Etapp 2 (b1939456): kritiska skriv-guards, 25/25 testfall gröna (inkl kolumnbuggfix i update-customer)
- Etapp 3–5 (f891a7b7): 25 läs-/verktygs-guards, 58/58 testfall gröna (en initial FAIL var fel testmetod, verifierad OK), webbläsartest alla roller utan tokenlösa anrop
- Etapp 6 (fb91ae3b): rate limiting (verifierad live: räknare + neutral spärr), Fortnox-OAuth-härdning (HMAC-state; återanslutning EJ livetestad — inget fick röra Fortnox live; testas vid nästa planerade anslutning), död kod raderad efter omverifiering, wildcard-CORS bort från nyguardade endpoints
- All testdata raderad (användare, kund, tekniker, loggrader, räknare)

RESTPUNKTER: (1) Fortnox-återanslutningsflödet livetestas vid nästa planerade anslutning; (2) wildcard-CORS kvarstår på äldre redan-guardade endpoints (accept-invitation m.fl.) — kosmetisk restyta; (3) multisite-users-refaktor till getManagerContext + modulflytt (email-templates/assistant-utils till _lib) uppskjutna — påverkar inte säkerhetsläget; (4) /api/set-password saknas men anropas av SetPassword.tsx (404 sedan tidigare) — separat ärende; (5) AI-/geo-endpoints saknar per-användar-kvot (accepterad restrisk R13).

## AVVIKELSER UNDER IMPLEMENTATION (dokumenterade i efterhand)

1. **`clickup/task/[taskId]` fick personalroller i stället för `requireAuthenticated` + ägarskap.** Granskarens ägarskapsdesign byggde på `customers.clickup_list_id` — kolumnen finns inte längre i databasen (verifierat mot information_schema 2026-08-30; ClickUp-task-id:n finns bara i `private_cases`/`business_cases`, som saknar `customer_id`). Ägarskap per kund är därmed obyggbart. Ofarligt i praktiken: kundportalens `cases`-tabell saknar `clickup_task_id` och multisite-vyerna skickar alltid tom `clickupTaskId` — kund-/multisiteflöden anropar aldrig med task-id utan använder DB-fallbacken i CaseDetailsModal. Guard: `requireAuth(['admin','koordinator','technician','säljare'])`.
2. **CaseDetailsModal ompekas INTE till `clickup/task/[taskId]`.** Svarsformaten skiljer sig helt (`task_info`/`custom_fields`-array kontra `ProcessedTaskDetails`) — ompekningen hade krävt omskrivning av modalens datamappning för noll säkerhetsvinst. Enda levande anroparen med task-id är admins TeamChat; modalen behåller `test-clickup`-URL:en (nu via apiFetch) och `test-clickup` admin-låses som planerat i etapp 5, vilket inte bryter någon.

---

## 0. KONFLIKTER MELLAN PLANERNA OCH HUR DE AVGJORTS

| # | Konflikt | Avgörande | Verifiering |
|---|---|---|---|
| K1 | A: "farligast först" (guards i etapp 1). B: report-only-logg + 72 h rena loggar före varje guard, kundportal sist. | **Kombination:** report-only-logg och klientmigrering deployas först (dag 0–1), därefter får de sex kritiska skriv-endpointsen ett **snabbspår med förkortat observationsfönster (48 h)**. Motivering: systemet är inte i skarp drift, anroparna är fullständigt kartlagda (en per endpoint), felmoden vid miss är ett felmeddelande — inte en krasch — och varje extra dags väntan är en dag med öppet kontokapningshål. Kundportalens **läs**-vägar tas fortfarande sist med fullt 72 h-fönster. | `api/update-customer.ts` rad 117/136: oautentiserad `auth.admin.updateUserById` med lösenord + e-post från body — kontokapning bekräftad. `api/send-welcome-password.ts` rad 104: nollställer lösenord för valfri e-post — bekräftad. |
| K2 | Klientstrategi: A = `getAuthHeaders()` per anropsplats; B = central `apiFetch` som inte kastar. | **B vinner.** `getAuthHeaders()` (`src/lib/supabase.ts:59`) **kastar** när session saknas — att sprida den till alla anropsplatser ändrar dagens beteende i kantfall och saknar central retry. `apiFetch` med icke-kastande semantik + 401-refresh-retry är bit-för-bit-kompatibel före guard-aktivering. Befintliga `getAuthHeaders()`-ställen rörs inte. | `getAuthHeaders` rad 61–62: `throw new Error('Du är inte inloggad')` — verifierat. |
| K3 | `send-welcome-password`-rollista: A = admin/koordinator/säljare; B = bara admin. | **A vinner.** Sidan nås av alla tre. | `src/App.tsx:195` (`anvandarkonton-kund` bakom `AdminOrKoordinatorRoute`), `:251` (koordinator `customer-access`), `:314` (`/saljare/anvandarkonton-kund` med `requiredRole="säljare"`). Koordinator-sidan är en ren wrapper runt admin-sidan (verifierat). |
| K4 | Multisite-användares roll: A = "har ingen AppRole → requireAuth omöjlig"; B = rollistor med 'customer'. | **Båda delvis fel, avgjort mot databasen:** multisite-användare **HAR** `profiles.role = 'customer'` men `customer_id = NULL` (8 av 8 aktiva multisite-roller i produktion; `api/create-multisite-users.ts:198` sätter `role: 'customer'`). Alltså: `requireAuth([...,'customer'])` släpper igenom dem, men **ägarskapskontroller får inte bygga på `auth.customerId`** — de måste falla tillbaka på `multisite_user_roles`/`organization_id`. | SQL mot `profiles` × `multisite_user_roles` (läsande). |
| K5 | Död kod: A = ActiveCasesList/CustomerStatsCards/RecentActivity döda; B = levande anropare i kundportalen. | **A vinner — och mer därtill: även `UpcomingVisits` är död.** Ingen av de fyra `clickup-tasks`-anroparna importeras från levande kod. `ActiveCasesList` importeras endast av oroutade `src/pages/multisite/Portal.tsx`. **Konsekvens: `/api/clickup-tasks` har ingen levande anropare alls** och kan admin-låsas direkt i snabbspåret. Kundportalens levande data går via Supabase/RLS. | Grep av importer i hela `src/` + App.tsx-importlista. |
| K6 | `api/set-password` finns/finns inte. | **B vinner:** filen finns inte. `src/pages/auth/SetPassword.tsx:65` anropar den → redan 404 idag. Separat ärende. | Glob + grep. |
| K7 | `test-clickup`/`clickup-tasks`-design. | `clickup-tasks`: admin-lås (K5). `test-clickup`: levande anropare är `CaseDetailsModal.tsx:414` (kund-, organisations- och regionalportal + admin TeamChat). **Lösning:** utöka befintliga `api/clickup/task/[taskId].ts` (idag admin-only) till `requireAuthenticated` + ägarskap, peka om CaseDetailsModal dit, lås därefter `test-clickup` till admin. | `api/clickup/task/[taskId].ts:77`, importkedjor verifierade. |
| K8 | `save-quote-recipient` + technician. | Sidan nås av admin (`App.tsx:174`), **koordinator** (`:284` — missad av båda planerna), säljare (`:327`) och technician (`:352–353`). Men `oneflow/create-contract` tillåter inte technician (`create-contract.ts:302`) — technician-routens kärnfunktion är **redan trasig**. **Beslut:** guarda med `['admin','koordinator','säljare']`, technician-frågan = beslutspunkt B1. Anropet på `OneflowContractCreator.tsx:755` har dessutom buggig felhantering (destrukturerar `{ error }` ur Response) — fixas vid migreringen. | Kodreferenser verifierade. |
| K9 | `download-file-direct`: B påstår "tyst fallback = självläkande". | **A vinner:** `tryDirectDownload` (`useContracts.ts:348–370`) returnerar **optimistiskt `true`** efter `<a href>`-klicket — blob-fallbacken nås aldrig vid 401. Klienten skrivs om till fetch+blob innan guard. | Läst i sin helhet. |
| K10 | `create-admin-user`-forwardingbuggen. | **Bekräftad:** rad 103–116 anropar admin-guardade `send-staff-invitation` utan `Authorization`-header → redan trasigt. Fixas i etapp 0. | Läst. |
| K11 | `email-templates.ts`: guard? | **Onödigt/omöjligt:** ingen default-export — ingen fungerande handler. Flyttas till `_lib` i städetappen. | Grep. |
| K12 | Geokodning: A = `requireAuthenticated`; B = `['admin','koordinator']`. | **A vinner.** B:s rollista hade brutit teknikerflöden: `EditCaseModal` (geokodning + `RevisitModal`) används i `TechnicianCases.tsx:658` och `TechnicianSchedule.tsx:726`; `MapLocationPicker` i `TechnicianEquipment`. `revisit-assistant` → `['admin','koordinator','technician']`. | Grep av användning. |
| K13 | Döda endpoints raderas (A) eller guardas (B). | **Tvåsteg:** admin-lås i snabbspåret (prejudikat: `clickup/task/[taskId]` admin-låstes vid audit juni 2026), radering i städetappen — beslutspunkt B2. | Noll anropare i `src/` (grep). |
| K14 | Fortnox OAuth. | **A:s härdning antas** i städetappen. Verifierat: `api/fortnox/auth.ts` genererar state enbart i angriparkontrollerad cookie — vem som helst kan slutföra flödet med eget Fortnox-konto och kapa faktureringsintegrationen. `fortnox/refresh` har oautentiserad handler som roterar tokens → admin-lås i snabbspåret. | `auth.ts` läst; `callback.ts` EJ djupläst (§9). |
| K15 | Loggmekanism: Log Drain vs Supabase-tabell. | **Rekommendation: Supabase-tabell `auth_rollout_log`** (mönster: `api/_lib/cronLogger.ts`) — SQL-frågbar, ingen ny extern tjänst, oberoende av Vercels korta loggretention. Beslutspunkt B3. | — |

---

## 1. KLIENTSTRATEGI

**Ny fil `src/lib/api.ts` med `apiFetch(input, init?) → Promise<Response>`:**

1. Hämta session via `supabase.auth.getSession()`. Session finns → sätt `Authorization: Bearer <token>`. Session saknas → **skicka ändå utan header, kasta inte**. Detta gör beteendet före guard-aktivering identiskt med idag.
2. Sätt `Content-Type: application/json` endast när body är sträng och anroparen inte satt egen; `FormData` lämnas orörd; anroparens headers vinner vid merge.
3. Vid 401-svar: exakt EN `supabase.auth.refreshSession()` + retry (fångar utgången token i långlivade flikar); annars returnera svaret så befintlig felhantering tar vid.
4. Samma signatur som `fetch` → migreringen är ett namnbyte per rad.

**Migrering:** samtliga anropsrader i endpoint-tabellen (§2) byts `fetch(` → `apiFetch(`. Tre dynamiska ställen får inte missas: `CreateCaseModal.tsx:836/839` (endpoint-variabel), `coordinatorAIAnalysisService.ts:145` och `aiAnalysisService.ts:180` (`this.baseUrl = '/api'`). Befintliga `getAuthHeaders()`-ställen rörs inte nu.

**Undantag (behåller naken fetch):** `ForgotPassword.tsx:36`, `ResetPassword.tsx:134`, `SetPassword.tsx:65`, `OrganizationsPage.tsx:909` (admins anrop till publika `reset-password`).

**Regressionsskydd:** ESLint-regel (`no-restricted-syntax`) som förbjuder naken `fetch('/api/…')` i `src/`, med explicita undantag för de publika filerna ovan.

**Specialfall i klientsteget:** (a) `tryDirectDownload` i `useContracts.ts:348` skrivs om till `apiFetch` + blob + objekt-URL (mönstret finns på rad 373–406); (b) `CaseDetailsModal.tsx:414` pekas om från `/api/test-clickup?task_id=` till `/api/clickup/task/<id>` (serverns uppmjukning av `[taskId].ts` deployas först — säkert eftersom det är en uppmjukning från admin-only); (c) `OneflowContractCreator.tsx:755` får korrekt `response.ok`-hantering.

---

## 2. SLUTGILTIG ENDPOINT-TABELL

Ägarskapshjälpare läggs i `api/_lib/` (t.ex. `ownership.ts`): personalroll = `role ∈ {admin, koordinator, technician, säljare}` eller `is_admin`; kund-ägarskap = `profiles.customer_id === mål` ELLER admin/koordinator; multisite-ägarskap via `multisite_user_roles` (aktiv rad) → organisationens siters `clickup_list_id`; tekniker-ägarskap = `profiles.technician_id === query.technician_id` ELLER admin/koordinator.

### Kritiska (snabbspår, etapp 2)

| Endpoint | Guard | Anropare som migreras |
|---|---|---|
| `api/update-customer.ts` | `requireAuthenticated` + kund-ägarskap på `body.customer_id` (admin/koordinator passerar — täcker impersonation, som är rent klient-side: admin bär egen JWT, verifierat i `ImpersonationContext.tsx`) | `CustomerSettingsModal.tsx:123` |
| `api/send-welcome-password.ts` | `requireAuth(['admin','koordinator','säljare'])` | `OrganizationsPage.tsx:941` |
| `api/global-coordinator-chat.ts` | `requireAuth(['admin','koordinator'])` + forwarda `req.headers.authorization` i det interna anropet (rad 321) + byt `req.headers.origin`-baserad URL till `VITE_APP_URL` | `GlobalCoordinatorChat.tsx:110` |
| `api/coordinator-ai-booking.ts` | `requireAuth(['admin','koordinator'])` — **odelbar commit med raden ovan** | endast server-till-server |
| `api/save-quote-recipient.ts` | `requireAuth(['admin','koordinator','säljare','technician'])` (beslut B1: tekniker ska kunna skicka avtalsförslag) | `OneflowContractCreator.tsx:755` |
| `api/fortnox/refresh.ts` (default-handlern) | `requireAuth(['admin'])`; långsiktigt flytta helpers till `_lib` och ta bort endpointen | inga |
| `api/clickup-tasks.ts` | `requireAuth(['admin'])` — inga levande anropare (K5) | inga (4 döda komponenter) |
| `api/technician/cases.ts`, `technician/commissions.ts`, `technician/commissions/cases.ts`, `debug/clickup-users.ts`, `map-clickup-fields.ts` | `requireAuth(['admin'])` nu; radering i etapp 6 (beslut B2) | inga |

### Personalverktyg (etapp 3)

| Endpoint | Guard | Anropare |
|---|---|---|
| `ruttplanerare/booking-assistant`, `find-team-assistant` | `requireAuth(['admin','koordinator'])` | `CreateCaseModal.tsx:836/839` (dynamisk). Oroutade `pages/coordinator/BookingAssistant.tsx:40` är död — radera i etapp 6 |
| `ruttplanerare/revisit-assistant` | `requireAuth(['admin','koordinator','technician'])` — technician når den via EditCaseModal→RevisitModal i TechnicianCases/TechnicianSchedule | `RevisitModal.tsx:199` |
| `ruttplanerare/get-abax-vehicles` | `requireAuth(['admin'])` | `AbaxVehicleModal.tsx:32` |
| `technician-locations` | `requireAuth(['admin','koordinator'])` | `GeographicOptimizationMap.tsx:369` |
| `schedule-optimizer/analyze` | `requireAuth(['admin','koordinator'])` | `ScheduleOptimizer.tsx:822` |
| `geocode-search`, `reverse-geocode` | `requireAuthenticated` (kostnadsskydd; bred personalanvändning inkl. technician — K12) | `geocoding.ts:177`, `CreateCaseModal.tsx:812` |
| `ai-technician-analysis` | `requireAuth(['admin'])` | `aiAnalysisService.ts:180` |
| `ai-coordinator-analysis` | `requireAuth(['admin','koordinator'])` | `coordinatorAIAnalysisService.ts:145` |
| `extract-contract-data`, `extract-begone-contract-pdf`, `extract-xpert-contract-data` | `requireAuth(['admin','koordinator','säljare'])` | `AddContractCustomerModal.tsx:133`, `ImportCustomerByPdfModal.tsx:276`, `AddXpertContractCustomerModal.tsx:133` |
| `oneflow/diagnostics` | `requireAuth(['admin'])` | `OneflowDiagnostics.tsx:54` |
| `test-webhook` | `requireAuth(['admin'])` | `WebhookConfig.tsx:112` |

### Oneflow-filer (etapp 4)

| Endpoint | Guard | Anropare |
|---|---|---|
| `oneflow/contract-files`, `view-file`, `download-file`, `download-file-direct` | `requireAuth(['admin','koordinator','säljare'])` | `useContracts.ts:224/259/294/351` (351 = blob-omskriven i etapp 1) |
| `oneflow/contract-files-direct`, `view-file-direct`, `download-file-oneflow` | `requireAuth(['admin','koordinator','säljare'])` | `CustomerContractButton.tsx:47/74/95` |

### Kund-/teknikerportal (etapp 5)

| Endpoint | Guard | Anropare |
|---|---|---|
| `clickup/task/[taskId]` | ÄNDRAS i etapp 0 från `requireAuth(['admin'])` till `requireAuthenticated` + ägarskap (personal passerar; customer/multisite: taskens `list.id` mot tillåtna `clickup_list_id` — multisite-fallet via `multisite_user_roles`, INTE `auth.customerId` som är NULL, K4) | `CaseDetailsModal.tsx:414` (ompekad i etapp 1) |
| `test-clickup` | `requireAuth(['admin'])` efter ompekningen | — |
| `technician/dashboard`, `technician/monthly-cases` | `requireAuth(['admin','koordinator','technician'])` + tekniker-ägarskap på `technician_id`-query (stänger IDOR) | `TechnicianDashboard.tsx:97`, `MonthlyCommissionModal.tsx:59` |

### Förblir publika (härdas i etapp 6, får ej kräva inloggning)
`reset-password` (anropas även av admin utan header, `OrganizationsPage.tsx:909`; enumeration-säker design), `verify-reset-token`, `fortnox/callback`, alla webhooks (signaturskydd), `fortnox/auth` (görs om till admin-skyddad JSON-endpoint i etapp 6 — se §4). `api/cron/*` (cron-secret) och redan guardade endpoints rörs inte. `multisite-users` är inline-skyddad — refaktor till `getManagerContext` i etapp 6.

**Regel för alla rollistor:** `'admin'` ska alltid ingå — frontendens `ProtectedRoute` ger admin full åtkomst till alla sidor, och backendens `requireAuth` har ingen automatisk admin-bypass utöver `is_admin` → effektiv roll `'admin'`.

---

## 3. ETAPPSEKVENS

Regel: **en etapp = en commit = en deploy** (tagga `auth-etapp-0` … `auth-etapp-6`). Klientmigrering och guard-aktivering aldrig i samma deploy (gamla flikar kör gammal bundle mot ny server).

**Etapp 0 — Server, riskfri (dag 0):**
`logMissingAuth(req, endpoint)` i `api/_lib/auth.ts` som loggar anrop utan Authorization-header till Supabase-tabellen `auth_rollout_log` (endpoint, metod, user-agent, tidsstämpel) — blockerar inget, fire-and-forget. Läggs först i varje endpoint i §2. Dessutom: (a) forwarding-fix i `create-admin-user.ts:103` (mönster: `enable-technician-auth.ts:122`); (b) mjuka upp `clickup/task/[taskId].ts` från admin-only till `requireAuthenticated` + ägarskap; (c) radera lokala `api/*.js`-artefakter inkl. `api/debug-sites.js` + lägg `.vercelignore`; (d) lägg till `'technician'` i `oneflow/create-contract`-rollistan (rad 302) — lagar det redan trasiga teknikerflödet för avtalsförslag (beslut B1; filens attributionslogik rad 264–284 är byggd för tekniker, guarden glömde rollen). Röktest: allt fungerar som innan + tekniker kan skicka avtalsförslag från /technician/oneflow.

**Etapp 1 — Klient (dag 0–1):**
`apiFetch` + migrering av alla call sites i §2 + ESLint-regel + `tryDirectDownload`-omskrivning + CaseDetailsModal-ompekning + save-quote-recipient-felhanteringsfix. Ofarligt mot öppna endpoints.

**Etapp 2 — Snabbspår kritiska skrivningar (dag 3, efter 48 h rena loggar för just dessa endpoints):**
Guards enligt tabellen "Kritiska". `global-coordinator-chat` + `coordinator-ai-booking` + forwarding + origin-fix i **samma commit** (odelbart). Avvägningen mot 72 h är explicit: 48 h räcker eftersom anroparlistan är en-till-en-verifierad och systemet saknar skarp trafik; kan förlängas (beslut B4).

**Etapp 3 — Personalverktyg (efter 72 h rena loggar från etapp 1-deployen):** guards enligt tabellen.

**Etapp 4 — Oneflow-filer (efter etapp 3 + rena loggar, särskilt inga header-lösa GET mot `download-file-direct`):** guards enligt tabellen.

**Etapp 5 — Kund-/teknikerportal (sist av guardarna, fullt 72 h-fönster):** `test-clickup` → admin; `technician/dashboard` + `monthly-cases` med ägarskap. Explicit test som multisite-verksamhetschef och kund FÖRE och EFTER.

**Etapp 6 — Härdning och städning:**
1. Fortnox OAuth: `fortnox/auth` blir `requireAuth(['admin'])`-skyddad JSON-endpoint som returnerar authorize-URL (FortnoxPage hämtar med apiFetch och sätter sedan `window.location.href`); state = `nonce.timestamp.HMAC(SECRET)` med ny env-var; callback verifierar HMAC + TTL + cookie-match, förblir publik.
2. Rate limiting på `reset-password`/`verify-reset-token`/`send-welcome-password`: DB-baserad räknartabell, 5/15 min per e-post, 20/15 min per IP, fail-open vid DB-fel.
3. Refaktor `multisite-users` till `getManagerContext`.
4. Modulflytt: `email-templates*`, `ruttplanerare/assistant-utils`, `constants/oneflowTemplates` → `_lib`-struktur (uppdatera importer i ~5 api-filer; kör build + type-check).
5. Radera död kod (beslut B2): de admin-låsta endpointsen + frontend `pages/coordinator/BookingAssistant.tsx`, `pages/multisite/Portal.tsx`, `ActiveCasesList`, `CustomerStatsCards`, `RecentActivity`, `UpcomingVisits`.
6. Städa `Access-Control-Allow-Origin: *` från nu guardade endpoints.
7. Separat ärende: `SetPassword.tsx` anropar obefintliga `/api/set-password`.

---

## 4. SPECIALFALL (sammanfattning)

| Fall | Hantering |
|---|---|
| `download-file-direct` (`<a href>` kan inte bära header; fallback nås aldrig pga optimistiskt `true`) | Klient: fetch+blob i etapp 1. Guard i etapp 4 efter loggverifiering |
| `global-coordinator-chat` → `coordinator-ai-booking` | Header-forwarding + båda guards + origin→`VITE_APP_URL` i EN commit (etapp 2) |
| `create-admin-user` → `send-staff-invitation` | Redan trasig; forwarding-fix i etapp 0 |
| Fortnox OAuth | Öppen t.o.m. etapp 6; därefter admin-krav på start + signerad state; callback förblir publik |
| Publika lösenordsflöden | Förblir öppna (token-design + admin-beroendet på `reset-password`); rate limit i etapp 6 |
| Geokodning | `requireAuthenticated` — data läcker inte, endast kostnad; teknikerflöden får inte brytas |
| Impersonation | Rent klient-side (admin bär egen JWT) — admin/koordinator-bypass i ägarskapskontrollerna räcker; testas explicit i etapp 2 |
| Webhooks + cron | Rörs inte |

---

## 5. TESTPLAN PER ETAPP

**Etapp 0:** fullt röktest utan förväntad förändring; verifiera att `auth_rollout_log` fylls på; skapa admin med välkomstmail (forwarding-fixen); öppna ärendedetalj i kundportalen.

**Etapp 1:** röktest per roll (nedan) + SQL: `missing-auth`-rader ska plana ut mot noll för migrerade endpoints.

**Etapp 2:** Som **customer**: ändra kontaktuppgifter + lösenord i portalen (OK); curl med annan `customer_id` (403); curl anonymt mot alla sex (401). Som **admin under impersonation**: samma modal (OK). Som **koordinator**: välkomstmail från customer-access; AI-chatt hela vägen till skapat ärende (verifierar forwarding). Som **säljare**: offert med multisite-mottagare. Negativt: kund-JWT mot `send-welcome-password` (403).

**Etapp 3:** Som **koordinator**: bokningsassistent 1 tekniker OCH team (dynamiska varianten!), schemaoptimering, AI-analys, teknikerpositioner, kartklick/adressförslag i CreateCaseModal. Som **technician**: återbesöksförslag från Mina ärenden, stationsplacering med kartväljare. Som **säljare**: adress-autocomplete, PDF-import. Som **admin**: ABAX-modal, tekniker-AI, diagnostik, test-webhook. Anonym curl mot samtliga (401).

**Etapp 4:** Som admin/koordinator/säljare: fillista, visa, ladda ner (båda knapparna — verifiera att blob-vägen ger korrekt PDF); anonym curl (401).

**Etapp 5:** Som **customer**: ärendedetaljmodal (egen task OK); curl med annan kunds task-id (403). Som **multisite-verksamhetschef OCH platsansvarig**: organisationsportalens ärendemodal (kritiskt: `auth.customerId` är NULL för dessa — ägarskap via org måste fungera). Som **technician A**: dashboard + provisionsmodal; curl med tekniker B:s id (403). Anonym curl (401).

**Etapp 6:** Fortnox-anslutning end-to-end som admin (gärna preview-deploy med testklient); lösenordsglömt-flödet; multisite-användarhantering som admin/koordinator/verksamhetschef i egen och främmande org; `npm run build` + type-check efter modulflytt.

---

## 6. ROLLBACK PER ETAPP

- **Snabbast:** Vercel Instant Rollback till föregående produktion (<1 min, atomiskt) — fungerar exakt för att varje etapp är en egen deploy.
- **Selektivt:** `git revert <etapp-tagg>` — varje guard är ~2 rader per fil, konfliktfri revert.
- Klient-rollback alltid ofarlig (extra header mot öppen endpoint skadar inte); guard-rollback gör bara endpointen öppen igen.
- **Enda farliga kombinationen:** `coordinator-ai-booking`-guard utan chat-forwarding — kan inte uppstå om etapp 2-commiten hålls odelbar.
- Etapp 6:s OAuth-ändring hålls i egen commit/PR; revert återställer nuvarande (fungerande men svagare) cookie-flöde.

---

## 7. SAMLAT RISKREGISTER

| # | Risk | Sannolikhet/Konsekvens | Hantering | Status |
|---|---|---|---|---|
| R1 | Missad anropare (inkl. dynamiska URL:er, externa skript, `gen-*.mjs`, Postman) → 401 efter guard | Låg–medel / Medel | Report-only-logg med user-agent före varje guard-etapp + ESLint-regel + fullständig fetch-inventering | Hanterad |
| R2 | Gamla öppna flikar skickar inga headers efter guard | Låg (ej skarp drift) / Låg (felmeddelande, ej krasch — stickprovad felhantering) | Tvåstegsdeploy + apiFetch-refresh-retry + observationsfönster | Hanterad |
| R3 | Multisite-användare blockeras — ägarskapskod som antar `auth.customerId` | Medel / Hög (organisationsportal död) | K4-designen: multisite-fall via `multisite_user_roles`; explicit multisite-test i etapp 5 | Hanterad i design; testas |
| R4 | Ägarskapskontroller får buggar (läcker eller överblockerar) — särskilt update-customer | Medel / Hög | Central hjälpare i `_lib`, negativa curl-tester per etapp | Öppen tills testad |
| R5 | Server-till-server bryts (chat→booking; create-admin-user) | Hög om ej åtgärdad / Medel | Odelbar commit (etapp 2); etapp 0-fix | Hanterad |
| R6 | Vercels korta loggretention ger falsk trygghet i observationsfönstret | Medel / Hög | Supabase-loggtabell obligatorisk före etapp 1 (beslut B3) | Hanterad |
| R7 | Fel rollista → 403 för legitim roll (t.ex. koordinator på OneflowContractCreator — missades av BÅDA planerna, hittad i App.tsx:284) | Medel / Låg–medel | Rollistor verifierade mot App.tsx i granskningen; 'admin' alltid med; röktest per roll | Hanterad |
| R8 | Technician-routen /technician/oneflow är redan halvtrasig (create-contract nekar technician) | Befintligt fel / Låg–medel | Beslut B1: `'technician'` läggs till i create-contract (etapp 0) och save-quote-recipient (etapp 2) | Hanterad |
| R9 | Blob-nedladdning beter sig annorlunda (stora filer/Safari) | Låg / Låg | Test etapp 4; view-file-vägen kvar | Hanterad |
| R10 | Fortnox-integrationskapning via öppet OAuth-start (verifierat i auth.ts) + refresh-DoS | Låg / Hög | refresh admin-låses i etapp 2; OAuth-härdning etapp 6; callback-internals ej djuplästa (§9) | Delvis öppen |
| R11 | Lokala byggartefakter (inkl. oskyddade `debug-sites.js`) deployas via CLI | Låg / Hög | Radera + `.vercelignore` i etapp 0; deploya via git | Hanterad |
| R12 | Rate limit-tabellen ger latens/falska spärrar | Låg / Låg | Konservativa trösklar, fail-open | Hanterad |
| R13 | Inloggade användare kan fortfarande missbruka AI-/geo-endpoints (ingen kvot) | Medel / Låg–medel (kostnad) | Utanför scope; framtida per-användar-kvot | Öppen — accepterad restrisk |
| R14 | Version skew: gammal flik lazy-laddar borttagen chunk | Låg–medel / Låg (finns redan idag) | Utanför scope; ev. "ny version"-banner senare | Öppen — accepterad |
| R15 | Cron-/webhook-hemligheters hygien ej granskad | Okänd / Hög | Separat rotationsöversyn rekommenderas | Öppen — produktägare |
| R16 | `logMissingAuth`-DB-skrivning adderar latens/fel i hot path | Låg / Låg | Fire-and-forget utan await på svarskritisk väg, fail-silent | Hanterad i design |

---

## 8. BESLUTSPUNKTER — AVGJORDA AV CHRISTIAN 2026-08-30

1. **B1 — Technician på Oneflow: BESLUTAT — tekniker ska fortsatt kunna skicka avtalsförslag.** `'technician'` läggs till i både `oneflow/create-contract` (rad 302, fixas i etapp 0 — guarden glömde rollen, attributionslogiken rad 264–284 är byggd för tekniker) och `save-quote-recipient`. Routerna behålls.
2. **B2 — Död kod: BESLUTAT — radera i etapp 6**, under förutsättning att dödheten omverifieras direkt före radering (grep efter importer + noll träffar i `auth_rollout_log` under hela utrullningen). Gäller endpoints (`technician/cases`, `technician/commissions{,/cases}`, `debug/clickup-users`, `map-clickup-fields`, `clickup-tasks`, `test-clickup`) och frontend (`UpcomingVisits`, `ActiveCasesList`, `CustomerStatsCards`, `RecentActivity`, `pages/multisite/Portal.tsx`, `pages/coordinator/BookingAssistant.tsx`).
3. **B3 — Loggmekanism: BESLUTAT — Supabase-tabell `auth_rollout_log`** (SQL-frågbar, gratis).
4. **B4 — Observationsfönstrets längd: rekommendationen 48 h snabbspår + 72 h övrigt gäller** (förklarad för Christian; kan förlängas på begäran).
5. **B5 — Kundlösenord via personal: BESLUTAT — admin/koordinator ska kunna sätta kundens lösenord** (impersonationsflödet ska fungera).
6. **B6 — `send-welcome-password` för säljare: BESLUTAT — behåll behörigheten som idag** (`['admin','koordinator','säljare']`).

---

## 9. ÄRLIGT DEKLARERAT — EJ VERIFIERAT I GRANSKNINGEN

- **`api/fortnox/callback.ts` internals** (båda planerna beskriver cookie-state-validering samstämmigt; startpunkten `auth.ts` är verifierad, callbacken är inte djupläst). Granska innan etapp 6-designen låses.
- **`multisite-users.ts` inline-auth** — båda planerna samstämmiga ("skyddad"), ej ombekräftad rad för rad.
- **Plan A:s uppgift att `test-clickup` "kan skapa test-tasks"** — grep visar bara läsning; skapande ej bekräftat. Påverkar inte åtgärden (admin-lås).
- **Vercels exakta loggretention per plan** — därav kravet på egen loggtabell.
- **Externa konsumenter** (skript, bokmärken, `gen-*.mjs`) — endast observerbara via report-only-loggen.
- **OrganizationsPage-UI:t för säljare** — antar samma knappar som för admin (samma komponent, wrapper verifierad); inga interna rollvillkor kontrollerade.
- **Rollistor på redan guardade endpoints** (43+ st) — stickprovade, inte totalgranskade; båda planernas inventeringar var samstämmiga.
- Databasverifieringen av multisite-roller speglar **dagens** data (8 användare) — ägarskapskoden ska inte anta `role='customer'` utan slå upp `multisite_user_roles` direkt.

Planen lovar skydd exakt för det som guardas enligt §2; restriskerna R10, R13–R15 kvarstår medvetet och är listade.

---

## Kritiska filer för implementation
- `api/_lib/auth.ts` — guards + ny `logMissingAuth` + ägarskapshjälpare
- `api/update-customer.ts` — kontokapningshålet, snabbspårets viktigaste fil
- `src/lib/api.ts` — ny central `apiFetch`, hela klientmigreringen bygger på den
- `api/global-coordinator-chat.ts` — guard + header-forwarding + origin-fix, odelbar commit med `coordinator-ai-booking`
- `src/hooks/useContracts.ts` — tryDirectDownload-omskrivningen som gör Oneflow-guardarna möjliga
