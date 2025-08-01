// 📁 src/pages/coordinator/CoordinatorAnalytics.tsx
// 🎯 Koordinator Analytics Dashboard - Deep insights för koordinatorns påverkan

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  Users, 
  MapPin, 
  Clock, 
  DollarSign,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  Target,
  Activity,
  Zap
} from 'lucide-react';

import { PageHeader } from '../../components/shared';
import Button from '../../components/ui/Button';
import { useCoordinatorAnalytics, useAnalyticsExport, useAnalyticsAlerts } from '../../hooks/useCoordinatorAnalytics';
import { formatCurrency, formatDate } from '../../utils/formatters';
import SchedulingEfficiencyChart from '../../components/admin/coordinator/SchedulingEfficiencyChart';
import TechnicianUtilizationGrid from '../../components/admin/coordinator/TechnicianUtilizationGrid';
import BusinessImpactCards from '../../components/admin/coordinator/BusinessImpactCards';
import GeographicOptimizationMap from '../../components/admin/coordinator/GeographicOptimizationMap';


const AlertsPanel = ({ alerts, onDismiss }: { alerts: any[]; onDismiss: (id: string) => void }) => {
  if (!alerts.length) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className={`p-4 rounded-lg border flex items-start gap-3 ${
          alert.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
          alert.type === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
          alert.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
          'bg-blue-500/10 border-blue-500/30'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {alert.type === 'error' ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
             alert.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-orange-400" /> :
             alert.type === 'success' ? <CheckCircle className="w-4 h-4 text-green-400" /> :
             <Info className="w-4 h-4 text-blue-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold text-sm ${
              alert.type === 'error' ? 'text-red-300' :
              alert.type === 'warning' ? 'text-orange-300' :
              alert.type === 'success' ? 'text-green-300' :
              'text-blue-300'
            }`}>
              {alert.title}
            </h4>
            <p className="text-xs text-slate-400 mt-1">{alert.message}</p>
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default function CoordinatorAnalytics() {
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const {
    kpiData,
    efficiencyTrend,
    utilizationData,
    businessImpact,
    loading,
    error,
    lastRefresh,
    refresh,
  } = useCoordinatorAnalytics(dateRange.startDate, dateRange.endDate);

  const { exportData, exporting } = useAnalyticsExport();
  const { alerts, dismissAlert } = useAnalyticsAlerts();

  const kpiMetrics = useMemo(() => {
    if (!kpiData) return [];
    
    return [
      {
        title: 'Genomsnittlig schemaläggning',
        value: `${kpiData.scheduling_efficiency.avg_hours_to_schedule.toFixed(1)}h`,
        description: 'Tid från skapande till schemalagd tid',
        icon: Clock,
        color: 'blue',
        trend: kpiData.scheduling_efficiency.avg_hours_to_schedule < 24 ? 'up' : 'down',
      },
      {
        title: 'Tekniker-utnyttjande',
        value: `${kpiData.technician_utilization.avg_utilization_percent.toFixed(1)}%`,
        description: 'Genomsnittligt kapacitetsutnyttjande',
        icon: Users,
        color: 'purple',
        trend: kpiData.technician_utilization.avg_utilization_percent > 70 ? 'up' : 'down',
      },
      {
        title: 'Schemalagda inom 24h',
        value: `${kpiData.scheduling_efficiency.scheduled_within_24h_percent.toFixed(1)}%`,
        description: 'Ärenden schemalagda inom ett dygn',
        icon: Target,
        color: 'green',
        trend: kpiData.scheduling_efficiency.scheduled_within_24h_percent > 80 ? 'up' : 'down',
      },
      {
        title: 'Omschemaläggningar',
        value: `${kpiData.rescheduling_metrics.reschedule_rate_percent.toFixed(1)}%`,
        description: 'Andel ärenden som omschemaläggs',
        icon: RefreshCw,
        color: 'orange',
        trend: kpiData.rescheduling_metrics.reschedule_rate_percent < 15 ? 'up' : 'down',
      },
    ];
  }, [kpiData]);

  const handleExport = async (type: 'kpi' | 'efficiency' | 'utilization' | 'impact') => {
    await exportData(type, dateRange.startDate, dateRange.endDate);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto p-6 md:p-8">
          <PageHeader 
            title="Koordinator Analytics"
            showBackButton={true}
            backButtonProps={{ href: '/koordinator' }}
          />
          
          <div className="bg-red-900/20 border border-red-500/30 text-red-300 p-6 rounded-lg flex items-center gap-4">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <p className="font-bold">Fel vid laddning av analytics</p>
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="secondary" onClick={refresh} className="ml-auto">
              <RefreshCw className="w-4 h-4 mr-2" />
              Försök igen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        
        <PageHeader 
          title="Koordinator Analytics"
          showBackButton={true}
          backButtonProps={{ href: '/koordinator' }}
        />

        {/* Controls och Alerts */}
        <div className="mb-8 space-y-6">
          {/* Date Range och Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                />
                <span className="text-slate-400">till</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              
              {lastRefresh && (
                <p className="text-xs text-slate-500">
                  Senast uppdaterad: {lastRefresh.toLocaleTimeString('sv-SE')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={refresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera
              </Button>
              
              <div className="relative group">
                <Button variant="secondary" disabled={exporting}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportera
                </Button>
                
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => handleExport('kpi')}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                    >
                      KPI Data
                    </button>
                    <button
                      onClick={() => handleExport('efficiency')}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                    >
                      Schemaläggningseffektivitet
                    </button>
                    <button
                      onClick={() => handleExport('utilization')}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                    >
                      Tekniker-utnyttjande
                    </button>
                    <button
                      onClick={() => handleExport('impact')}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded"
                    >
                      Affärspåverkan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Viktiga uppmärksamheter
              </h3>
              <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
            </div>
          )}
        </div>

        {/* KPI Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Koordinator Impact Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {kpiMetrics.map((metric, index) => (
              <div key={index} className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 bg-${metric.color}-500/20 rounded-lg`}>
                    <metric.icon className={`w-5 h-5 text-${metric.color}-400`} />
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    metric.trend === 'up' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                </div>
                
                <div>
                  <p className="text-2xl font-bold text-white mb-1">
                    {loading ? (
                      <span className="bg-slate-700 rounded w-16 h-8 inline-block animate-pulse" />
                    ) : (
                      metric.value
                    )}
                  </p>
                  <p className="text-sm font-medium text-slate-300 mb-1">{metric.title}</p>
                  <p className="text-xs text-slate-500">{metric.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Business Impact Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Affärspåverkan</h2>
          <BusinessImpactCards data={businessImpact} loading={loading} />
        </section>

        {/* Charts och Analysis */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-12">
          {/* Scheduling Efficiency Chart */}
          <SchedulingEfficiencyChart data={efficiencyTrend} loading={loading} />
          
          {/* Technician Utilization */}
          <TechnicianUtilizationGrid 
            data={utilizationData} 
            loading={loading}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
          />
        </div>

        {/* Geographic Optimization */}
        <section className="mb-12">
          <GeographicOptimizationMap data={kpiData} loading={loading} />
        </section>

        {/* Recommendations */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">Rekommendationer</h2>
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
            <div className="space-y-4">
              {kpiData?.scheduling_efficiency.avg_hours_to_schedule > 24 && (
                <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-300">Förbättra schemaläggningshastighet</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Genomsnittlig schemaläggning tar över 24 timmar. Överväg att automatisera delar av processen eller allokera mer tid för schemaläggning.
                    </p>
                  </div>
                </div>
              )}
              
              {kpiData?.technician_utilization.underutilized_technicians > 0 && (
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-300">Balansera tekniker-arbetsbörda</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      {kpiData.technician_utilization.underutilized_technicians} tekniker har lågt utnyttjande. 
                      Överväg att omfördela ärenden för bättre balans.
                    </p>
                  </div>
                </div>
              )}
              
              {kpiData?.rescheduling_metrics.reschedule_rate_percent > 15 && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-300">Minska omschemaläggningar</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Hög andel omschemaläggningar påverkar effektiviteten. Analysera de vanligaste orsakerna och förbättra initial planering.
                    </p>
                  </div>
                </div>
              )}

              {/* Success message when everything looks good */}
              {kpiData && 
               kpiData.scheduling_efficiency.avg_hours_to_schedule <= 24 &&
               kpiData.technician_utilization.underutilized_technicians === 0 &&
               kpiData.rescheduling_metrics.reschedule_rate_percent <= 15 && (
                <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-300">Utmärkt koordinering!</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Alla nyckeltal ser bra ut. Fortsätt med nuvarande arbetssätt och fokusera på kontinuerlig förbättring.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}