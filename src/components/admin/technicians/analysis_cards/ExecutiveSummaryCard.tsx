// src/components/admin/technicians/analysis_cards/ExecutiveSummaryCard.tsx
import React from 'react';
import type { AIExecutiveSummary } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { Bot } from 'lucide-react';

const ExecutiveSummaryCard: React.FC<{ summary: AIExecutiveSummary }> = ({ summary }) => {
  return (
    <Card className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <Bot className="w-6 h-6 text-orange-400" />
        <h3 className="text-xl font-bold text-orange-400">{summary.headline}</h3>
      </div>
      <p className="text-slate-300 leading-relaxed">{summary.summary}</p>
    </Card>
  );
};

export default ExecutiveSummaryCard;