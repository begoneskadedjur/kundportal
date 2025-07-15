// src/components/admin/technicians/analysis_cards/StrengthsAndDevelopmentCard.tsx
import React from 'react';
import type { AIStrength, AIDevelopmentArea } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { CheckCircle, Zap } from 'lucide-react';

const StrengthsAndDevelopmentCard: React.FC<{ strengths: AIStrength[], developmentAreas: AIDevelopmentArea[] }> = ({ strengths, developmentAreas }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-semibold text-white">Styrkor</h3>
        </div>
        <div className="space-y-4">
          {strengths.map((item, index) => (
            <div key={index} className="p-3 bg-slate-800/50 rounded-lg">
              <p className="font-semibold text-green-300">{item.area}</p>
              <p className="text-sm text-slate-300 mt-1">{item.description}</p>
              <p className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">Bevis: {item.evidence}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-yellow-400" />
          <h3 className="text-xl font-semibold text-white">Utvecklingsområden</h3>
        </div>
        <div className="space-y-4">
          {developmentAreas.map((item, index) => (
            <div key={index} className="p-3 bg-slate-800/50 rounded-lg">
              <p className="font-semibold text-yellow-300">{item.area}</p>
              <p className="text-sm text-slate-300 mt-1">{item.description}</p>
              <p className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">Potential: {item.potential_impact}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default StrengthsAndDevelopmentCard;