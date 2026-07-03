---
name: supabase-databas
description: Supabase-databasens schema, RLS-policies, klientmönster och realtid i BeGone Kundportal. Använd vid arbete med src/lib/supabase.ts, src/types/database.ts, src/contexts/AuthContext.tsx, api/_lib/auth.ts, RLS-policies, nya tabeller/migrations i supabase/migrations/, statusmappning (STATUS_ID_TO_NAME/STATUS_CONFIG), realtidsprenumerationer (.channel/postgres_changes), triggers/cron, eller frågor om roller (admin/koordinator/technician/customer/säljare), profiles, multisite_user_roles. Engelska/svenska nyckelord: RLS, row level security, realtime, Supabase client, service role, JWT metadata, auth trigger, handle_new_user, database types.
---

# Supabase-databasen i BeGone Kundportal

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `src/lib/supabase.ts` | Frontend-klient (anon-nyckel, RLS gäller). Global `window.supabase`. |
| `api/_lib/auth.ts` | `requireAuth`/`requireAuthenticated` för serverless-endpoints; `AppRole`-union. |
| `src/types/database.ts` | Handskriven DB-typ. **`cases`-blocket (rad 182-247) är fel**, se Fallgropar. Statusmappning rad 831-961. |
| `src/types/cases.ts` | `Case`-typen (rad 8-92) — korrekt typ för `cases`-tabellen, använd i stället för `database.ts`. Saknar dock `tertiary_technician_id/name/email` som finns i DB. |
| `src/contexts/AuthContext.tsx` | Roll-/profilhantering, redirect-logik, dual-role (tekniker+admin). |
| `src/contexts/MultisiteContext.tsx` | Organisation/sajt-modell, sajtfiltrering i appkod (rad ~298-303). |
| `supabase/migrations/` | Bara 13 filer från 2026 — inte fullständig schemahistorik. |
| `supabase/functions/fortnox-sync/index.ts` | Edge function, anropas av pg_cron var 5:e minut med HMAC-signatur (se `supabase/migrations/manual_setup_fortnox_sync_cron.sql`). |

## Arkitektur

Tre klienttyper: frontend (anon, RLS gäller), serverless `api/*.ts` (service role, bypassar RLS helt, ~210 endpoints med `export default`), edge function (service role, Fortnox-poll). Endast 30 av ~210 api-filer använder `requireAuth`/`requireAuthenticated` — resten är oskyddade eller skyddas via CRON_SECRET/HMAC.

Provisionering av användare är triggerdrivet, inte API-drivet: `technicians`-rad skapas → `api/enable-technician-auth.ts` skapar auth-user med `user_metadata` → DB-triggern `on_auth_user_created` → `handle_new_user()` (SECURITY DEFINER) skapar `profiles`-raden automatiskt. API:t skriver aldrig `profiles` själv, det bara väntar och verifierar.

RLS bygger på SECURITY DEFINER-hjälpfunktioner (`get_user_profile()`, `is_current_user_admin()`, `get_current_user_id()`) för att undvika rekursion på `profiles`. Ground truth för RLS är `pg_policy` i live-DB, inte migrationsfilerna.

Realtid: bara `case_comments` och `comment_read_receipts` ingår i publikationen `supabase_realtime`. Allt annat som prenumererar är en tyst no-op.

## Invarianter

- **Lita aldrig på `database.ts` för `cases`-kolumner** — använd `Case` i `src/types/cases.ts`. Detta är dagens läge pga typskuld (1007 baseline-fel maskerar problemet); målbild är att generera typer från DB (`generate_typescript_types`) och rätta blocket.
- **Ändra aldrig `commission_amount`/`commission_calculated_at`** manuellt på private/business_cases — triggern `restrict_billing_updates` kastar exception för alla utom service_role/postgres. Om ett fält behöver systemskydd, kopiera det mönstret, lita inte på att RLS räcker.
- **`user_metadata.role`/`technician_id` i JWT måste hållas i synk med `profiles`** — RLS-policies (t.ex. delete-policyn på private_cases/business_cases) läser `auth.jwt()->'user_metadata'->>'role'` direkt. Byts rollen bara i `profiles` gäller gamla JWT-rättigheter tills token förnyas.
- **Sätt aldrig `case_number` manuellt** — triggern `set_case_number`/`generate_case_number` äger det fältet.
- **Skriv aldrig `_synthetic: true`-rader från `ContractService.getActiveContracts` till DB** — de är syntetiserade i minnet från customers-fält när kunden saknar `contracts`-rader.
- **Ny realtidsprenumeration fungerar bara om tabellen är tillagd i `supabase_realtime`-publikationen OCH har SELECT-RLS som släpper igenom mottagaren** — annars tyst no-op, inget fel kastas.
- **`multisite_user_roles` är rätt tabellnamn** — det finns ingen `user_roles`-tabell.
- Regionchef/platsansvarig-filtrering på `site_ids` sker enbart i `MultisiteContext.tsx`, inte i RLS. RLS ger org-bred läsning på `customers`. Bygg aldrig säkerhet på denna appkodsfiltrering.

## Vanliga uppgifter

**Ny tabell**: Migration i `supabase/migrations/YYYYMMDD_beskrivning.sql` eller MCP `apply_migration` → `ENABLE ROW LEVEL SECURITY` + policies (kopiera egenkontroll-mönstret, se `supabase/migrations/20260624_egenkontroll_dynamic_templates.sql:90-104` eller `20260127_create_preparations_table.sql:27-53`) → lägg till typ i `database.ts` (Insert/Update-Omit-mönster) → vid behov `ALTER PUBLICATION supabase_realtime ADD TABLE <tbl>`.

**Ny status**: Ändra alla samtidigt i `database.ts`: `ClickUpStatus`-unionen (rad 831), `STATUS_ID_TO_NAME`, `STATUS_NAME_TO_ID` (kanoniskt ID, mappningen är asymmetrisk), `STATUS_CONFIG`, ev. `isCompletedStatus`, `getCustomerStatusDisplay`, `DROPDOWN_STATUSES`/`ALL_VALID_STATUSES`.

**Ny roll**: `AuthContext.tsx` (Profile-typ + boolean + redirect-switch) → `api/_lib/auth.ts` (`AppRole`) → `handle_new_user`-triggern i DB → grep:a RLS-policies med `ARRAY['admin','koordinator',...]`-literaler och lägg till rollen → `ProtectedRoute`.

**Skyddad api-endpoint**: `const auth = await requireAuth(req, res, ['admin','koordinator']); if (!auth) return;` i handlern, och frontend anropar med `await getAuthHeaders()` (se `src/lib/supabase.ts:59-68`, standardmönster i 12 filer).

## Fallgropar

- `src/types/database.ts:182-247` beskriver `cases`-kolumner som inte existerar (`clickup_task_id`, `status_id`, `scheduled_date`, `assigned_technician_id` m.fl.). Verkliga kolumner: `primary/secondary/tertiary_technician_id/name/email`, `scheduled_start/end`, `service_type`, `address` (jsonb), `material_cost` m.fl.
- `profiles`-typen i `database.ts` saknar `is_koordinator` trots att den används flitigt i RLS-policies.
- `cases`-tabellens skrivpolicies är i praktiken svaga: INSERT har `WITH CHECK (true)`, och UPDATE-policyn `cases_complete_update_access` tillåter alla med tekniker-profil eller aktiv multisite-roll att uppdatera vilken rad som helst. Detta är medvetet öppet, inte ett förbiseende — men bygg inte vidare säkerhet ovanpå det utan att veta det.
- `invoices` har en enda policy `"Allow all for authenticated users"` (ALL, using true) — alla inloggade, inklusive kundkonton, kan läsa/skriva alla fakturor via PostgREST. Samma för `commission_posts` (fyra policies med using/check `true`).
- `services`, `service_groups`, `pricing_settings`, `fortnox_sync_state`, `fortnox_test_tokens`, `incident_employees` har RLS helt avstängd, och `anon`-rollen har SELECT/INSERT/UPDATE/DELETE-grants på dem.
- `usePendingCases.ts:96-133` prenumererar på `cases` (opublicerad → aldrig events) och har dessutom fel filter (`status=eq.requested` mot verkligt värde `'Öppen'`) — dubbelt trasig, fungerar bara för att hooken fetchar på mount ändå.
- `onAuthStateChange('SIGNED_IN')` i `AuthContext.tsx` anropar inte `fetchProfile` (rad 156-159) — profilen hämtas bara från `signIn()` eller initial `getSession()`. Ändra inte utan att förstå dubbelanrops-historiken.
- `commission_posts.case_id` är TEXT medan `invoices.case_id` är UUID — `handle_invoice_paid()` castar mellan dem; håll typerna i huvudet vid nya join-frågor mot dessa tabeller.
- `detectSessionInUrl: false` i `supabase.ts:23` betyder att magic-link-flöden i URL inte fungerar — lösenordsåterställning går via `api/reset-password.ts`/`api/verify-reset-token.ts` med token i `user_metadata`, inte Supabase-standardflödet.

## Riktning

Dagens läge har flera medvetna eller ärvda säkerhetshål. Fixa i denna prioritetsordning när du ändå är i närheten av koden:

1. **Slå på RLS på de sex öppna tabellerna** (`services`, `service_groups`, `pricing_settings`, `fortnox_sync_state`, `fortnox_test_tokens`, `incident_employees`). Lägst risk, störst exponering: `anon`-nyckeln ligger i frontend-bundeln och har idag full skriv/läsrätt på tjänstekatalog, prissättning och Fortnox-testtokens. Kopiera preparations-mönstret (read för authenticated, write endast för admin — se `20260127_create_preparations_table.sql:27-53`; inga policies alls på fortnox_*/incident_employees).

2. **Ersätt "allow all authenticated" på `invoices` och `commission_posts`** med rollbegränsade policies (staff-write, tekniker-SELECT begränsad till egen `technician_id`). Medelrisk — kräver test av `trg_invoice_paid`-flödet och provisionsvyerna, men stänger en tydlig lucka där kundkonton idag kan läsa/skriva alla fakturor. För `commission_posts` finns en färdig detaljplan (tekniker måste kunna skapa poster vid ärendeavslut, settings admin-only) i skill provisioner, Riktning 2 - följ den i stället för att designa om.

3. **Rätta `database.ts`-typen för `cases`** (eller generera typerna via MCP `generate_typescript_types`). Målbild: en typ som matchar DB på riktigt, ingen parallell sanning i `cases.ts`. Låg-medel risk — kan blotta latenta buggar, vilket är önskvärt, men kräver en genomgångsrunda efteråt.

4. **Städa döda realtidsprenumerationer** (24 av 25 `.channel()`-anrop i `src/` träffar opublicerade tabeller; bara `comments:`-kanalen i `communicationService.ts:520` mot `case_comments` lever). Besluta per vy vilka som ska leva (t.ex. koordinatorns cases, notiser) och publicera de tabellerna explicit (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`) samtidigt som SELECT-RLS verifieras för mottagarna; ta bort resten och förlita dig på refetch-vid-fokus i stället. Låg risk att ta bort, men publicering av nya tabeller ökar realtime-last och kräver RLS-koll.
