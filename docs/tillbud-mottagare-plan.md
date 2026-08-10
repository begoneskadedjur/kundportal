# Plan: Mottagare per incidenttyp (tillbud, olycka, avvikelse)

**Datum:** 2026-08-10 (uppdaterad efter beslut samma dag)
**Status:** IMPLEMENTERAD 2026-08-10 (alla 7 faser). RLS-regler verifierade med simulerade användare i produktionsdatabasen. Kvarstår: utse mottagare i UI:t samt manuell röktest efter deploy.
**Bakgrund:** Kartläggning 2026-08-10 visade att incidentsystemet är komplett byggt men dött i praktiken: 0 rapporter, 0 mottagare, och mottagarflaggan är en enda boolean (`profiles.incident_recipient`) som gäller alla typer. Denna plan inför valbara mottagare per typ, hanterat från Användarkonton (Personal), den saknade typen "olycka", samt tydlig synlighet åt båda håll: lätt att rapportera, lätt att se att något nytt väntar.

## Beslut (Christian 2026-08-10)

1. **Icke-mottagare ser ingenting**, inte ens maskerade rader. Man ser bara incidenter man själv rapporterat eller är berörd i. Detta genomdrivs med RLS i databasen, inte bara i frontend.
2. **E-post skickas direkt** till mottagarna, utöver in-app-notis.
3. **Synlighet är ett krav**: det ska vara lätt att upptäcka att man kan rapportera, och lätt för ansvarig mottagare att se att en ny rapport väntar på hantering.

## Målbild

- Admin kan på `/admin/anvandarkonton-personal` välja per person vilka incidenttyper hen är mottagare av: **Tillbud (Oj!)**, **Olycka (Aj!)**, **Avvikelse**.
- Olika personer kan vara mottagare av olika typer, en person kan ta emot flera.
- Vid ny rapport notifieras exakt de som är mottagare av just den typen: in-app + e-post.
- Mottagare ser en räknare (badge) i sidomenyn med antal ohanterade rapporter av sina typer, och kan markera rapporter som hanterade.
- Rapportören ser status på sin rapport, vilket är beviset på att det är värt att rapportera.
- Alla tre roller har menylänk och tekniker behåller snabbknappen på dashboarden.

## Nulägesfakta som planen bygger på

- Alla anställda (även Koordinator, Admin, Säljare) ligger i `technicians`-tabellen med profil via `profiles.technician_id`. Personalsidan är `TechnicianManagement.tsx`, redigeringsmodalen `TechnicianModal.tsx` (har redan checkbox för dagens boolean).
- `case_incidents.type` har CHECK med enbart `('tillbud','avvikelse')`. Inga status- eller åtgärdsfält finns.
- Notiser skapas idag klientsidigt i `IncidentsPage.tsx`. Ingen e-post.
- E-postinfrastruktur finns (Resend, mönster i `api/send-staff-invitation.ts` m.fl.).
- `profiles.incident_recipient = true` hos 0 personer, `case_incidents` är tom: ingen data att migrera, fritt fram att bygga om.
- Sidomenyerna (admin/koordinator/tekniker) saknar badge-stöd; `NavItem` är statisk config. Badge-mekanik behöver byggas.

## Datamodell

### Ny tabell: mottagare per typ

```sql
CREATE TABLE incident_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_type text NOT NULL CHECK (incident_type IN ('tillbud','olycka','avvikelse')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, incident_type)
);
```

Motivering: enklare att fråga per typ vid notisutskick, RLS-vänlig, utbyggbar (t.ex. e-postpreferens per rad) jämfört med array-kolumn på `profiles`.

RLS på `incident_recipients`: SELECT för alla inloggade (behövs för badge och admin-UI), INSERT/DELETE endast admin.

### Utökningar på case_incidents

```sql
ALTER TABLE case_incidents DROP CONSTRAINT case_incidents_type_check;
ALTER TABLE case_incidents ADD CONSTRAINT case_incidents_type_check
  CHECK (type IN ('tillbud','olycka','avvikelse'));

ALTER TABLE case_incidents
  ADD COLUMN status text NOT NULL DEFAULT 'ny'
    CHECK (status IN ('ny','under_utredning','atgardad')),
  ADD COLUMN action_taken text,
  ADD COLUMN handled_by_name text,
  ADD COLUMN handled_at timestamptz;
```

Statusfältet är det som gör "att hantera"-räknaren meningsfull: badge = antal rapporter med `status = 'ny'` av ens mottagartyper.

### RLS-härdning (beslut 1)

`case_incidents` byter från `SELECT USING (true)` till:

- **SELECT**: rapportör (`reported_by_id = auth.uid()`), berörd anställd (finns i `incident_employees` via egen `technician_id`), eller mottagare av incidentens typ (`EXISTS`-uppslag i `incident_recipients`).
- **INSERT**: alla inloggade (som idag).
- **UPDATE**: mottagare av incidentens typ (statusändring, åtgärd) samt rapportören (egen beskrivning).
- **DELETE**: admin/koordinator (som idag).

`incident_employees` får RLS påslaget med motsvarande regler (idag helt avstängt). Frontendens maskering ("Konfidentiell") tas bort helt, den blir överflödig när databasen filtrerar.

`profiles.incident_recipient` behålls orörd under implementationen och droppas i städfasen.

## Faser

### Fas 1: Databas

Migration i `supabase/migrations/`: tabellen `incident_recipients`, utökad typ-CHECK, statusfälten, samt RLS-härdningen på alla tre tabeller enligt ovan. Ingen datamigrering behövs.

### Fas 2: Typer och service

- `src/types/caseIncidents.ts`:
  - `IncidentType = 'tillbud' | 'olycka' | 'avvikelse'`, `IncidentStatus = 'ny' | 'under_utredning' | 'atgardad'`
  - Config för olycka och status. Färgspråk: tillbud = amber (Oj!), olycka = röd (Aj!), avvikelse = slate/blå (röd reserveras för personskada).
- Ny service `src/services/incidentRecipientService.ts` (statisk klass enligt kodbasens mönster):
  - `getRecipients()` (admin-UI), `getMyRecipientTypes(userId)` (IncidentsPage + badge), `setRecipientTypes(userId, types)` (diffar rader).

### Fas 3: Admin-UI på Användarkonton (Personal)

- `TechnicianModal.tsx`: ersätt dagens enda checkbox med sektionen "Incidentmottagare" med tre checkboxar (Tillbud, Olycka, Avvikelse), fortsatt endast när personen har inloggning. Spara via `setRecipientTypes`.
- `technicianManagementService.getAllTechnicians()`: berika med `incident_recipient_types`.
- Personallistan: chips per person, plus varning högst upp om någon av de tre typerna helt saknar mottagare (dagens tysta felläge).

### Fas 4: IncidentsPage - rapportering och hantering

- **Insyn**: `recipientTypes: Set<IncidentType>` ersätter `isRecipient`. All maskeringskod (`canSeeDetails`, "Konfidentiell"-rader, info-bannern) tas bort; RLS levererar redan bara rätt rader.
- **Formuläret**: tre pedagogiska typkort (Oj! / Aj! / Avvikelse) med stor rubrik och kort förklaring. Vid olycka: informationsrad om anmälningsplikt till Arbetsmiljöverket vid allvarlig händelse, länk till anmalarbetsskada.se. Rapportören kan ange när händelsen inträffade (förvalt nu).
- **Hantering**: mottagare ser sektionen "Att hantera" överst (status ny, äldst först) och kan sätta status, fylla i åtgärd och markera som åtgärdad. Rapportören ser status på sina rapporter.
- **Statistik**: fyra kort: Tillbud, Olyckor, Avvikelser, Senaste 30 dagarna.
- Klientsidig notislogik tas bort (ersätts i fas 5).

### Fas 5: Notiser via API (in-app + e-post, beslut 2)

- Ny endpoint `api/notify-incident.ts` (service role, auth via `api/_lib/auth.ts`):
  1. Tar emot `incident_id`, läser incidenten server-side.
  2. Hämtar mottagare för incidentens typ ur `incident_recipients` + `profiles` (namn/e-post), exkluderar rapportören.
  3. Insertar `notifications`-rader (samma format som idag).
  4. Skickar e-post via Resend (mönster från `api/send-staff-invitation.ts`): typ, beskrivning, berörda, rapportör, tidpunkt, länk till incidentsidan.
- `IncidentsPage.handleSubmit` anropar endpointen fire-and-forget; misslyckad notis blockerar inte rapporten.
- Håll API-delprojektet typgrönt (`npm run type-check`).

### Fas 6: Synlighet i navigationen (beslut 3)

- **Lätt att rapportera**:
  - Koordinator får menylänken "Tillbud & Avvikelser" i `coordinatorNavConfig.ts` (routen finns redan).
  - Tekniker behåller menylänk + dashboardknappen "Rapportera tillbud" (rubriken uppdateras till "Rapportera Oj eller Aj").
  - Koordinatorns dashboard får motsvarande snabbknapp.
- **Lätt att se nya att hantera**:
  - Ny hook `useIncidentBadge`: räknar `case_incidents` med `status = 'ny'` inom användarens mottagartyper, med realtidsprenumeration (`postgres_changes`) så räknaren uppdateras direkt.
  - `NavItem` utökas med valfri `badgeKey`; sidomeny + mobilnav i alla tre layouter renderar en amber räknarbadge på länken när antalet är över noll. Byggs generiskt så tickets kan återanvända mekaniken senare.
  - In-app-notis (klockan) och e-post från fas 5 kompletterar badgen.

### Fas 7: Städning

- Ta bort all kodanvändning av `profiles.incident_recipient` (IncidentsPage, TechnicianModal, technicianManagementService, database.ts) och droppa kolumnen.
- Uppdatera `src/types/database.ts` med nya tabeller/fält.

## Ordning och leverans

Fas 1 → 2 → 3 som första PR (mottagarhantering komplett). Fas 4 → 5 → 6 som andra (rapportflöde, notiser, synlighet). Fas 7 som avslutande städ. Eftersom tabellen är tom och funktionen saknar användare idag är risken minimal, allt kan även tas i ett svep.

## Berörda filer (sammanfattning)

| Fil | Ändring |
|---|---|
| `supabase/migrations/<datum>_incident_recipients.sql` | Ny tabell, typ-CHECK, statusfält, RLS-härdning |
| `src/types/caseIncidents.ts` | Typ olycka, status, recipient-typ, config |
| `src/services/incidentRecipientService.ts` | Ny service |
| `src/services/technicianManagementService.ts` | Berika personal med mottagartyper |
| `src/components/admin/technicians/management/TechnicianModal.tsx` | Tre checkboxar i stället för en |
| `src/pages/admin/TechnicianManagement.tsx` | Chips + varning om typ utan mottagare |
| `src/pages/admin/IncidentsPage.tsx` | Typkort, status/hantering, "Att hantera", datumval, borttagen maskering |
| `api/notify-incident.ts` | Ny endpoint, in-app + Resend-mejl |
| `src/hooks/useIncidentBadge.ts` | Ny hook med realtid |
| Nav-configs + sidomenyer/mobilnav (admin, koordinator, tekniker) | Menylänk koordinator, badge-stöd, snabbknappar |
| `src/types/database.ts` | Nya tabelltyper, senare bortplock av incident_recipient |
