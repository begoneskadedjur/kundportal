---
name: dev-workflow
description: Bygge, type-check, lint och deploy för BeGone Kundportal. Använd vid ändringar i package.json-scripten (build/lint/type-check), scripts/type-check.mjs, scripts/type-check-baseline.json, tsconfig.json/tsconfig.app.json/tsconfig.node.json, eslint.config.js, vite.config.ts, vercel.json, cron-jobb i api/cron/, nya filer i api/_lib/, eller frågor om CI, bundle-storlek, deploy till Vercel, env-vars för service role key.
---

## Nyckelfiler

| Fil | Syfte |
|---|---|
| `package.json` | scripts: `build`, `lint`, `type-check`, `type-check:full` |
| `scripts/type-check.mjs` | Riktig typkontroll med baseline-diff mot kända fel |
| `scripts/type-check-baseline.json` | 1007 kända fel i `src/**` (0 i `api/**`), checkas in i git |
| `tsconfig.json` (root) | `files: []`, bara `references` - ren solution-fil, gör inget själv |
| `tsconfig.app.json` | Frontend (`src/`), avstängda strikta regler pga skuld (se Invarianter) |
| `tsconfig.node.json` | API (`api/**/*.ts` + 4 explicita `src`-filer), 100% grönt, NodeNext |
| `eslint.config.js` | Flat config, **trasig i nuvarande state** (se Fallgropar) |
| `vite.config.ts` | React-plugin, `optimizeDeps.include` för lucide-react/framer-motion |
| `vercel.json` | `buildCommand`, `functions.maxDuration`, 7 `crons`, SPA-rewrites |
| `api/_lib/auth.ts` | `requireAuthenticated()` / `requireAuth(req,res,roles)` - roll-gate för API |
| `api/_lib/cronLogger.ts` | `withCronLog(jobName, fn)` - best-effort loggning till `cron_runs` |

## Arkitektur

Repot har **ingen CI-pipeline** (inga `.github/workflows`, inga husky-hooks). All kvalitetskontroll är manuell eller sker via Vercels egen build (`vercel.json.buildCommand` = `npm run build`).

`npm run build` = `tsc && vite build`. `tsc` här läser root-`tsconfig.json` som bara har `references`, ingen `include` - det är formellt en no-op som alltid ger exit 0 innan `vite build` körs. Typsäkerhet kommer **enbart** från `npm run type-check`, som körs separat och inte automatiskt före build eller deploy.

`scripts/type-check.mjs` kör riktig `tsc -p tsconfig.app.json --noEmit` och `tsc -p tsconfig.node.json --noEmit`, parsar felraderna och jämför **antal fel per `fil|TS-kod`-nyckel** mot `scripts/type-check-baseline.json`. Radnummer ingår inte i fingeravtrycket. Om totalen sjunker jämfört med baseline skrivs bara en påminnelse om `--update` ut, scriptet failar inte.

`tsconfig.node.json`s `include` är en explicit allow-list: `api/**/*.ts` plus fyra uttryckliga `src`-filer (`src/lib/clickup.ts`, `src/lib/supabase-admin.ts`, `src/lib/pdf-generator.ts`, `src/types/database.ts`) som är skrivna för att fungera i både Vite- och Node-världen. `src/lib/supabase.ts` är **inte** med, eftersom den läser `import.meta.env` (se Invarianter).

Deploy sker via Vercel, styrd av `vercel.json`: `buildCommand: npm run build`, `outputDirectory: dist`, 7 cron-jobb mot `api/cron/*.ts`, samt SPA-fallback-rewrites (`/api/(.*)` → sig själv, sedan `/(.*)` → `/index.html`).

## Invarianter

- **`scripts/type-check-baseline.json` måste alltid checkas in tillsammans med kodändringar som minskar felantalet.** Kör `node scripts/type-check.mjs --update` bara efter att faktiskt ha fixat fel, aldrig för att dölja nya. `--update` gör total override utan merge-logik.
- **`api/`-projektet (`tsconfig.node.json`) ska förbli 0 fel.** Det är den enda delen av kodbasen med skarp typsäkerhet - `noUnusedLocals`/`noUnusedParameters` och `verbatimModuleSyntax` är bara avstängda i `tsconfig.app.json`, inte i node-configen. En ny `api/*.ts`-fil med typfel bryter `type-check` direkt.
- **Nya `api/*.ts`-filer får ALDRIG statiskt importera `src/lib/supabase.ts`** eller andra moduler som läser `import.meta.env` - det kraschar vid modul-load i Vercels Node-runtime. Använd `process.env.VITE_SUPABASE_URL!` + lokal `createClient(...)` i filen själv, följ mönstret i `api/_lib/auth.ts`.
- **Filer i `api/_lib/` exponeras inte som HTTP-endpoints** (Vercel-konvention: underscore-prefix). Ny delad server-logik hör hemma där, inte direkt i `api/`.
- **`npm run build` skyddar inte mot typfel** - det finns ingen CI som kör `type-check` automatiskt. Kör det manuellt före commit/push av `src`- eller `api`-ändringar.
- Dagens läge kräver den radnummer-agnostiska baseline-tekniken eftersom 1007 fel i `src/**` inte kan fixas på en gång; målbild är att baseline krymper mot 0 och att `noUnusedLocals`/`noUnusedParameters`/`verbatimModuleSyntax` slås på igen i `tsconfig.app.json` när skulden är avbetald.

## Vanliga uppgifter

**Fixa typfel i `src/`:**
1. Fixa felen i koden.
2. Kör `node scripts/type-check.mjs` - ska visa att skulden minskat.
3. Kör `node scripts/type-check.mjs --update` för att skriva om baseline.
4. Committa uppdaterad `scripts/type-check-baseline.json` i **samma commit** som kodfixen.

**Lägga till ett nytt cron-jobb:**
1. Skapa `api/cron/<namn>.ts` (lägg till `export const config = { maxDuration: N }` om annat än default 300s behövs).
2. Lägg till post i `vercel.json`s `crons`-array.
3. Wrappa handlern med `withCronLog` från `api/_lib/cronLogger.ts` för observability i `cron_runs`-tabellen.
4. Lägg till auth-kontroll (`CRON_SECRET`-header) - se Riktning nedan, praxis idag är inkonsekvent, kopiera inte ett oskyddat jobb som mall.

**Lägga till en ny delad server-modul för `api/`:**
1. Lägg den i `api/_lib/` med ett namn som inte matchar ett tänkt URL-mönster.
2. Läs env-vars via `process.env`, aldrig `import.meta.env`.
3. Kör `npm run type-check:full` (visar alla fel, inte bara nya mot baseline) för att verifiera att `api`-sidan fortfarande är grön.

**Verifiera build/bundle innan en större frontend-ändring:**
1. Kör `npx vite build` och läs varningarna - chunk-size-varningen för huvudbunden (`index-*.js`, ~7 MB i nuvarande build) är känd, inte en regression du orsakat, men värd att inte förvärra medvetet.

## Fallgropar

- `npm run lint` (`eslint .`) **kraschar just nu** med `SyntaxError: Cannot use import statement outside a module`, eftersom `eslint.config.js` använder ESM `import` men `package.json` saknar `"type": "module"`. Detta är inget att fixa i kod - verktyget startar inte alls. Kodbasen kör helt utan lint-skydd tills detta åtgärdas.
- `tsc` i `npm run build` (root-`tsconfig.json`, `files: []`) ser ut som ett typkontrollsteg men är en no-op. Lita aldrig på grön `npm run build` som bevis för typsäkerhet.
- `scripts/type-check.mjs`s fingeravtryck är per `fil|TS-kod`, inte per rad. Om en fil redan har N kända fel av en viss kod och du introducerar exakt N nya (annan orsak, annan rad) men totalt oförändrat antal, upptäcks det **inte**. Var extra vaksam vid refaktorering av filer som redan har många baseline-fel.
- Fallback-ordningen för service-nyckeln är inkonsekvent mellan filer: `api/_lib/auth.ts` gör `SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_ROLE_KEY`, medan `api/_lib/cronLogger.ts` gör omvänd ordning. Om båda env-varen är satta med olika värden (t.ex. under nyckelrotation) kan olika filer använda olika nycklar samtidigt - felsök detta specifikt om behörighetsfel uppstår sporadiskt efter en rotation.
- `vite.config.ts` exkluderas medvetet från `tsconfig.node.json` eftersom Vite är ESM-only och projektet kör NodeNext utan `"type": "module"` - rör inte detta utan att förstå konsekvensen för hela API-projektets modulupplösning.
- Cron-auth är inkonsekvent: `api/cron/sync-embeddings.ts` och `api/cron/sync-oneflow.ts` kollar `CRON_SECRET` - men bara villkorligt: `sync-oneflow.ts:280` släpper igenom allt om env-varen inte är satt, och `sync-embeddings.ts:50` enforcar dessutom bara i production. `api/cron/cleanup-ai-images.ts` kollar bara `req.method !== 'GET'` (rad 13) och `extend-recurring-schedules.ts`, `reactivate-paused-billing.ts`, `monthly-customer-snapshot.ts`, `generate-continuing-contracts.ts` har ingen kontroll alls - kopiera aldrig ett av dessa fyra som mall för ett nytt jobb utan att lägga till auth.

## Riktning

1. **Lägg till `CRON_SECRET`-kontroll på alla sju cron-endpoints, inte bara två.** Idag saknar `cleanup-ai-images.ts` (bara metodkoll), `extend-recurring-schedules.ts`, `reactivate-paused-billing.ts`, `monthly-customer-snapshot.ts` och `generate-continuing-contracts.ts` helt auth-kontroll, trots att flera av dem kör faktureringslogik med full service-role-åtkomst och är publikt anropsbara av vem som helst som känner till URL:en. Extrahera de två snarlika (men inte identiska) kontrollerna från `sync-embeddings.ts`/`sync-oneflow.ts` till en delad hjälpfunktion i `api/_lib/`, applicera på alla sju - och gör den skarp även när `CRON_SECRET` saknas (idag är båda no-ops utan env-varen).
2. **Gör `npm run lint` körbart.** Enklaste vägen: döp om `eslint.config.js` → `eslint.config.mjs` (kräver ingen ändring av `package.json` eller `tsconfig.node.json`s CJS/NodeNext-antaganden). Kodbasen har idag noll lint-skydd trots en genomtänkt config med react-hooks-regler.
3. **Minska huvud-bundlens storlek** (flera MB, en enda chunk som laddas av alla roller). Lägg till `build.rollupOptions.output.manualChunks` i `vite.config.ts` och städa blandade statiska/dynamiska importer (Vite flaggar dessa i sin egen build-logg) så att admin/koordinator/tekniker/kund-kod kan route-splittas separat.
4. **Konsolidera `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`-fallback-ordningen** till en delad `getServiceSupabaseClient()`-funktion i `api/_lib/`, så att nyckelrotationer inte kan ge olika filer olika nycklar samtidigt.
