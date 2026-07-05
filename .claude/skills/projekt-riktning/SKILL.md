---
name: projekt-riktning
description: Prioriterad förbättringsagenda för hela BeGone Kundportal, aggregerad från alla domänskillars Riktning-sektioner. Använd när du ska planera nya features, refaktorera, förbättra arkitekturen, betala av teknisk skuld, prioritera en roadmap eller bedöma var en större ändring gör mest nytta. Nyckelord: planera, refaktorera, förbättra, arkitektur, teknisk skuld, roadmap, prioritering, förbättringsagenda.
---

# Projektriktning: prioriterad förbättringsagenda

Aggregerar Riktning-sektionerna från alla domänskills till en helhetsbild. Rangordnad efter nytta/insats: säkerhetshål och tyst dataförlust först, ren städning sist. Läs alltid respektive domänskill innan du börjar, den har detaljplanen och invarianterna.

## Avklarat

- ~~**Auth på Fortnox-proxyn**~~ KLART 2026-07-03 (`5754bbfd`): `requireAuth(['admin','koordinator'])` + resurs-allowlist + path-validering i `api/fortnox/proxy.ts`, Bearer-header i `fortnoxService.ts`.
- ~~**Auth på multisite-användar-API:erna**~~ KLART 2026-07-03 (`bd487586`, `f74f44fc`): delad kontroll i `api/_lib/multisiteAuth.ts` (admin/koordinator/verksamhetschef-i-egen-org) på alla tre endpoints, e-postbytet vägrar dessutom röra icke-multisite-konton.
- ~~**CRON_SECRET fail-closed på alla sju cron-endpoints**~~ KLART 2026-07-03 (`3d3a871d`): delad `requireCronSecret` i `api/_lib/cronAuth.ts`, 503 om env-varn saknas, timing-säker jämförelse. OBS: CRON_SECRET måste finnas i Vercel-miljön, annars stannar jobben (medvetet).
- ~~**Trasig lint**~~ KLART 2026-07-03 (`e31e2ae9`): `eslint.config.js` → `.mjs`, `npm run lint` startar nu.
- ~~**Tyst intäktsläckage i adhoc-fakturering**~~ KLART 2026-07-05 (`ff11a923`, `74ec1f03`): atomära inserter, fel propageras med toast, Ofakturerat-banner med återkörning. DB-analys: inget historiskt läckage.
- ~~**Tyst dataförlust i provisionsflödet**~~ KLART 2026-07-05 (`f46b5787`): validering före delete + partiellt unikt index (migration applicerad).
- ~~**Auth på Oneflow-mutationsendpoints**~~ KLART 2026-07-05 (`b8b4759b`): sex endpoints skyddade, avsändarspoofing via x-sender-email stoppad. Fil-endpoints återstår (se externa-integrationer Riktning 2).
- ~~**Auth på PDF-endpoints**~~ KLART 2026-07-05 (`9a8587ae`): requireAuthenticated på alla fyra rapport-endpoints inkl. mejlutskicket, nio anropare skickar Bearer.
- ~~**Cronens tidszonsdrift**~~ KLART 2026-07-05 (`53410f86`): fromZonedTime i extend-recurring-schedules. Kvar: röda dagar-portning (produktbeslut) + städning av gamla felskrivna sessioner.

## Topp 3, rangordnat efter nytta/insats

1. **RLS på de öppna tabellerna** (supabase-databas + provisioner). Belägg: sex tabeller har RLS helt avstängd med anon-grants (`services`, `pricing_settings`, `fortnox_test_tokens` m.fl.), och `invoices`/`commission_posts` har allow-all för authenticated, dvs. kundkonton kan läsa/skriva fakturor och lönedata. Första steg: slå på RLS på de sex tabellerna med preparations-mönstret (`20260127_create_preparations_table.sql:27-53`), ta sedan `invoices`/`commission_posts` enligt detaljplanen i skill provisioner Riktning 2.

2. **Konsolidera Oneflow-mall-ID:na och gör nattsyncen ofarlig** (externa-integrationer). Belägg: mall-ID:n på 7+ ställen, och missas cron-kopian TRASHAR `sync-oneflow.ts:324-346` alla avtal på nya mallen natten efter. Första steg: exportera `ALL_TEMPLATE_IDS`/`OFFER_TEMPLATE_IDS` från `api/constants/oneflowTemplates.js` (behåll CJS) och importera i cron/sync-offers/offer-stats; wrappa samtidigt syncen i `withCronLog`.

3. **Radera de döda generationerna, med ClickUp-token-kedjan först** (externa-integrationer, provisioner, multisite-organisation, fakturering-prislistor, pdf-rapporter). Belägg: `VITE_CLICKUP_API_TOKEN` ligger i publika frontend-bundlen (`clickupSync.ts:15`), gamla multisite-portalen har fel datamodell, provisionernas gen 1 lockar till fel fix, legacy-batch-UI:t kan skapa parallella faktureringsrader. Första steg: radera den döda ClickUp-frontendkedjan + rotera token (säkerhet och städning i ett), ta sedan en generation per commit enligt respektive skills Riktning.

## Principer

Tvärgående mönster som återkommer i nästan varje domän. Väg in dem vid varje ny feature eller refaktor:

- **Duplicerade generationer lever kvar.** Nya system byggs bredvid gamla utan att de gamla tas bort: provisioner gen 1/gen 2, tre fakturanummer-generatorer, tre schemagenerator-kopior, tre ärenderapportvägar, två portal-switchar, två permissions-matriser, tre tröskellogik-kopior. Bygg aldrig en fjärde variant; återanvänd eller ersätt och radera.
- **Oskyddade service-role-endpoints.** Bara en bråkdel av ~210 api-filer har auth (Fortnox-proxy, multisite-användar-API:er och alla cron-jobb åtgärdade 2026-07-03). Varje ny endpoint ska ha `requireAuth`/`requireAuthenticated` eller `requireCronSecret` från start, aldrig "läggs till senare".
- **Tyst felsväljning i pengaflöden.** console.error + fortsätt är mönstret bakom både intäktsläckaget (punkt 4) och provisionsförlusten (punkt 5). Fel som påverkar pengar ska upp till användaren och gå att köra om.
- **Klient-side orkestrering av serverjobb.** Raderingssekvenser, fakturaskapande och geocoding körs icke-transaktionellt i webbläsaren. Målbilden är SECURITY DEFINER-RPC:er eller serverless-endpoints för fleregsoperationer.
- **RLS är inte säkerhetsgränsen i dag.** Nästan allt är `USING (true)` och avgränsningen sker i klientkod. Bygg aldrig säkerhet på klientfiltrering, och strama inte åt RLS piecemeal utan att läsa respektive skills invarianter.
- **Migrationsmappen är inte schemakällan.** Flera tabeller finns bara i live-DB. Verifiera alltid mot `rfyufytjwvqiqwueinoj` via MCP innan migration, och skriv migrationsfil för varje ny DDL-ändring.
- **Ingen CI, ingen testtäckning.** `npm run build` typkollar inte, delade rena moduler (periodmatematik, datumgeneratorer) saknar enhetstester (lint är körbar sedan 2026-07-03 men skulden är stor). Varje utbruten ren modul ska få tester direkt, det är så skulden krymper.
- **Tid skrivs med explicit svensk offset.** `toLocalISOStringWithOffset` för väggtider, aldrig naiv sträng, aldrig `new Date(y,m,d,h,min)` på UTC-server.
- **Död kod är en aktiv fälla.** Orutade komponenter med fel datamodell tas som mall av misstag. Märk `@deprecated` eller radera; kolla alltid med grep om en fil faktiskt är routad innan du härmar den.
