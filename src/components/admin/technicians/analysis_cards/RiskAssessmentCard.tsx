// src/components/admin/technicians/analysis_cards/RiskAssessmentCard.tsx
import React from 'react';
import type { AIRiskAssessment } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const RiskAssessmentCard: React.FC<{ assessment: AIRiskAssessment }> = ({ assessment }) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <h3 className="text-xl font-semibold text-white">Riskbedömning</h3>
      </div>
      <div className="space-y-3">
        {assessment.key_risks.map((risk, index) => (
          <div key={index} className="p-3 bg-red-500/10 rounded-lg">
            <p className="font-semibold text-red-300">Risk: {risk.risk}</p>
            <div className="flex items-start gap-2 text-sm text-slate-300 mt-2 pt-2 border-t border-red-500/20">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{risk.mitigation_strategy}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default RiskAssessmentCard;