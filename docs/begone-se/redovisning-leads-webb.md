# Redovisning: Leads (Webb) och formulären på nya begone.se

2026-10-05. Beställning från Christian: "Jag vill att vi döper om den befintliga 'leads' till Leads (B2B) och sen skapar vi 'Leads (Webb)' för de som kommer från webbsidan." Integrationen med kontaktformulären byggs parallellt med textarbetet så att sajten kan gå live.

Plan: `docs/begone-se/forfragningar-plan.md`.

## Vad som byggdes

**Kundportalen (pushat till main)**

- Leads heter nu Leads (B2B) i de fyra menyerna, mobilraden, brödsmulorna och rubriken på sidan. Tabellen `leads` och sidan i övrigt är orörda.
- Leads (Webb) under Försäljning, routes `/…/leads-webb`, med flikarna Inkorg, Alla och Statistik. Detaljmodalen visar formulärets svar, bilderna, sidan där formuläret skickades, statusflöde (Ny till Vunnen, Förlorad eller Skräp), tilldelning, anteckningar med historik och knapparna Skapa B2B-lead (förifylld) och Skapa kund.
- Statistik: efterfrågan per vecka, tjänst, kundgrupp och sida, och andelen som fick kontakt samma dag.
- Räknare i sidomenyn med realtid som visar antalet nya förfrågningar.
- Publikt API `api/forfragan.ts` med `api/_lib/forfragan.ts` och den gemensamma CORS-vitlistan `api/_lib/begoneSeCors.ts` (utflyttad ur `api/artanalys.ts`).
- Kvittensmejl till kunden via Resend med ett eget nummer i kolumnen `referens`.
- Uppdateringsloggen: version 3.24.0 i `src/constants/changelog.ts`.

**Databasen (Supabase rfyufytjwvqiqwueinoj)**

- Tabellerna `web_inquiries`, `web_inquiry_images` och `web_inquiry_events`, alla med RLS.
- Privat bucket `web-inquiry-images`, högst 5 MB per fil, bara bildtyper.
- Migrationer, i ordning:
  1. `20261005_web_inquiries.sql` (tabeller, bucket, RLS, trigger)
  2. `20261005_web_inquiries_rattigheter.sql` (rollkontrollen räknar is_admin, anon får inte köra security definer-funktionerna)
  3. `20261005_web_inquiries_grants.sql` (anon får inga tabellrättigheter, inloggade bara de som behövs)

**Sajten (worktree `C:\Users\chris\begone-se-forfragan`, grenen forfragningar, inte pushad)**

- `src/lib/offert.ts`: `INBOUND_URL` pekar på `https://kundportal.vercel.app/api/forfragan`. `skickaForfragan()` skalar ned bilderna, skickar JSON och laddar upp bilderna.
- `Offertflode.astro` skickar med `fran` och bilderna. Förut kom bilderna aldrig fram, bara antalet.
- Artanalysens formulär skickar ort bara när vi täcker postnumret. Artanalysens nummer skickas aldrig och kopplas inte till kundportalens nummer.

## Från formulär till portal

1. Besökaren fyller i offertflödet, /prisforslag/, startsidans formulär eller artanalysens formulär.
2. Webbläsaren skalar ned varje bild till JPEG (EXIF och GPS försvinner) och skickar texten som JSON, högst 32 kB, till `api/forfragan`. Vercels gräns på 4,5 MB nås därför aldrig.
3. API:t kontrollerar Origin, honungsfält, minsta tid, hastighetsgräns och fälten, sparar raden i `web_inquiries` med service role och svarar med id, referens och signerade uppladdnings-URL:er.
4. Webbläsaren laddar upp bilderna direkt till bucketen och meddelar API:t, som markerar vilka som kom fram och skriver en rad i historiken.
5. Kunden får kvittensmejlet. I portalen syns förfrågan direkt i Inkorgen via realtid och i menyns räknare.

Texten sparas alltid först, så en bild som faller tar inte förfrågan med sig.

## Säkerhet

- CORS bara för begone.se, www.begone.se, localhost och förhandsvisningar med suffixet `-begone-skadedjur.vercel.app`. Främmande eller saknad Origin ger 403.
- Honungsfält och inskick under 3 sekunder ger 200 utan att något sparas.
- Gräns per IP och per telefon via `withinRateLimit`. IP sparas bara som hash.
- Kropp över 32 kB ger 413. Ogiltig telefon, saknat samtycke, fel filtyp eller för många bilder ger 400 med fältets namn.
- Loggarna innehåller bara id, inga personuppgifter.
- RLS: admin, koordinator och säljare läser och ändrar. Anon, kund och tekniker ser inget. Ingen roll kan skapa eller radera förfrågningar; bara API:t skapar dem.
- Tabellrättigheterna är smalare än Supabases standard, som ett skydd utöver RLS.

## Test

- Ett riktigt inskick hela vägen i en testrigg: sajtens `skickaForfragan()` mot kundportalens handler, med mejl och notis avstängda. Rad, bild, händelse och ip_hash fanns i databasen. Testdata raderad efteråt, tabellerna och bucketen är tomma.
- Alla skydd i API:t testade med de svar som står ovan.
- RLS testat med SQL som varje roll.
- Säkerhetsrådgivaren: bara de avsiktliga varningarna om två security definer-funktioner för inloggade.
- Före push: `node scripts/type-check.mjs` utan nya fel (941 mot baseline 944), `npm run build` grönt, lint utan fel i de nya filerna. Lint för hela repot har gammal skuld som inte rör leveransen.
- begone.se anropades aldrig.

## Commits

| Repo | Commit | Innehåll |
|---|---|---|
| Kundportalen, main | `2ae7a61c` | Leads (Webb) och namnbytet |
| Kundportalen, main | `31dc24db` | Säkerhetsgranskningens rättningar |
| Sajten, forfragningar | `372e8ab` | Formulären skickar förfrågningar till kundportalen |
| Sajten, forfragningar | `6b3bbed` | Granskningens rättningar |

Grenen forfragningar är inte pushad och inte ihopslagen. Huvudsessionen slår ihop den när textarbetet tillåter.

## Deploy

DEPLOYSTATUS

## Kvarstående risker

- Origin-kontrollen stoppar bara webbläsare. Mot skript skyddar hastighetsgränsen, som släpper igenom allt om databasen inte svarar.
- Storleken på uppladdade bilder kontrolleras inte i förväg, så taket är bucketens 5 MB.
- Sidan Leads (Webb) är granskad i koden men inte testad i webbläsare.
- Kvittensmejlet är inte testat.
- Utanför uppdraget: anon kan anropa `bump_rate_limit` direkt, och lokala .env-filer stänger av certifikatkontrollen med `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Frågor till Christian och förslagen som byggdes

1. **Notistypen.** Notisen i klockan kräver att CHECK-villkoret `notifications_case_type_check` byts, vilket kräver en drop constraint som migrationsverktyget nekar. Byggt: räknaren i menyn och realtid på sidan. Godkänner du satsen läggs notisen till.
2. **Vem ser Leads (Webb).** Byggt: admin, koordinator och säljare. Tekniker ser inget.
3. **Svar på kvittensmejlet.** Förslag: reply-to `info@begone.se` så att kunden kan svara med fler bilder.
4. **Artanalysens bild.** Byggt: bilden följer inte med förfrågan. Kan läggas till senare med en rad i integritetstexten.
5. **Gallring.** Förslag: skräp raderas efter 30 dagar och förlorade efter 24 månader, med en cron senare. Inte byggt än.
6. **Privatpersoner.** Byggt: status och anteckningar, ingen knapp för att skapa ärende i första versionen.
7. **Internt mejl.** Byggt: inget mejl till en säljinkorg, räknaren räcker. Ingen captcha nu.

Adressen `INBOUND_URL` byts till kundportal.begone.se när den domänen finns.
