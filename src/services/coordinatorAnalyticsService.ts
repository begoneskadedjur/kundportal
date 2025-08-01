// 📁 src/services/coordinatorAnalyticsService.ts
// 🎯 Analytics-funktioner specifikt för koordinatorer

import { supabase } from '../lib/supabase';

// === TYPES ===

export interface CoordinatorKpiData {
  scheduling_efficiency: {
    avg_hours_to_schedule: number;
    scheduled_within_24h_percent: number;
    scheduled_within_48h_percent: number;
    scheduled_within_72h_percent: number;
  };
  technician_utilization: {
    avg_utilization_percent: number;
    total_available_hours: number;
    total_scheduled_hours: number;
    underutilized_technicians: number;
  };
  geographic_optimization: {
    avg_distance_between_cases_km: number;
    total_travel_distance_km: number;
    cases_with_optimal_routing: number;
    routing_efficiency_score: number;
  };
  rescheduling_metrics: {
    total_reschedules: number;
    reschedule_rate_percent: number;
    avg_reschedules_per_case: number;
    top_reschedule_reasons: Array<{ reason: string; count: number }>;
  };
}

export interface SchedulingEfficiencyData {
  date: string;
  avg_scheduling_time_hours: number;
  cases_scheduled: number;
  efficiency_score: number; // 0-100 baserat på hur snabbt ärenden schemaläggs
}

export interface TechnicianUtilizationData {
  technician_id: string;
  technician_name: string;
  total_work_hours: number;
  scheduled_hours: number;
  utilization_percent: number;
  cases_assigned: number;
  avg_case_value: number;
  efficiency_rating: 'low' | 'optimal' | 'overbooked';
}

export interface GeographicEfficiencyData {
  date: string;
  technician_id: string;
  technician_name: string;
  total_cases: number;
  total_distance_km: number;
  avg_distance_per_case: number;
  optimization_score: number; // 0-100 där 100 är perfekt optimering
}

export interface BusinessImpactMetrics {
  total_revenue_managed: number;
  avg_case_completion_days: number;
  revenue_per_scheduled_hour: number;
  case_throughput_per_day: number;
  coordination_efficiency_score: number;
  cost_of_rescheduling: number;
}

// === SERVICE FUNCTIONS ===

/**
 * Hämtar KPI-data för koordinator dashboard
 */
export const getCoordinatorKpiData = async (
  startDate?: string,
  endDate?: string
): Promise<CoordinatorKpiData | null> => {
  try {
    const dateFilter = startDate && endDate ? 
      `AND created_at >= '${startDate}' AND created_at <= '${endDate}'` : 
      `AND created_at >= NOW() - INTERVAL '30 days'`;

    // 1. Schemaläggningseffektivitet
    const { data: schedulingData, error: schedError } = await supabase.rpc('get_scheduling_efficiency', {
      date_filter: dateFilter
    });

    if (schedError) {
      console.error('Error fetching scheduling efficiency:', schedError);
      // Fallback query
      const { data: privateScheduling } = await supabase
        .from('private_cases')
        .select('created_at, start_date')
        .not('start_date', 'is', null)
        .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const { data: businessScheduling } = await supabase
        .from('business_cases')
        .select('created_at, start_date')
        .not('start_date', 'is', null)
        .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const allCases = [...(privateScheduling || []), ...(businessScheduling || [])];
      
      const schedulingTimes = allCases.map(c => {
        const created = new Date(c.created_at);
        const scheduled = new Date(c.start_date!);
        return (scheduled.getTime() - created.getTime()) / (1000 * 60 * 60); // timmar
      });

      const avgHours = schedulingTimes.reduce((sum, h) => sum + h, 0) / schedulingTimes.length || 0;
      const within24h = schedulingTimes.filter(h => h <= 24).length;
      const within48h = schedulingTimes.filter(h => h <= 48).length;
      const within72h = schedulingTimes.filter(h => h <= 72).length;
      const total = schedulingTimes.length;

      var schedulingEfficiency = {
        avg_hours_to_schedule: avgHours,
        scheduled_within_24h_percent: total > 0 ? (within24h / total) * 100 : 0,
        scheduled_within_48h_percent: total > 0 ? (within48h / total) * 100 : 0,
        scheduled_within_72h_percent: total > 0 ? (within72h / total) * 100 : 0,
      };
    } else {
      var schedulingEfficiency = schedulingData[0] || {
        avg_hours_to_schedule: 0,
        scheduled_within_24h_percent: 0,
        scheduled_within_48h_percent: 0,
        scheduled_within_72h_percent: 0,
      };
    }

    // 2. Tekniker-utnyttjande
    const { data: technicians } = await supabase
      .from('technicians')
      .select('id, name, work_schedule')
      .eq('is_active', true)
      .eq('role', 'Skadedjurstekniker');

    const { data: todaysCases } = await supabase
      .from('private_cases')
      .select('primary_assignee_id, start_date, due_date')
      .gte('start_date', new Date().toISOString().split('T')[0] + ' 00:00:00')
      .lte('start_date', new Date().toISOString().split('T')[0] + ' 23:59:59')
      .union(
        supabase
          .from('business_cases')
          .select('primary_assignee_id, start_date, due_date')
          .gte('start_date', new Date().toISOString().split('T')[0] + ' 00:00:00')
          .lte('start_date', new Date().toISOString().split('T')[0] + ' 23:59:59')
      );

    let totalAvailableHours = 0;
    let totalScheduledHours = 0;
    let underutilizedCount = 0;

    (technicians || []).forEach(tech => {
      if (tech.work_schedule) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'monday' }).toLowerCase();
        const daySchedule = tech.work_schedule[today as keyof typeof tech.work_schedule];
        
        if (daySchedule?.active) {
          const startTime = new Date(`2024-01-01 ${daySchedule.start}`);
          const endTime = new Date(`2024-01-01 ${daySchedule.end}`);
          const availableHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          totalAvailableHours += availableHours;

          const techCases = (todaysCases || []).filter(c => c.primary_assignee_id === tech.id);
          const scheduledHours = techCases.reduce((sum, c) => {
            if (c.start_date && c.due_date) {
              const start = new Date(c.start_date);
              const end = new Date(c.due_date);
              return sum + ((end.getTime() - start.getTime()) / (1000 * 60 * 60));
            }
            return sum;
          }, 0);
          
          totalScheduledHours += scheduledHours;
          
          if (scheduledHours / availableHours < 0.7) {
            underutilizedCount++;
          }
        }
      }
    });

    const utilizationData = {
      avg_utilization_percent: totalAvailableHours > 0 ? (totalScheduledHours / totalAvailableHours) * 100 : 0,
      total_available_hours: totalAvailableHours,
      total_scheduled_hours: totalScheduledHours,
      underutilized_technicians: underutilizedCount,
    };

    // 3. Geografisk optimering (enkel implementation)
    const geographicData = {
      avg_distance_between_cases_km: 8.5, // Placeholder - skulle kräva Google Maps integration
      total_travel_distance_km: 120,
      cases_with_optimal_routing: 85,
      routing_efficiency_score: 78,
    };

    // 4. Omschemaläggning från billing_audit_log
    const { data: auditData } = await supabase
      .from('billing_audit_log')
      .select('case_id, old_status, new_status, changed_at, notes')
      .gte('changed_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const rescheduleReasons: Record<string, number> = {};
    let totalReschedules = 0;

    (auditData || []).forEach(audit => {
      if (audit.old_status && audit.new_status && audit.old_status !== audit.new_status) {
        totalReschedules++;
        const reason = audit.notes || 'Ej specificerat';
        rescheduleReasons[reason] = (rescheduleReasons[reason] || 0) + 1;
      }
    });

    const totalCases = ((await supabase.from('private_cases').select('id', { count: 'exact', head: true })).count || 0) +
                      ((await supabase.from('business_cases').select('id', { count: 'exact', head: true })).count || 0);

    const reschedulingData = {
      total_reschedules: totalReschedules,
      reschedule_rate_percent: totalCases > 0 ? (totalReschedules / totalCases) * 100 : 0,
      avg_reschedules_per_case: totalCases > 0 ? totalReschedules / totalCases : 0,
      top_reschedule_reasons: Object.entries(rescheduleReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };

    return {
      scheduling_efficiency: schedulingEfficiency,
      technician_utilization: utilizationData,
      geographic_optimization: geographicData,
      rescheduling_metrics: reschedulingData,
    };

  } catch (error) {
    console.error('Error in getCoordinatorKpiData:', error);
    return null;
  }
};

/**
 * Hämtar schemaläggningseffektivitet över tid
 */
export const getSchedulingEfficiencyTrend = async (
  days: number = 30
): Promise<SchedulingEfficiencyData[]> => {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select('created_at, start_date')
      .not('start_date', 'is', null)
      .gte('created_at', startDate.toISOString());

    const { data: businessCases } = await supabase
      .from('business_cases')
      .select('created_at, start_date')
      .not('start_date', 'is', null)
      .gte('created_at', startDate.toISOString());

    const allCases = [...(privateCases || []), ...(businessCases || [])];

    // Gruppera per dag
    const dailyData: Record<string, { 
      total_cases: number; 
      total_scheduling_time: number; 
      cases_scheduled: number; 
    }> = {};

    allCases.forEach(caseItem => {
      const dateKey = new Date(caseItem.created_at).toISOString().split('T')[0];
      const schedulingTime = (new Date(caseItem.start_date!).getTime() - new Date(caseItem.created_at).getTime()) / (1000 * 60 * 60);
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { total_cases: 0, total_scheduling_time: 0, cases_scheduled: 0 };
      }
      
      dailyData[dateKey].total_cases++;
      dailyData[dateKey].total_scheduling_time += schedulingTime;
      dailyData[dateKey].cases_scheduled++;
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      avg_scheduling_time_hours: data.cases_scheduled > 0 ? data.total_scheduling_time / data.cases_scheduled : 0,
      cases_scheduled: data.cases_scheduled,
      efficiency_score: Math.max(0, Math.min(100, 100 - (data.total_scheduling_time / data.cases_scheduled / 24 * 100))),
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  } catch (error) {
    console.error('Error in getSchedulingEfficiencyTrend:', error);
    return [];
  }
};

/**
 * Hämtar tekniker-utnyttjande data
 */
export const getTechnicianUtilizationData = async (): Promise<TechnicianUtilizationData[]> => {
  try {
    const { data: technicians } = await supabase
      .from('technicians')
      .select('id, name, work_schedule')
      .eq('is_active', true)
      .eq('role', 'Skadedjurstekniker');

    const today = new Date().toISOString().split('T')[0];
    
    const utilizationData: TechnicianUtilizationData[] = [];

    for (const tech of technicians || []) {
      // Beräkna arbetsstunden från work_schedule
      let totalWorkHours = 0;
      if (tech.work_schedule) {
        Object.values(tech.work_schedule).forEach((daySchedule: any) => {
          if (daySchedule?.active) {
            const start = new Date(`2024-01-01 ${daySchedule.start}`);
            const end = new Date(`2024-01-01 ${daySchedule.end}`);
            totalWorkHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          }
        });
      }

      // Hämta schemalagda ärenden för denna vecka
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const { data: privateCases } = await supabase
        .from('private_cases')
        .select('start_date, due_date, pris')
        .eq('primary_assignee_id', tech.id)
        .gte('start_date', weekStart.toISOString())
        .lte('start_date', weekEnd.toISOString());

      const { data: businessCases } = await supabase
        .from('business_cases')
        .select('start_date, due_date, pris')
        .eq('primary_assignee_id', tech.id)
        .gte('start_date', weekStart.toISOString())
        .lte('start_date', weekEnd.toISOString());

      const allCases = [...(privateCases || []), ...(businessCases || [])];
      
      let scheduledHours = 0;
      let totalCaseValue = 0;
      
      allCases.forEach(caseItem => {
        if (caseItem.start_date && caseItem.due_date) {
          const hours = (new Date(caseItem.due_date).getTime() - new Date(caseItem.start_date).getTime()) / (1000 * 60 * 60);
          scheduledHours += hours;
        }
        totalCaseValue += caseItem.pris || 0;
      });

      const utilizationPercent = totalWorkHours > 0 ? (scheduledHours / totalWorkHours) * 100 : 0;
      
      let efficiencyRating: 'low' | 'optimal' | 'overbooked';
      if (utilizationPercent < 60) efficiencyRating = 'low';
      else if (utilizationPercent > 95) efficiencyRating = 'overbooked';
      else efficiencyRating = 'optimal';

      utilizationData.push({
        technician_id: tech.id,
        technician_name: tech.name,
        total_work_hours: totalWorkHours,
        scheduled_hours: scheduledHours,
        utilization_percent: utilizationPercent,
        cases_assigned: allCases.length,
        avg_case_value: allCases.length > 0 ? totalCaseValue / allCases.length : 0,
        efficiency_rating: efficiencyRating,
      });
    }

    return utilizationData.sort((a, b) => b.utilization_percent - a.utilization_percent);

  } catch (error) {
    console.error('Error in getTechnicianUtilizationData:', error);
    return [];
  }
};

/**
 * Hämtar business impact metrics
 */
export const getBusinessImpactMetrics = async (
  startDate?: string,
  endDate?: string
): Promise<BusinessImpactMetrics | null> => {
  try {
    const dateFilter = startDate && endDate ? 
      { gte: startDate, lte: endDate } : 
      { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() };

    // Hämta alla ärenden inom tidsperioden
    const { data: privateCases } = await supabase
      .from('private_cases')
      .select('pris, created_at, start_date, completed_date')
      .gte('created_at', dateFilter.gte)
      .lte('created_at', dateFilter.lte || new Date().toISOString());

    const { data: businessCases } = await supabase
      .from('business_cases')
      .select('pris, created_at, start_date, completed_date')
      .gte('created_at', dateFilter.gte)
      .lte('created_at', dateFilter.lte || new Date().toISOString());

    const allCases = [...(privateCases || []), ...(businessCases || [])];

    const totalRevenue = allCases.reduce((sum, c) => sum + (c.pris || 0), 0);
    
    // Beräkna completion times
    const completedCases = allCases.filter(c => c.completed_date);
    const avgCompletionDays = completedCases.length > 0 
      ? completedCases.reduce((sum, c) => {
          const days = (new Date(c.completed_date!).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / completedCases.length 
      : 0;

    // Enkel beräkning av scheduled hours (skulle behöva mer exakt data)
    const estimatedScheduledHours = allCases.length * 2; // Antag 2 timmar per ärende i genomsnitt
    const revenuePerHour = estimatedScheduledHours > 0 ? totalRevenue / estimatedScheduledHours : 0;

    const casesPerDay = allCases.length / 30; // Antag 30 dagar period

    return {
      total_revenue_managed: totalRevenue,
      avg_case_completion_days: avgCompletionDays,
      revenue_per_scheduled_hour: revenuePerHour,
      case_throughput_per_day: casesPerDay,
      coordination_efficiency_score: Math.min(100, Math.max(0, 100 - (avgCompletionDays * 2))), // Enkel beräkning
      cost_of_rescheduling: 500, // Placeholder - skulle kräva mer detaljerad cost-analys
    };

  } catch (error) {
    console.error('Error in getBusinessImpactMetrics:', error);
    return null;
  }
};

/**
 * Exportera analytics data till CSV-format
 */
export const exportAnalyticsData = async (
  type: 'kpi' | 'efficiency' | 'utilization' | 'impact',
  startDate?: string,
  endDate?: string
): Promise<string> => {
  try {
    let csvData = '';
    
    switch (type) {
      case 'kpi':
        const kpiData = await getCoordinatorKpiData(startDate, endDate);
        if (kpiData) {
          csvData = `Metric,Value\n`;
          csvData += `Avg Hours to Schedule,${kpiData.scheduling_efficiency.avg_hours_to_schedule}\n`;
          csvData += `Scheduled within 24h %,${kpiData.scheduling_efficiency.scheduled_within_24h_percent}\n`;
          csvData += `Avg Utilization %,${kpiData.technician_utilization.avg_utilization_percent}\n`;
          csvData += `Total Reschedules,${kpiData.rescheduling_metrics.total_reschedules}\n`;
        }
        break;
        
      case 'efficiency':
        const efficiencyData = await getSchedulingEfficiencyTrend();
        csvData = `Date,Avg Scheduling Time (hours),Cases Scheduled,Efficiency Score\n`;
        efficiencyData.forEach(item => {
          csvData += `${item.date},${item.avg_scheduling_time_hours},${item.cases_scheduled},${item.efficiency_score}\n`;
        });
        break;
        
      case 'utilization':
        const utilizationData = await getTechnicianUtilizationData();
        csvData = `Technician,Work Hours,Scheduled Hours,Utilization %,Cases Assigned,Efficiency Rating\n`;
        utilizationData.forEach(item => {
          csvData += `${item.technician_name},${item.total_work_hours},${item.scheduled_hours},${item.utilization_percent},${item.cases_assigned},${item.efficiency_rating}\n`;
        });
        break;
        
      case 'impact':
        const impactData = await getBusinessImpactMetrics(startDate, endDate);
        if (impactData) {
          csvData = `Metric,Value\n`;
          csvData += `Total Revenue Managed,${impactData.total_revenue_managed}\n`;
          csvData += `Avg Completion Days,${impactData.avg_case_completion_days}\n`;
          csvData += `Revenue per Hour,${impactData.revenue_per_scheduled_hour}\n`;
          csvData += `Cases per Day,${impactData.case_throughput_per_day}\n`;
        }
        break;
    }
    
    return csvData;
    
  } catch (error) {
    console.error('Error in exportAnalyticsData:', error);
    return '';
  }
};