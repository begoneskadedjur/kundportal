# Skills för BeGone Kundportal

Projektspecifika skills som laddas automatiskt av Claude Code när en uppgift matchar. En rad per skill: namn + när den triggar.

| Skill | Triggar när du arbetar med |
|---|---|
| `fakturering-prislistor` | Fakturor, avtalsfakturering, årspremie, merförsäljning/adhoc, prislistor, ROT/RUT, fakturanummer, `invoiceService`/`contractInvoiceGenerator`/`caseBillingService` |
| `provisioner` | Provisioner och tekniker-ersättning: `commission_posts`, `ProvisionService`, utbetalningsmånad, löneunderlag, invoice paid-triggern |
| `schemalaggning-tidszoner` | Koordinator-/teknikerschemat, återkommande besök, FullCalendar, konfliktdetektering, tidszoner och timestamptz, röda dagar |
| `egenkontroll-rondering` | Stationskontroller, inspektionssessioner, rondering/egenkontroll Trafikkontoret, planritningar, stationstyper, kontrollrapporter |
| `multisite-organisation` | Multisite-organisationer, regionala kunder, `multisite_user_roles`, portalerna /organisation och /regional, regionpolygoner |
| `externa-integrationer` | Oneflow, Fortnox, ClickUp (legacy), e-post och SMS: webhooks, OAuth, mall-ID:n, `api/oneflow/*`, `api/fortnox/*` |
| `ui-designsystem` | Modaler, brandfärgen #20c58f, bas-komponenter (`Modal`/`Select`/`Button`/`Card`), z-index-krockar, kompakt-standarden |
| `supabase-databas` | Databasschema, RLS-policies, migrations, statusmappning, realtidsprenumerationer, roller/profiles, auth-triggers |
| `pdf-rapporter` | PDF-generering: saneringsrapporter, ärenderapporter, kontrollrapporter, ronderingsrapporter, jsPDF/Puppeteer, interna beslutsdokument |
| `dev-workflow` | Bygge, type-check-baseline, lint, Vercel-deploy, cron-jobb, `tsconfig`-uppdelningen, env-vars för service-nycklar |
| `projekt-riktning` | Planering av nya features, refaktorer, arkitekturbeslut, teknisk skuld och roadmap-prioritering över alla domäner |

Varje skill följer samma struktur: Nyckelfiler, Arkitektur, Invarianter (ALDRIG-regler), Vanliga uppgifter, Fallgropar och Riktning (dagens läge vs målbild). `projekt-riktning` aggregerar alla Riktning-sektioner till en prioriterad agenda.
