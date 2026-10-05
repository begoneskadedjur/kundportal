# Leads (Webb): förfrågningar från begone.se in i kundportalen

Plan 2026-10-05. Beställning från Christian samma dag: "Jag vill att vi döper om den befintliga 'leads' till Leads (B2B) och sen skapar vi 'Leads (Webb)' för de som kommer från webbsidan." Integrationen byggs parallellt med textarbetet så att nya begone.se kan gå live. Bygger vidare på ARKITEKTUR.md avsnitt C, med en skillnad: webbförfrågningarna blir INTE rader i `leads`, de ligger i ett eget system.

## 1. Nuläge (kartlagt, ingen kod ändrad)

### 1.1 Befintliga leads i kundportalen

| Del | Var |
|---|---|
| Sida | `src/pages/admin/Leads.tsx` (1 038 rader), rubrik "Lead Pipeline" på rad 764 |
| Routes | `/admin/leads` och `/admin/leadsstatistik` (`src/App.tsx:193-194`, admin, koordinator, tekniker), `/koordinator/leads` (306), `/saljare/leads` (369), `/technician/leads` (401) |
| Meny | etiketten "Leads" i `adminNavConfig.ts:81` och `:154` (mobil), `coordinatorNavConfig.ts:63` och `:95`, `saljareNavConfig.ts:47` och `:64`, `technicianNavConfig.ts:44`; breadcrumbs i samma filer |
| Komponenter | `src/components/admin/leads/` (CreateLeadModal, LeadDetailModal, EditLeadModal, LeadsTable, LeadsFilters, kolumnval) |
| Tabell | `leads`: `company_name`, `contact_person`, `phone_number`, `email`, `created_by`, `updated_by` är NOT NULL; `assigned_to` pekar på `technicians` |
| Behörighet | RLS släpper in admin, koordinator, tekniker och säljare; kunder och anonyma ser inget |

### 1.2 Notiser och e-post

- `notifications` (recipient_id, case_id, case_type, title, preview, case_title, sender_id, sender_name, is_read). CHECK `notifications_case_type_check` tillåter bara `private, business, contract, customer, procurement`.
- Klick på en notis styrs per `case_type` i `NotificationBell.tsx:75`, `NotificationCenter.tsx:55` och `NotificationModal.tsx:132`.
- Mönster för serverinsättning: `insertNotifications` i `api/_lib/procurement.ts:766`.
- Utgående kundmejl går via Resend REST (`fetch('https://api.resend.com/emails')`) med avsändaren `BeGone Kundportal <noreply@begone.se>` och `baseTemplate` ur `api/email-templates.ts`, till exempel `api/cron/send-booking-notifications.ts:267-274`. Nodemailer mot `smtp.resend.com` finns i äldre endpoints. Vi använder REST-varianten.

### 1.3 Vad sajtens formulär skickar i dag

Tre ingångar använder samma `skickaForfragan(data)` i `begone-se/src/lib/offert.ts`. Den gör POST med JSON (`Content-Type: application/json`), ett nytt försök efter 1,5 s, och läser `{ id }` ur svaret. `INBOUND_URL` är tom, så ingenting skickas: offertflödet visar felraden med telefonnumret och artanalysens formulär renderas inte alls.

**Offertflödet** (`Offertflode.astro`, används på `/prisforslag/`, startsidan `fran="start"`, kontakt `fran="kontakt"`, företagssidan `fran="foretag"` och tjänstesidorna `fran="tjanst-<slug>"`):

| Fält | Innehåll |
|---|---|
| `form_type` | `akut` om rutan "Det är akut, jag behöver hjälp i dag" är ikryssad, annars `offert` |
| `customer_kind` | `privat` eller `foretag` (knappen "Företag, BRF eller fastighet") |
| `name`, `phone` | krävs; telefonen normaliserad till 0XXXXXXXXX |
| `email` | frivillig för privat, krävs för företag |
| `company_name`, `organization_number` | bara företag; företagsnamn krävs |
| `postal_code`, `city` | fem siffror krävs; ort ur sajtens postnummertabell, saknas utanför området |
| `address`, `message` | frivilliga |
| `pest_type` | djurets id (getingar, rattor, moss, vaggloss, silverfisk, myror, kackerlackor, faglar, vetinte), svaret under Annat (till exempel "Bålgeting"), eller `foretag` |
| `details` | `fraga`, `svar`, `foljfraga`, `folj` (för företag: verksamhetstyp, där "BRF eller fastighet" är ett svar, och behov), `akut`, `nar_ringa`, `antal_bilder` |
| spårning | `landing_url`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid` |
| samtycke | `consent: true`, `privacy_notice_shown: true`, `consent_text_version: '2026-09-25'` |
| robotskydd | `website` (honungsfältet `webbplats`), `started_at`, `submitted_at` |

Två luckor: **bilderna skickas inte alls** (upp till tre väljs och förhandsvisas, men bara `antal_bilder` följer med), och **`fran` saknas i payloaden** (propen används bara för länken till artanalysen).

Tack på `/prisforslag/` och de inbäddade formulären: samma ruta byter till tack-läget. Rubriken "Tack <förnamn>, vi ringer upp dig/er", raden "Din förfrågan om <djur> i <ort> har nummer <första 8 tecknen av id i versaler>" och, när e-post finns, "En bekräftelse skickas till <adress>". Därför måste endpointen skicka bekräftelsemejlet (avsnitt 6).

**Artanalysens formulär** (`artanalys-labb.ts:946-970`): `form_type` (`akut` för gruppen akut), `customer_kind`, `name`, `phone`, `postal_code`, `city`, `pest_type` (artens djur eller `vetinte`), `message` (protokollraden "Artanalys ÅÅÅÅ-MM-DD kl ...: art, säkerhet" plus egen beskrivning), `details: { kalla: 'artanalys', fran, kundgrupp: privat|brf_fastighet|verksamhet, art, sakerhet, utfall }`, spårning, samtycke och `website`. Ingen e-post och ingen bild. Kvittot visar aldrig något nummer.

### 1.4 Publika API:er i kundportalen

`api/artanalys.ts` är förlagan: CORS bara för `begone.se`, `www.begone.se`, `begone-se(-...)?.vercel.app` och `localhost:4321`/`127.0.0.1:4321`, annars 403; IP sparas bara som HMAC; tak per besökare. `api/_lib/rateLimit.ts` ger `withinRateLimit(nyckel, gräns, sekunder)` via RPC `bump_rate_limit` (fail-open). Vercel tar högst 4,5 MB per anrop; artanalysen stannar på 3,2 MB.

## 2. Leads (B2B): bara namnbyte

- Etiketten "Leads" blir "Leads (B2B)" i de fyra navconfig-filerna (sidomeny, mobilrad, breadcrumbs). Rubriken "Lead Pipeline" i `Leads.tsx:764` blir "Leads (B2B)".
- Inga routes, tabeller, filter eller behörigheter ändras. "Leadsstatistik" behåller sitt namn.

## 3. Datamodell (migration `supabase/migrations/20261005_web_inquiries.sql`)

Bara `create table if not exists`, `add column if not exists`, `create or replace`. Ingen DROP.

### 3.1 `web_inquiries`

| Kolumn | Typ | Kommentar |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `referens` | text generated always as (upper(left(id::text, 8))) stored | kvittonumret som sajten visar; aldrig ett ärendenummer |
| `created_at`, `updated_at` | timestamptz not null default now() | |
| `form_type` | text check in (`offert`, `akut`) | `akut` = rutan ikryssad eller artanalysens akutgrupp |
| `kalla` | text check in (`offertflode`, `artanalys`) | |
| `fran` | text | `start`, `kontakt`, `foretag`, `prisforslag`, `tjanst-<slug>`, artanalysens ingång |
| `sida` | text | sökvägen ur `landing_url` utan frågesträng |
| `landing_url`, `referrer` | text | |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid` | text | |
| `customer_kind` | text check in (`privat`, `foretag`) | |
| `kundgrupp` | text check in (`privat`, `brf_fastighet`, `verksamhet`) | härleds: artanalysens `kundgrupp`; offertflödet `foretag` + svaret "BRF eller fastighet" ger `brf_fastighet`, annars `verksamhet` |
| `name`, `phone`, `email` | text | namn och telefon not null |
| `company_name`, `organization_number` | text | |
| `postal_code` | text not null check (`^\d{5}$`) | |
| `city`, `address` | text | |
| `inom_omrade` | boolean | sant när sajten gav en ort |
| `pest_type` | text not null | djur-id eller svaret under Annat |
| `message` | text | högst 4 000 tecken |
| `details` | jsonb not null default '{}' | frågan, svaret, följdfrågan, när vi ska ringa, för artanalys `art`, `sakerhet`, `utfall` |
| `antal_bilder` | smallint not null default 0 | |
| `consent`, `consent_text_version` | boolean not null, text | |
| `started_at`, `submitted_at` | timestamptz | |
| `ip_hash`, `user_agent` | text | HMAC, aldrig klartext-IP |
| `status` | text not null default `ny` check in (`ny`, `kontaktad`, `offert`, `vunnen`, `forlorad`, `skrap`) | |
| `status_andrad_at` | timestamptz | sätts av trigger |
| `forsta_kontakt_at` | timestamptz | första gången status lämnar `ny` |
| `tilldelad_till`, `tilldelad_at` | uuid references profiles(id), timestamptz | |
| `lead_id` | uuid references leads(id) | när en B2B-lead skapats |
| `customer_id` | uuid references customers(id) | när en kund skapats |
| `kvittens_skickad_at` | timestamptz | bekräftelsemejlet |

Index på `created_at desc`, `status`, `pest_type`, `tilldelad_till`. Trigger `web_inquiries_touch` (create or replace function) sätter `updated_at`, `status_andrad_at` och `forsta_kontakt_at`.

Ingen kolumn och ingen främmande nyckel pekar mot `artanalys_anrop`, och `artanalys_anrop` får ingen kolumn mot `web_inquiries`. Artanalysens anropsnummer kopplas aldrig till kundportalens nummer.

### 3.2 `web_inquiry_images`

`id`, `inquiry_id` (references web_inquiries on delete cascade), `storage_path`, `mime`, `bytes`, `bredd`, `hojd`, `uppladdad` (boolean default false), `created_at`.

### 3.3 `web_inquiry_events`

Historik och anteckningar: `id`, `inquiry_id`, `typ` check in (`anteckning`, `status`, `tilldelning`, `konvertering`), `text`, `fran_varde`, `till_varde`, `skapad_av` (profiles.id), `created_at`. Anteckningar läggs här, så att de får författare och tid.

### 3.4 RLS

- RLS på alla tre tabellerna. Ingen policy för `anon`; insert från sajten går bara via service role i API:et.
- `web_inquiries`: select och update för admin, koordinator och säljare (samma rollkontroll som befintliga leads-policyer, via `profiles.user_id = auth.uid()`). Ingen delete-policy, skräp markeras med status.
- `web_inquiry_images`: select för samma roller.
- `web_inquiry_events`: select och insert för samma roller, `skapad_av` måste vara den egna profilen. Ingen update eller delete.
- Efter migrationen: `get_advisors` (security) och ett RLS-test som varje roll, enligt minnet tekniker-avslut-rls.

### 3.5 Bilder: privat bucket

Bucket `web-inquiry-images`, `public = false`, `file_size_limit` 3 MB, `allowed_mime_types` jpeg, png, webp. Sökväg `<inquiry_id>/<n>.jpg`. Storage-policy: select för admin, koordinator och säljare. Ingen insert-policy för anon; uppladdning sker bara med signerade uppladdnings-URL:er som API:et skapar. Portalen visar bilderna med `createSignedUrl` (giltig 1 timme).

## 4. Bildflödet utan att nå 4,5 MB

Bilderna går aldrig genom Vercel-funktionen.

1. I webbläsaren skalas varje bild ned med canvas till högst 1 600 px på längsta sidan och JPEG kvalitet 0,82 (oftast 200 till 600 kB). EXIF och GPS försvinner på köpet. Går bilden inte att avkoda (HEIC i andra webbläsare än Safari) skickas originalet om det är högst 3 MB, annars hoppas bilden över och felraden säger det.
2. Förfrågan skickas som JSON utan bilder, med `bilder: [{ mime, bytes }]` (högst 3). Texten sparas därmed alltid, även om en uppladdning faller.
3. API:et svarar `{ id, uppladdning: [{ path, signedUrl }] }` från `storage.createSignedUploadUrl` (giltig 2 timmar) och skapar raderna i `web_inquiry_images`.
4. Webbläsaren laddar upp direkt till Supabase Storage med PUT mot den fullständiga `signedUrl` som API:et returnerar. Sajten behöver ingen Supabase-nyckel.
5. Webbläsaren skickar `POST /api/forfragan` med `{ id, steg: 'bilder_klara' }`. API:et kontrollerar med service role vilka filer som finns, sätter `uppladdad`, `antal_bilder` och lägger till "med N bilder" på notisen. Saknas anropet syns ändå de filer som kom fram, eftersom portalen listar bucketens mapp.

## 5. API: `api/forfragan.ts`

Publik endpoint i kundportalen, ingen JWT (som `api/artanalys.ts`). Undantaget dokumenteras i `docs/sakerhetsplan-api-auth-vag2.md`.

| Steg | Regel |
|---|---|
| CORS | `tillatenOrigin` flyttas från `api/artanalys.ts` till `api/_lib/begoneSeCors.ts` och delas: `https://begone.se`, `https://www.begone.se`, `begone-se(-...)?.vercel.app`, `localhost:4321`, `127.0.0.1:4321`. Annan eller saknad Origin ger 403. Bara POST och OPTIONS |
| Storlek | högst 32 kB JSON, annars 413 |
| Honeypot | `website` ifyllt: svara 200 `{ ok: true }` utan id, spara inget, skicka inget |
| Tid | `submitted_at` minus `started_at` under 3 s räknas som robot (samma svar som honeypot) |
| Hastighet | `withinRateLimit('forfragan:ip:' + ipHash, 5, 600)`, `('forfragan:ip-dygn:' + ipHash, 20, 86400)` och `('forfragan:tel:' + hash(telefon), 3, 3600)`; överskridet ger 429 `{ fel: 'rate_limited' }`. Fail-open: förfrågningar kostar inget och får inte tappas |
| Validering | namn 1 till 120 tecken, telefon `^0\d{7,9}$` efter normalisering, postnummer fem siffror, `customer_kind` privat eller foretag, företag kräver företagsnamn och e-post när `kalla` är offertflöde, e-post med samma regex som sajten, `pest_type` högst 60 tecken, `message` högst 4 000, `details` bara kända nycklar, `consent` sant, högst tre bilder med mime jpeg/png/webp och högst 3 MB. Fel ger 400 `{ fel: 'validering', falt }` |
| Lagring | insert med service role, `ip_hash` som HMAC (egen salt-variabel, fallback som artanalysen) |
| Notis | avsnitt 7 |
| Kvittens | avsnitt 6 |
| Svar | 200 `{ ok: true, id, uppladdning }` |
| Loggar | bara id, statuskod och felkod. Aldrig namn, telefon, e-post, adress, meddelande eller IP. Databasfel loggas med `error.code` |

`vercel.json` behöver ingen ändring (rewrites släpper igenom `/api/*`). `maxDuration` 15 s.

## 6. Bekräftelsemejl till kunden (beslutat)

Christian 2026-10-05: "e-post skulle kunna utgå till kunden, det gör inget".

- Skickas via Resend REST som befintliga kundmejl, avsändare `BeGone Kundportal <noreply@begone.se>`, mallen `baseTemplate` ur `api/email-templates.ts`. Funktionen `skickaKvittens()` ligger i `api/_lib/forfragan.ts`.
- Skickas bara när förfrågan sparats, e-postadressen finns och är giltig, och varken honeypot, tidskontroll eller hastighetsbegränsning slagit till. Ingen e-post, inget mejl. Ett fel vid sändning stoppar inte svaret till sajten; `kvittens_skickad_at` förblir tom.
- Ämne: "Vi har tagit emot din förfrågan".
- Text, kort och i Begones röst, utan tidslöften utöver detta, utan jour och utan priser:

  > Hej <förnamn>,
  >
  > Tack, vi har tagit emot din förfrågan om <djur i löptext>. Vi ringer upp när vi ser den, alltid samma dag om den kommer in vardagar 08 till 17.
  >
  > Ditt nummer är <referens>. Har du fler bilder eller något att lägga till kan du svara på det här mejlet.
  >
  > Begone Skadedjur

  Företag får "er" och "ni" i stället för "dig" och "du", och "förfrågan från <företag>". Raden om att svara på mejlet tas bara med om svaren landar i en bevakad inkorg (fråga 3).
- Artanalysens formulär har ingen e-post och får därför inget mejl.

## 7. Notis i portalen (beslutat)

Christian 2026-10-05: "Koordinatorn ska få notisen om nya leads".

- Vid varje ny förfrågan skrivs en rad i `notifications` till alla aktiva profiler med rollen koordinator. `case_type 'web_inquiry'`, `case_id` = förfrågans id, `title` "Ny webbförfrågan: <djur>, <ort>" (plus "akut" när rutan är ikryssad), `preview` "<kundgrupp>, <källa>" utan telefon och e-post, `sender_name` "begone.se".
- Klick (NotificationBell, NotificationCenter, NotificationModal) öppnar `/koordinator/leads-webb?id=<id>` för koordinatorn och `/admin/leads-webb?id=<id>` i admin-layouten.
- CHECK-villkoret på `notifications.case_type` måste bytas för att tillåta `web_inquiry`. Det kräver `alter table notifications drop constraint ...` som `apply_migration` nekar (minnet supabase-migration-drop-nekas). Se fråga 1. Tills dess byggs allt annat, och menyposten Leads (Webb) visar ett räknetal för status `ny` via realtid, så att inget missas.

## 8. Sidan Leads (Webb)

- Routes `/admin/leads-webb`, `/koordinator/leads-webb`, `/saljare/leads-webb`, med `ProtectedRoute` för admin, koordinator och säljare. Menyposten "Leads (Webb)" direkt efter "Leads (B2B)" under Försäljning i admin, koordinator och säljare, med räknare (`badgeKey`) för status `ny`. Tekniker får ingen post.
- Sida `src/pages/admin/WebLeads.tsx`, komponenter i `src/components/admin/webLeads/`, tjänst `src/services/webInquiryService.ts` som statisk klass, typer i `src/types/webInquiry.ts`.
- Flikar som understrukna tabbar: Inkorg (status ny, äldst först), Alla, Statistik.
- Lista: inkommet (ÅÅÅÅ-MM-DD HH:mm, svensk tid), referens i monospace, namn och företag, tjänst, ort, kundgrupp, källa, status som färgad text med statuspunkt (inga piller), tilldelad. Akut markeras med röd statuspunkt och ordet Akut.
- Filter: status, tjänst, källa (offertflöde per `fran`, artanalys), kundgrupp och datumintervall. Valda filter sparas per användare i localStorage med try/catch.
- Realtid: `postgres_changes` på `web_inquiries`, så nya rader dyker upp direkt.
- Detaljvy som modal enligt modal-design-standard (inget `Card` i modalen): kontaktuppgifter med ring- och mejllänk, svaren från formuläret i klartext, meddelandet, bilderna som miniatyrer med förstoring via signerad URL, källa, sida, UTM och inkommet. Statusflödet ny, kontaktad, offert, vunnen, förlorad, skräp som knapprad; tilldelning till admin, koordinator eller säljare ("Ta" sätter mig själv); anteckningar och historik ur `web_inquiry_events`.
- Konvertering för kundgrupp brf_fastighet och verksamhet: "Skapa B2B-lead" öppnar befintliga `CreateLeadModal` förifylld (företagsnamn, kontaktperson, telefon, e-post, org.nr, adress, `problem_type` = tjänsten, `source` "Webbförfrågan", anteckning med meddelandet och referensen). När leaden sparats sätts `lead_id` och en händelse `konvertering` skrivs. "Skapa kund" öppnar befintligt flöde för ny kund förifyllt och sätter `customer_id`. Är något redan skapat visas länken i stället för knappen.
- Allt via `apiFetch`/Supabase-klienten; inga nya API-anrop från frontend behövs utöver Supabase.

## 9. Efterfrågestatistik

Flik Statistik på samma sida, Recharts, mörkt tema enligt tema-system.md:

- Antal per vecka (ISO-vecka, måndag först, räknat i Europe/Stockholm), staplat per kundgrupp.
- Antal per tjänst (`pest_type`) för vald period.
- Antal per källa (`kalla` och `fran`) och per sida.
- Andel som lämnat status ny inom samma dag, och andel vunna.

Volymen är cirka 70 till 80 förfrågningar i månaden, så aggregeringen görs i klienten på periodens rader. En SQL-vy kan läggas till senare om det växer.

## 10. Koppla på sajten

Allt på grenen `forfragningar` i worktree `C:\Users\chris\begone-se-forfragan`, aldrig i `C:\Users\chris\begone-se`. Grenen pushas inte.

1. `src/lib/offert.ts`: `INBOUND_URL = 'https://kundportal.vercel.app/api/forfragan'` (byts till kundportal.begone.se när domänen finns). `skickaForfragan(data, bilder?)` tar emot bilderna, skalar ned dem, skickar JSON, laddar upp med de signerade URL:erna och skickar `bilder_klara`. Svaret räknas som lyckat redan när texten är sparad.
2. `Offertflode.astro`: lägg till `details.fran` och `details.kalla: 'offertflode'`, skicka med de valda bilderna.
3. `artanalys-labb.ts`: ingen ändring utöver det som följer av `INBOUND_URL`; formuläret börjar renderas. Inget analysnummer skickas.
4. Sajten behöver inga nya miljövariabler: `createSignedUploadUrl` ger en fullständig `signedUrl` som tar emot PUT.
5. Test mot förhandsvisningen och lokalt (`localhost:4321`): privat, företag, akut, med och utan bilder, med och utan e-post, honeypot, för snabbt inskick, sjätte inskicket inom tio minuter.
6. Merge till sajtens main görs av huvudsessionen när textarbetet tillåter.

## 11. Ordning

1. Migration (tabeller, bucket, RLS, trigger) och typer.
2. `api/_lib/begoneSeCors.ts`, `api/_lib/forfragan.ts`, `api/forfragan.ts` med kvittens och notis.
3. Namnbytet Leads (B2B), sidan Leads (Webb), detaljvy, konvertering, statistik, notisklick, menyräknare.
4. Uppdateringsloggen i `src/constants/changelog.ts`, `node scripts/type-check.mjs`, lint, bygge, push till main.
5. Sajten i worktree, test, rapport.

## 12. Frågor till Christian (bygget fortsätter med förslaget)

1. **Notistypen.** För att notisen ska gå in i klockan måste CHECK-villkoret på `notifications.case_type` bytas, vilket kräver en DROP CONSTRAINT som migrationsverktyget nekar. Förslag: du godkänner att satsen körs (den rör inga data, bara listan över tillåtna typer). Till dess syns nya förfrågningar via räknaren på Leads (Webb).
2. **Vem ser Leads (Webb).** Förslag: admin, koordinator och säljare. Tekniker ser inget, men kan tilldelas senare om det behövs.
3. **Svar på bekräftelsemejlet.** `noreply@begone.se` tas inte emot någonstans. Förslag: reply-to `info@begone.se` så att kunden kan svara med fler bilder; annars tas raden om att svara bort.
4. **Artanalysens bild.** Förslag: den analyserade bilden följer INTE med förfrågan nu; protokollraden räcker. Kan läggas till senare med en rad i integritetstexten.
5. **Gallring.** Förslag: förfrågningar med status skräp raderas efter 30 dagar och förlorade efter 24 månader, med en cron senare.
6. **Privatpersoner.** Förslag: för privata förfrågningar finns i första versionen bara status och anteckningar, ingen knapp för att skapa ärende. "Skapa ärende" kan byggas som nästa steg.
7. **Ett mejl till en säljinkorg** utöver notisen. Förslag: nej, notisen och räknaren räcker.
