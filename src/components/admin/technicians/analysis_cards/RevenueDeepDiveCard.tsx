// src/components/admin/technicians/analysis_cards/RevenueDeepDiveCard.tsx
import React from 'react';
import type { AIRevenueDeepDive } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { Briefcase, Home, FileText, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatters';

const RevenueDeepDiveCard: React.FC<{ deepDive: AIRevenueDeepDive }> = ({ deepDive }) => {
  const icons = {
    Privat: <Home className="w-5 h-5 text-cyan-400" />,
    Företag: <Briefcase className="w-5 h-5 text-blue-400" />,
    Avtal: <FileText className="w-5 h-5 text-indigo-400" />,
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <DollarSign className="w-6 h-6 text-green-400" />
        <h3 className="text-xl font-semibold text-white">Intäktsanalys</h3>
      </div>
      <div className="space-y-3 mb-4">
        {deepDive.breakdown.map((item) => (
          <div key={item.source} className="p-4 rounded-lg bg-slate-800/50 flex items-center gap-4">
            <div className="flex-shrink-0">{icons[item.source]}</div>
            <div className="flex-1">
              <p className="font-semibold text-slate-200">{item.source}</p>
              <p className="text-xs text-slate-400">{item.case_count} ärenden</p>
            </div>
            <div className="text-right">
                <p className="font-bold text-lg text-white">{formatCurrency(item.revenue)}</p>
                <p className="text-xs text-slate-400">{formatCurrency(item.avg_value)} / ärende</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <p className="text-sm font-semibold text-green-300 mb-1">AI-Insikt:</p>
        <p className="text-sm text-slate-300">{deepDive.profitability_analysis}</p>
      </div>
    </Card>
  );
};

export default RevenueDeepDiveCard;