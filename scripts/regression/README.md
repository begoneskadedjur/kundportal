# Regressionsskript för avtalsfakturering

Steg 1 i `docs/planer/avtalsar-exakt-arsdag-teknik.md`. Körs före och efter varje följande steg för att visa att planerade perioder och matchningen mot befintliga fakturor är oförändrade, byte för byte.

Allt läser prod med service role från `.env` och skriver aldrig till databasen: bara SELECT och läsande SQL-funktioner (`contract_addon_ledger`, `contract_next_period_start`, `contract_next_unplanned_period`). `sync_addon_period_lines` och `sync_addon_article_lines` anropas inte; § 6-raderna läses som de ligger. Dumparna hamnar i `scripts/regression/out/`, som inte versionshanteras (kunddata).

## Planerade perioder

```bash
npx tsx --env-file=.env scripts/regression/plan-dump.mts --today=2026-10-30
```

Skriver `out/plan-<today>-<git sha>.json` och `.sha256` bredvid. Valfritt `--out-dir=<mapp>`.

Innehåll:
- `contracts`: alla levande avtal (`type = 'contract'`, status signed/active), med källor (premietrappa, § 4- och § 6-rader, aktiva tilläggsstationer), om cronen väljer avtalet och varför inte.
- `synth_customers`: kunder utan avtalsrad som cronen planerar ur kundraden.
- `rows`: en rad per planerad period (alla fält i `PlannedPeriod`) eller befintlig faktura utan plan, sorterad på ägare, typ och periodstart. Varje rad har
  - `generator`: vad Planera fakturor skulle göra (`buildDiff` i `contractInvoiceGenerator.ts`: keep, update, create, delete, locked, uncovered, consolidated, plus pseudoåtgärderna `samlad` för avtal som planeras på samlingsfakturan och `tackt_av_fortnox` för perioder som en F-import täcker till minst hälften),
  - `cron`: vad `generate-continuing-contracts` skulle göra (skapas, finns, finns_per_avtal, ej_dags, inga_rader, historisk, fortnox, samlad, inom_bindning_ej_rullad) och `refresh_invoice_id` när den skulle byta tilläggsrader på ett utkast,
  - `cron_planned`: cronens period när den skiljer sig från generatorns (annars null).

Matchningen är en trogen kopia av koden i `src/` och `api/` (den är inte exporterad), med rad för rad hänvisning i skriptet. Avvikelser med flit: sync-RPC:erna körs inte, fakturor ordnas på `created_at, id` (PostgREST lämnar ordningen öppen), och synth-kundernas generatorjämförelse görs på bindningsplanen.

## SQL-funktionerna

```bash
npx tsx --env-file=.env scripts/regression/sql-dump.mts
```

Samma sak som `sql-dump.sql` (som kan köras direkt i SQL-editorn): för alla levande avtal och sju fasta datum `contract_next_period_start`, `contract_next_unplanned_period` och `next_invoice_replik`. `contract_customer_view` kräver inloggad användare och kan inte anropas med service role; fältet `next_invoice` räknas därför med funktionens eget uttryck. `meta.md5` ska vara lika med kontrollsumman längst ned i `.sql`-filen.

## Jämföra

```bash
node scripts/regression/compare.mjs out/plan-A.json out/plan-B.json
```

Skriver skillnader per avtal: tillagda, borttagna och ändrade perioder med fält. Exitkod 0 vid identiska, 1 vid skillnader. `git_sha` och `today` i meta räknas inte som skillnad.

## Vad det bevisar

Samma sha och samma `--today` ger samma hash. Efter en ändring i koden (samma `--today`, ny sha) visar `compare.mjs` exakt vilka perioder, belopp och åtgärder som ändrats. Databasen ändras mellan körningarna (cronen, fakturor som skickas), så jämför körningar som gjorts nära varandra i tid, eller kör båda versionerna samma dag.
