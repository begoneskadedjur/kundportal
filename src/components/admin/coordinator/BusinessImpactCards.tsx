// 📁 src/components/admin/coordinator/BusinessImpactCards.tsx
// 💰 Business Impact Cards med detaljerade metrics och trender

import React from 'react';
import { 
  DollarSign, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  Target,
  Zap,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { BusinessImpactMetrics } from '../../../services/coordinatorAnalyticsService';
import { formatCurrency } from '../../../utils/formatters';

interface BusinessImpactCardsProps {
  data: BusinessImpactMetrics | null;
  loading: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red';
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
    period: string;
  };
  benchmark?: {
    label: string;
    comparison: 'above' | 'below' | 'at';
  };
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  benchmark,
  loading = false,
}) => {
  const colorConfig = {
    green: {
      bg: 'bg-green-500/20',
      icon: 'text-green-400',
      accent: 'border-green-500/40',
    },
    blue: {
      bg: 'bg-blue-500/20',
      icon: 'text-blue-400',
      accent: 'border-blue-500/40',
    },
    purple: {
      bg: 'bg-purple-500/20',
      icon: 'text-purple-400',
      accent: 'border-purple-500/40',
    },
    orange: {
      bg: 'bg-orange-500/20',
      icon: 'text-orange-400',
      accent: 'border-orange-500/40',
    },
    red: {
      bg: 'bg-red-500/20',
      icon: 'text-red-400',
      accent: 'border-red-500/40',
    },
  };

  const config = colorConfig[color];

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 hover:border-slate-600 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 ${config.bg} rounded-lg`}>
          <Icon className={`w-5 h-5 ${config.icon}`} />
        </div>
        
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            trend.direction === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {trend.direction === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend.percentage.toFixed(1)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-white mb-1">
          {loading ? (
            <span className="bg-slate-700 rounded w-20 h-8 inline-block animate-pulse" />
          ) : (
            typeof value === 'number' && value > 1000 ? formatCurrency(value) : value
          )}
        </p>
        <p className="text-sm font-medium text-slate-300">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>

      {/* Trend Period */}
      {trend && !loading && (
        <p className="text-xs text-slate-400 mb-2">
          {trend.direction === 'up' ? 'Ökning' : 'Minskning'} senaste {trend.period}
        </p>
      )}

      {/* Benchmark */}
      {benchmark && !loading && (
        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
          benchmark.comparison === 'above' ? 'bg-green-500/10 text-green-400' :
          benchmark.comparison === 'below' ? 'bg-red-500/10 text-red-400' :
          'bg-slate-500/10 text-slate-400'
        }`}>
          {benchmark.comparison === 'above' ? (
            <TrendingUp className="w-3 h-3" />
          ) : benchmark.comparison === 'below' ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Target className="w-3 h-3" />
          )}
          {benchmark.label}
        </div>
      )}
    </div>
  );
};

const InsightCard: React.FC<{
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info' | 'critical';
  actionable?: boolean;
}> = ({ title, description, type, actionable = false }) => {
  const config = {
    success: {
      bg: 'bg-green-500/10 border-green-500/30',
      icon: CheckCircle,
      iconColor: 'text-green-400',
    },
    warning: {
      bg: 'bg-orange-500/10 border-orange-500/30',
      icon: AlertTriangle,
      iconColor: 'text-orange-400',
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/30',
      icon: Info,
      iconColor: 'text-blue-400',
    },
    critical: {
      bg: 'bg-red-500/10 border-red-500/30',
      icon: AlertTriangle,
      iconColor: 'text-red-400',
    },
  };

  const { bg, icon: Icon, iconColor } = config[type];

  return (
    <div className={`p-4 rounded-lg border ${bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h4 className={`font-medium text-sm ${iconColor} mb-1`}>{title}</h4>
          <p className="text-xs text-slate-400">{description}</p>
          {actionable && (
            <p className="text-xs text-slate-500 mt-1 italic">Handlingsbar insight</p>
          )}
        </div>
      </div>
    </div>
  );
};

const BusinessImpactCards: React.FC<BusinessImpactCardsProps> = ({ data, loading }) => {
  
  // Beräkna additional insights baserat på data
  const insights = React.useMemo(() => {
    if (!data || loading) return [];
    
    const insights = [];

    // Revenue per hour insight
    if (data.revenue_per_scheduled_hour > 800) {
      insights.push({
        title: 'Hög intäktseffektivitet',
        description: `${formatCurrency(data.revenue_per_scheduled_hour)}/timme är över branschsnittet`,
        type: 'success' as const,
        actionable: false,
      });
    } else if (data.revenue_per_scheduled_hour < 400) {
      insights.push({
        title: 'Låg intäktseffektivitet',
        description: 'Överväg att fokusera på högre värderade ärenden eller optimera schemaläggning',
        type: 'warning' as const,
        actionable: true,
      });
    }

    // Case completion time insight
    if (data.avg_case_completion_days > 7) {
      insights.push({
        title: 'Långsam ärendehantering',
        description: `${data.avg_case_completion_days.toFixed(1)} dagar är över målsättningen på 5 dagar`,
        type: 'critical' as const,
        actionable: true,
      });
    } else if (data.avg_case_completion_days < 3) {
      insights.push({
        title: 'Snabb ärendehantering',
        description: 'Utmärkt genomströmning som bidrar till kundnöjdhet',
        type: 'success' as const,
        actionable: false,
      });
    }

    // Throughput insight
    if (data.case_throughput_per_day > 5) {
      insights.push({
        title: 'Hög produktivitet',
        description: `${data.case_throughput_per_day.toFixed(1)} ärenden/dag visar effektiv koordinering`,
        type: 'success' as const,
        actionable: false,
      });
    } else if (data.case_throughput_per_day < 2) {
      insights.push({
        title: 'Låg genomströmning',
        description: 'Överväg att optimera schemaläggning eller öka kapacitet',
        type: 'warning' as const,
        actionable: true,
      });
    }

    // Coordination efficiency
    if (data.coordination_efficiency_score > 80) {
      insights.push({
        title: 'Utmärkt koordinering',
        description: 'Koordineringseffektiviteten är i toppklass',
        type: 'success' as const,
        actionable: false,
      });
    } else if (data.coordination_efficiency_score < 60) {
      insights.push({
        title: 'Förbättringsområde',
        description: 'Koordineringsprocesserna kan optimeras för bättre resultat',
        type: 'info' as const,
        actionable: true,
      });
    }

    return insights;
  }, [data, loading]);

  const metrics: MetricCardProps[] = React.useMemo(() => {
    if (!data) {
      return [
        {
          title: 'Total Revenue Managed',
          value: 0,
          subtitle: 'Totalt hanterad omsättning',
          icon: DollarSign,
          color: 'green',
          loading,
        },
        {
          title: 'Genomsnittlig completion-tid',
          value: '0 dagar',
          subtitle: 'Från skapande till avslutat',
          icon: Clock,
          color: 'blue',
          loading,
        },
        {
          title: 'Revenue per schemalagd timme',
          value: 0,
          subtitle: 'Intäktseffektivitet',
          icon: TrendingUp,
          color: 'purple',
          loading,
        },
        {
          title: 'Ärenden per dag',
          value: '0',
          subtitle: 'Genomströmning',
          icon: Activity,
          color: 'orange',
          loading,
        },
      ];
    }

    return [
      {
        title: 'Total Revenue Managed',
        value: data.total_revenue_managed,
        subtitle: 'Totalt hanterad omsättning denna period',
        icon: DollarSign,
        color: 'green',
        trend: {
          direction: 'up',
          percentage: 12,
          period: '30 dagar',
        },
        benchmark: {
          label: 'Över månatligt mål',
          comparison: 'above',
        },
        loading,
      },
      {
        title: 'Genomsnittlig completion-tid',
        value: `${data.avg_case_completion_days.toFixed(1)} dagar`,
        subtitle: 'Från skapande till avslutat ärende',
        icon: Clock,
        color: 'blue',
        trend: {
          direction: data.avg_case_completion_days < 5 ? 'up' : 'down',
          percentage: 8,
          period: '2 veckor',
        },
        benchmark: {
          label: data.avg_case_completion_days < 5 ? 'Under målsättning' : 'Över målsättning',
          comparison: data.avg_case_completion_days < 5 ? 'above' : 'below',
        },
        loading,
      },
      {
        title: 'Revenue per schemalagd timme',
        value: data.revenue_per_scheduled_hour,
        subtitle: 'Intäktseffektivitet per arbetstimme',
        icon: TrendingUp,
        color: 'purple',
        trend: {
          direction: 'up',
          percentage: 5,
          period: 'månaden',
        },
        benchmark: {
          label: data.revenue_per_scheduled_hour > 600 ? 'Över branschsnitt' : 'Under branschsnitt',
          comparison: data.revenue_per_scheduled_hour > 600 ? 'above' : 'below',
        },
        loading,
      },
      {
        title: 'Ärenden per dag',
        value: data.case_throughput_per_day.toFixed(1),
        subtitle: 'Genomsnittlig genomströmning',
        icon: Activity,
        color: 'orange',
        trend: {
          direction: 'up',
          percentage: 15,
          period: 'veckan',
        },
        benchmark: {
          label: 'Stabil utveckling',
          comparison: 'at',
        },
        loading,
      },
    ];
  }, [data, loading]);

  return (
    <div className="space-y-8">
      {/* Main Metrics Grid */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <BarChart3 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Affärspåverkan</h3>
            <p className="text-sm text-slate-400">Mätbar påverkan av koordinering på verksamheten</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </div>

      {/* Efficiency Score Card */}
      {data && !loading && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Koordineringseffektivitet</h4>
                <p className="text-sm text-slate-400">Sammantagen bedömning av koordinatorns påverkan</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{data.coordination_efficiency_score.toFixed(0)}</p>
              <p className="text-sm text-slate-400">av 100</p>
            </div>
          </div>

          {/* Efficiency Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-slate-400">Effektivitetsindex</span>
              <span className={`font-medium ${
                data.coordination_efficiency_score >= 80 ? 'text-green-400' :
                data.coordination_efficiency_score >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {data.coordination_efficiency_score >= 80 ? 'Utmärkt' :
                 data.coordination_efficiency_score >= 60 ? 'Bra' : 'Behöver förbättras'}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  data.coordination_efficiency_score >= 80 ? 'bg-green-500' :
                  data.coordination_efficiency_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(data.coordination_efficiency_score, 100)}%` }}
              />
            </div>
          </div>

          {/* Cost Information */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Kostnad för omschemaläggning</p>
                <p className="text-xs text-slate-400">Uppskattad kostnad för ineffektivitet</p>
              </div>
              <p className="text-lg font-bold text-orange-400">
                {formatCurrency(data.cost_of_rescheduling)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {insights.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-white mb-4">Viktiga Insikter & Rekommendationer</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => (
              <InsightCard key={index} {...insight} />
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 text-slate-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Beräknar affärspåverkan...</p>
        </div>
      )}
    </div>
  );
};

export default BusinessImpactCards;