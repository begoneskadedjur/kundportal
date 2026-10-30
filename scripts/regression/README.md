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

Matchningen (`buildContractDiff`, `monthKey`, `periodKey`, `coveredByFortnox`) importeras sedan steg 2 från `src/shared/contractInvoiceMatch.ts`, samma modul som generatorn, cronen och signeringen använder. Övriga delar (urval, källor, cronens flöde) är trogna kopior av koden i `src/` och `api/`, med rad för rad hänvisning i skriptet. Avvikelser med flit: sync-RPC:erna körs inte, fakturor ordnas på `created_at, id` (PostgREST lämnar ordningen öppen), och synth-kundernas generatorjämförelse görs på bindningsplanen.

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

## Periodregeln, TS mot SQL (steg 6)

```bash
npx tsx --env-file=.env scripts/regression/periods-twin.mts
```

Jämför `periodContaining` i `src/shared/contractPeriods.ts` (exakt avtalsdag) med SQL-funktionen `contract_period_on_pure` för 400 fasta kombinationer (20 startdagar, fyra frekvenser, fem frågedatum, fast frö). `--starts=N` ger fler. Exitkod 0 vid noll skillnader. Funktionen är ren och läser ingen tabell.

`avtalsar-perioder.test.sql` provar SQL-grenarna för exakt läge på FEV:s avtal i ett block som alltid rullas tillbaka (raise exception med resultatet).

## Överlappsmatchningen (steg 7)

`plan-dump.mts` kör sedan steg 7 också en kontroll som skrivs till `out/match-check-<today>-<sha>.json` (dumpen påverkas inte):

- `match.legacy_differences`: varje `buildDiff`-anrop i gamla läget jämförs med en fryst kopia av månadsnyckeln före steg 7. Ska vara 0.
- `match.plan_variant_differences`: hur många anrop planens variant (överlapp först, sedan månadsreserv) hade ändrat. Bara information; varianten byggdes inte.
- `guard.stops`: simulering av överlappsvakten mot generatorns create (efter delete och update) och cronens skapas. Ska vara tom.

`--exact=<id-prefix>,<id-prefix>` (eller `--exact=all`) sätter `billing_anchor_mode = 'start_day'` på de avtalen i minnet, aldrig i databasen. Använd en egen `--out-dir`.

```bash
npx tsx --env-file=.env scripts/regression/plan-dump.mts --today=2026-10-30 --out-dir=scripts/regression/out/steg7/exakt --exact=bca4c235,72818957
```

`overlap-share-twin.mts` jämför `periodOverlapShare` i TS med SQL-funktionen `contract_period_overlap_share` (som överlappsvakten anropar) för 400 fasta par (`--pairs=N` ger fler). `overlap-share.test.sql` provar vakten på riktigt kring gränsen hälften i ett block som alltid rullas tillbaka.

## Pro rata version 2 (steg 9)

`prorata-compare.sql` kör `sync_addon_prorata_line` (och `_legacy` när den finns) för alla anrop som förekommer i dag, varje anrop i en deltransaktion som rullas tillbaka, och skriver md5 per funktion. Före och efter migrationen ska md5 vara lika (avtal utan `addon_rules = 'v2'` går den gamla vägen). Svaret beror på dagens datum.

`prorata-v2.test.sql` provar version 2 på Falu kommun i målbilden (exakt avtalsdag, option, v2), ledtidsregeln på FEV, reservtriggern och teknikerns RLS, i ett block som alltid rullas tillbaka.
