---
name: projekt-riktning
description: Prioriterad förbättringsagenda för hela BeGone Kundportal, aggregerad från alla domänskillars Riktning-sektioner. Använd när du ska planera nya features, refaktorera, förbättra arkitekturen, betala av teknisk skuld, prioritera en roadmap eller bedöma var en större ändring gör mest nytta. Nyckelord: planera, refaktorera, förbättra, arkitektur, teknisk skuld, roadmap, prioritering, förbättringsagenda.
---

# Projektriktning: prioriterad förbättringsagenda

Aggregerar Riktning-sektionerna från alla domänskills till en helhetsbild. Rangordnad efter nytta/insats: säkerhetshål och tyst dataförlust först, ren städning sist. Läs alltid respektive domänskill innan du börjar, den har detaljplanen och invarianterna.

## Topp 10, rangordnat efter nytta/insats

1. **Auth på Fortnox-proxyn** (externa-integrationer). Belägg: `api/fortnox/proxy.ts` saknar auth helt, vem som helst kan POST:a mot bokföringen. Första steg: `requireAuth(req, res, ['admin','koordinator'])` överst i proxyn + `Authorization: Bearer`-header i `fortnoxService.ts:16`.

2. **Auth på multisite-användar-API:erna** (multisite-organisation). Belägg: `api/update-multisite-user-email.ts` och `api/create-multisite-users.ts` saknar auth (CORS `*`), vem som helst kan byta e-post på valfri auth-user, dvs. kontokapning. Första steg: bryt ut Bearer-valideringen från `api/multisite-users.ts:33-65` till delad helper i `api/_lib/` och kräv den i alla tre endpoints.

3. **CRON_SECRET fail-closed på alla sju cron-endpoints** (dev-workflow). Belägg: fem av sju cron-jobb i `vercel.json` saknar auth-kontroll helt, och `sync-oneflow.ts:280` släpper igenom allt om env-varn saknas. Flera kör faktureringslogik med service-role. Första steg: delad `requireCronSecret`-helper i `api/_lib/`, skarp även när env-varn saknas.

4. **Fixa tyst intäktsläckage i adhoc-fakturering** (fakturering-prislistor). Belägg: `createAdHocItemsFromCase` markerar rader `billed` FÖRE fakturaskapandet och sväljer fel med bara console.error (`contractBillingService.ts:447-449`), omkörning hjälper inte. Första steg: returnera `invoiceId/invoiceError` till anroparna med toast, kasta vid DB-fel; därefter backfill-cron för `ad_hoc`-rader utan `invoice_id`.

5. **Fixa tyst dataförlust i provisionsflödet** (provisioner). Belägg: `upsertPostsForCase` raderar poster INNAN valideringen körs (`provisionService.ts:174-197`), en prisändring under tröskeln raderar intjänad provision med bara en toast som spår. Första steg: kör tröskel- och andelsvalidering före delete, lägg unikt index på `(case_id, technician_id)` via migration.

6. **RLS på de öppna tabellerna** (supabase-databas + provisioner). Belägg: sex tabeller har RLS helt avstängd med anon-grants (`services`, `pricing_settings`, `fortnox_test_tokens` m.fl.), och `invoices`/`commission_posts` har allow-all för authenticated, dvs. kundkonton kan läsa/skriva fakturor och lönedata. Första steg: slå på RLS på de sex tabellerna med preparations-mönstret (`20260127_create_preparations_table.sql:27-53`), ta sedan `invoices`/`commission_posts` enligt detaljplanen i skill provisioner Riktning 2.

7. **Tidszonsfixar i skrivvägarna** (schemalaggning-tidszoner). Belägg: fem levande felskrivningar med `toSwedishISOString` (bl.a. `EditCaseModal.tsx:1023`, kan tippa ärenden i fel provisionsmånad) och cronens UTC-bygge (`extend-recurring-schedules.ts:212`) driftar besök 1-2 timmar. Första steg: byt de fem skrivvägarna till `toLocalISOStringWithOffset`, märk funktionen `@deprecated` för skrivning; cronens bygge rättas med `fromZonedTime('Europe/Stockholm')`.

8. **Auth på PDF-endpoints** (pdf-rapporter). Belägg: `api/generate-case-report-pdf.ts` och `api/generate-inspection-report-pdf.ts` saknar auth och slår upp kunddata via service-role från okontrollerat `case_id`. Första steg: `requireAuthenticated` (samma nivå som `api/generate-pdf.ts`) + Authorization-header i de anropande hooksen, som egen testad PR.

9. **Konsolidera Oneflow-mall-ID:na och gör nattsyncen ofarlig** (externa-integrationer). Belägg: mall-ID:n på 7+ ställen, och missas cron-kopian TRASHAR `sync-oneflow.ts:324-346` alla avtal på nya mallen natten efter. Första steg: exportera `ALL_TEMPLATE_IDS`/`OFFER_TEMPLATE_IDS` från `api/constants/oneflowTemplates.js` (behåll CJS) och importera i cron/sync-offers/offer-stats; wrappa samtidigt syncen i `withCronLog`.

10. **Radera de döda generationerna, med ClickUp-token-kedjan först** (externa-integrationer, provisioner, multisite-organisation, fakturering-prislistor, pdf-rapporter). Belägg: `VITE_CLICKUP_API_TOKEN` ligger i publika frontend-bundlen (`clickupSync.ts:15`), gamla multisite-portalen har fel datamodell, provisionernas gen 1 lockar till fel fix, legacy-batch-UI:t kan skapa parallella faktureringsrader. Första steg: radera den döda ClickUp-frontendkedjan + rotera token (säkerhet och städning i ett), ta sedan en generation per commit enligt respektive skills Riktning.

## Principer

Tvärgående mönster som återkommer i nästan varje domän. Väg in dem vid varje ny feature eller refaktor:

- **Duplicerade generationer lever kvar.** Nya system byggs bredvid gamla utan att de gamla tas bort: provisioner gen 1/gen 2, tre fakturanummer-generatorer, tre schemagenerator-kopior, tre ärenderapportvägar, två portal-switchar, två permissions-matriser, tre tröskellogik-kopior. Bygg aldrig en fjärde variant; återanvänd eller ersätt och radera.
- **Oskyddade service-role-endpoints.** Bara ~30 av ~210 api-filer har auth. Varje ny endpoint ska ha `requireAuth`/`requireAuthenticated` eller CRON_SECRET från start, aldrig "läggs till senare".
- **Tyst felsväljning i pengaflöden.** console.error + fortsätt är mönstret bakom både intäktsläckaget (punkt 4) och provisionsförlusten (punkt 5). Fel som påverkar pengar ska upp till användaren och gå att köra om.
- **Klient-side orkestrering av serverjobb.** Raderingssekvenser, fakturaskapande och geocoding körs icke-transaktionellt i webbläsaren. Målbilden är SECURITY DEFINER-RPC:er eller serverless-endpoints för fleregsoperationer.
- **RLS är inte säkerhetsgränsen i dag.** Nästan allt är `USING (true)` och avgränsningen sker i klientkod. Bygg aldrig säkerhet på klientfiltrering, och strama inte åt RLS piecemeal utan att läsa respektive skills invarianter.
- **Migrationsmappen är inte schemakällan.** Flera tabeller finns bara i live-DB. Verifiera alltid mot `rfyufytjwvqiqwueinoj` via MCP innan migration, och skriv migrationsfil för varje ny DDL-ändring.
- **Ingen CI, ingen lint, ingen testtäckning.** `npm run build` typkollar inte, lint kraschar, delade rena moduler (periodmatematik, datumgeneratorer) saknar enhetstester. Varje utbruten ren modul ska få tester direkt, det är så skulden krymper.
- **Tid skrivs med explicit svensk offset.** `toLocalISOStringWithOffset` för väggtider, aldrig naiv sträng, aldrig `new Date(y,m,d,h,min)` på UTC-server.
- **Död kod är en aktiv fälla.** Orutade komponenter med fel datamodell tas som mall av misstag. Märk `@deprecated` eller radera; kolla alltid med grep om en fil faktiskt är routad innan du härmar den.
