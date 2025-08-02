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
      recentCasesWithPrices
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

      // Kommande schemalagda ärenden
      supabase
        .from('private_cases')
        .select('*, technicians(name)')
        .gte('start_date', today)
        .lte('start_date', oneWeekFromNow)
        .not('start_date', 'is', null)
        .order('start_date', { ascending: true }),

      // Senaste ärenden med priser för prissättningsanalys
      supabase
        .from('private_cases')
        .select('id, title, description, pris, tekniker_kommentar, created_at, primary_assignee_id')
        .not('pris', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    // Analysera schema-luckor
    const scheduleGaps = await analyzeScheduleGaps(technicians.data || [], today, oneWeekFromNow);

    // Analysera tekniker-tillgänglighet
    const technicianAvailability = await analyzeTechnicianAvailability(technicians.data || [], today, oneWeekFromNow);

    // Beräkna prestationsmått
    const performanceMetrics = await calculatePerformanceMetrics();

    // Analysera prissättningsmönster
    const pricingPatterns = analyzePricingPatterns(recentCasesWithPrices.data || []);

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
        recent_cases_with_prices: recentCasesWithPrices.data || [],
        pricing_patterns: pricingPatterns
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
              duration_hours: gapDuration,
              gap_type: gapDuration >= 3 ? 'major' : 'minor'
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
            duration_hours: gapDuration,
            gap_type: gapDuration >= 3 ? 'major' : 'minor'
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
 * Analyserar prissättningsmönster
 */
const analyzePricingPatterns = (cases: any[]) => {
  const patterns = [];
  
  // Gruppera efter typ av ärende baserat på titel/beskrivning
  const caseTypes = groupCasesByType(cases);
  
  for (const [type, typeCases] of Object.entries(caseTypes)) {
    const prices = (typeCases as any[]).map(c => c.pris).filter(p => p > 0);
    
    if (prices.length >= 3) {
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      patterns.push({
        case_type: type,
        case_count: prices.length,
        avg_price: Math.round(avgPrice),
        min_price: minPrice,
        max_price: maxPrice,
        price_variance: Math.round(maxPrice - minPrice),
        recent_cases: (typeCases as any[]).slice(0, 3)
      });
    }
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