// 📁 src/components/admin/coordinator/TechnicianUtilizationGrid.tsx
// 👥 Interaktiv grid för tekniker-utnyttjande med detaljerad analys

import React, { useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Activity,
  Calendar,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { TechnicianUtilizationData } from '../../../services/coordinatorAnalyticsService';
import { formatCurrency } from '../../../utils/formatters';

interface TechnicianUtilizationGridProps {
  data: TechnicianUtilizationData[];
  loading: boolean;
  startDate: string;
  endDate: string;
}

const EfficiencyBadge: React.FC<{ rating: 'low' | 'optimal' | 'overbooked' }> = ({ rating }) => {
  const config = {
    low: {
      color: 'bg-red-500/20 text-red-400 border-red-500/40',
      icon: TrendingDown,
      text: 'Låg',
    },
    optimal: {
      color: 'bg-green-500/20 text-green-400 border-green-500/40',
      icon: CheckCircle,
      text: 'Optimal',
    },
    overbooked: {
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
      icon: AlertTriangle,
      text: 'Överbokad',
    },
  };

  const { color, icon: Icon, text } = config[rating];

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="w-3 h-3" />
      {text}
    </div>
  );
};

const UtilizationBar: React.FC<{ 
  percentage: number; 
  optimal?: boolean;
  showPercentage?: boolean;
}> = ({ percentage, optimal = false, showPercentage = true }) => {
  const getColor = () => {
    if (percentage < 60) return 'bg-red-500';
    if (percentage > 95) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getBackgroundColor = () => {
    if (percentage < 60) return 'bg-red-500/20';
    if (percentage > 95) return 'bg-orange-500/20';
    return 'bg-green-500/20';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 h-2 rounded-full ${getBackgroundColor()}`}>
        <div 
          className={`h-full rounded-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs font-medium text-white w-10 text-right">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
};

const TechnicianCard: React.FC<{ 
  technician: TechnicianUtilizationData;
  rank: number;
  expanded: boolean;
  onToggleExpand: () => void;
  periodInfo: { label: string; suffix: string };
}> = ({ technician, rank, expanded, onToggleExpand, periodInfo }) => {
  
  const getRankColor = (position: number) => {
    if (position <= 3) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    if (position <= 6) return 'bg-teal-500/20 text-teal-400 border-teal-500/40';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
  };

  const getHoursColor = (utilization: number) => {
    if (utilization < 60) return 'text-red-400';
    if (utilization > 95) return 'text-orange-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-all">
      {/* Main Card Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${getRankColor(rank)}`}>
              {rank}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-white">{technician.technician_name}</h4>
                {/* Frånvaro-status badges */}
                {technician.total_work_hours === 0 ? (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40">
                    <AlertTriangle className="w-3 h-3" />
                    Helt frånvarande
                  </div>
                ) : technician.absence_hours && technician.absence_hours > 0 ? (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/40">
                    <Clock className="w-3 h-3" />
                    Delvis frånvarande
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-slate-400">{technician.cases_assigned} ärenden {periodInfo.label}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <EfficiencyBadge rating={technician.efficiency_rating} />
            <button
              onClick={onToggleExpand}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              {expanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Utilization Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Kapacitetsutnyttjande</span>
            <span className={`text-xs font-medium ${getHoursColor(technician.utilization_percent)}`}>
              {technician.scheduled_hours.toFixed(1)}h / {technician.total_work_hours.toFixed(1)}h
            </span>
          </div>
          <UtilizationBar percentage={technician.utilization_percent} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {technician.avg_case_value > 0 ? formatCurrency(technician.avg_case_value) : '—'}
            </p>
            <p className="text-xs text-slate-400">Snitt ärendevärde</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{technician.utilization_percent.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">Utnyttjande</p>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-slate-700 p-4 bg-slate-800/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-teal-400" />
                <span className="text-slate-400">Arbetstid</span>
              </div>
              <p className="text-white font-medium">
                {technician.total_work_hours.toFixed(1)}h{periodInfo.suffix}
                {technician.absence_hours && technician.absence_hours > 0 && (
                  <span className="text-orange-400 text-xs ml-1">
                    ({technician.original_work_hours?.toFixed(1)}h före frånvaro)
                  </span>
                )}
              </p>
            </div>
            
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-green-400" />
                <span className="text-slate-400">Schemalagt</span>
              </div>
              <p className="text-white font-medium">{technician.scheduled_hours.toFixed(1)}h</p>
            </div>
            
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Activity className="w-3 h-3 text-purple-400" />
                <span className="text-slate-400">Ärenden</span>
              </div>
              <p className="text-white font-medium">{technician.cases_assigned} st</p>
            </div>
            
            <div>
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-orange-400" />
                <span className="text-slate-400">Effektivitet</span>
              </div>
              <p className="text-white font-medium capitalize">{technician.efficiency_rating}</p>
            </div>
          </div>

          {/* Frånvaro-information om tillämpligt */}
          {technician.absence_hours && technician.absence_hours > 0 && (
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-orange-400 text-sm mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Frånvaro denna vecka</span>
              </div>
              <p className="text-xs text-slate-400">
                {technician.absence_hours.toFixed(1)} timmar frånvarande av ursprungliga {technician.original_work_hours?.toFixed(1)}h arbetstid
              </p>
            </div>
          )}

          {/* Recommendations */}
          <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
            <h5 className="text-sm font-medium text-white mb-2">Rekommendationer:</h5>
            <div className="text-xs text-slate-300 space-y-1">
              {technician.total_work_hours === 0 ? (
                <p>• Tekniker är helt frånvarande denna period - ingen kapacitet tillgänglig</p>
              ) : technician.absence_hours && technician.absence_hours > 0 ? (
                <p>• Tekniker är delvis frånvarande - mäts mot reducerad arbetstid ({technician.total_work_hours.toFixed(1)}h)</p>
              ) : (
                <>
                  {technician.efficiency_rating === 'low' && (
                    <p>• Överväg att tilldela fler ärenden för att öka utnyttjandet (målsättning: 70-90%)</p>
                  )}
                  {technician.efficiency_rating === 'overbooked' && (
                    <p>• Risk för utbrändhet - omfördela några ärenden för bättre balans</p>
                  )}
                  {technician.efficiency_rating === 'optimal' && (
                    <p>• Perfekt balans - fortsätt med nuvarande nivå (70-90% utnyttjande)</p>
                  )}
                </>
              )}
              {technician.avg_case_value < 1000 && technician.avg_case_value > 0 && (
                <p>• Fokusera på högre värderade ärenden för bättre lönsamhet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TechnicianUtilizationGrid: React.FC<TechnicianUtilizationGridProps> = ({ 
  data, 
  loading,
  startDate,
  endDate
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'utilization' | 'cases' | 'value'>('utilization');

  // Beräkna period-information
  const getPeriodInfo = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
      return { label: 'denna vecka', suffix: '/vecka' };
    } else if (diffDays <= 31) {
      return { label: 'denna månaden', suffix: '/månad' };
    } else if (diffDays <= 92) {
      return { label: 'detta kvartal', suffix: '/kvartal' };
    } else {
      return { label: 'denna period', suffix: '/period' };
    }
  };

  const periodInfo = getPeriodInfo();

  const toggleExpand = (technicianId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(technicianId)) {
      newExpanded.delete(technicianId);
    } else {
      newExpanded.add(technicianId);
    }
    setExpandedCards(newExpanded);
  };

  const sortedData = React.useMemo(() => {
    if (!data.length) return [];
    
    return [...data].sort((a, b) => {
      switch (sortBy) {
        case 'utilization':
          return b.utilization_percent - a.utilization_percent;
        case 'cases':
          return b.cases_assigned - a.cases_assigned;
        case 'value':
          return b.avg_case_value - a.avg_case_value;
        default:
          return 0;
      }
    });
  }, [data, sortBy]);

  const stats = React.useMemo(() => {
    if (!data.length) return null;
    
    const avgUtilization = data.reduce((sum, t) => sum + t.utilization_percent, 0) / data.length;
    const totalCases = data.reduce((sum, t) => sum + t.cases_assigned, 0);
    const totalScheduledHours = data.reduce((sum, t) => sum + t.scheduled_hours, 0);
    const totalWorkHours = data.reduce((sum, t) => sum + t.total_work_hours, 0);
    
    const lowUtilization = data.filter(t => t.efficiency_rating === 'low').length;
    const optimal = data.filter(t => t.efficiency_rating === 'optimal').length;
    const overbooked = data.filter(t => t.efficiency_rating === 'overbooked').length;

    return {
      avgUtilization,
      totalCases,
      totalScheduledHours,
      totalWorkHours,
      distribution: { lowUtilization, optimal, overbooked },
    };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Tekniker-utnyttjande</h3>
            <p className="text-sm text-slate-400">Kapacitetsutnyttjande per tekniker</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-900/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Tekniker-utnyttjande</h3>
            <p className="text-sm text-slate-400">Kapacitetsutnyttjande per tekniker</p>
          </div>
        </div>
        
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-slate-300 mb-2">Ingen tekniker-data</h4>
          <p className="text-sm text-slate-500">Inga aktiva tekniker hittades för analys</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Tekniker-utnyttjande</h3>
            <p className="text-sm text-slate-400">{data.length} aktiva tekniker {periodInfo.label}</p>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Sortera:</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
          >
            <option value="utilization">Utnyttjande</option>
            <option value="cases">Antal ärenden</option>
            <option value="value">Ärendevärde</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.avgUtilization.toFixed(1)}%</p>
            <p className="text-xs text-slate-400">Genomsnittligt utnyttjande</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.totalCases}</p>
            <p className="text-xs text-slate-400">Total ärenden</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.totalScheduledHours.toFixed(0)}h</p>
            <p className="text-xs text-slate-400">Schemalagda timmar</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-white">{stats.distribution.optimal}</p>
            <p className="text-xs text-slate-400">Optimalt utnyttjade</p>
          </div>
        </div>
      )}

      {/* Efficiency Distribution */}
      {stats && (
        <div className="mb-6 p-4 bg-slate-900/30 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-3">Effektivitetsfördelning</h4>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-slate-400">Låg utnyttjande: {stats.distribution.lowUtilization}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-slate-400">Optimal: {stats.distribution.optimal}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-slate-400">Överbokad: {stats.distribution.overbooked}</span>
            </div>
          </div>
        </div>
      )}

      {/* Technician Cards */}
      <div className="space-y-4">
        {sortedData.map((technician, index) => (
          <TechnicianCard
            key={technician.technician_id}
            technician={technician}
            rank={index + 1}
            expanded={expandedCards.has(technician.technician_id)}
            onToggleExpand={() => toggleExpand(technician.technician_id)}
            periodInfo={periodInfo}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setExpandedCards(new Set(data.map(t => t.technician_id)))}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Expandera alla
        </button>
        <button
          onClick={() => setExpandedCards(new Set())}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Minimera alla
        </button>
      </div>
    </div>
  );
};

export default TechnicianUtilizationGrid;