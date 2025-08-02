// src/services/coordinatorChatService.ts
// Service för att samla all koordinatordata för AI-chatten

import { supabase } from '../lib/supabase';

export interface CoordinatorChatData {
  cases: {
    private_cases: any[];
    business_cases: any[];
    legacy_cases: any[];
  };
  technicians: any[];
  schedule: {
    upcoming_cases: any[];
    schedule_gaps: any[];
    technician_availability: any[];
  };
  analytics: {
    performance_metrics: any;
    utilization_data: any[];
    recent_trends: any[];
  };
  pricing: {
    recent_cases_with_prices: any[];
    pricing_patterns: any[];
  };
}

/**
 * Hämtar komplett koordinatordata för AI-chatten
 */
export const getCoordinatorChatData = async (): Promise<CoordinatorChatData> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Hämta all data parallellt för prestanda
    const [
      privateCases,
      businessCases,
      legacyCases,
      technicians,
      upcomingCases,
      recentPrivateCasesWithPrices,
      recentBusinessCasesWithPrices
    ] = await Promise.all([
      // Private cases
      supabase
        .from('private_cases')
        .select('*')
        .gte('created_at', oneWeekAgo)
        .order('created_at', { ascending: false })
        .limit(100),

      // Business cases  
      supabase
        .from('business_cases')
        .select('*')
        .gte('created_at', oneWeekAgo)
        .order('created_at', { ascending: false })
        .limit(100),

      // Legacy cases
      supabase
        .from('cases')
        .select('*')
        .gte('created_at', oneWeekAgo)
        .order('created_at', { ascending: false })
        .limit(50),

      // Tekniker med arbetsscheman
      supabase
        .from('technicians')
        .select('*')
        .eq('is_active', true),

      // Kommande schemalagda ärenden med detaljerad info
      supabase
        .from('private_cases')
        .select(`
          id, title, description, adress, start_date, due_date, status,
          primary_assignee_id, secondary_assignee_id, tertiary_assignee_id
        `)
        .gte('start_date', today)
        .lte('start_date', oneWeekFromNow)
        .not('start_date', 'is', null)
        .order('start_date', { ascending: true }),

      // Alla ärenden med priser (för skadedjurs-specifik filtrering)
      supabase
        .from('private_cases')
        .select(`
          id, title, description, rapport, pris, skadedjur, 
          start_date, due_date, created_at,
          primary_assignee_id, secondary_assignee_id, tertiary_assignee_id,
          adress, status
        `)
        .not('pris', 'is', null)
        .gte('created_at', new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())
        .order('pris', { ascending: false }) // Sortera efter pris för bättre analys
        .limit(200), // Öka gränsen för bättre skadedjurs-täckning

      // Business cases med komplett prissättningsdata
      supabase
        .from('business_cases')
        .select(`
          id, title, description, rapport, pris, skadedjur, 
          start_date, due_date, created_at,
          primary_assignee_id, secondary_assignee_id, tertiary_assignee_id,
          adress, status
        `)
        .not('pris', 'is', null)
        .gte('created_at', new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())
        .order('pris', { ascending: false }) // Sortera efter pris för bättre analys
        .limit(200) // Öka gränsen för bättre skadedjurs-täckning
    ]);

    // Kombinera alla ärenden med priser för omfattande prissättningsanalys
    const allCasesWithPrices = [
      ...(recentPrivateCasesWithPrices.data || []).map(c => ({ ...c, case_type: 'private' as const })),
      ...(recentBusinessCasesWithPrices.data || []).map(c => ({ ...c, case_type: 'business' as const }))
    ];

    // TEMPORARY: Debug logging för att spåra dataflöde (även i produktion för debugging)
    console.log('📊 Coordinator Chat Data Summary:');
    console.log(`- Private cases with prices: ${recentPrivateCasesWithPrices.data?.length || 0}`);
    console.log(`- Business cases with prices: ${recentBusinessCasesWithPrices.data?.length || 0}`);
    console.log(`- Total cases with prices: ${allCasesWithPrices.length}`);
    
    // Log pest types found in data
    const pestTypes = allCasesWithPrices.map(c => c.skadedjur).filter(Boolean);
    const uniquePestTypes = [...new Set(pestTypes)];
    console.log(`- Unique pest types found: ${uniquePestTypes.join(', ')}`);
    console.log(`- Sample vägglöss cases:`, allCasesWithPrices.filter(c => 
      c.skadedjur?.toLowerCase().includes('vägglöss') || 
      c.skadedjur?.toLowerCase().includes('vägglus')
    ).length);

    // Optimera prissättningsdata genom att gruppera efter skadedjur
    const optimizedPricingData = optimizePricingDataByPestType(allCasesWithPrices);
    
    // TEMPORARY: Debug optimized pricing data
    console.log(`📈 Optimized Pricing Data Keys: ${Object.keys(optimizedPricingData).join(', ')}`);
    if (optimizedPricingData['Vägglöss']) {
      console.log(`🐛 Vägglöss data found: ${optimizedPricingData['Vägglöss'].case_count} cases, avg price: ${optimizedPricingData['Vägglöss'].price_statistics?.avg_price}`);
    } else {
      console.log(`❌ No Vägglöss data in optimized structure`);
    }

    // Analysera schema-luckor
    const scheduleGaps = await analyzeScheduleGaps(technicians.data || [], today, oneWeekFromNow);

    // Analysera tekniker-tillgänglighet
    const technicianAvailability = await analyzeTechnicianAvailability(technicians.data || [], today, oneWeekFromNow);

    // Beräkna prestationsmått
    const performanceMetrics = await calculatePerformanceMetrics();

    // Analysera avancerade prissättningsmönster
    const pricingPatterns = analyzePricingPatterns(allCasesWithPrices);

    return {
      cases: {
        private_cases: privateCases.data || [],
        business_cases: businessCases.data || [],
        legacy_cases: legacyCases.data || []
      },
      technicians: technicians.data || [],
      schedule: {
        upcoming_cases: upcomingCases.data || [],
        schedule_gaps: scheduleGaps,
        technician_availability: technicianAvailability
      },
      analytics: {
        performance_metrics: performanceMetrics,
        utilization_data: [], // Kan hämtas från befintlig analytics-service
        recent_trends: [] // Kan implementeras senare
      },
      pricing: {
        recent_cases_with_prices: allCasesWithPrices,
        pricing_patterns: pricingPatterns,
        optimized_by_pest_type: optimizedPricingData
      }
    };

  } catch (error) {
    console.error('Error fetching coordinator chat data:', error);
    throw new Error('Kunde inte hämta koordinatordata');
  }
};

/**
 * Analyserar schema-luckor för kommande vecka
 */
const analyzeScheduleGaps = async (technicians: any[], startDate: string, endDate: string) => {
  const gaps = [];
  
  for (const tech of technicians) {
    if (!tech.work_schedule) continue;

    // Hämta schemalagda ärenden för tekniker
    const { data: scheduledCases } = await supabase
      .from('private_cases')
      .select('start_date, due_date')
      .eq('primary_assignee_id', tech.id)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .not('start_date', 'is', null)
      .not('due_date', 'is', null);

    // Analysera arbetstid vs schemalagd tid
    const workDays = getWorkDaysInPeriod(tech.work_schedule, startDate, endDate);
    
    for (const workDay of workDays) {
      const dayStart = new Date(`${workDay.date} ${workDay.start}`);
      const dayEnd = new Date(`${workDay.date} ${workDay.end}`);
      
      // Hitta luckor mellan schemalagda ärenden
      const dayCases = (scheduledCases || [])
        .filter(c => c.start_date.startsWith(workDay.date))
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

      let currentTime = dayStart;
      
      for (const caseItem of dayCases) {
        const caseStart = new Date(caseItem.start_date);
        
        if (caseStart > currentTime) {
          const gapDuration = (caseStart.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
          
          if (gapDuration >= 1) { // Minst 1 timmes lucka
            gaps.push({
              technician_id: tech.id,
              technician_name: tech.name,
              date: workDay.date,
              start_time: currentTime.toTimeString().slice(0, 5),
              end_time: caseStart.toTimeString().slice(0, 5),
              duration_hours: Math.round(gapDuration * 10) / 10,
              gap_type: gapDuration >= 3 ? 'major' : 'minor',
              day_of_week: new Date(workDay.date).toLocaleDateString('sv-SE', { weekday: 'long' }),
              suggested_booking_time: `${currentTime.toTimeString().slice(0, 5)} - ${new Date(currentTime.getTime() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5)}`
            });
          }
        }
        
        currentTime = new Date(caseItem.due_date);
      }
      
      // Kontrollera lucka från sista ärendet till arbetsdagens slut
      if (currentTime < dayEnd && dayCases.length > 0) {
        const gapDuration = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
        
        if (gapDuration >= 1) {
          gaps.push({
            technician_id: tech.id,
            technician_name: tech.name,
            date: workDay.date,
            start_time: currentTime.toTimeString().slice(0, 5),
            end_time: dayEnd.toTimeString().slice(0, 5),
            duration_hours: Math.round(gapDuration * 10) / 10,
            gap_type: gapDuration >= 3 ? 'major' : 'minor',
            day_of_week: new Date(workDay.date).toLocaleDateString('sv-SE', { weekday: 'long' }),
            suggested_booking_time: `${currentTime.toTimeString().slice(0, 5)} - ${new Date(currentTime.getTime() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5)}`
          });
        }
      }
    }
  }

  return gaps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Analyserar tekniker-tillgänglighet
 */
const analyzeTechnicianAvailability = async (technicians: any[], startDate: string, endDate: string) => {
  const availability = [];

  for (const tech of technicians) {
    if (!tech.work_schedule) continue;

    // Beräkna total arbetstid för perioden
    const workDays = getWorkDaysInPeriod(tech.work_schedule, startDate, endDate);
    const totalWorkHours = workDays.reduce((sum, day) => {
      const start = new Date(`2000-01-01 ${day.start}`);
      const end = new Date(`2000-01-01 ${day.end}`);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);

    // Hämta schemalagda timmar
    const { data: scheduledCases } = await supabase
      .from('private_cases')
      .select('start_date, due_date')
      .eq('primary_assignee_id', tech.id)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .not('start_date', 'is', null)
      .not('due_date', 'is', null);

    const scheduledHours = (scheduledCases || []).reduce((sum, c) => {
      const start = new Date(c.start_date);
      const end = new Date(c.due_date);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);

    const utilizationPercent = totalWorkHours > 0 ? (scheduledHours / totalWorkHours) * 100 : 0;
    const availableHours = totalWorkHours - scheduledHours;

    availability.push({
      technician_id: tech.id,
      technician_name: tech.name,
      total_work_hours: totalWorkHours,
      scheduled_hours: scheduledHours,
      available_hours: Math.max(0, availableHours),
      utilization_percent: utilizationPercent,
      status: utilizationPercent < 60 ? 'underutilized' : 
              utilizationPercent > 90 ? 'overutilized' : 'optimal',
      specializations: tech.specializations || [],
      work_areas: tech.work_areas || []
    });
  }

  return availability.sort((a, b) => a.utilization_percent - b.utilization_percent);
};

/**
 * Beräknar grundläggande prestationsmått
 */
const calculatePerformanceMetrics = async () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Hämta grunddata för senaste veckan
  const [privateCases, businessCases] = await Promise.all([
    supabase.from('private_cases').select('*').gte('created_at', oneWeekAgo),
    supabase.from('business_cases').select('*').gte('created_at', oneWeekAgo)
  ]);

  const allCases = [...(privateCases.data || []), ...(businessCases.data || [])];
  
  return {
    total_cases_week: allCases.length,
    scheduled_cases: allCases.filter(c => c.start_date).length,
    completed_cases: allCases.filter(c => c.status === 'Avslutat').length,
    avg_scheduling_time: calculateAverageSchedulingTime(allCases),
    total_revenue_week: allCases.reduce((sum, c) => sum + (c.pris || 0), 0)
  };
};

/**
 * Analyserar avancerade prissättningsmönster med alla faktorer
 */
const analyzePricingPatterns = (cases: any[]) => {
  const patterns = [];
  
  // Gruppera efter skadedjurstyp (primärt)
  const pestTypes = groupCasesByPestType(cases);
  
  for (const [pestType, pestCases] of Object.entries(pestTypes)) {
    if ((pestCases as any[]).length < 3) continue;
    
    const casesWithPrices = (pestCases as any[]).filter(c => c.pris > 0);
    if (casesWithPrices.length < 3) continue;
    
    // Beräkna grundläggande statistik
    const prices = casesWithPrices.map(c => c.pris);
    const durations = casesWithPrices
      .filter(c => c.start_date && c.due_date)
      .map(c => calculateDurationHours(c.start_date, c.due_date));
    
    // Analysera tekniker-påverkan
    const technicianImpact = analyzeTechnicianCountImpact(casesWithPrices);
    
    // Analysera komplexitet baserat på beskrivning och rapport
    const complexityAnalysis = analyzeComplexityFactors(casesWithPrices);
    
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgDuration = durations.length > 0 ? 
      durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    
    patterns.push({
      pest_type: pestType,
      case_count: casesWithPrices.length,
      price_statistics: {
        avg_price: Math.round(avgPrice),
        min_price: minPrice,
        max_price: maxPrice,
        price_variance: Math.round(maxPrice - minPrice),
        median_price: calculateMedian(prices)
      },
      duration_statistics: {
        avg_duration_hours: Math.round(avgDuration * 10) / 10,
        cases_with_duration: durations.length
      },
      technician_impact: technicianImpact,
      complexity_factors: complexityAnalysis,
      recent_examples: casesWithPrices.slice(0, 5).map(c => ({
        id: c.id,
        title: c.title,
        price: c.pris,
        duration_hours: c.start_date && c.due_date ? 
          calculateDurationHours(c.start_date, c.due_date) : null,
        technician_count: getTechnicianCount(c),
        complexity_score: calculateComplexityScore(c),
        case_type: c.case_type,
        created_at: c.created_at
      }))
    });
  }
  
  return patterns.sort((a, b) => b.case_count - a.case_count);
};

/**
 * Hjälpfunktioner
 */
const getWorkDaysInPeriod = (workSchedule: any, startDate: string, endDate: string) => {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const schedule = workSchedule[dayName];
    
    if (schedule?.active) {
      days.push({
        date: current.toISOString().split('T')[0],
        start: schedule.start,
        end: schedule.end,
        day: dayName
      });
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};

const calculateAverageSchedulingTime = (cases: any[]) => {
  const scheduledCases = cases.filter(c => c.start_date && c.created_at);
  
  if (scheduledCases.length === 0) return 0;
  
  const totalHours = scheduledCases.reduce((sum, c) => {
    const created = new Date(c.created_at);
    const scheduled = new Date(c.start_date);
    return sum + (scheduled.getTime() - created.getTime()) / (1000 * 60 * 60);
  }, 0);
  
  return totalHours / scheduledCases.length;
};

/**
 * Grupperar ärenden efter skadedjurstyp (primärt från skadedjur-kolumn)
 */
const groupCasesByPestType = (cases: any[]) => {
  const types: Record<string, any[]> = {};
  
  for (const caseItem of cases) {
    let pestType = 'Övrigt';
    
    // Använd skadedjur-kolumnen först om den finns
    if (caseItem.skadedjur) {
      pestType = caseItem.skadedjur;
    } else {
      // Fallback till textanalys av title/description
      const title = caseItem.title || '';
      const description = caseItem.description || '';
      const text = `${title} ${description}`.toLowerCase();
      
      if (text.includes('råtta') || text.includes('mus')) pestType = 'Gnagare';
      else if (text.includes('myra') || text.includes('ant')) pestType = 'Myror';
      else if (text.includes('kackerlack') || text.includes('cockroach')) pestType = 'Kackerlackor';
      else if (text.includes('vägglus') || text.includes('bedbug')) pestType = 'Vägglöss';
      else if (text.includes('getinggap') || text.includes('hornets nest')) pestType = 'Getingar';
      else if (text.includes('fågel') || text.includes('bird')) pestType = 'Fåglar';
      else if (text.includes('spindel') || text.includes('spider')) pestType = 'Spindlar';
    }
    
    if (!types[pestType]) types[pestType] = [];
    types[pestType].push(caseItem);
  }
  
  return types;
};

/**
 * Beräknar varaktighet i timmar mellan start och slut
 */
const calculateDurationHours = (startDate: string, dueDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(dueDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
};

/**
 * Räknar antal tekniker som arbetat på ärendet
 */
const getTechnicianCount = (caseItem: any): number => {
  let count = 0;
  if (caseItem.primary_assignee_id) count++;
  if (caseItem.secondary_assignee_id) count++;
  if (caseItem.tertiary_assignee_id) count++;
  return count;
};

/**
 * Analyserar påverkan av antal tekniker på prissättning
 */
const analyzeTechnicianCountImpact = (cases: any[]) => {
  const byTechCount = { 1: [], 2: [], 3: [] } as Record<number, number[]>;
  
  for (const caseItem of cases) {
    const techCount = getTechnicianCount(caseItem);
    if (techCount >= 1 && techCount <= 3 && caseItem.pris > 0) {
      byTechCount[techCount].push(caseItem.pris);
    }
  }
  
  const result: any = {};
  
  for (const [count, prices] of Object.entries(byTechCount)) {
    if (prices.length > 0) {
      result[`${count}_technician`] = {
        case_count: prices.length,
        avg_price: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        min_price: Math.min(...prices),
        max_price: Math.max(...prices)
      };
    }
  }
  
  return result;
};

/**
 * Analyserar komplexitetsfaktorer från beskrivning och rapport
 */
const analyzeComplexityFactors = (cases: any[]) => {
  const complexityKeywords = {
    high: ['omfattande', 'komplex', 'svår', 'återbesök', 'problem', 'infestation', 'stort', 'många'],
    medium: ['standard', 'normal', 'vanlig', 'kontroll', 'förebyggande'],
    low: ['enkel', 'liten', 'begränsad', 'snabb', 'rutinmässig']
  };
  
  const complexityCounts = { high: 0, medium: 0, low: 0 };
  const complexityPrices = { high: [], medium: [], low: [] } as Record<string, number[]>;
  
  for (const caseItem of cases) {
    const text = `${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
    let complexity = 'medium'; // default
    
    let highScore = 0, mediumScore = 0, lowScore = 0;
    
    for (const keyword of complexityKeywords.high) {
      if (text.includes(keyword)) highScore++;
    }
    for (const keyword of complexityKeywords.medium) {
      if (text.includes(keyword)) mediumScore++;
    }
    for (const keyword of complexityKeywords.low) {
      if (text.includes(keyword)) lowScore++;
    }
    
    if (highScore > mediumScore && highScore > lowScore) complexity = 'high';
    else if (lowScore > mediumScore && lowScore > highScore) complexity = 'low';
    
    complexityCounts[complexity as keyof typeof complexityCounts]++;
    if (caseItem.pris > 0) {
      complexityPrices[complexity as keyof typeof complexityPrices].push(caseItem.pris);
    }
  }
  
  const result: any = {};
  
  for (const [level, prices] of Object.entries(complexityPrices)) {
    if (prices.length > 0) {
      result[`${level}_complexity`] = {
        case_count: prices.length,
        avg_price: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        price_range: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      };
    }
  }
  
  return result;
};

/**
 * Beräknar komplexitetspoäng för ett ärende
 */
const calculateComplexityScore = (caseItem: any): number => {
  const text = `${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
  let score = 0;
  
  // Faktorer som ökar komplexitet
  if (text.includes('omfattande')) score += 3;
  if (text.includes('komplex')) score += 3;
  if (text.includes('återbesök')) score += 2;
  if (text.includes('problem')) score += 2;
  if (text.includes('infestation')) score += 2;
  if (text.includes('många')) score += 1;
  if (text.includes('stort')) score += 1;
  
  // Faktorer som minskar komplexitet
  if (text.includes('enkel')) score -= 2;
  if (text.includes('liten')) score -= 1;
  if (text.includes('rutinmässig')) score -= 1;
  
  // Tekniker-antal påverkar komplexitet
  const techCount = getTechnicianCount(caseItem);
  if (techCount > 1) score += techCount - 1;
  
  return Math.max(0, score); // Minimum 0
};

/**
 * Beräknar median från en array av nummer
 */
const calculateMedian = (numbers: number[]): number => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  } else {
    return sorted[middle];
  }
};

/**
 * Optimerar prissättningsdata genom att gruppera efter skadedjurstyp
 */
const optimizePricingDataByPestType = (cases: any[]) => {
  const pestTypeGroups: Record<string, any[]> = {};
  
  // Gruppera efter skadedjur-kolumn (primär) och textanalys (sekundär)
  for (const caseItem of cases) {
    let pestType = 'Övrigt';
    
    // Använd skadedjur-kolumnen först
    if (caseItem.skadedjur && caseItem.skadedjur.trim()) {
      pestType = caseItem.skadedjur.trim();
    } else {
      // Fallback till textanalys
      const title = caseItem.title || '';
      const description = caseItem.description || '';
      const text = `${title} ${description}`.toLowerCase();
      
      if (text.includes('råtta') || text.includes('mus')) pestType = 'Gnagare';
      else if (text.includes('myra')) pestType = 'Myror';
      else if (text.includes('kackerlack')) pestType = 'Kackerlackor';
      else if (text.includes('vägglus') || text.includes('bedbug')) pestType = 'Vägglöss';
      else if (text.includes('getingar') || text.includes('hornets nest')) pestType = 'Getingar';
      else if (text.includes('fågel') || text.includes('bird')) pestType = 'Fåglar';
      else if (text.includes('spindel')) pestType = 'Spindlar';
      else if (text.includes('fågelsäkring')) pestType = 'Fågelsäkring';
      else if (text.includes('sanering')) pestType = 'Sanering';
    }
    
    if (!pestTypeGroups[pestType]) {
      pestTypeGroups[pestType] = [];
    }
    pestTypeGroups[pestType].push(caseItem);
  }
  
  // Skapa optimerad struktur med statistik för varje skadedjurstyp
  const optimizedData: Record<string, any> = {};
  
  for (const [pestType, pestCases] of Object.entries(pestTypeGroups)) {
    if (pestCases.length >= 3) { // Endast typer med tillräckligt data
      const prices = pestCases.map(c => c.pris).filter(p => p > 0);
      
      if (prices.length >= 3) {
        optimizedData[pestType] = {
          case_count: pestCases.length,
          price_statistics: {
            avg_price: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
            median_price: calculateMedian(prices),
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            price_variance: Math.max(...prices) - Math.min(...prices)
          },
          recent_cases: pestCases
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 25), // Top 25 senaste för bättre variation och precision
          complexity_distribution: analyzeComplexityDistribution(pestCases),
          technician_requirements: analyzeTechnicianRequirements(pestCases),
          duration_patterns: analyzeDurationPatterns(pestCases)
        };
      }
    }
  }
  
  return optimizedData;
};

/**
 * Analyserar komplexitetsfördelning för en skadedjurstyp
 */
const analyzeComplexityDistribution = (cases: any[]) => {
  const complexity = { low: 0, medium: 0, high: 0 };
  
  for (const caseItem of cases) {
    const text = `${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
    
    if (text.includes('sanering') || text.includes('omfattande') || text.includes('komplex')) {
      complexity.high++;
    } else if (text.includes('enkel') || text.includes('rutinmässig')) {
      complexity.low++;
    } else {
      complexity.medium++;
    }
  }
  
  return complexity;
};

/**
 * Analyserar tekniker-krav för en skadedjurstyp
 */
const analyzeTechnicianRequirements = (cases: any[]) => {
  const techCounts = { 1: 0, 2: 0, 3: 0 };
  
  for (const caseItem of cases) {
    let count = 0;
    if (caseItem.primary_assignee_id) count++;
    if (caseItem.secondary_assignee_id) count++;
    if (caseItem.tertiary_assignee_id) count++;
    
    if (count >= 1 && count <= 3) {
      techCounts[count as keyof typeof techCounts]++;
    }
  }
  
  return techCounts;
};

/**
 * Analyserar duration-mönster för en skadedjurstyp
 */
const analyzeDurationPatterns = (cases: any[]) => {
  const casesWithDuration = cases.filter(c => c.start_date && c.due_date);
  
  if (casesWithDuration.length === 0) {
    return { message: 'Ingen durationsdata tillgänglig' };
  }
  
  const durations = casesWithDuration.map(c => 
    (new Date(c.due_date).getTime() - new Date(c.start_date).getTime()) / (1000 * 60 * 60)
  );
  
  return {
    avg_duration: Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length) * 10) / 10,
    min_duration: Math.round(Math.min(...durations) * 10) / 10,
    max_duration: Math.round(Math.max(...durations) * 10) / 10,
    cases_with_duration: casesWithDuration.length
  };
};

const groupCasesByType = (cases: any[]) => {
  const types: Record<string, any[]> = {};
  
  for (const caseItem of cases) {
    const title = caseItem.title || '';
    const description = caseItem.description || '';
    const text = `${title} ${description}`.toLowerCase();
    
    let type = 'Övrigt';
    
    if (text.includes('råtta') || text.includes('mus')) type = 'Gnagare';
    else if (text.includes('myra') || text.includes('ant')) type = 'Myror';
    else if (text.includes('kackerlack') || text.includes('cockroach')) type = 'Kackerlackor';
    else if (text.includes('vägglus') || text.includes('bedbug')) type = 'Vägglöss';
    else if (text.includes('getinggap') || text.includes('hornets nest')) type = 'Getingar';
    else if (text.includes('fågel') || text.includes('bird')) type = 'Fåglar';
    else if (text.includes('spindel') || text.includes('spider')) type = 'Spindlar';
    
    if (!types[type]) types[type] = [];
    types[type].push(caseItem);
  }
  
  return types;
};