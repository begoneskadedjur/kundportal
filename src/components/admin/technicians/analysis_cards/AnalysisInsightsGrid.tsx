// src/components/admin/technicians/analysis_cards/AnalysisInsightsGrid.tsx
import React from 'react';
import type { AISpecializationAnalysis, AIHistoricalTrends } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { Droplet, TrendingUp, Clock } from 'lucide-react';

export const SpecializationCard: React.FC<{ analysis: AISpecializationAnalysis }> = ({ analysis }) => (
  <Card className="p-6 h-full">
    <div className="flex items-center gap-3 mb-3">
      <Droplet className="w-5 h-5 text-rose-400" />
      <h4 className="text-lg font-semibold text-white">Huvudspecialisering</h4>
    </div>
    <p className="text-2xl font-bold text-rose-300">{analysis.primary_specialization}</p>
    <p className="text-sm text-slate-400 mt-2">{analysis.recommendation}</p>
  </Card>
);

export const HistoricalTrendsCard: React.FC<{ trends: AIHistoricalTrends }> = ({ trends }) => (
  <Card className="p-6 h-full">
    <div className="flex items-center gap-3 mb-3">
      <Clock className="w-5 h-5 text-lime-400" />
      <h4 className="text-lg font-semibold text-white">Historisk Trend</h4>
    </div>
    <p className="text-2xl font-bold capitalize text-lime-300">{trends.six_month_revenue_trend}</p>
    <p className="text-sm text-slate-400 mt-2">{trends.trend_analysis}</p>
  </Card>
);