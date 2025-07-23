// 📁 src/components/admin/coordinator/UnplannedCasesPanel.tsx
// ⭐ VERSION 1.0 - VISAR LISTA MED OPLANERADE ÄRENDEN ⭐

import React from 'react';
import { BeGoneCaseRow } from '../../../types/database';
import { User, MapPin, AlertCircle, CalendarPlus } from 'lucide-react';

interface UnplannedCasesPanelProps {
  unplannedCases: BeGoneCaseRow[];
  // Vi lägger till onCaseClick för att kunna öppna modalen även härifrån
  onCaseClick: (caseData: BeGoneCaseRow) => void;
}

// En enskild rad/kort för ett oplanerat ärende
const UnplannedCaseItem: React.FC<{ caseData: BeGoneCaseRow; onClick: () => void }> = ({ caseData, onClick }) => {
  const { title, kontaktperson, adress, skadedjur } = caseData;
  const fullAddress = typeof adress === 'object' && adress?.formatted_address ? adress.formatted_address : (typeof adress === 'string' ? adress : 'Adress saknas');

  return (
    <div 
      onClick={onClick}
      className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-lg mb-2 hover:bg-slate-700/50 hover:border-blue-500/50 transition-all cursor-pointer"
    >
      <h4 className="font-bold text-white text-sm truncate">{title}</h4>
      <div className="mt-2 space-y-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{kontaktperson || 'Kontaktperson saknas'}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{fullAddress}</span>
        </div>
        {skadedjur && (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{skadedjur}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function UnplannedCasesPanel({ unplannedCases, onCaseClick }: UnplannedCasesPanelProps) {
  return (
    <div className="space-y-2">
      {unplannedCases.length > 0 ? (
        unplannedCases.map(caseData => (
          <UnplannedCaseItem key={caseData.id} caseData={caseData} onClick={() => onCaseClick(caseData)} />
        ))
      ) : (
        <div className="text-center py-8 px-4 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
          <CalendarPlus className="mx-auto w-8 h-8 text-slate-600 mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">Inga oplanerade ärenden</h3>
          <p className="text-xs text-slate-500">Alla ärenden är schemalagda.</p>
        </div>
      )}
    </div>
  );
}