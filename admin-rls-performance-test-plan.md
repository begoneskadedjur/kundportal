# Admin Dashboard Performance Test Plan
*Post RLS-optimering för monthly_marketing_spend och quote_recipients*

## BAKGRUND
Efter genomförda RLS-optimeringar:
1. **monthly_marketing_spend**: current_user_role() wrapper + 4 optimerade policies  
2. **quote_recipients**: 6 optimerade policies + 11 prestandaindex + 83% förbättring

**TESTMÅL**: Validera att admin-användare upplever märkbar prestanda-förbättring i kritiska workflows.

---

## 1. KRITISKA ADMIN-KOMPONENTER ATT TESTA

### A. Economics Dashboard (/admin/economics)
**Berörda komponenter:**
- `MarketingSpendManager.tsx` - Direkt påverkad av monthly_marketing_spend optimering
- `KpiCards.tsx` - Aggregerade KPI beräkningar
- `MonthlyRevenueChart.tsx` - Intäktsdata över tid
- `BeGoneMonthlyStatsChart.tsx` - Statistik för engångsjobb
- `EconomicInsightsChart.tsx` - Topplista ärenden/skadedjur

**Datakällor från useEconomicsDashboard.ts:**
- `useMarketingSpend()` - Hook för marknadsföringskostnader
- `useKpiData()` - Nyckeltal aggregering
- `useMonthlyRevenue()` - Månadsvis intäktsdata

### B. Notifikations/Quote System (påverkat av quote_recipients)
**Komponenter som kan användas:**
- Admin notifikationshantering
- Massutskick av offerter  
- Customer communication workflows

---

## 2. BEFORE/AFTER PERFORMANCE BENCHMARKS

### A. Browser DevTools Performance Profiling

**Mätpunkter:**
```javascript
// Timing markers att mäta
Performance.mark('admin-dashboard-start')
Performance.mark('economics-data-loaded')  
Performance.mark('marketing-spend-loaded')
Performance.mark('complete-render')

// Beräkna tidsskillnader
Performance.measure('total-load-time', 'admin-dashboard-start', 'complete-render')
Performance.measure('marketing-data-time', 'admin-dashboard-start', 'marketing-spend-loaded')
```

**Förväntade förbättringar:**
- Economics Dashboard initial load: **-30-50%** laddningstid
- MarketingSpendManager CRUD operationer: **-40-60%** responstid
- Database query count reduction: **-20-35%** färre queries

### B. Network Tab Analysis
**Mätpunkter:**
- Antal Supabase API calls per sidladdning
- Total data transferred (KB/MB)
- Tid till första byte (TTFB)
- Tid till interaktiv (TTI)

---

## 3. PRAKTISKA PRESTANDA-TESTER

### TEST 1: Economics Dashboard Cold Load
**Steg:**
1. Rensa browser cache helt
2. Navigera till `/admin/economics`
3. Mät tid tills alla komponenter visar data
4. Dokumentera Network/Performance tabs

**Success Criteria:**
- Sida laddad under 3 sekunder (vs tidigare 4-6s)
- Marketing spend data synlig under 2 sekunder
- Inga timeout-fel eller långsamma queries

### TEST 2: MarketingSpendManager CRUD Operations
**Operationer att testa:**
```javascript
// Test scenario för MarketingSpendManager
1. Hämta alla marknadsföringskostnader
2. Lägg till ny månadskostnad (POST)
3. Uppdatera befintlig kostnad (PUT)
4. Ta bort kostnad (DELETE)
5. Refresh dashboard data
```

**Mätpunkter:**
- Tid för varje CRUD operation
- UI responsivitet under operationer
- Success/failure rates

### TEST 3: Heavy Data Load Simulation
**Scenario:**
1. Skapa testdata med 50+ månader av marketing spend
2. Ladda Economics Dashboard
3. Utför flera samtidiga operationer
4. Testa scrollning/filtrering av stora dataset

### TEST 4: Concurrent Admin User Sessions
**Scenario:**
1. Simulera 5-10 samtidiga admin-användare
2. Alla laddar Economics Dashboard samtidigt
3. Utför CRUD operationer parallellt
4. Mät system-responsivitet

---

## 4. USER EXPERIENCE METRICS

### A. Subjektiva UX-förbättringar
**Testpunkter:**
- Upplevd "snappiness" vid navigation
- Förmåga att arbeta kontinuerligt utan väntan
- Reduced "loading spinner" tid
- Smoother scrolling i stora dataset

### B. Task Completion Efficiency  
**Admin workflows att mäta:**
```
Scenario: "Monthly Marketing Review"
1. Navigera till Economics Dashboard
2. Granska KPI cards för månadsöversikt
3. Öppna MarketingSpendManager
4. Lägg till/uppdatera 3 månaders kostnader
5. Analysera ROI via MarketingRoiChart
6. Exportera månadsrapport

Mät: Total tid från start till slutförd uppgift
```

---

## 5. SPECIFIKA RLS-OPTIMERING TESTER

### A. monthly_marketing_spend Policies Test
```sql
-- Testa att optimerade policies fungerar korrekt
-- Admin ska kunna se ALL data, andra roller begränsad access

-- Test queries för validering:
SELECT COUNT(*) FROM monthly_marketing_spend; -- Admin: alla rader
SELECT * FROM monthly_marketing_spend WHERE month > '2024-01-01';
```

### B. current_user_role() Wrapper Performance
**Validera att:**
- Admin-användare får korrekt `admin` role från current_user_role()
- Policies bypassas korrekt för admin
- Inga security leaks till andra roller

---

## 6. AUTOMATED PERFORMANCE TESTS

### A. Lighthouse Performance Audit
```bash
# Kör Lighthouse på Economics Dashboard
npx lighthouse http://localhost:5173/admin/economics \
  --only-categories=performance \
  --chrome-flags="--headless" \
  --output=json \
  --output-path=./performance-report.json
```

**Target scores:**
- Performance: >85 (vs tidigare ~70)
- First Contentful Paint: <2s
- Largest Contentful Paint: <3s

### B. Database Query Performance
```sql
-- Analysera query performance före/efter
EXPLAIN ANALYZE SELECT * FROM monthly_marketing_spend 
WHERE month >= '2024-01-01' 
ORDER BY month DESC;

-- Förväntat: Index usage, reduced scan time
```

---

## 7. IMPLEMENTATION CHECKLIST

### Före testning:
- [ ] Backup av nuvarande performance metrics
- [ ] Setup av test environment med representativ data
- [ ] Browser DevTools performance profiling aktiverat
- [ ] Network throttling settings documented

### Under testning:
- [ ] Dokumentera alla load times
- [ ] Screenshot av DevTools Performance tab
- [ ] Network tab data export
- [ ] User experience observations

### Efter testning:
- [ ] Jämför before/after metrics
- [ ] Identifiera eventuella regressions
- [ ] Dokumentera användares feedback
- [ ] Plan för ytterligare optimeringar

---

## 8. SUCCESS CRITERIA SAMMANFATTNING

**Kritiska framgångsmått:**
1. **Economics Dashboard**: 30-50% snabbare initial load
2. **MarketingSpendManager**: CRUD operationer under 1 sekund
3. **Admin UX**: Inga loading spinners >2 sekunder
4. **Database**: Reducerade query counts med 20-35%
5. **Concurrent users**: Stabil performance för 10+ samtidiga admins

**Acceptanskriterier:**
- Alla admin workflows fungerar utan functional regressions
- Security policies behåller korrekt access control
- Performance gains märkbara för slutanvändare
- Inga nya fel eller crashes introducerade

**Nästa steg vid framgång:**
- Applicera liknande RLS-optimeringar på andra stora tabeller
- Implementera query caching för ytterligare speedup
- Utöka performance monitoring för kontinuerlig övervakning