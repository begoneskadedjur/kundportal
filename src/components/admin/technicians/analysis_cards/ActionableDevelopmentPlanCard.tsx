// src/components/admin/technicians/analysis_cards/ActionableDevelopmentPlanCard.tsx
import React from 'react';
import type { AIActionableDevelopmentPlan } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { Target } from 'lucide-react';

const getPriorityClass = (priority: 'Hög' | 'Medium' | 'Låg') => {
  switch (priority) {
    case 'Hög': return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'Medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    case 'Låg': return 'bg-green-500/20 text-green-300 border-green-500/30';
  }
};

const ActionableDevelopmentPlanCard: React.FC<{ plan: AIActionableDevelopmentPlan }> = ({ plan }) => {
  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <Target className="w-6 h-6 text-purple-400" />
        <h3 className="text-xl font-semibold text-white">Handlingsplan - Nästa 30 Dagar</h3>
      </div>
      <div className="p-4 rounded-lg bg-purple-500/10 mb-6 border border-purple-500/20">
        <p className="text-sm font-semibold text-purple-300 mb-1">Huvudfokus:</p>
        <p className="text-white font-medium">{plan.primary_focus_30_days}</p>
      </div>
      <div className="space-y-4">
        {plan.actions.map((action, index) => (
          <div key={index} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex justify-between items-start mb-2 gap-4">
              <p className="font-semibold text-slate-200 flex-1 pr-4">{action.action}</p>
              <span className={`text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${getPriorityClass(action.priority)}`}>
                {action.priority} Prioritet
              </span>
            </div>
            <div className="text-sm text-slate-400 space-y-2 mt-3 border-t border-slate-600 pt-3">
              <p><span className="font-semibold text-slate-300">Förväntat resultat:</span> {action.expected_outcome}</p>
              <p><span className="font-semibold text-slate-300">Hur vi mäter:</span> {action.how_to_measure}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ActionableDevelopmentPlanCard;