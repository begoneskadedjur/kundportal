# Monthly Marketing Spend RLS-optimering: Verifieringsplan

## Översikt
Denna plan säkerställer att RLS-optimeringen för `monthly_marketing_spend` fungerar korrekt i admin-portalen efter deployment. Migrationen optimerar prestanda genom att införa `current_user_role()` wrapper-funktion och uppdatera 4 RLS policies.

## 1. Pre-deployment Verifiering

### 1.1 Säkerhets-checklist
- [ ] **Backup av kritisk data**
  ```sql
  -- Säkerhetskopiera befintlig data
  SELECT * FROM monthly_marketing_spend ORDER BY month DESC;
  ```
- [ ] **Kontrollera befintliga RLS policies**
  ```sql
  -- Visa aktuella policies
  SELECT * FROM pg_policies WHERE tablename = 'monthly_marketing_spend';
  ```
- [ ] **Verifiera admin-användare finns**
  ```sql
  -- Kontrollera admin-profiler
  SELECT id, role, email FROM profiles WHERE role = 'admin';
  ```

### 1.2 Performance baseline
- [ ] **Mät nuvarande laddningstider**
  - Economics Dashboard: _____ sekunder
  - MarketingSpendManager: _____ sekunder
  - MarketingRoiChart: _____ sekunder
- [ ] **Dokumentera aktuell query-prestanda**
  ```sql
  EXPLAIN ANALYZE SELECT * FROM monthly_marketing_spend;
  ```

### 1.3 Funktionalitets-snapshot
- [ ] **Testa MarketingSpendManager.tsx**
  - Kan visa alla marketing spend entries
  - Kan skapa ny entry
  - Kan redigera befintlig entry
  - Kan ta bort entry
- [ ] **Testa Economics Dashboard integration**
  - MarketingRoiChart visar data korrekt
  - KPI cards inkluderar marketing spend data

## 2. Migration Deployment

### 2.1 Migration execution checklist
- [ ] **Kör migration**
  ```bash
  # Via Supabase CLI eller dashboard
  supabase db push
  ```
- [ ] **Verifiera att migration körts**
  ```sql
  -- Kontrollera att current_user_role() funktion skapats
  SELECT proname FROM pg_proc WHERE proname = 'current_user_role';
  
  -- Kontrollera att nya policies aktiverats
  SELECT policyname, cmd, qual FROM pg_policies 
  WHERE tablename = 'monthly_marketing_spend';
  ```

## 3. Post-deployment Funktionell Testning

### 3.1 Admin-användare testning (KRITISKT)
**Testanvändare:** Admin-konto med `role = 'admin'`

#### 3.1.1 SELECT-operationer
- [ ] **MarketingSpendManager kan hämta data**
  - Gå till Economics Dashboard
  - Öppna MarketingSpendManager komponenten
  - Verifiera att alla marketing spend entries visas
  - **Förväntad:** Lista med alla entries, total kostnad visas
  - **Vid fel:** "Kunde inte hämta marknadsföringskostnader"

#### 3.1.2 INSERT-operationer
- [ ] **Skapa ny marketing spend entry**
  - Klicka "Lägg till" i MarketingSpendManager
  - Fyll i: Månad (2024-12), Kostnad (50000), Anteckningar
  - Klicka "Spara"
  - **Förväntad:** "Marknadsföringskostnad sparad!" toast
  - **Vid fel:** "Kunde inte spara marknadsföringskostnad"

#### 3.1.3 UPDATE-operationer
- [ ] **Redigera befintlig entry**
  - Klicka edit-knappen på en befintlig entry
  - Ändra kostnad från X till Y
  - Klicka save-knappen
  - **Förväntad:** "Marknadsföringskostnad uppdaterad!" toast
  - **Vid fel:** "Kunde inte uppdatera marknadsföringskostnad"

#### 3.1.4 DELETE-operationer
- [ ] **Ta bort entry**
  - Klicka delete-knappen på test entry
  - Bekräfta i confirmation dialog
  - **Förväntad:** "Marknadsföringskostnad borttagen!" toast
  - **Vid fel:** "Kunde inte ta bort marknadsföringskostnad"

### 3.2 Economics Dashboard integration
- [ ] **MarketingRoiChart fungerar**
  - Navigera till Economics Dashboard
  - Kontrollera att MarketingRoiChart laddar utan fel
  - Verifiera att data visas korrekt
- [ ] **KPI Cards inkluderar marketing data**
  - Kontrollera att marketing spend påverkar ROI-beräkningar
  - Verifiera att totala kostnadssiffror stämmer

## 4. Säkerhetstester (KRITISKA)

### 4.1 Koordinator-användare (MÅSTE MISSLYCKAS)
**Testanvändare:** Koordinator-konto med `role = 'koordinator'`

- [ ] **Försök nå MarketingSpendManager**
  - Gå till /admin/economics (om åtkomst)
  - Alternativt: testa direct API call
  ```javascript
  // I browser console
  supabase.from('monthly_marketing_spend').select('*')
  ```
  - **Förväntad:** RLS fel eller ingen data
  - **Vid fel:** Data visas (SÄKERHETSRISK!)

### 4.2 Tekniker-användare (MÅSTE MISSLYCKAS)
**Testanvändare:** Tekniker-konto med `role = 'technician'`

- [ ] **Försök direct database access**
  ```javascript
  // I browser console på tekniker-konto
  supabase.from('monthly_marketing_spend').select('*')
  ```
  - **Förväntad:** Tom array eller RLS fel
  - **Vid fel:** Data visas (SÄKERHETSRISK!)

### 4.3 Kund-användare (MÅSTE MISSLYCKAS)
**Testanvändare:** Kund-konto med `role = 'customer'`

- [ ] **Försök database queries**
  ```javascript
  // Test alla CRUD operationer
  supabase.from('monthly_marketing_spend').select('*')
  supabase.from('monthly_marketing_spend').insert({month: '2024-01-01', spend: 1000})
  supabase.from('monthly_marketing_spend').update({spend: 2000}).eq('id', 'test-id')
  supabase.from('monthly_marketing_spend').delete().eq('id', 'test-id')
  ```
  - **Förväntad:** Alla operationer misslyckas
  - **Vid fel:** Någon operation lyckas (SÄKERHETSRISK!)

## 5. Performance-validering

### 5.1 Laddningstider (mål: förbättring eller samma)
- [ ] **Economics Dashboard efter optimering**
  - Laddningstid: _____ sekunder (jämfört med pre-deployment)
  - Förbättring: _____ % snabbare/långsammare
- [ ] **MarketingSpendManager laddning**
  - Initial load: _____ sekunder
  - CRUD operationer: _____ sekunder vardera

### 5.2 Query-prestanda
- [ ] **Mät optimerad query-tid**
  ```sql
  -- Testa med EXPLAIN ANALYZE
  EXPLAIN ANALYZE 
  SELECT * FROM monthly_marketing_spend 
  WHERE (current_user_role() = 'admin'::text);
  ```
  - Execution time: _____ ms
  - Jämfört med pre-migration: _____ % förbättring

### 5.3 Memory och CPU impact
- [ ] **Browser Performance tab**
  - Memory usage vid Economics Dashboard load
  - CPU impact under CRUD operations
  - Jämför med baseline measurements

## 6. Integration-tester med Admin-komponenter

### 6.1 MarketingSpendManager.tsx
**Filer att testa:** `/src/components/admin/economics/MarketingSpendManager.tsx`

- [ ] **Formulärvalidering fungerar**
  - Testa tom månad: "Månad måste anges"
  - Testa ogiltig kostnad: "Kostnad måste vara ett giltigt positiv tal"
  - Testa duplicate månad: "Det finns redan en kostnad för den månaden"

- [ ] **Formattering och beräkningar**
  - Total kostnad beräknas korrekt: `formatCurrency(totalSpend)`
  - Genomsnittlig månadskostnad: `totalSpend / spendData.length`
  - Månadsformat visas korrekt: `formatMonth(spend.month.slice(0, 7))`

### 6.2 useEconomicsDashboard integration
**Fil:** `/src/hooks/useEconomicsDashboard.ts`

- [ ] **Marketing spend data hook fungerar**
  ```javascript
  // Test att useMarketingSpend hook fungerar
  const { data, loading, error } = useMarketingSpend()
  // Verifiera att data är array och innehåller korrekta fält
  ```

### 6.3 economicsService.ts integration
**Fil:** `/src/services/economicsService.ts`

- [ ] **getMarketingSpend funktion**
  ```javascript
  // Testa service layer
  import { getMarketingSpend } from '../services/economicsService'
  const data = await getMarketingSpend()
  // Verifiera data structure och innehåll
  ```

### 6.4 MarketingRoiChart integration
**Fil:** `/src/components/admin/economics/MarketingRoiChart.tsx`

- [ ] **Chart renderar med ny data**
  - Marketing spend data inkluderas i ROI-beräkningar
  - Chart visar korrekt timeline
  - Hover states fungerar
  - Legend och labels är korrekta

## 7. Rollback-scenarion

### 7.1 Kritiska fel som kräver rollback
- [ ] **Admin-användare kan inte komma åt data**
- [ ] **Säkerhetsbrott:** Icke-admin kan se marketing spend
- [ ] **Performance regression:** >50% långsammare
- [ ] **Data corruption:** Felaktig eller förlorad data

### 7.2 Rollback-procedur
```sql
-- 1. Återställ gamla policies
DROP POLICY IF EXISTS "marketing_spend_select_admin" ON monthly_marketing_spend;
DROP POLICY IF EXISTS "marketing_spend_insert_admin" ON monthly_marketing_spend;
DROP POLICY IF EXISTS "marketing_spend_update_admin" ON monthly_marketing_spend;
DROP POLICY IF EXISTS "marketing_spend_delete_admin" ON monthly_marketing_spend;

-- 2. Återskapa ursprungliga policies
CREATE POLICY "Enable read for admin users" ON monthly_marketing_spend
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));
-- ... (återskapa övriga original policies)

-- 3. Ta bort wrapper-funktion om nödvändigt
DROP FUNCTION IF EXISTS current_user_role();
```

### 7.3 Rollback validation
- [ ] **Återställ backup data om nödvändigt**
- [ ] **Testa att admin-access fungerar med gamla policies**
- [ ] **Verifiera att performance är återställd**
- [ ] **Dokumentera vad som gick fel för framtida referenser**

## 8. Post-verifiering Dokumentation

### 8.1 Resultat-sammanfattning
```
MIGRATION STATUS: [ ] SUCCESS [ ] FAILED [ ] ROLLED BACK

Performance improvements:
- Dashboard loading: _____ % förbättring
- Query times: _____ ms → _____ ms
- Memory usage: _____ MB → _____ MB

Issues discovered:
- [ ] Inga problem
- [ ] Minor issues (lista nedan)
- [ ] Major issues (kräver uppföljning)

Issues lista:
1. _________________________________
2. _________________________________
3. _________________________________
```

### 8.2 Admin team notification
- [ ] **Meddela admin team om slutförd optimering**
- [ ] **Dela performance metrics**
- [ ] **Dokumentera nya monitoring points**

### 8.3 Monitoring setup
- [ ] **Sätt upp alerts för RLS policy failures**
- [ ] **Monitor query performance över tid**
- [ ] **Track admin user activity patterns**

---

## Verifieringschecklista - Snabbversion

### KRITISKA TESTS (måste lyckas):
- [ ] Admin kan se marketing spend data
- [ ] Admin kan skapa/redigera/ta bort entries
- [ ] Koordinator/Tekniker/Kund kan INTE komma åt data
- [ ] Performance är lika bra eller bättre

### SÄKERHETS TESTS (måste misslyckas för icke-admin):
- [ ] `supabase.from('monthly_marketing_spend').select('*')` → Fel/Tom array
- [ ] `supabase.from('monthly_marketing_spend').insert({...})` → RLS fel
- [ ] `supabase.from('monthly_marketing_spend').update({...})` → RLS fel  
- [ ] `supabase.from('monthly_marketing_spend').delete()` → RLS fel

### ROLLBACK TRIGGERS:
- Admin förlorar access till data
- Säkerhetsbrott (icke-admin får access)
- Performance regression >50%
- Data corruption

**TESTANSVARIG:** ________________  
**DATUM:** ________________  
**STATUS:** ________________