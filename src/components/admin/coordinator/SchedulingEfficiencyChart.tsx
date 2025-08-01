// 📁 src/components/admin/coordinator/SchedulingEfficiencyChart.tsx
// 📊 Interaktivt diagram för schemaläggningseffektivitet

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Clock, Target, RefreshCw, Info } from 'lucide-react';
import { SchedulingEfficiencyData } from '../../../services/coordinatorAnalyticsService';

interface SchedulingEfficiencyChartProps {
  data: SchedulingEfficiencyData[];
  loading: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium mb-2">
          {new Date(label).toLocaleDateString('sv-SE', { 
            month: 'short', 
            day: 'numeric',
            weekday: 'short'
          })}
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Genomsnittlig tid:</span>
            <span className="text-blue-400 font-medium">
              {data.avg_scheduling_time_hours.toFixed(1)}h
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Ärenden schemalagda:</span>
            <span className="text-white font-medium">{data.cases_scheduled}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Effektivitetsindex:</span>
            <span className={`font-medium ${
              data.efficiency_score >= 80 ? 'text-green-400' :
              data.efficiency_score >= 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {data.efficiency_score.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const SchedulingEfficiencyChart: React.FC<SchedulingEfficiencyChartProps> = ({ 
  data, 
  loading 
}) => {
  
  // Beräkna trender och statistik
  const stats = React.useMemo(() => {
    if (!data.length) return null;
    
    const avgSchedulingTime = data.reduce((sum, d) => sum + d.avg_scheduling_time_hours, 0) / data.length;
    const avgEfficiencyScore = data.reduce((sum, d) => sum + d.efficiency_score, 0) / data.length;
    const totalCasesScheduled = data.reduce((sum, d) => sum + d.cases_scheduled, 0);
    
    // Beräkna trend (jämför första och sista hälften)
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.avg_scheduling_time_hours, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.avg_scheduling_time_hours, 0) / secondHalf.length;
    
    const trend = firstHalfAvg > secondHalfAvg ? 'improving' : 'declining';
    const trendPercent = Math.abs(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100);
    
    return {
      avgSchedulingTime,
      avgEfficiencyScore,
      totalCasesScheduled,
      trend,
      trendPercent,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Schemaläggningseffektivitet</h3>
            <p className="text-sm text-slate-400">Hur snabbt ärenden får schemalagd tid</p>
          </div>
        </div>
        
        <div className="h-64 bg-slate-900/50 rounded-lg animate-pulse flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Schemaläggningseffektivitet</h3>
            <p className="text-sm text-slate-400">Hur snabbt ärenden får schemalagd tid</p>
          </div>
        </div>
        
        <div className="h-64 bg-slate-900/50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Clock className="w-12 h-12 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400">Ingen data tillgänglig</p>
            <p className="text-xs text-slate-500 mt-1">Schemalägg några ärenden för att se trender</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Schemaläggningseffektivitet</h3>
            <p className="text-sm text-slate-400">Utveckling över {data.length} dagar</p>
          </div>
        </div>
        
        {stats && (
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-slate-400">Genomsnitt</p>
              <p className="text-white font-medium">{stats.avgSchedulingTime.toFixed(1)}h</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400">Trend</p>
              <div className="flex items-center gap-1">
                {stats.trend === 'improving' ? (
                  <TrendingDown className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                )}
                <span className={`font-medium ${
                  stats.trend === 'improving' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stats.trendPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Measurement Info Box */}
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Hur mäts schemaläggningseffektivitet?</h4>
            <div className="text-sm text-slate-300 space-y-1">
              <p>• <strong>Genomsnittlig tid:</strong> Tid från ärendets skapande till schemalagd starttid</p>
              <p>• <strong>Effektivitetsindex:</strong> Beräknas som 100 - (genomsnittlig tid i timmar / 24 × 100)</p>
              <p>• <strong>Målsättning:</strong> Alla ärenden ska schemaläggs inom 24 timmar för 80% effektivitet</p>
              <p>• <strong>Toppklass:</strong> Under 12 timmar ger över 95% effektivitetsindex</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl font-bold text-white">{stats.avgSchedulingTime.toFixed(1)}h</p>
            <p className="text-xs text-slate-400">Genomsnittlig tid</p>
          </div>
          
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-xl font-bold text-white">{stats.avgEfficiencyScore.toFixed(0)}%</p>
            <p className="text-xs text-slate-400">Effektivitetsindex</p>
          </div>
          
          <div className="bg-slate-900/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xl font-bold text-white">{stats.totalCasesScheduled}</p>
            <p className="text-xs text-slate-400">Totalt schemalagda</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="schedulingTimeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString('sv-SE', { 
                month: 'short', 
                day: 'numeric' 
              })}
            />
            
            <YAxis 
              yAxisId="time"
              stroke="#9ca3af"
              fontSize={12}
              label={{ 
                value: 'Timmar', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#9ca3af', fontSize: '12px' }
              }}
            />
            
            <YAxis 
              yAxisId="efficiency"
              orientation="right"
              stroke="#9ca3af"
              fontSize={12}
              label={{ 
                value: 'Effektivitet %', 
                angle: 90, 
                position: 'insideRight',
                style: { textAnchor: 'middle', fill: '#9ca3af', fontSize: '12px' }
              }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              yAxisId="time"
              type="monotone"
              dataKey="avg_scheduling_time_hours"
              stroke="#3b82f6"
              fillOpacity={1}
              fill="url(#schedulingTimeGradient)"
              strokeWidth={2}
            />
            
            <Line
              yAxisId="efficiency"
              type="monotone"
              dataKey="efficiency_score"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-slate-400">Schemaläggnningstid (timmar)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-slate-400">Effektivitetsindex (%)</span>
        </div>
      </div>
    </div>
  );
};

export default SchedulingEfficiencyChart;