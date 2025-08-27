# Testplan: Monthly Marketing Spend RLS-optimering

**Datum:** 2025-08-26  
**Version:** 1.0  
**Skapare:** Admin Portal Guardian

## Översikt

Denna testplan verifierar att RLS-optimeringen för tabellen `monthly_marketing_spend` fungerar korrekt i admin-portalen. Optimeringen ändrade policies från `auth.jwt() ->> 'user_role' = 'admin'` till `(SELECT auth.jwt() ->> 'user_role') = 'admin'` för förbättrad prestanda.

## Identifierade Komponenter som Använder monthly_marketing_spend

### 1. **MarketingSpendManager.tsx** (`src/components/admin/economics/MarketingSpendManager.tsx`)
- **Funktionalitet:** Komplett CRUD-hantering av marknadsutgifter
- **Operations:**
  - `SELECT *` - Hämta alla utgifter
  - `INSERT` - Skapa nya utgiftsposter
  - `UPDATE` - Redigera befintliga utgifter  
  - `DELETE` - Ta bort utgiftsposter

### 2. **ManageSpendCard.tsx** (`src/components/admin/ManageSpendCard.tsx`)
- **Funktionalitet:** Formulär för att hantera marknadsutgifter
- **Operations:**
  - `SELECT *` - Lista alla utgifter
  - `INSERT` - Lägg till ny utgiftspost
  - `DELETE` - Ta bort utgiftsposter

### 3. **economicsService.ts** (`src/services/economicsService.ts`)
- **Funktion:** `getMarketingSpend()`
- **Operations:**
  - `SELECT month, spend` - Hämta data för beräkningar

### 4. **useEconomicsDashboard.ts** (`src/hooks/useEconomicsDashboard.ts`)
- **Funktionalitet:** Hook som använder `getMarketingSpend()`
- **Används av:** MarketingRoiChart.tsx, CaseEconomyChart.tsx

### 5. **Admin-sidor som påverkas:**
- `/admin/economics` (Economics.tsx) - Använder economics-komponenter
- Potentiellt andra admin-sidor som importerar MarketingSpendManager

## Testscenarier

### A. FUNKTIONELLA TESTER (Admin-användare)

#### Test A1: Visa marknadsutgifter
**Beskrivning:** Verifiera att admin kan se alla marknadsutgifter  
**Förutsättningar:** Inloggad som admin-användare  
**Steg:**
1. Navigera till admin-portalen
2. Sök efter komponenter som använder MarketingSpendManager eller ManageSpendCard
3. Kontrollera att marknadsutgifter visas korrekt
4. Verifiera att totalsumma beräknas rätt

**Förväntat resultat:** Alla utgiftsposter visas med korrekt formatering

#### Test A2: Skapa ny marknadsutgift
**Beskrivning:** Testa att admin kan lägga till nya utgiftsposter  
**Förutsättningar:** Inloggad som admin-användare  
**Testdata:**
- Månad: 2025-08
- Kostnad: 15000 SEK
- Anteckningar: "Test Google Ads kampanj"

**Steg:**
1. Öppna MarketingSpendManager eller ManageSpendCard
2. Fyll i formuläret med testdata
3. Klicka "Spara"
4. Verifiera att posten skapas

**Förväntat resultat:** Ny post skapas och visas i listan

#### Test A3: Redigera befintlig marknadsutgift  
**Beskrivning:** Testa att admin kan uppdatera utgiftsposter
**Förutsättningar:** Befintlig utgiftspost finns  
**Steg:**
1. Klicka "Redigera" på befintlig post
2. Ändra kostnad från 15000 till 18000
3. Uppdatera anteckningar
4. Spara ändringar

**Förväntat resultat:** Post uppdateras med nya värden

#### Test A4: Ta bort marknadsutgift
**Beskrivning:** Testa att admin kan ta bort utgiftsposter  
**Steg:**
1. Klicka "Ta bort" på testpost
2. Bekräfta borttagning
3. Verifiera att posten försvinner från listan

**Förväntat resultat:** Post tas bort permanent

#### Test A5: Economics Dashboard integration
**Beskrivning:** Verifiera att marknadsutgifter visas korrekt i ekonomisk analys  
**Steg:**
1. Navigera till `/admin/economics`
2. Kontrollera att MarketingRoiChart läser data
3. Verifiera att beräkningar inkluderar marknadsutgifter

**Förväntat resultat:** Marketing ROI och CAC beräknas korrekt

### B. SÄKERHETSTESTER (Icke-admin användare)

#### Test B1: Koordinator access denied
**Beskrivning:** Verifiera att koordinator inte kan komma åt marketing spend data  
**Förutsättningar:** Inloggad som koordinator-användare  
**Steg:**
1. Försök komma åt komponenter som läser monthly_marketing_spend
2. Kontrollera att RLS blockerar åtkomst
3. Verifiera felmeddelande

**Förväntat resultat:** Åtkomst nekad, ingen data visas

#### Test B2: Tekniker access denied  
**Beskrivning:** Verifiera att tekniker inte kan se marknadsutgifter
**Förutsättningar:** Inloggad som tekniker-användare  
**Steg:**
1. Försök navigera till admin-ekonomisidor
2. Om åtkomst till komponenter: verifiera att ingen marketing spend data visas

**Förväntat resultat:** Antingen route-blockering eller tom data

#### Test B3: Kund access denied
**Beskrivning:** Verifiera att kunder inte kan komma åt admin-funktioner  
**Förutsättningar:** Inloggad som kund-användare  
**Steg:**
1. Försök komma åt admin-portalen
2. Verifiera att access blockeras på route-nivå

**Förväntat resultat:** Omdirigering till kund-portal

### C. PRESTANDA-TESTER

#### Test C1: Dashboard-laddningstid
**Beskrivning:** Mät laddningstider efter RLS-optimering  
**Steg:**
1. Öppna utvecklarverktyg (Network tab)
2. Navigera till `/admin/economics`
3. Mät tid för `getMarketingSpend` queries
4. Jämför med tidigare prestanda om möjligt

**Förväntat resultat:** Förbättrade laddningstider

#### Test C2: Stora dataset
**Beskrivning:** Testa prestanda med många marknadsutgiftsposter  
**Testdata:** Skapa 24 månaders utgiftsposter
**Steg:**
1. Lägg till utgiftsposter för 2023-2024 (24 månader)
2. Ladda MarketingSpendManager
3. Kontrollera prestanda och responsivitet

**Förväntat resulval:** Smooth rendering av stora dataset

### D. INTEGRATIONSTESTER

#### Test D1: useEconomicsDashboard hook
**Beskrivning:** Testa att hook:en fungerar korrekt  
**Steg:**
1. Kontrollera att `useEconomicsDashboard()` returnerar marketingSpend array
2. Verifiera att loading/error states hanteras
3. Kontrollera att data används i MarketingRoiChart

**Förväntat resultat:** Hook returnerar korrekt data

#### Test D2: Real-time updates
**Beskrivning:** Testa att ändringar reflekteras omedelbart  
**Steg:**
1. Öppna MarketingSpendManager i en flik
2. Öppna Economics dashboard i annan flik
3. Lägg till ny utgiftspost i första fliken
4. Verifiera att andra fliken uppdateras (om real-time aktivt)

**Förväntat resultat:** Data synkroniseras mellan komponenter

### E. REGRESSIONSTESTER

#### Test E1: Befintlig funktionalitet
**Beskrivning:** Kontrollera att inga andra admin-funktioner påverkats  
**Steg:**
1. Testa andra admin CRUD-operationer (kunder, tekniker, etc.)
2. Kontrollera att andra ekonomiska beräkningar fungerar
3. Verifiera att inga konsol-errors visas

**Förväntat resultat:** All annan funktionalitet fungerar som tidigare

#### Test E2: Formulärvalidering
**Beskrivning:** Kontrollera att validering fortfarande fungerar  
**Testfall:**
- Tom månad
- Negativ kostnad  
- Duplicerad månad
- Ogiltig månad

**Förväntat resultat:** Korrekt felmeddelanden visas

## Tekniska Testdetaljer

### RLS Policy Queries att Testa

```sql
-- Dessa queries ska fungera för admin:
SELECT * FROM monthly_marketing_spend;
INSERT INTO monthly_marketing_spend (month, spend, notes) VALUES ('2025-08-01', 15000, 'Test');
UPDATE monthly_marketing_spend SET spend = 18000 WHERE id = 'test-id';
DELETE FROM monthly_marketing_spend WHERE id = 'test-id';

-- Dessa ska MISSLYCKAS för icke-admin:
-- (Testa med koordinator/tekniker/kund JWT tokens)
```

### Miljöer för Testning

1. **Lokal utvecklingsmiljö**
2. **Staging-miljö** (om tillgänglig)
3. **Test med olika browser** (Chrome, Firefox, Safari)
4. **Mobila enheter** (responsiv design)

### Verktyg för Testning

- **Browser Developer Tools:** Network tab för prestanda
- **Supabase Dashboard:** För att verifiera RLS policies
- **React Developer Tools:** För att inspektera component state
- **Database logs:** För att se query-prestanda

## Pass/Fail Kriterier

### ✅ PASS om:
- Alla admin CRUD-operationer fungerar
- Icke-admin användare får access denied
- Prestanda är lika bra eller bättre än tidigare
- Inga JavaScript errors i konsolen
- Economics dashboard visar korrekt data

### ❌ FAIL om:
- Admin kan inte utföra någon CRUD-operation
- Icke-admin användare kan se/ändra data
- Prestanda försämras märkbart
- JavaScript errors uppstår
- Data visas inte korrekt i dashboard

## Testrapportering

För varje test, dokumentera:
- **Test ID:** (A1, A2, etc.)
- **Status:** Pass/Fail
- **Datum/Tid:** När testet kördes
- **Testare:** Vem som körde testet
- **Kommentarer:** Observations eller issues
- **Screenshots:** För UI-tester

## Risker och Begränsningar

### Högrisk Areas:
- Economics dashboard som förlitar sig på marketing spend data
- Performance på större dataset
- Cross-component data syncing

### Testbegränsningar:
- Kräver olika användarroller för komplett testning
- Prestanda-tester kräver realistisk datamängd
- Real-time funktionalitet kan vara svår att testa

## Signering

**Testansvarig:** _____________________  
**Datum:** _____________________  
**Godkänd för production:** _____________________