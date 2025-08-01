// 📁 src/hooks/useCoordinatorAnalytics.ts
// 🎯 Custom hooks för coordinator analytics data

import { useState, useEffect } from 'react';
import {
  getCoordinatorKpiData,
  getSchedulingEfficiencyTrend,
  getTechnicianUtilizationData,
  getBusinessImpactMetrics,
  exportAnalyticsData,
  type CoordinatorKpiData,
  type SchedulingEfficiencyData,
  type TechnicianUtilizationData,
  type BusinessImpactMetrics,
} from '../services/coordinatorAnalyticsService';

// === MAIN COORDINATOR ANALYTICS HOOK ===

export const useCoordinatorAnalytics = (
  startDate?: string,
  endDate?: string,
  autoRefresh: boolean = true
) => {
  const [data, setData] = useState<{
    kpiData: CoordinatorKpiData | null;
    efficiencyTrend: SchedulingEfficiencyData[];
    utilizationData: TechnicianUtilizationData[];
    businessImpact: BusinessImpactMetrics | null;
  }>({
    kpiData: null,
    efficiencyTrend: [],
    utilizationData: [],
    businessImpact: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [kpiData, efficiencyTrend, utilizationData, businessImpact] = await Promise.all([
        getCoordinatorKpiData(startDate, endDate),
        getSchedulingEfficiencyTrend(30),
        getTechnicianUtilizationData(),
        getBusinessImpactMetrics(startDate, endDate),
      ]);

      setData({
        kpiData,
        efficiencyTrend,
        utilizationData,
        businessImpact,
      });
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching coordinator analytics:', err);
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av analytics-data');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchAllData();
  };

  useEffect(() => {
    fetchAllData();
  }, [startDate, endDate]);

  // Auto-refresh var 5:e minut om aktiverat
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAllData();
    }, 5 * 60 * 1000); // 5 minuter

    return () => clearInterval(interval);
  }, [autoRefresh, startDate, endDate]);

  return {
    ...data,
    loading,
    error,
    lastRefresh,
    refresh,
  };
};

// === INDIVIDUAL HOOKS ===

/**
 * Hook för KPI-data
 */
export const useCoordinatorKpiData = (startDate?: string, endDate?: string) => {
  const [data, setData] = useState<CoordinatorKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getCoordinatorKpiData(startDate, endDate);
      setData(result);
    } catch (err) {
      console.error('Error fetching KPI data:', err);
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av KPI-data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  return { data, loading, error, refresh: fetchData };
};

/**
 * Hook för schemaläggningseffektivitet
 */
export const useSchedulingEfficiency = (days: number = 30) => {
  const [data, setData] = useState<SchedulingEfficiencyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getSchedulingEfficiencyTrend(days);
      setData(result);
    } catch (err) {
      console.error('Error fetching scheduling efficiency:', err);
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av schemaläggningsdata');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  return { data, loading, error, refresh: fetchData };
};

/**
 * Hook för tekniker-utnyttjande
 */
export const useTechnicianUtilization = () => {
  const [data, setData] = useState<TechnicianUtilizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getTechnicianUtilizationData();
      setData(result);
    } catch (err) {
      console.error('Error fetching technician utilization:', err);
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av tekniker-utnyttjande');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refresh: fetchData };
};

/**
 * Hook för business impact metrics
 */
export const useBusinessImpactMetrics = (startDate?: string, endDate?: string) => {
  const [data, setData] = useState<BusinessImpactMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getBusinessImpactMetrics(startDate, endDate);
      setData(result);
    } catch (err) {
      console.error('Error fetching business impact metrics:', err);
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av affärspåverkan');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  return { data, loading, error, refresh: fetchData };
};

// === EXPORT HOOK ===

/**
 * Hook för att exportera analytics-data
 */
export const useAnalyticsExport = () => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async (
    type: 'kpi' | 'efficiency' | 'utilization' | 'impact',
    startDate?: string,
    endDate?: string,
    filename?: string
  ) => {
    try {
      setExporting(true);
      setError(null);

      const csvData = await exportAnalyticsData(type, startDate, endDate);
      
      if (!csvData) {
        throw new Error('Ingen data att exportera');
      }

      // Skapa blob och ladda ner
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename || `coordinator-analytics-${type}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
    } catch (err) {
      console.error('Error exporting data:', err);
      setError(err instanceof Error ? err.message : 'Fel vid export av data');
      return false;
    } finally {
      setExporting(false);
    }
  };

  return { exportData, exporting, error };
};

// === UTILITY HOOKS ===

/**
 * Hook för att beräkna jämförelser mellan perioder
 */
export const usePerformanceComparison = (
  currentStartDate: string,
  currentEndDate: string,
  previousStartDate: string,
  previousEndDate: string
) => {
  const [comparison, setComparison] = useState<{
    scheduling_improvement: number;
    utilization_change: number;
    revenue_growth: number;
    efficiency_change: number;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateComparison = async () => {
      try {
        setLoading(true);
        setError(null);

        const [currentData, previousData] = await Promise.all([
          getCoordinatorKpiData(currentStartDate, currentEndDate),
          getCoordinatorKpiData(previousStartDate, previousEndDate),
        ]);

        if (!currentData || !previousData) {
          throw new Error('Kunde inte hämta jämförelsedata');
        }

        const schedulingImprovement = 
          previousData.scheduling_efficiency.avg_hours_to_schedule > 0 
            ? ((previousData.scheduling_efficiency.avg_hours_to_schedule - currentData.scheduling_efficiency.avg_hours_to_schedule) / 
               previousData.scheduling_efficiency.avg_hours_to_schedule) * 100
            : 0;

        const utilizationChange = 
          currentData.technician_utilization.avg_utilization_percent - 
          previousData.technician_utilization.avg_utilization_percent;

        // För revenue och efficiency skulle vi behöva mer komplex beräkning
        // Detta är en förenklad version
        const revenueGrowth = 15; // Placeholder
        const efficiencyChange = 8; // Placeholder

        setComparison({
          scheduling_improvement: schedulingImprovement,
          utilization_change: utilizationChange,
          revenue_growth: revenueGrowth,
          efficiency_change: efficiencyChange,
        });

      } catch (err) {
        console.error('Error calculating comparison:', err);
        setError(err instanceof Error ? err.message : 'Fel vid beräkning av jämförelse');
        setComparison(null);
      } finally {
        setLoading(false);
      }
    };

    calculateComparison();
  }, [currentStartDate, currentEndDate, previousStartDate, previousEndDate]);

  return { comparison, loading, error };
};

/**
 * Hook för real-time notifieringar om viktiga events
 */
export const useAnalyticsAlerts = () => {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'warning' | 'success' | 'info' | 'error';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

  const { kpiData } = useCoordinatorKpiData();

  useEffect(() => {
    if (!kpiData) return;

    const newAlerts = [];

    // Kontrollera om schemaläggningen är långsam
    if (kpiData.scheduling_efficiency.avg_hours_to_schedule > 48) {
      newAlerts.push({
        id: 'slow-scheduling',
        type: 'warning' as const,
        title: 'Långsam schemaläggning',
        message: `Genomsnittlig schemaläggning tar ${kpiData.scheduling_efficiency.avg_hours_to_schedule.toFixed(1)} timmar`,
        timestamp: new Date(),
      });
    }

    // Kontrollera om tekniker-utnyttjandet är lågt
    if (kpiData.technician_utilization.avg_utilization_percent < 60) {
      newAlerts.push({
        id: 'low-utilization',
        type: 'info' as const,
        title: 'Lågt tekniker-utnyttjande',
        message: `Genomsnittligt utnyttjande är ${kpiData.technician_utilization.avg_utilization_percent.toFixed(1)}%`,
        timestamp: new Date(),
      });
    }

    // Kontrollera om omschemaläggningar är höga
    if (kpiData.rescheduling_metrics.reschedule_rate_percent > 20) {
      newAlerts.push({
        id: 'high-reschedules',
        type: 'error' as const,
        title: 'Höga omschemaläggningar',
        message: `${kpiData.rescheduling_metrics.reschedule_rate_percent.toFixed(1)}% av ärenden omschemaläggs`,
        timestamp: new Date(),
      });
    }

    setAlerts(newAlerts);
  }, [kpiData]);

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  return { alerts, dismissAlert };
};