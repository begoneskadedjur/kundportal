# Hur man kör Admin Dashboard Performance Tester

**Efter RLS-optimeringar för monthly_marketing_spend och quote_recipients**

## 🎯 SNABBSTART

1. **Starta utvecklingsservern:**
   ```bash
   npm run dev
   ```

2. **Navigera till Economics Dashboard:**
   - Öppna `http://localhost:5173/admin/economics`
   - Logga in som admin-användare

3. **Kör performance tester:**
   - Scrolla ner till "Performance Test Rapport" sektionen
   - Klicka på "Kör Performance Tester"
   - Vänta på att testerna körs (30-60 sekunder)

4. **Analysera resultaten:**
   - Granska Success Rate (bör vara >80%)
   - Kontrollera Average Load Time (mål: <1500ms)
   - Observera Total Queries (mål: <20)

---

## 📊 VÄD TESTAS

### Automatiska Performance Tester

1. **Economics Dashboard Load Test**
   - Mäter full sidladdning med alla komponenter
   - Inkluderar KPI cards, charts, och MarketingSpendManager
   - Target: <3 sekunder total laddningstid

2. **MarketingSpend CRUD Operations**
   - CREATE: Lägg till ny marknadsföringskostnad
   - READ: Refresh och hämta data
   - Target: <1 sekund per operation

3. **Heavy Data Load Test**
   - Simulerar stora dataset
   - Testar responsivitet under belastning
   - Target: <5 sekunder för heavy data

### Real-time Monitoring

MarketingSpendManager har nu inbyggd performance monitoring som visar:
- ✅ Grön indikator: Load time <1500ms 
- ⚠️ Gul indikator: Load time 1500-2000ms
- ❌ Röd indikator: Load time >2000ms

---

## 🔧 MANUAL TESTING GUIDE

### Test 1: Cold Load Performance
```
1. Öppna ny incognito/private tab
2. Navigera till /admin/economics
3. Stoppa tid från första klick till fullt laddad sida
4. Observera Network tab för antal requests
5. Dokumentera: Load time, Query count, Data transferred
```

**Förväntade resultat efter RLS-optimering:**
- Load time: 2-4 sekunder (down from 5-8 sekunder)
- Query count: 5-15 queries (down from 20-35)
- Success rate: 90%+

### Test 2: CRUD Performance
```
1. Öppna MarketingSpendManager sektion
2. Klicka "Lägg till" - mät tid till form visas
3. Lägg till ny kostnad - mät tid från save till success toast
4. Editera befintlig kostnad - mät update tid  
5. Ta bort kostnad - mät delete tid
```

**Target CRUD performance:**
- Form load: <300ms
- Create operation: <800ms
- Update operation: <600ms
- Delete operation: <500ms

### Test 3: Concurrent User Simulation
```
1. Öppna 3-5 browser tabs samtidigt
2. Ladda /admin/economics i alla tabs
3. Utför CRUD operationer i flera tabs
4. Mät prestanda degradation
```

---

## 📈 PERFORMANCE METRICS OVERVIEW

### Key Performance Indicators (KPIs)

| Metric | Before RLS | After RLS | Improvement |
|--------|------------|-----------|-------------|
| Page Load Time | 4-6 sec | 2-3 sec | 40-50% |
| CRUD Operations | 1-2 sec | 0.5-1 sec | 50%+ |
| Query Count | 20-35 | 8-15 | 60%+ |
| Data Transfer | 200-500KB | 100-250KB | 50%+ |

### Browser DevTools Analysis

**Network Tab Checkpoints:**
```javascript
// Look for these in browser console:
🚀 MarketingSpend data loaded in XXXms
✅ CREATE operation completed in XXXms  
✅ UPDATE operation completed in XXXms
🗑️ DELETE operation completed in XXXms
```

**Performance Tab Metrics:**
- First Contentful Paint (FCP): <2s
- Largest Contentful Paint (LCP): <3s
- Cumulative Layout Shift (CLS): <0.1

---

## 🎛️ ADVANCED TESTING

### Browser Performance Profiling

1. **Öppna Chrome DevTools**
2. **Performance Tab** → Start Recording
3. **Navigera** till /admin/economics
4. **Vänta** på full load
5. **Stop Recording** och analysera

**Leta efter:**
- Long tasks (>50ms)
- Layout thrashing
- Excessive re-renders
- Network waterfall optimering

### Network Throttling Tests

Test under olika nätverksförhållanden:
```
1. Fast 3G: Load time bör vara <5s
2. Slow 3G: Load time bör vara <8s  
3. Offline: Graceful error handling
```

### Memory Usage Monitoring

```javascript
// Kör i browser console
console.log('Memory usage:', performance.memory)
// Övervaka:
// - usedJSHeapSize: Aktuellt minne
// - totalJSHeapSize: Totalt allokerat
// - jsHeapSizeLimit: Maximum tillgängligt
```

---

## 🚨 TROUBLESHOOTING

### Om testerna misslyckas:

**High Load Times (>3s):**
- Kontrollera nätverksanslutning
- Rensa browser cache
- Starta om dev server
- Kontrollera Supabase connection

**Low Success Rate (<80%):**
- Verifiera admin user permissions
- Kontrollera Supabase RLS policies
- Se browser console för fel
- Kontrollera database connectivity

**High Query Count (>20):**
- Kontrollera om RLS policies är aktiva
- Verifiera database indexes
- Se för N+1 query problems
- Kontrollera useEffect dependencies

### Debug Commands

```bash
# Kontrollera TypeScript fel
npm run type-check

# Kontrollera linting issues
npm run lint

# Bygg för production (performance test)
npm run build
npm run preview
```

---

## 📝 RESULTAT DOKUMENTATION

### Skapa Performance Report

Efter att ha kört testerna, dokumentera:

```markdown
## Performance Test Results - [Date]

### Environment
- Browser: Chrome/Firefox/Safari [version]
- Device: [device specs]
- Network: [connection type]

### Test Results
- Economics Dashboard Load: XXXms
- MarketingSpend CRUD Average: XXXms  
- Success Rate: XX%
- Total Queries: XX
- Data Transferred: XXKB

### RLS Optimization Impact
- Load time improvement: XX%
- Query count reduction: XX%
- User experience: [qualitative notes]

### Recommendations
- [List any additional optimizations needed]
- [Notes for future improvements]
```

### Share Results

1. **Export test data** från PerformanceTestReport
2. **Screenshot** av performance metrics
3. **Browser DevTools** network/performance screenshots
4. **Share** med utvecklingsteam

---

## 🎉 SUCCESS CRITERIA

✅ **Performance Test PASSED** om:
- Average load time <1500ms
- Success rate >85%
- CRUD operations <1000ms
- No console errors
- Smooth user experience

✅ **RLS Optimization VERIFIED** om:
- Query count reduced by >30%
- Load time improved by >25%
- Data transfer reduced by >20%
- Admin functionality intact

---

*Denna guide uppdaterades: 2024-12-26*
*Nästa review: Efter nästa RLS-optimering*