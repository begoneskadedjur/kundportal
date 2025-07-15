// src/components/admin/technicians/analysis_cards/PerformanceDashboardCard.tsx
import React from 'react';
import type { AIPerformanceDashboard } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { BarChart3, TrendingUp, TrendingDown, Award } from 'lucide-react';

const getComparisonColor = (value: number) => {
  if (value > 5) return 'text-green-400';
  if (value < -5) return 'text-red-400';
  return 'text-slate-400';
};

const PerformanceDashboardCard: React.FC<{ dashboard: AIPerformanceDashboard }> = ({ dashboard }) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="w-6 h-6 text-blue-400" />
        <h3 className="text-xl font-semibold text-white">Prestandapanel</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-800/50 text-center flex flex-col justify-center items-center">
          <p className="text-sm text-slate-400">Samlat Betyg</p>
          <p className="text-5xl font-bold text-blue-300 mt-1 flex items-center gap-2">
            <Award className="w-8 h-8" />
            {dashboard.overall_performance_grade}
          </p>
        </div>
        {dashboard.key_metrics.map((metric, index) => (
          <div key={index} className="p-4 rounded-lg bg-slate-800/50">
            <p className="text-sm text-slate-400">{metric.metric}</p>
            <p className="text-2xl font-bold text-white mt-1">{metric.value}</p>
            {typeof metric.comparison_to_team_avg === 'number' && (
              <div className={`flex items-center text-xs mt-2 font-semibold ${getComparisonColor(metric.comparison_to_team_avg)}`}>
                {metric.comparison_to_team_avg > 5 && <TrendingUp className="w-4 h-4 mr-1" />}
                {metric.comparison_to_team_avg < -5 && <TrendingDown className="w-4 h-4 mr-1" />}
                <span>{metric.comparison_to_team_avg.toFixed(0)}% vs. teamet</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default PerformanceDashboardCard;